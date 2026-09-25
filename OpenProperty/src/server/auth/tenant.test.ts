import { describe, expect, it } from "vitest";
import type { MembershipRow } from "./tenant";
import { pickTenantFromMemberships } from "./tenant";

const orgA: MembershipRow = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  organizationName: "Org A",
  organizationSlug: "org-a",
  role: "owner",
};

const orgB: MembershipRow = {
  organizationId: "00000000-0000-4000-8000-000000000002",
  organizationName: "Org B",
  organizationSlug: "org-b",
  role: "viewer",
};

describe("pickTenantFromMemberships (org isolation)", () => {
  it("rejects a foreign organization id when user belongs to multiple orgs", () => {
    const tenant = pickTenantFromMemberships([orgA, orgB], orgB.organizationId);
    expect(tenant).toEqual({
      organizationId: orgB.organizationId,
      role: "viewer",
    });

    const foreign = pickTenantFromMemberships(
      [orgA, orgB],
      "00000000-0000-4000-8000-000000000099",
    );
    expect(foreign).toBeNull();
  });

  it("does not resolve to a foreign org id (stale header falls back to sole membership)", () => {
    const tenant = pickTenantFromMemberships([orgA], orgB.organizationId);
    expect(tenant?.organizationId).toBe(orgA.organizationId);
    expect(tenant?.organizationId).not.toBe(orgB.organizationId);
  });

  it("falls back to sole membership when header points at another org", () => {
    const tenant = pickTenantFromMemberships(
      [orgA],
      "00000000-0000-4000-8000-000000000099",
    );
    expect(tenant).toEqual({ organizationId: orgA.organizationId, role: "owner" });
  });

  it("requires explicit org when user has multiple memberships and no header", () => {
    expect(pickTenantFromMemberships([orgA, orgB], null)).toBeNull();
  });

  it("auto-selects when user has exactly one membership", () => {
    expect(pickTenantFromMemberships([orgA], null)).toEqual({
      organizationId: orgA.organizationId,
      role: "owner",
    });
  });
});
