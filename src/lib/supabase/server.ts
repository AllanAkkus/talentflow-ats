import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Authenticated server client for Server Components, Server Actions and route
 * handlers.
 *
 * It uses the anon key plus the session cookie, which means it is still subject
 * to Row Level Security. That is deliberate: server code runs under the
 * caller's identity, so a bug in a query cannot leak another tenant's data.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. Token refresh is handled by
          // middleware.ts, which runs before every request, so ignoring this is
          // safe and is the pattern Supabase documents.
        }
      },
    },
  });
}
