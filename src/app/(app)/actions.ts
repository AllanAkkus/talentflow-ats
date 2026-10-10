"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getSessionContext } from "@/lib/auth/session";
import { ACTIVE_ORG_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/schemas";

/**
 * Switch which organization a platform admin is operating as.
 *
 * The cookie is only a *hint*. It is re-validated on every request by
 * `resolveActiveOrganizationId`, and for a customer it is ignored outright, so
 * editing the cookie by hand cannot grant access to another tenant. Setting it
 * still requires being an admin, and the organization must exist.
 */
export async function setActiveOrganizationAction(
  formData: FormData,
): Promise<void> {
  const session = await getSessionContext();
  if (!session || session.profile.role !== "admin") {
    return;
  }

  const parsed = uuidSchema.safeParse(String(formData.get("organizationId") ?? ""));
  if (!parsed.success) {
    return;
  }

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", parsed.data)
    .maybeSingle();

  if (!organization) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, organization.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/", "layout");
}
