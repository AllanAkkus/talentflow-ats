import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export type SessionContext = {
  userId: string;
  email: string;
  profile: Profile;
};

/**
 * Resolve the signed-in user and their profile.
 *
 * Uses `auth.getUser()` rather than `auth.getSession()` on purpose:
 * `getUser()` revalidates the JWT against Supabase, so a forged or expired
 * cookie cannot produce a logged-in session.
 *
 * Returns null when there is no usable session - callers decide whether that is
 * a redirect (pages) or a 401 (API routes).
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // Auth user exists but has no application profile. Treated as not signed in
    // rather than crashing: the user has no role, so there is nothing they may
    // do. See PROJECT_LOG.md for how this is avoided when creating accounts.
    return null;
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    profile,
  };
}

/** Page-level guard. Redirects to /login when there is no session. */
export async function requireSessionContext(): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/** Page-level guard for admin-only screens. */
export async function requireAdminContext(): Promise<SessionContext> {
  const session = await requireSessionContext();
  if (session.profile.role !== "admin") {
    redirect("/dashboard");
  }
  return session;
}
