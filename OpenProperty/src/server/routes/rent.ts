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
import { MARK_OVERDUE_FOR_ORG_SQL } from "../notifications/alerts";
import { periodSchema, rentChargeStatusSchema } from "../schemas/common";
import { parseJson, parseQuery } from "../validation";

export function mountRentRoutes(app: Hono<AppEnv>) {
  const ChargeInput = z.object({
    lease_id: z.string().uuid(),
    period: periodSchema,
    due_date: z.string(),
    amount: z.number().min(0).optional(),
    notes: z.string().optional().nullable(),
  });

  function chargeSelect(where: string): string {
    return `
  SELECT c.*,
    l.unit_id, l.monthly_rent as lease_rent, l.rent_due_day,
    u.name as unit_name,
    p.id as property_id, p.name as property_name, p.color as property_color,
    t.id as tenant_id, t.first_name as tenant_first_name, t.last_name as tenant_last_name
  FROM rent_charges c
  LEFT JOIN leases l ON l.id = c.lease_id AND l.organization_id = c.organization_id
  LEFT JOIN units u ON u.id = l.unit_id AND u.organization_id = l.organization_id
  LEFT JOIN properties p ON p.id = u.property_id AND p.organization_id = u.organization_id
  LEFT JOIN tenants t ON t.id = l.primary_tenant_id AND t.organization_id = l.organization_id
  WHERE c.organization_id = $1 ${where}`;
  }

  const ListChargesQuery = z.object({
    period: periodSchema.optional(),
    status: rentChargeStatusSchema.optional(),
  });

  app.get("/api/rent-charges", async (c) => {
    const q = parseQuery(c, ListChargesQuery);
    if (!q.ok) return c.json({ error: q.error }, 400);
    const o = orgId(c);
    const { period, status } = q.data;
    const filters: string[] = [];
    const params: SqlParam[] = [o];
    let n = 2;
    if (period) {
      filters.push(`c.period = $${n++}`);
      params.push(period);
    }
    if (status) {
      filters.push(`c.status = $${n++}`);
      params.push(status);
    }
    const extra = filters.length ? `AND ${filters.join(" AND ")}` : "";
    const rows = await query(
      c,
      `${chargeSelect(extra)} ORDER BY c.due_date, p.name, u.name`,
      params,
    ).catch(() => []);
    return c.json({ charges: normalizeRows(rows) });
  });

  app.post("/api/rent-charges", async (c) => {
    const parsed = await parseJson(c, ChargeInput);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const d = parsed.data;
    const o = orgId(c);
    const inserted = await get<{ id: string }>(
      c,
      `INSERT INTO rent_charges (organization_id, lease_id, period, due_date, amount, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (lease_id, period) DO NOTHING
     RETURNING id`,
      [o, d.lease_id, d.period, d.due_date, String(d.amount ?? 0), d.notes ?? null],
    );
    if (!inserted) {
      const existing = await get(c, `${chargeSelect("AND c.lease_id = $2 AND c.period = $3")}`, [
        o,
        d.lease_id,
        d.period,
      ]);
      return c.json({ charge: normalizeRow(existing as Record<string, unknown>) });
    }
    const row = await get(c, `${chargeSelect("AND c.id = $2")}`, [o, inserted.id]);
    return c.json({ charge: normalizeRow(row as Record<string, unknown>) }, 201);
  });

  app.post("/api/rent-charges/generate", async (c) => {
    const parsed = await parseJson(c, z.object({ period: periodSchema }));
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const period = parsed.data.period;
    const o = orgId(c);
    const [year, month] = period.split("-").map(Number);
    const periodEnd = `${period}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
    const leases = await query<{
      id: string;
      monthly_rent: string;
      rent_due_day: number;
      start_date: string;
      end_date: string;
    }>(
      c,
      "SELECT id, monthly_rent, rent_due_day, start_date::text, end_date::text FROM leases WHERE organization_id = $1 AND status = 'active'",
      [o],
    );
    let created = 0;
    for (const l of leases) {
      const periodStart = `${period}-01`;
      if (l.end_date < periodStart || l.start_date > periodEnd) continue;
      const day = String(Math.min(28, Math.max(1, l.rent_due_day))).padStart(2, "0");
      const dueDate = `${period}-${day}`;
      const r = await run(
        c,
        `INSERT INTO rent_charges (organization_id, lease_id, period, due_date, amount)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (lease_id, period) DO NOTHING`,
        [o, l.id, period, dueDate, l.monthly_rent],
      );
      if (r.changes) created++;
    }
    await run(c, MARK_OVERDUE_FOR_ORG_SQL, [o]);
    return c.json({ created, period });
  });

  app.put("/api/rent-charges/:id", async (c) => {
    const id = uuidParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const Patch = z.object({
      amount: z.number().min(0).optional(),
      due_date: z.string().optional(),
      status: z.enum(["open", "partial", "paid", "overdue", "waived"]).optional(),
      notes: z.string().optional().nullable(),
    });
    const parsed = await parseJson(c, Patch);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const data = { ...parsed.data };
    if (data.amount !== undefined) data.amount = String(data.amount) as unknown as number;
    const { sets, params, next } = buildUpdate(data as Record<string, unknown>);
    if (!sets.length) return c.json({ error: "No fields" }, 400);
    const o = orgId(c);
    params.push(id, o);
    const r = await run(
      c,
      `UPDATE rent_charges SET ${sets.join(", ")} WHERE id = $${next} AND organization_id = $${next + 1}`,
      params,
    );
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    const row = await get(c, `${chargeSelect("AND c.id = $2")}`, [o, id]);
    return c.json({ charge: normalizeRow(row as Record<string, unknown>) });
  });

  app.delete("/api/rent-charges/:id", async (c) => {
    const id = uuidParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const o = orgId(c);
    const r = await run(c, "DELETE FROM rent_charges WHERE id = $1 AND organization_id = $2", [
      id,
      o,
    ]);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });

  const PaymentInput = z.object({
    charge_id: z.string().uuid(),
    paid_at: z.string().optional(),
    amount: z.number().min(0),
    method: z.enum(["cash", "check", "ach", "credit", "other"]).optional(),
    reference: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  });

  app.get("/api/rent-charges/:id/payments", async (c) => {
    const id = uuidParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const o = orgId(c);
    const rows = await query(
      c,
      "SELECT * FROM payments WHERE charge_id = $1 AND organization_id = $2 ORDER BY paid_at DESC",
      [id, o],
    );
    return c.json({ payments: normalizeRows(rows) });
  });

  app.post("/api/payments", async (c) => {
    const parsed = await parseJson(c, PaymentInput);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const d = parsed.data;
    const o = orgId(c);
    await run(
      c,
      `INSERT INTO payments (organization_id, charge_id, paid_at, amount, method, reference, notes)
     VALUES ($1, $2, COALESCE($3::timestamptz, now()), $4, $5, $6, $7)`,
      [
        o,
        d.charge_id,
        d.paid_at ?? null,
        String(d.amount),
        d.method ?? "cash",
        d.reference ?? null,
        d.notes ?? null,
      ],
    );
    const charge = await get<{ amount: string }>(
      c,
      "SELECT amount FROM rent_charges WHERE id = $1 AND organization_id = $2",
      [d.charge_id, o],
    );
    if (!charge) return c.json({ error: "Charge not found" }, 404);
    const sumRow = await get<{ total: string }>(
      c,
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE charge_id = $1 AND organization_id = $2",
      [d.charge_id, o],
    );
    const paid = Number(sumRow?.total ?? 0);
    const amount = Number(charge.amount);
    const status = paid >= amount ? "paid" : paid > 0 ? "partial" : "open";
    await run(
      c,
      "UPDATE rent_charges SET amount_paid = $1, status = $2 WHERE id = $3 AND organization_id = $4",
      [String(paid), status, d.charge_id, o],
    );
    const updated = await get(c, `${chargeSelect("AND c.id = $2")}`, [o, d.charge_id]);
    return c.json({ charge: normalizeRow(updated as Record<string, unknown>) }, 201);
  });

  app.delete("/api/payments/:id", async (c) => {
    const id = uuidParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const o = orgId(c);
    const row = await get<{ charge_id: string }>(
      c,
      "SELECT charge_id FROM payments WHERE id = $1 AND organization_id = $2",
      [id, o],
    );
    if (!row) return c.json({ error: "Not found" }, 404);
    await run(c, "DELETE FROM payments WHERE id = $1 AND organization_id = $2", [id, o]);
    const sumRow = await get<{ total: string }>(
      c,
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE charge_id = $1 AND organization_id = $2",
      [row.charge_id, o],
    );
    const charge = await get<{ amount: string }>(
      c,
      "SELECT amount FROM rent_charges WHERE id = $1 AND organization_id = $2",
      [row.charge_id, o],
    );
    const paid = Number(sumRow?.total ?? 0);
    const amount = charge ? Number(charge.amount) : 0;
    const status = !charge ? "open" : paid >= amount ? "paid" : paid > 0 ? "partial" : "open";
    await run(
      c,
      "UPDATE rent_charges SET amount_paid = $1, status = $2 WHERE id = $3 AND organization_id = $4",
      [String(paid), status, row.charge_id, o],
    );
    return c.json({ ok: true });
  });
}
