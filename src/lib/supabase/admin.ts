import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { supabaseUrl } from "@/lib/env";
import { supabaseServiceRoleKey } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Service-role client. BYPASSES Row Level Security completely and can call the
 * Supabase Auth Admin API.
 *
 * Only used for things that genuinely cannot be done as a normal user:
 *   * creating auth users (admin creating customer/admin accounts)
 *   * writing the matching profile row for a brand new user
 *   * the local seed/create-admin scripts
 *
 * The `server-only` import above makes the build fail if this module is ever
 * pulled into a client component, which is the guardrail that keeps the key out
 * of the browser bundle.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
