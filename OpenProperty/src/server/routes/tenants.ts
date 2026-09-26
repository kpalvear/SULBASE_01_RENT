import { z } from "zod";
import type { Hono } from "hono";
import { collectCascadeKeys, deleteR2Keys } from "../documents/storage";
import type { AppEnv } from "../env";
import { buildUpdate, get, normalizeRow, normalizeRows, orgId, query, run, uuidParam } from "../pg";
import { parseJson } from "../validation";

export function mountTenantsRoutes(app: Hono<AppEnv>) {
  const TenantInput = z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    date_of_birth: z.string().optional().nullable(),
    emergency_contact: z.string().optional().nullable(),
    employer: z.string().optional().nullable(),
    monthly_income: z.number().optional().nullable(),
    notes: z.string().optional().nullable(),
  });

  const TENANT_EXTRA = `
       (SELECT u.id FROM leases l LEFT JOIN units u ON u.id = l.unit_id AND u.organization_id = l.organization_id
          WHERE l.primary_tenant_id = t.id AND l.organization_id = t.organization_id AND l.status = 'active' LIMIT 1) as active_unit_id,
       (SELECT u.name FROM leases l LEFT JOIN units u ON u.id = l.unit_id AND u.organization_id = l.organization_id
          WHERE l.primary_tenant_id = t.id AND l.organization_id = t.organization_id AND l.status = 'active' LIMIT 1) as active_unit_name,
       (SELECT p.name FROM leases l LEFT JOIN units u ON u.id = l.unit_id AND u.organization_id = l.organization_id LEFT JOIN properties p ON p.id = u.property_id AND p.organization_id = u.organization_id
          WHERE l.primary_tenant_id = t.id AND l.organization_id = t.organization_id AND l.status = 'active' LIMIT 1) as active_property_name`;

  app.get("/api/tenants", async (c) => {
    const o = orgId(c);
    const search = c.req.query("q")?.trim();
    if (search) {
      const like = `%${search}%`;
      const rows = await query(
        c,
        `SELECT t.*, ${TENANT_EXTRA}
       FROM tenants t
       WHERE t.organization_id = $1 AND (t.last_name ILIKE $2 OR t.first_name ILIKE $2 OR t.email ILIKE $2 OR t.phone ILIKE $2)
       ORDER BY t.last_name, t.first_name LIMIT 200`,
        [o, like],
      );
      return c.json({ tenants: normalizeRows(rows) });
    }
    const rows = await query(
      c,
      `SELECT t.*, ${TENANT_EXTRA}
     FROM tenants t WHERE t.organization_id = $1 ORDER BY t.last_name, t.first_name LIMIT 500`,
      [o],
    );
    return c.json({ tenants: normalizeRows(rows) });
  });

  app.get("/api/tenants/:id", async (c) => {
    const id = uuidParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const o = orgId(c);
    const row = await get(c, "SELECT * FROM tenants WHERE id = $1 AND organization_id = $2", [
      id,
      o,
    ]);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ tenant: normalizeRow(row as Record<string, unknown>) });
  });

  app.post("/api/tenants", async (c) => {
    const parsed = await parseJson(c, TenantInput);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const d = parsed.data;
    const o = orgId(c);
    const row = await get(
      c,
      `INSERT INTO tenants (organization_id, first_name, last_name, email, phone, date_of_birth, emergency_contact, employer, monthly_income, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        o,
        d.first_name,
        d.last_name,
        d.email ?? null,
        d.phone ?? null,
        d.date_of_birth ?? null,
        d.emergency_contact ?? null,
        d.employer ?? null,
        d.monthly_income != null ? String(d.monthly_income) : null,
        d.notes ?? null,
      ],
    );
    return c.json({ tenant: normalizeRow(row as Record<string, unknown>) }, 201);
  });

  app.put("/api/tenants/:id", async (c) => {
    const id = uuidParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const parsed = await parseJson(c, TenantInput.partial());
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const data = { ...parsed.data };
    if (data.monthly_income !== undefined && data.monthly_income !== null) {
      data.monthly_income = String(data.monthly_income) as unknown as number;
    }
    const { sets, params, next } = buildUpdate(data as Record<string, unknown>);
    if (!sets.length) return c.json({ error: "No fields" }, 400);
    const o = orgId(c);
    params.push(id, o);
    const r = await run(
      c,
      `UPDATE tenants SET ${sets.join(", ")} WHERE id = $${next} AND organization_id = $${next + 1}`,
      params,
    );
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    const row = await get(c, "SELECT * FROM tenants WHERE id = $1 AND organization_id = $2", [
      id,
      o,
    ]);
    return c.json({ tenant: normalizeRow(row as Record<string, unknown>) });
  });

  app.delete("/api/tenants/:id", async (c) => {
    const id = uuidParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const o = orgId(c);
    const keys = await collectCascadeKeys(c, "tenant", id);
    const r = await run(c, "DELETE FROM tenants WHERE id = $1 AND organization_id = $2", [id, o]);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    await deleteR2Keys(c.env, keys);
    return c.json({ ok: true });
  });
}
