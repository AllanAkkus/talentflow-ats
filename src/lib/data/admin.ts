import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Organization, UserRole } from "@/types/database";

/**
 * Platform-admin read model. Only used by /admin/* pages, which are guarded by
 * `requireAdminContext()`.
 *
 * Reads go through the caller's own RLS-bound client wherever possible - an
 * admin passes `tf_is_admin()` so they legitimately see every tenant. The
 * service-role client is used for exactly one thing: reading email addresses,
 * which live in `auth.users` and are not exposed to normal clients.
 */

export type OrganizationOverview = Organization & {
  userCount: number;
  jobCount: number;
  candidateCount: number;
  applicationCount: number;
};

export async function listOrganizationOverview(): Promise<
  OrganizationOverview[]
> {
  const supabase = await createClient();

  const [
    { data: organizations },
    { data: profiles },
    { data: jobs },
    { data: candidates },
    { data: applications },
  ] = await Promise.all([
    supabase.from("organizations").select("*").order("name"),
    supabase.from("profiles").select("organization_id"),
    supabase.from("jobs").select("organization_id"),
    supabase.from("candidates").select("organization_id"),
    supabase.from("applications").select("organization_id"),
  ]);

  const tally = (rows: { organization_id: string | null }[] | null) => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) {
      if (!row.organization_id) continue;
      counts.set(
        row.organization_id,
        (counts.get(row.organization_id) ?? 0) + 1,
      );
    }
    return counts;
  };

  const userCounts = tally(profiles);
  const jobCounts = tally(jobs);
  const candidateCounts = tally(candidates);
  const applicationCounts = tally(applications);

  return (organizations ?? []).map((organization) => ({
    ...organization,
    userCount: userCounts.get(organization.id) ?? 0,
    jobCount: jobCounts.get(organization.id) ?? 0,
    candidateCount: candidateCounts.get(organization.id) ?? 0,
    applicationCount: applicationCounts.get(organization.id) ?? 0,
  }));
}

export type PlatformUser = {
  id: string;
  fullName: string;
  role: UserRole;
  email: string | null;
  lastSignInAt: string | null;
  createdAt: string;
  organizationId: string | null;
  organizationName: string | null;
};

export async function listPlatformUsers(): Promise<PlatformUser[]> {
  const supabase = await createClient();

  const [{ data: profiles }, { data: organizations }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("organizations").select("id, name"),
  ]);

  const organizationName = new Map(
    (organizations ?? []).map((organization) => [
      organization.id,
      organization.name,
    ]),
  );

  // Email and last-sign-in only exist in auth.users, so this one lookup needs
  // the service-role key. It runs on the server and only the fields below are
  // sent to the browser.
  const admin = createAdminClient();
  const { data: authUsers } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const authById = new Map(
    (authUsers?.users ?? []).map((user) => [user.id, user]),
  );

  return (profiles ?? []).map((profile) => {
    const authUser = authById.get(profile.id);
    return {
      id: profile.id,
      fullName: profile.full_name,
      role: profile.role,
      email: authUser?.email ?? null,
      lastSignInAt: authUser?.last_sign_in_at ?? null,
      createdAt: profile.created_at,
      organizationId: profile.organization_id,
      organizationName: profile.organization_id
        ? (organizationName.get(profile.organization_id) ?? null)
        : null,
    };
  });
}
