import { describe, expect, it } from "vitest";
import { createOrgIsolationSql } from "../test/mock-tenant-sql";
import { createPropertiesTestApp } from "../test/properties-test-app";

const ORG_A = "10000000-0000-4000-8000-000000000001";
const ORG_B = "10000000-0000-4000-8000-000000000002";
const PROP_B = "20000000-0000-4000-8000-000000000010";

const seed = [
  {
    id: PROP_B,
    organization_id: ORG_B,
    name: "Org B only",
    type: "single_family",
    color: "sky",
  },
];

describe("API org isolation (properties)", () => {
  it("returns 404 when tenant org does not own the property", async () => {
    const sql = createOrgIsolationSql(seed);
    const app = createPropertiesTestApp({ orgId: ORG_A, sql });
    const res = await app.request(`/api/properties/${PROP_B}`);
    expect(res.status).toBe(404);
  });

  it("returns property when organization_id matches tenant", async () => {
    const sql = createOrgIsolationSql(seed);
    const app = createPropertiesTestApp({ orgId: ORG_B, sql });
    const res = await app.request(`/api/properties/${PROP_B}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { property: { id: string; name: string } };
    expect(body.property.id).toBe(PROP_B);
    expect(body.property.name).toBe("Org B only");
  });

  it("lists only properties for the active organization", async () => {
    const sql = createOrgIsolationSql(seed);
    const app = createPropertiesTestApp({ orgId: ORG_A, sql });
    const res = await app.request("/api/properties");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { properties: unknown[] };
    expect(body.properties).toHaveLength(0);

    const appB = createPropertiesTestApp({ orgId: ORG_B, sql: createOrgIsolationSql(seed) });
    const resB = await appB.request("/api/properties");
    const bodyB = (await resB.json()) as { properties: { id: string }[] };
    expect(bodyB.properties).toHaveLength(1);
    expect(bodyB.properties[0].id).toBe(PROP_B);
  });

  it("cannot delete a property from another organization", async () => {
    const sql = createOrgIsolationSql(seed);
    const app = createPropertiesTestApp({ orgId: ORG_A, sql });
    const res = await app.request(`/api/properties/${PROP_B}`, { method: "DELETE" });
    expect(res.status).toBe(404);

    const stillThere = createPropertiesTestApp({ orgId: ORG_B, sql });
    const check = await stillThere.request(`/api/properties/${PROP_B}`);
    expect(check.status).toBe(200);
  });
});
