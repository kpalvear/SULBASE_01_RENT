import { describe, expect, it } from "vitest";
import { canManage, canMutate, roleAtLeast } from "./roles";
import { slugifyOrganizationName } from "./tenant";

describe("membership roles", () => {
  it("ranks roles for mutation and management", () => {
    expect(canMutate("viewer")).toBe(false);
    expect(canMutate("staff")).toBe(true);
    expect(canManage("staff")).toBe(false);
    expect(canManage("manager")).toBe(true);
    expect(roleAtLeast("owner", "manager")).toBe(true);
  });
});

describe("slugifyOrganizationName", () => {
  it("normalizes names for organization slugs", () => {
    expect(slugifyOrganizationName("Acme Properties")).toBe("acme-properties");
    expect(slugifyOrganizationName("  ")).toBe("org");
  });
});
