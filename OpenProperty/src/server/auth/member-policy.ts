import { canManage, type MembershipRole } from "./roles";

export type MemberDecision = { ok: true } | { ok: false; error: string };

export function decideInvite(actor: MembershipRole, targetRole: MembershipRole): MemberDecision {
  if (!canManage(actor)) return denied();
  if (targetRole === "owner" && actor !== "owner") {
    return { ok: false, error: "Only an owner can grant the owner role" };
  }
  return { ok: true };
}

export function decideRoleChange(input: {
  actor: MembershipRole;
  targetRole: MembershipRole;
  nextRole: MembershipRole;
  ownerCount: number;
}): MemberDecision {
  if (!canManage(input.actor)) return denied();
  if (input.actor !== "owner" && (input.targetRole === "owner" || input.nextRole === "owner")) {
    return { ok: false, error: "Only an owner can change the owner role" };
  }
  if (input.targetRole === "owner" && input.nextRole !== "owner" && input.ownerCount <= 1) {
    return { ok: false, error: "The organization must keep at least one owner" };
  }
  return { ok: true };
}

export function decideRemove(input: {
  actor: MembershipRole;
  targetRole: MembershipRole;
  ownerCount: number;
}): MemberDecision {
  if (!canManage(input.actor)) return denied();
  if (input.targetRole === "owner" && input.actor !== "owner") {
    return { ok: false, error: "Only an owner can remove an owner" };
  }
  if (input.targetRole === "owner" && input.ownerCount <= 1) {
    return { ok: false, error: "The organization must keep at least one owner" };
  }
  return { ok: true };
}

function denied(): MemberDecision {
  return { ok: false, error: "Insufficient permissions" };
}
