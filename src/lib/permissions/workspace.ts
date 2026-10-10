import "server-only";

import { cookies } from "next/headers";

import { getSessionContext, type SessionContext } from "@/lib/auth/session";
import { ACTIVE_ORG_COOKIE } from "@/lib/constants";
import { resolveActiveOrganizationId } from "@/lib/permissions/access";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/types/database";

/**
 * A "workspace" is everything a page needs in order to render the right tenant:
 * who is signed in, which organization is active, and (for admins) the list of
 * organizations they can switch between.
 *
 * The organization list is fetched through the RLS-protected client, so a
 * customer only ever gets their own organization back - the admin switcher is
 * literally empty of other tenants for them, not just hidden by CSS.
 */
export type Workspace = {
  session: SessionContext;
  isAdmin: boolean;
  organizationId: string | null;
  organization: Organization | null;
  organizations: Organization[];
};

export async function getWorkspace(): Promise<Workspace | null> {
  const session = await getSessionContext();
  if (!session) return null;

  const supabase = await createClient();
  const { data: organizations } = await supabase
    .from("organizations")
    .select("*")
    .order("name", { ascending: true });

  const list = organizations ?? [];
  const cookieStore = await cookies();
  const requested = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;

  const organizationId = resolveActiveOrganizationId(
    session.profile,
    requested,
    list.map((organization) => organization.id),
  );

  return {
    session,
    isAdmin: session.profile.role === "admin",
    organizationId,
    organization: list.find((o) => o.id === organizationId) ?? null,
    organizations: list,
  };
}

/**
 * Same as getWorkspace but guarantees a session. Used by the authenticated
 * layout, which already redirects unauthenticated visitors to /login.
 */
export async function requireWorkspace(): Promise<Workspace> {
  const workspace = await getWorkspace();
  if (!workspace) {
    // The (app) layout guards every page under it, so reaching this means the
    // session disappeared mid-render.
    throw new Error("Not authenticated");
  }
  return workspace;
}
