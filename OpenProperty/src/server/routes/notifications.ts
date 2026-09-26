import { z } from "zod";
import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { NOTIFICATION_KINDS } from "../notifications/types";
import { get, normalizeRow, normalizeRows, orgId, query, run, uuidParam } from "../pg";
import { parseQuery } from "../validation";

const Kind = z.enum(NOTIFICATION_KINDS);

const ListQuery = z.object({
  kind: Kind.optional(),
  read: z.enum(["unread", "read", "all"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const VISIBLE = `organization_id = $1
  AND ($2::uuid IS NULL OR user_id IS NULL OR user_id = $2::uuid)`;

export function mountNotificationRoutes(app: Hono<AppEnv>) {
  app.get("/api/notifications", async (c) => {
    const parsed = parseQuery(c, ListQuery);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const userId = c.get("userId");
    const kind = parsed.data.kind ?? null;
    const read = parsed.data.read ?? "all";
    const limit = parsed.data.limit ?? 50;
    const rows = await query(
      c,
      `SELECT id, kind, title, body, severity, entity_type, entity_id, period, read_at, created_at
       FROM notifications
       WHERE ${VISIBLE}
         AND ($3::text IS NULL OR kind::text = $3)
         AND (
           $4 = 'all'
           OR ($4 = 'unread' AND read_at IS NULL)
           OR ($4 = 'read' AND read_at IS NOT NULL)
         )
       ORDER BY created_at DESC
       LIMIT $5`,
      [orgId(c), userId, kind ?? null, read, limit],
    );
    const unread = await get<{ n: number }>(
      c,
      `SELECT COUNT(*)::int AS n FROM notifications
       WHERE ${VISIBLE} AND read_at IS NULL`,
      [orgId(c), userId],
    );
    return c.json({
      notifications: normalizeRows(rows),
      unread_count: Number(unread?.n ?? 0),
    });
  });

  app.post("/api/notifications/read-all", async (c) => {
    const userId = c.get("userId");
    const result = await run(
      c,
      `UPDATE notifications
       SET read_at = COALESCE(read_at, now())
       WHERE ${VISIBLE} AND read_at IS NULL`,
      [orgId(c), userId],
    );
    return c.json({ updated: result.changes });
  });

  app.post("/api/notifications/:id/read", async (c) => {
    const id = uuidParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const userId = c.get("userId");
    const row = await get(
      c,
      `UPDATE notifications
       SET read_at = COALESCE(read_at, now())
       WHERE id = $1
         AND organization_id = $2
         AND ($3::uuid IS NULL OR user_id IS NULL OR user_id = $3::uuid)
       RETURNING id, kind, title, body, severity, entity_type, entity_id, period, read_at, created_at`,
      [id, orgId(c), userId],
    );
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ notification: normalizeRow(row as Record<string, unknown>) });
  });
}
