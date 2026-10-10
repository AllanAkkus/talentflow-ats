import "server-only";

import { getWorkspace } from "@/lib/permissions/workspace";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/types/database";

export type WriteContext = {
  supabase: SupabaseClient<Database>;
  organizationId: string;
  profile: Profile;
};

/**
 * Resolves "who is writing, and to which tenant" for a mutation.
 *
 * Returns a string instead of throwing when the request cannot proceed, so
 * server actions can turn it into an inline form error. Never trusts an
 * organization id from the client: it always comes from the server-resolved
 * workspace (the customer's own profile, or an admin's validated selection).
 */
export async function getWriteContext(): Promise<WriteContext | string> {
  const workspace = await getWorkspace();

  if (!workspace) {
    return "Your session has expired. Sign in again.";
  }

  if (!workspace.organizationId) {
    return workspace.isAdmin
      ? "Select an organization first - create one under Organizations."
      : "Your account is not linked to an organization yet. Contact your administrator.";
  }

  const supabase = await createClient();

  return {
    supabase,
    organizationId: workspace.organizationId,
    profile: workspace.session.profile,
  };
}
