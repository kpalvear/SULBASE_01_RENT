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

export function mountWorkOrdersRoutes(app: Hono<AppEnv>) {
  const WorkOrderInput = z.object({
    property_id: z.string().uuid().nullable().optional(),
    unit_id: z.string().uuid().nullable().optional(),
    tenant_id: z.string().uuid().nullable().optional(),
    vendor_id: z.string().uuid().nullable().optional(),
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    status: z.enum(["open", "assigned", "in_progress", "completed", "cancelled"]).optional(),
    scheduled_at: z.string().optional().nullable(),
    completed_at: z.string().optional().nullable(),
    cost: z.number().min(0).optional().nullable(),
    notes: z.string().optional().nullable(),
  });

  function woSelect(where: string): string {
    return `
  SELECT w.*,
    p.name as property_name, p.color as property_color,
    u.name as unit_name,
    t.first_name as tenant_first_name, t.last_name as tenant_last_name,
    v.name as vendor_name, v.color as vendor_color
  FROM work_orders w
  LEFT JOIN properties p ON p.id = w.property_id AND p.organization_id = w.organization_id
  LEFT JOIN units u ON u.id = w.unit_id AND u.organization_id = w.organization_id
  LEFT JOIN tenants t ON t.id = w.tenant_id AND t.organization_id = w.organization_id
  LEFT JOIN vendors v ON v.id = w.vendor_id AND v.organization_id = w.organization_id
  WHERE w.organization_id = $1 ${where}`;
  }

  app.get("/api/work-orders", async (c) => {
    const o = orgId(c);
    const status = c.req.query("status");
    const propertyId = uuidParam(c.req.query("property_id"));
    const filters: string[] = [];
    const params: SqlParam[] = [o];
    let n = 2;
    if (status) {
      filters.push(`w.status = $${n++}`);
      params.push(status);
    }
    if (propertyId) {
      filters.push(`w.property_id = $${n++}`);
      params.push(propertyId);
    }
    const extra = filters.length ? `AND ${filters.join(" AND ")}` : "";
    const rows = await query(
      c,
      `${woSelect(extra)} ORDER BY
    CASE w.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
    w.created_at DESC`,
      params,
    ).catch(() => []);
    return c.json({ work_orders: normalizeRows(rows) });
  });

  app.post("/api/work-orders", async (c) => {
    const parsed = await parseJson(c, WorkOrderInput);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const d = parsed.data;
    const o = orgId(c);
    const inserted = await get<{ id: string }>(
      c,
      `INSERT INTO work_orders (organization_id, property_id, unit_id, tenant_id, vendor_id, title, description, priority, status, scheduled_at, completed_at, cost, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [
        o,
        d.property_id ?? null,
        d.unit_id ?? null,
        d.tenant_id ?? null,
        d.vendor_id ?? null,
        d.title,
        d.description ?? null,
        d.priority ?? "normal",
        d.status ?? "open",
        d.scheduled_at ?? null,
        d.completed_at ?? null,
        d.cost != null ? String(d.cost) : null,
        d.notes ?? null,
      ],
    );
    if (!inserted?.id) return c.json({ error: "Insert failed" }, 500);
    const row = await get(c, `${woSelect("AND w.id = $2")}`, [o, inserted.id]);
    return c.json({ work_order: normalizeRow(row as Record<string, unknown>) }, 201);
  });

  app.put("/api/work-orders/:id", async (c) => {
    const id = uuidParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const parsed = await parseJson(c, WorkOrderInput.partial());
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const data = { ...parsed.data };
    if (data.cost !== undefined && data.cost !== null)
      data.cost = String(data.cost) as unknown as number;
    const { sets, params, next } = buildUpdate(data as Record<string, unknown>);
    if (!sets.length) return c.json({ error: "No fields" }, 400);
    const o = orgId(c);
    params.push(id, o);
    const r = await run(
      c,
      `UPDATE work_orders SET ${sets.join(", ")} WHERE id = $${next} AND organization_id = $${next + 1}`,
      params,
    );
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    const row = await get(c, `${woSelect("AND w.id = $2")}`, [o, id]);
    return c.json({ work_order: normalizeRow(row as Record<string, unknown>) });
  });

  app.delete("/api/work-orders/:id", async (c) => {
    const id = uuidParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const o = orgId(c);
    const r = await run(c, "DELETE FROM work_orders WHERE id = $1 AND organization_id = $2", [
      id,
      o,
    ]);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
}
