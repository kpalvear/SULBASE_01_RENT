import type { Sql } from "../db";

/** Same predicate the rent charge generator uses before notifying. */
export const OVERDUE_CHARGE_PREDICATE = `status IN ('open', 'partial') AND amount_paid < amount AND due_date < CURRENT_DATE`;

export const MARK_OVERDUE_FOR_ORG_SQL = `UPDATE rent_charges SET status = 'overdue'
 WHERE organization_id = $1 AND ${OVERDUE_CHARGE_PREDICATE}`;

export const MARK_OVERDUE_ALL_SQL = `UPDATE rent_charges SET status = 'overdue'
 WHERE ${OVERDUE_CHARGE_PREDICATE}`;

/** Rows inserted per category on one cron pass. The next run continues via the dedupe key. */
export const ALERT_BATCH_SIZE = 40;

const RENT_JOINS = `
FROM rent_charges c
LEFT JOIN leases l ON l.id = c.lease_id AND l.organization_id = c.organization_id
LEFT JOIN units u ON u.id = l.unit_id AND u.organization_id = l.organization_id
LEFT JOIN properties p ON p.id = u.property_id AND p.organization_id = u.organization_id
LEFT JOIN tenants t ON t.id = l.primary_tenant_id AND t.organization_id = l.organization_id`;

const RENT_BODY = `COALESCE(NULLIF(concat_ws(' · ',
  NULLIF(trim(concat_ws(' ', t.first_name, t.last_name)), ''),
  NULLIF(trim(concat_ws(' ', p.name, u.name)), ''),
  'Periodo ' || c.period,
  'Vence el ' || to_char(c.due_date, 'YYYY-MM-DD')
), ''), 'Cargo de renta')`;

function insertSelect(select: string): string {
  return `INSERT INTO notifications (
  organization_id, kind, title, body, severity, entity_type, entity_id, period
)
${select}
ON CONFLICT ON CONSTRAINT uq_notifications_dedupe DO NOTHING
RETURNING id`;
}

const RENT_DUE_SQL = insertSelect(`
SELECT c.organization_id, 'rent_due', 'Renta por vencer', ${RENT_BODY},
  CASE WHEN c.due_date <= CURRENT_DATE + 2 THEN 'warning' ELSE 'info' END,
  'rent_charge', c.id, c.period
${RENT_JOINS}
WHERE c.due_date >= CURRENT_DATE
  AND c.due_date <= CURRENT_DATE + 7
  AND c.amount_paid < c.amount
  AND c.status NOT IN ('paid', 'waived')
ORDER BY c.due_date
LIMIT $1`);

const RENT_OVERDUE_SQL = insertSelect(`
SELECT c.organization_id, 'rent_overdue', 'Renta vencida', ${RENT_BODY},
  'critical', 'rent_charge', c.id, c.period
${RENT_JOINS}
WHERE c.due_date < CURRENT_DATE
  AND c.amount_paid < c.amount
  AND c.status <> 'waived'
ORDER BY c.due_date
LIMIT $1`);

const LEASE_EXPIRING_SQL = insertSelect(`
SELECT l.organization_id, 'lease_expiring', 'Contrato por vencer',
  COALESCE(NULLIF(concat_ws(' · ',
    NULLIF(trim(concat_ws(' ', t.first_name, t.last_name)), ''),
    NULLIF(trim(concat_ws(' ', p.name, u.name)), ''),
    'Termina el ' || l.end_date::text
  ), ''), 'Contrato por vencer'),
  CASE WHEN l.end_date <= CURRENT_DATE + 7 THEN 'warning' ELSE 'info' END,
  'lease', l.id, l.end_date::text
FROM leases l
LEFT JOIN units u ON u.id = l.unit_id AND u.organization_id = l.organization_id
LEFT JOIN properties p ON p.id = u.property_id AND p.organization_id = u.organization_id
LEFT JOIN tenants t ON t.id = l.primary_tenant_id AND t.organization_id = l.organization_id
WHERE l.status = 'active'
  AND l.end_date >= CURRENT_DATE
  AND l.end_date <= CURRENT_DATE + 30
ORDER BY l.end_date
LIMIT $1`);

const WORK_ORDER_SQL = insertSelect(`
SELECT w.organization_id, 'work_order', 'Orden de trabajo sin asignar',
  COALESCE(NULLIF(concat_ws(' · ', w.title, p.name, u.name), ''), w.title),
  CASE w.priority WHEN 'urgent' THEN 'critical' WHEN 'high' THEN 'warning' ELSE 'info' END,
  'work_order', w.id, 'unassigned'
FROM work_orders w
LEFT JOIN properties p ON p.id = w.property_id AND p.organization_id = w.organization_id
LEFT JOIN units u ON u.id = w.unit_id AND u.organization_id = w.organization_id
WHERE w.vendor_id IS NULL
  AND w.status NOT IN ('completed', 'cancelled')
ORDER BY w.created_at
LIMIT $1`);

export type MailboxAlertSummary = {
  overdueMarked: number;
  rentDue: number;
  rentOverdue: number;
  leaseExpiring: number;
  workOrders: number;
};

async function inserted(sql: Sql, text: string, batchSize: number): Promise<number> {
  const rows = await sql.unsafe(text, [batchSize]);
  return (rows as unknown as { id: string }[]).length;
}

/**
 * One cron pass: mark overdue charges, then insert at most `batchSize` new alerts per kind.
 * Already-notified rows collide on (organization, kind, entity, period) and are skipped.
 */
export async function generateMailboxAlerts(
  sql: Sql,
  batchSize = ALERT_BATCH_SIZE,
): Promise<MailboxAlertSummary> {
  const marked = await sql.unsafe(MARK_OVERDUE_ALL_SQL);
  const overdueMarked = Number((marked as { count?: number }).count ?? 0);
  const rentDue = await inserted(sql, RENT_DUE_SQL, batchSize);
  const rentOverdue = await inserted(sql, RENT_OVERDUE_SQL, batchSize);
  const leaseExpiring = await inserted(sql, LEASE_EXPIRING_SQL, batchSize);
  const workOrders = await inserted(sql, WORK_ORDER_SQL, batchSize);
  return { overdueMarked, rentDue, rentOverdue, leaseExpiring, workOrders };
}
