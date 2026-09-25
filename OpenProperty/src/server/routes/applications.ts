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

export function mountApplicationsRoutes(app: Hono<AppEnv>) {
const ApplicationInput = z.object({
  unit_id: z.string().uuid().nullable().optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  monthly_income: z.number().optional().nullable(),
  employer: z.string().optional().nullable(),
  desired_move_in: z.string().optional().nullable(),
  status: z.enum(["new", "screening", "approved", "declined", "withdrawn"]).optional(),
  notes: z.string().optional().nullable(),
});

const APP_SELECT = `
     FROM applications a
     LEFT JOIN units u ON u.id = a.unit_id AND u.organization_id = a.organization_id
     LEFT JOIN properties p ON p.id = u.property_id AND p.organization_id = u.organization_id`;

app.get("/api/applications", async (c) => {
  const o = orgId(c);
  const rows = await query(
    c,
    `SELECT a.*, u.name as unit_name, p.name as property_name ${APP_SELECT}
     WHERE a.organization_id = $1 ORDER BY a.created_at DESC`,
    [o],
  ).catch(() => []);
  return c.json({ applications: normalizeRows(rows) });
});

app.post("/api/applications", async (c) => {
  const parsed = await parseJson(c, ApplicationInput);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const d = parsed.data;
  const o = orgId(c);
  const inserted = await get<{ id: string }>(
    c,
    `INSERT INTO applications (organization_id, unit_id, first_name, last_name, email, phone, monthly_income, employer, desired_move_in, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [
      o,
      d.unit_id ?? null,
      d.first_name,
      d.last_name,
      d.email ?? null,
      d.phone ?? null,
      d.monthly_income != null ? String(d.monthly_income) : null,
      d.employer ?? null,
      d.desired_move_in ?? null,
      d.status ?? "new",
      d.notes ?? null,
    ],
  );
  if (!inserted?.id) return c.json({ error: "Insert failed" }, 500);
  const row = await get(
    c,
    `SELECT a.*, u.name as unit_name, p.name as property_name ${APP_SELECT} WHERE a.organization_id = $1 AND a.id = $2`,
    [o, inserted.id],
  );
  return c.json({ application: normalizeRow(row as Record<string, unknown>) }, 201);
});

app.put("/api/applications/:id", async (c) => {
  const id = uuidParam(c.req.param("id"));
  if (!id) return c.json({ error: "Invalid ID" }, 400);
  const parsed = await parseJson(c, ApplicationInput.partial());
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
    `UPDATE applications SET ${sets.join(", ")} WHERE id = $${next} AND organization_id = $${next + 1}`,
    params,
  );
  if (!r.changes) return c.json({ error: "Not found" }, 404);
  const row = await get(
    c,
    `SELECT a.*, u.name as unit_name, p.name as property_name ${APP_SELECT} WHERE a.organization_id = $1 AND a.id = $2`,
    [o, id],
  );
  return c.json({ application: normalizeRow(row as Record<string, unknown>) });
});

app.delete("/api/applications/:id", async (c) => {
  const id = uuidParam(c.req.param("id"));
  if (!id) return c.json({ error: "Invalid ID" }, 400);
  const o = orgId(c);
  const r = await run(c, "DELETE FROM applications WHERE id = $1 AND organization_id = $2", [id, o]);
  if (!r.changes) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});
}
