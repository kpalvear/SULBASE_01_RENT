import type { Sql } from "../db";
import type { NotificationDraft } from "./types";

const INSERT_SQL = `INSERT INTO notifications (
  organization_id, user_id, kind, title, body, severity, entity_type, entity_id, period
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT ON CONSTRAINT uq_notifications_dedupe DO NOTHING
RETURNING id`;

/** Insert one mailbox row. Repeated logical keys are ignored. */
export async function insertNotification(sql: Sql, draft: NotificationDraft): Promise<boolean> {
  const rows = await sql.unsafe(INSERT_SQL, [
    draft.organizationId,
    draft.userId ?? null,
    draft.kind,
    draft.title,
    draft.body,
    draft.severity,
    draft.entityType,
    draft.entityId,
    draft.period,
  ]);
  return (rows as unknown as { id: string }[]).length > 0;
}
