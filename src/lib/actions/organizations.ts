"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { describeDatabaseError, type FormState } from "@/lib/actions/state";
import { getSessionContext } from "@/lib/auth/session";
import { ACTIVE_ORG_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrors,
  organizationSchema,
  uuidSchema,
} from "@/lib/validation/schemas";

/**
 * Organization management. Platform-admin only, enforced here *and* by the
 * `organizations_insert/update/delete` RLS policies, which require
 * `tf_is_admin()`. A customer calling this action directly gets nothing.
 */

async function requireAdmin() {
  const session = await getSessionContext();
  if (!session) return "Your session has expired. Sign in again.";
  if (session.profile.role !== "admin") {
    return "Only platform admins can manage organizations.";
  }
  return session;
}

export async function createOrganizationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = { name: String(formData.get("name") ?? "") };

  const session = await requireAdmin();
  if (typeof session === "string") {
    return { status: "error", message: session, values: raw };
  }

  const parsed = organizationSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: parsed.data.name })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        errors: { name: "An organization with that name already exists" },
        values: raw,
      };
    }
    return { status: "error", message: describeDatabaseError(error), values: raw };
  }

  // Switch straight into the new organization: the next thing an admin does is
  // almost always create a job or a user for it.
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, data.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/", "layout");
  return {
    status: "success",
    message: `${parsed.data.name} created. You are now viewing it.`,
  };
}

export async function renameOrganizationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = { name: String(formData.get("name") ?? "") };
  const organizationId = uuidSchema.safeParse(
    String(formData.get("organizationId") ?? ""),
  );

  const session = await requireAdmin();
  if (typeof session === "string") {
    return { status: "error", message: session, values: raw };
  }

  if (!organizationId.success) {
    return { status: "error", message: "Unknown organization.", values: raw };
  }

  const parsed = organizationSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name: parsed.data.name })
    .eq("id", organizationId.data);

  if (error) {
    return { status: "error", message: describeDatabaseError(error), values: raw };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Organization renamed." };
}
