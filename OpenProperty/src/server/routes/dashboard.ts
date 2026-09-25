import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { get, normalizeRows, orgId, query, type SqlParam } from "../pg";

export function mountDashboardRoutes(app: Hono<AppEnv>) {
app.get("/api/dashboard/summary", async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const periodNow = today.slice(0, 7);
  const o = orgId(c);

  const safeGet = <T,>(sql: string, params: SqlParam[] = [], fallback: T) =>
    get<T>(c, sql, params)
      .catch(() => fallback as T | undefined)
      .then((v) => v ?? fallback);
  const safeQuery = <T,>(sql: string, params: SqlParam[] = []): Promise<T[]> =>
    query<T>(c, sql, params).catch(() => [] as T[]);

  const [
    propertyCount,
    unitCount,
    occupiedCount,
    vacantCount,
    activeLeases,
    upcomingMoveOuts,
    monthOutstanding,
    monthCollected,
    overdueRow,
    openWorkOrders,
    urgentWorkOrders,
    recentWorkOrders,
    upcomingExpirations,
  ] = await Promise.all([
    safeGet<{ n: number }>("SELECT COUNT(*)::int as n FROM properties WHERE organization_id = $1", [o], { n: 0 }),
    safeGet<{ n: number }>("SELECT COUNT(*)::int as n FROM units WHERE organization_id = $1", [o], { n: 0 }),
    safeGet<{ n: number }>("SELECT COUNT(*)::int as n FROM units WHERE organization_id = $1 AND status = 'occupied'", [o], { n: 0 }),
    safeGet<{ n: number }>("SELECT COUNT(*)::int as n FROM units WHERE organization_id = $1 AND status = 'vacant'", [o], { n: 0 }),
    safeGet<{ n: number }>("SELECT COUNT(*)::int as n FROM leases WHERE organization_id = $1 AND status = 'active'", [o], { n: 0 }),
    safeGet<{ n: number }>(
      "SELECT COUNT(*)::int as n FROM leases WHERE organization_id = $1 AND status = 'active' AND end_date <= CURRENT_DATE + interval '30 days'",
      [o],
      { n: 0 },
    ),
    safeGet<{ total: string }>(
      "SELECT COALESCE(SUM(amount - amount_paid), 0) as total FROM rent_charges WHERE organization_id = $1 AND period = $2 AND status != 'waived'",
      [o, periodNow],
      { total: "0" },
    ),
    safeGet<{ total: string }>(
      "SELECT COALESCE(SUM(amount_paid), 0) as total FROM rent_charges WHERE organization_id = $1 AND period = $2",
      [o, periodNow],
      { total: "0" },
    ),
    safeGet<{ total: string; n: number }>(
      "SELECT COALESCE(SUM(amount - amount_paid), 0) as total, COUNT(*)::int as n FROM rent_charges WHERE organization_id = $1 AND due_date < CURRENT_DATE AND amount_paid < amount AND status != 'waived'",
      [o],
      { total: "0", n: 0 },
    ),
    safeGet<{ n: number }>(
      "SELECT COUNT(*)::int as n FROM work_orders WHERE organization_id = $1 AND status NOT IN ('completed', 'cancelled')",
      [o],
      { n: 0 },
    ),
    safeGet<{ n: number }>(
      "SELECT COUNT(*)::int as n FROM work_orders WHERE organization_id = $1 AND priority = 'urgent' AND status NOT IN ('completed', 'cancelled')",
      [o],
      { n: 0 },
    ),
    safeQuery<{
      id: string;
      title: string;
      priority: string;
      status: string;
      property_name: string | null;
      unit_name: string | null;
      created_at: string;
    }>(
      `SELECT w.id, w.title, w.priority, w.status, p.name as property_name, u.name as unit_name, w.created_at
       FROM work_orders w
       LEFT JOIN properties p ON p.id = w.property_id AND p.organization_id = w.organization_id
       LEFT JOIN units u ON u.id = w.unit_id AND u.organization_id = w.organization_id
       WHERE w.organization_id = $1 AND w.status NOT IN ('completed', 'cancelled')
       ORDER BY CASE w.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, w.created_at DESC
       LIMIT 6`,
      [o],
    ),
    safeQuery<{
      id: string;
      end_date: string;
      tenant_first_name: string | null;
      tenant_last_name: string | null;
      unit_name: string | null;
      property_name: string | null;
    }>(
      `SELECT l.id, l.end_date::text,
         t.first_name as tenant_first_name, t.last_name as tenant_last_name,
         u.name as unit_name, p.name as property_name
       FROM leases l
       LEFT JOIN tenants t ON t.id = l.primary_tenant_id AND t.organization_id = l.organization_id
       LEFT JOIN units u ON u.id = l.unit_id AND u.organization_id = l.organization_id
       LEFT JOIN properties p ON p.id = u.property_id AND p.organization_id = u.organization_id
       WHERE l.organization_id = $1 AND l.status = 'active' AND l.end_date <= CURRENT_DATE + interval '60 days'
       ORDER BY l.end_date ASC LIMIT 6`,
      [o],
    ),
  ]);

  return c.json({
    period: periodNow,
    properties: propertyCount.n,
    units: unitCount.n,
    occupied: occupiedCount.n,
    vacant: vacantCount.n,
    occupancy_rate: unitCount.n ? Math.round((occupiedCount.n / unitCount.n) * 100) : 0,
    active_leases: activeLeases.n,
    upcoming_move_outs: upcomingMoveOuts.n,
    month_outstanding: Number(monthOutstanding.total),
    month_collected: Number(monthCollected.total),
    overdue_total: Number(overdueRow.total),
    overdue_count: overdueRow.n,
    open_work_orders: openWorkOrders.n,
    urgent_work_orders: urgentWorkOrders.n,
    recent_work_orders: normalizeRows(recentWorkOrders),
    upcoming_expirations: normalizeRows(upcomingExpirations),
  });
});
}
