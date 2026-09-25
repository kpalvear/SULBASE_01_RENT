export const MEMBERSHIP_ROLES = ["owner", "manager", "staff", "viewer"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

const RANK: Record<MembershipRole, number> = {
  viewer: 0,
  staff: 1,
  manager: 2,
  owner: 3,
};

export function roleAtLeast(role: MembershipRole, minimum: MembershipRole): boolean {
  return RANK[role] >= RANK[minimum];
}

/** Staff and above may create/update operational records. */
export function canMutate(role: MembershipRole): boolean {
  return roleAtLeast(role, "staff");
}

/** Managers and owners may change org settings and destructive admin actions. */
export function canManage(role: MembershipRole): boolean {
  return roleAtLeast(role, "manager");
}
