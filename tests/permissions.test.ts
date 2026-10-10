import { describe, expect, it } from "vitest";

import {
  canAccessOrganization,
  isPlatformAdmin,
  resolveActiveOrganizationId,
} from "@/lib/permissions/access";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";

const customerA = { role: "customer" as const, organization_id: ORG_A };
const customerB = { role: "customer" as const, organization_id: ORG_B };
const admin = { role: "admin" as const, organization_id: null };

describe("isPlatformAdmin", () => {
  it("is true only for the admin role", () => {
    expect(isPlatformAdmin(admin)).toBe(true);
    expect(isPlatformAdmin(customerA)).toBe(false);
    expect(isPlatformAdmin(null)).toBe(false);
  });
});

describe("canAccessOrganization", () => {
  it("lets a customer into their own organization", () => {
    expect(canAccessOrganization(customerA, ORG_A)).toBe(true);
  });

  it("keeps a customer out of another organization", () => {
    expect(canAccessOrganization(customerA, ORG_B)).toBe(false);
    expect(canAccessOrganization(customerB, ORG_A)).toBe(false);
  });

  it("lets a platform admin into any organization", () => {
    expect(canAccessOrganization(admin, ORG_A)).toBe(true);
    expect(canAccessOrganization(admin, ORG_B)).toBe(true);
  });

  it("denies everything when there is no profile", () => {
    expect(canAccessOrganization(null, ORG_A)).toBe(false);
  });

  it("denies a customer when no organization is given", () => {
    expect(canAccessOrganization(customerA, null)).toBe(false);
    expect(canAccessOrganization(customerA, undefined)).toBe(false);
  });
});

describe("resolveActiveOrganizationId", () => {
  const existing = [ORG_A, ORG_B];

  it("pins a customer to their own organization and ignores the cookie", () => {
    // This is the anti-spoofing case: the request asks for org B, the profile
    // says org A, and org A wins.
    expect(resolveActiveOrganizationId(customerA, ORG_B, existing)).toBe(ORG_A);
    expect(resolveActiveOrganizationId(customerA, null, existing)).toBe(ORG_A);
    expect(
      resolveActiveOrganizationId(customerA, "not-a-uuid", existing),
    ).toBe(ORG_A);
  });

  it("honours a valid selection for an admin", () => {
    expect(resolveActiveOrganizationId(admin, ORG_B, existing)).toBe(ORG_B);
  });

  it("falls back to the first organization when an admin's selection is unknown", () => {
    expect(
      resolveActiveOrganizationId(admin, "33333333-3333-4333-8333-333333333333", existing),
    ).toBe(ORG_A);
    expect(resolveActiveOrganizationId(admin, null, existing)).toBe(ORG_A);
  });

  it("returns null for an admin when no organization exists yet", () => {
    expect(resolveActiveOrganizationId(admin, null, [])).toBeNull();
  });

  it("returns null when there is no profile", () => {
    expect(resolveActiveOrganizationId(null, ORG_A, existing)).toBeNull();
  });
});
