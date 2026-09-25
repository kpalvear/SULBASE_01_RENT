import { eq } from "drizzle-orm";
import { memberships, organizations } from "../../db/schema";
import type { AppDb } from "../db";
import type { MembershipRole } from "./roles";

export type MembershipRow = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: MembershipRole;
};

export async function listMemberships(db: AppDb, userId: string): Promise<MembershipRow[]> {
  const rows = await db
    .select({
      organizationId: memberships.organizationId,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(memberships.userId, userId));

  return rows.map((r) => ({
    organizationId: r.organizationId,
    organizationName: r.organizationName,
    organizationSlug: r.organizationSlug,
    role: r.role as MembershipRole,
  }));
}

export type ResolvedTenant = {
  organizationId: string;
  role: MembershipRole;
};

/**
 * Pick active org from header or sole membership. Never trusts org id without a membership row.
 */
export function pickTenantFromMemberships(
  all: MembershipRow[],
  requestedOrgId: string | null,
): ResolvedTenant | null {
  if (all.length === 0) return null;

  if (requestedOrgId) {
    const match = all.find((m) => m.organizationId === requestedOrgId);
    if (match) {
      return { organizationId: match.organizationId, role: match.role };
    }
    // Stale X-Organization-Id header — fall back if unambiguous.
    if (all.length === 1) {
      return { organizationId: all[0].organizationId, role: all[0].role };
    }
    return null;
  }

  if (all.length === 1) {
    return { organizationId: all[0].organizationId, role: all[0].role };
  }

  return null;
}

export async function resolveTenant(
  db: AppDb,
  userId: string,
  requestedOrgId: string | null,
): Promise<ResolvedTenant | null> {
  const all = await listMemberships(db, userId);
  return pickTenantFromMemberships(all, requestedOrgId);
}

export function slugifyOrganizationName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "org";
}
