import { z } from "zod";
import type { Hono } from "hono";
import type { AppEnv } from "../env";
import {
  buildUpdate,
  get,
  normalizeRow,
  normalizeRows,
  orgId,
  query,
  run,
  uuidParam,
  type SqlParam,
} from "../pg";
import { parseJson } from "../validation";

export function mountPropertiesRoutes(app: Hono<AppEnv>) {
const PropertyInput = z.object({
  name: z.string().min(1),
  type: z.enum(["single_family", "multi_family", "condo", "townhouse", "commercial"]).optional(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  year_built: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  color: z.string().optional(),
});

app.get("/api/properties", async (c) => {
  const o = orgId(c);
  const rows = await query(
    c,
    `SELECT p.*,
       (SELECT COUNT(*)::int FROM units u WHERE u.property_id = p.id AND u.organization_id = p.organization_id) as unit_count,
       (SELECT COUNT(*)::int FROM units u WHERE u.property_id = p.id AND u.organization_id = p.organization_id AND u.status = 'occupied') as occupied_count
     FROM properties p WHERE p.organization_id = $1 ORDER BY p.name`,
    [o],
  );
  return c.json({ properties: normalizeRows(rows) });
});

app.get("/api/properties/:id", async (c) => {
  const id = uuidParam(c.req.param("id"));
  if (!id) return c.json({ error: "Invalid ID" }, 400);
  const o = orgId(c);
  const row = await get(c, "SELECT * FROM properties WHERE id = $1 AND organization_id = $2", [id, o]);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ property: normalizeRow(row as Record<string, unknown>) });
});

app.post("/api/properties", async (c) => {
  const parsed = await parseJson(c, PropertyInput);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const d = parsed.data;
  const o = orgId(c);
  const row = await get(
    c,
    `INSERT INTO properties (organization_id, name, type, address, city, state, zip, year_built, notes, color)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      o,
      d.name,
      d.type ?? "single_family",
      d.address ?? null,
      d.city ?? null,
      d.state ?? null,
      d.zip ?? null,
      d.year_built ?? null,
      d.notes ?? null,
      d.color ?? "sky",
    ],
  );
  return c.json({ property: normalizeRow(row as Record<string, unknown>) }, 201);
});

app.put("/api/properties/:id", async (c) => {
  const id = uuidParam(c.req.param("id"));
  if (!id) return c.json({ error: "Invalid ID" }, 400);
  const parsed = await parseJson(c, PropertyInput.partial());
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const { sets, params, next } = buildUpdate(parsed.data);
  if (!sets.length) return c.json({ error: "No fields" }, 400);
  const o = orgId(c);
  params.push(id, o);
  const r = await run(
    c,
    `UPDATE properties SET ${sets.join(", ")} WHERE id = $${next} AND organization_id = $${next + 1}`,
    params,
  );
  if (!r.changes) return c.json({ error: "Not found" }, 404);
  const row = await get(c, "SELECT * FROM properties WHERE id = $1 AND organization_id = $2", [id, o]);
  return c.json({ property: normalizeRow(row as Record<string, unknown>) });
});

app.delete("/api/properties/:id", async (c) => {
  const id = uuidParam(c.req.param("id"));
  if (!id) return c.json({ error: "Invalid ID" }, 400);
  const o = orgId(c);
  const r = await run(c, "DELETE FROM properties WHERE id = $1 AND organization_id = $2", [id, o]);
  if (!r.changes) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});
}
