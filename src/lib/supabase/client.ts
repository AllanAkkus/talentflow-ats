"use client";

import { createBrowserClient } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Browser client. Uses the anon key, so every query it makes is still filtered
 * by Row Level Security against the signed-in user's JWT.
 *
 * Used for: signing in, signing out, and reacting to auth state. All data
 * mutations go through server actions instead.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
