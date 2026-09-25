import { z } from "zod";
import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { buildUpdate, get, normalizeRow, normalizeRows, orgId, query, run, uuidParam } from "../pg";
import { parseJson } from "../validation";

export function mountVendorsRoutes(app: Hono<AppEnv>) {
  const VendorInput = z.object({
    name: z.string().min(1),
    category: z
      .enum(["plumber", "electrician", "hvac", "handyman", "cleaning", "landscaping", "general"])
      .optional(),
    phone: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    color: z.string().optional(),
  });

  app.get("/api/vendors", async (c) => {
    const o = orgId(c);
    const rows = await query(c, "SELECT * FROM vendors WHERE organization_id = $1 ORDER BY name", [
      o,
    ]);
    return c.json({ vendors: normalizeRows(rows) });
  });

  app.post("/api/vendors", async (c) => {
    const parsed = await parseJson(c, VendorInput);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const d = parsed.data;
    const o = orgId(c);
    const row = await get(
      c,
      `INSERT INTO vendors (organization_id, name, category, phone, email, notes, color)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        o,
        d.name,
        d.category ?? "general",
        d.phone ?? null,
        d.email ?? null,
        d.notes ?? null,
        d.color ?? "slate",
      ],
    );
    return c.json({ vendor: normalizeRow(row as Record<string, unknown>) }, 201);
  });

  app.put("/api/vendors/:id", async (c) => {
    const id = uuidParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const parsed = await parseJson(c, VendorInput.partial());
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const { sets, params, next } = buildUpdate(parsed.data);
    if (!sets.length) return c.json({ error: "No fields" }, 400);
    const o = orgId(c);
    params.push(id, o);
    const r = await run(
      c,
      `UPDATE vendors SET ${sets.join(", ")} WHERE id = $${next} AND organization_id = $${next + 1}`,
      params,
    );
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    const row = await get(c, "SELECT * FROM vendors WHERE id = $1 AND organization_id = $2", [
      id,
      o,
    ]);
    return c.json({ vendor: normalizeRow(row as Record<string, unknown>) });
  });

  app.delete("/api/vendors/:id", async (c) => {
    const id = uuidParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const o = orgId(c);
    const r = await run(c, "DELETE FROM vendors WHERE id = $1 AND organization_id = $2", [id, o]);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
}
