import { describe, expect, it } from "vitest";
import { decideInvite, decideRemove, decideRoleChange } from "./member-policy";

describe("member policy", () => {
  it("lets owners invite any role and blocks managers from granting owner", () => {
    expect(decideInvite("owner", "owner").ok).toBe(true);
    expect(decideInvite("manager", "staff").ok).toBe(true);
    expect(decideInvite("manager", "owner").ok).toBe(false);
    expect(decideInvite("staff", "viewer").ok).toBe(false);
  });

  it("keeps the last owner and stops a manager from editing owners", () => {
    expect(
      decideRoleChange({
        actor: "owner",
        targetRole: "owner",
        nextRole: "manager",
        ownerCount: 1,
      }).ok,
    ).toBe(false);
    expect(
      decideRoleChange({
        actor: "manager",
        targetRole: "owner",
        nextRole: "owner",
        ownerCount: 2,
      }).ok,
    ).toBe(false);
    expect(
      decideRoleChange({
        actor: "owner",
        targetRole: "staff",
        nextRole: "manager",
        ownerCount: 1,
      }).ok,
    ).toBe(true);
  });

  it("refuses to remove the last owner", () => {
    expect(decideRemove({ actor: "owner", targetRole: "owner", ownerCount: 1 }).ok).toBe(false);
    expect(decideRemove({ actor: "owner", targetRole: "owner", ownerCount: 2 }).ok).toBe(true);
    expect(decideRemove({ actor: "manager", targetRole: "owner", ownerCount: 2 }).ok).toBe(false);
    expect(decideRemove({ actor: "manager", targetRole: "staff", ownerCount: 1 }).ok).toBe(true);
  });
});
