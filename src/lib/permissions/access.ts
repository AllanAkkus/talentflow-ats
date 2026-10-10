import type { Profile } from "@/types/database";

/**
 * Pure authorization helpers. No I/O, no Supabase, no `next/headers` - which is
 * what makes them unit-testable and safe to reuse from both server actions and
 * route handlers.
 */

export function isPlatformAdmin(profile: Pick<Profile, "role"> | null): boolean {
  return profile?.role === "admin";
}

/**
 * Can this profile read/write rows belonging to `organizationId`?
 *
 * Mirrors the RLS policy in supabase/migrations/002_rls_policies.sql. The
 * database is the real boundary; this function exists so the app can return a
 * clean 403 instead of letting a query come back empty and look like a 404.
 */
export function canAccessOrganization(
  profile: Pick<Profile, "role" | "organization_id"> | null,
  organizationId: string | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.role === "admin") return true;
  if (!organizationId) return false;
  return profile.organization_id === organizationId;
}

/**
 * Which organization is this request operating on?
 *
 *  * A customer is always pinned to their own organization. The cookie is
 *    ignored entirely, so tampering with it changes nothing.
 *  * A platform admin may operate "as" any organization. The requested id is
 *    only honoured when it is one that actually exists.
 *  * An admin with no valid selection falls back to the first organization so
 *    the app is usable immediately after login.
 */
export function resolveActiveOrganizationId(
  profile: Pick<Profile, "role" | "organization_id"> | null,
  requestedOrganizationId: string | null | undefined,
  existingOrganizationIds: readonly string[],
): string | null {
  if (!profile) return null;

  if (profile.role === "customer") {
    return profile.organization_id;
  }

  if (
    requestedOrganizationId &&
    existingOrganizationIds.includes(requestedOrganizationId)
  ) {
    return requestedOrganizationId;
  }

  return existingOrganizationIds[0] ?? null;
}
