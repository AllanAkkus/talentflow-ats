import { NextResponse } from "next/server";

import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createUserSchema, fieldErrors } from "@/lib/validation/schemas";

/**
 * POST /api/admin/users
 *
 * Creates a platform admin or a customer user. This has to run on the server
 * because creating an auth user requires the Supabase service-role key, which
 * bypasses RLS and must never reach the browser.
 *
 * Order of checks (all server-side, none of them trusting the request body):
 *   1. Is there a valid session?                       -> 401
 *   2. Does the caller's profile say role = 'admin'?   -> 403
 *   3. Does the payload pass the Zod schema?           -> 422
 *   4. Resolve/create the organization (customers only)
 *   5. Create the auth user with the Admin API
 *   6. Create the matching profile row
 *   7. If step 6 fails, delete the auth user again so we do not leave an
 *      account that can sign in but has no role.
 *
 * Step 7 is a compensating delete, not a transaction: Supabase Auth and the
 * Postgres table cannot be committed atomically from the client side. See
 * CODE_REVIEW_NOTES.md for how this would be made properly transactional.
 */
export async function POST(request: Request) {
  const session = await getSessionContext();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (session.profile.role !== "admin") {
    return NextResponse.json(
      { error: "Only platform admins can create accounts." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const input = parsed.data;
  const admin = createAdminClient();

  // ---------------------------------------------------------------------------
  // 4. Organization
  // ---------------------------------------------------------------------------
  let organizationId: string | null = null;

  if (input.role === "customer") {
    if (input.organizationId) {
      // Read through the caller's own RLS-bound client: an admin can see every
      // organization, so this both validates existence and keeps the check
      // honest if the role model ever changes.
      const supabase = await createClient();
      const { data: organization } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", input.organizationId)
        .maybeSingle();

      if (!organization) {
        return NextResponse.json(
          { error: "That organization does not exist." },
          { status: 422 },
        );
      }
      organizationId = organization.id;
    } else if (input.organizationName) {
      const { data: organization, error } = await admin
        .from("organizations")
        .insert({ name: input.organizationName })
        .select("id")
        .single();

      if (error || !organization) {
        if (error?.code === "23505") {
          return NextResponse.json(
            {
              error:
                "An organization with that name already exists. Pick it from the list instead.",
              fields: { organizationName: "Name already in use" },
            },
            { status: 409 },
          );
        }
        return NextResponse.json(
          { error: "Could not create the organization." },
          { status: 500 },
        );
      }
      organizationId = organization.id;
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Auth user
  // ---------------------------------------------------------------------------
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    // No SMTP is configured in this environment, so the account is confirmed
    // immediately and the admin shares the password out of band. Email
    // invitations are listed as a next step in README.md.
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });

  if (createError || !created?.user) {
    const message = createError?.message ?? "Could not create the account.";
    const alreadyExists = /already (been )?registered|already exists/i.test(message);
    return NextResponse.json(
      {
        error: alreadyExists
          ? "A user with that email already exists."
          : message,
        ...(alreadyExists ? { fields: { email: "Email already in use" } } : {}),
      },
      { status: alreadyExists ? 409 : 500 },
    );
  }

  // ---------------------------------------------------------------------------
  // 6/7. Profile, with compensating delete on failure
  // ---------------------------------------------------------------------------
  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    organization_id: organizationId,
    full_name: input.fullName,
    role: input.role,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      {
        error:
          "The account could not be finished and has been rolled back. Please try again.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      user: {
        id: created.user.id,
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        organizationId,
      },
    },
    { status: 201 },
  );
}
