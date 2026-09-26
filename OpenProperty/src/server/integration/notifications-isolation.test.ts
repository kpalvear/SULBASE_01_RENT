import { describe, expect, it } from "vitest";
import { factory } from "../factory";
import type { Sql } from "../db";
import { mountNotificationRoutes } from "../routes/notifications";

const ORG_A = "10000000-0000-4000-8000-000000000001";
const ORG_B = "10000000-0000-4000-8000-000000000002";
const USER_A = "30000000-0000-4000-8000-000000000001";
const USER_B = "30000000-0000-4000-8000-000000000002";
const NOTE_B = "40000000-0000-4000-8000-000000000010";
const NOTE_A = "40000000-0000-4000-8000-000000000011";
const NOTE_PRIVATE = "40000000-0000-4000-8000-000000000012";

type Row = {
  id: string;
  organization_id: string;
  user_id: string | null;
  kind: string;
  title: string;
  body: string;
  severity: string;
  entity_type: string | null;
  entity_id: string | null;
  period: string;
  read_at: string | null;
  created_at: string;
};

function seed(): Row[] {
  return [
    {
      id: NOTE_B,
      organization_id: ORG_B,
      user_id: null,
      kind: "rent_overdue",
      title: "Renta vencida",
      body: "Org B",
      severity: "critical",
      entity_type: "rent_charge",
      entity_id: "50000000-0000-4000-8000-000000000001",
      period: "2026-09",
      read_at: null,
      created_at: "2026-09-20T12:00:00.000Z",
    },
    {
      id: NOTE_A,
      organization_id: ORG_A,
      user_id: null,
      kind: "lease_expiring",
      title: "Contrato por vencer",
      body: "Org A",
      severity: "warning",
      entity_type: "lease",
      entity_id: "50000000-0000-4000-8000-000000000002",
      period: "2026-10-01",
      read_at: null,
      created_at: "2026-09-21T12:00:00.000Z",
    },
    {
      id: NOTE_PRIVATE,
      organization_id: ORG_A,
      user_id: USER_B,
      kind: "system",
      title: "Privada",
      body: "Solo el usuario B",
      severity: "info",
      entity_type: null,
      entity_id: null,
      period: "private",
      read_at: null,
      created_at: "2026-09-22T12:00:00.000Z",
    },
  ];
}

function visible(rows: Row[], org: string, userId: string | null) {
  return rows.filter(
    (row) =>
      row.organization_id === org &&
      (userId == null || row.user_id == null || row.user_id === userId),
  );
}

function createSql(rows: Row[]): Sql {
  const unsafe = async (text: string, params: unknown[] = []) => {
    if (!text.includes("organization_id = $1") && !text.includes("organization_id = $2")) {
      return [];
    }
    if (text.includes("COUNT(*)")) {
      const [org, userId] = params as [string, string | null];
      const n = visible(rows, org, userId).filter((row) => row.read_at == null).length;
      return [{ n }];
    }
    if (text.includes("FROM notifications")) {
      const [org, userId, kind, read] = params as [string, string | null, string | null, string];
      return visible(rows, org, userId).filter((row) => {
        if (kind && row.kind !== kind) return false;
        if (read === "unread") return row.read_at == null;
        if (read === "read") return row.read_at != null;
        return true;
      });
    }
    if (text.includes("UPDATE notifications") && text.includes("WHERE id = $1")) {
      const [id, org, userId] = params as [string, string, string | null];
      const row = rows.find((item) => item.id === id);
      if (!row || row.organization_id !== org) return [];
      if (userId && row.user_id && row.user_id !== userId) return [];
      row.read_at = row.read_at ?? new Date().toISOString();
      return [row];
    }
    if (text.includes("UPDATE notifications")) {
      const [org, userId] = params as [string, string | null];
      let count = 0;
      for (const row of visible(rows, org, userId)) {
        if (row.read_at == null) {
          row.read_at = new Date().toISOString();
          count += 1;
        }
      }
      return Object.assign([], { count });
    }
    return [];
  };
  return { unsafe } as unknown as Sql;
}

function appFor(orgId: string, userId: string | null, sql: Sql) {
  const app = factory.createApp();
  app.use("*", async (c, next) => {
    c.set("sql", sql);
    c.set("db", {} as never);
    c.set("orgId", orgId);
    c.set("userId", userId);
    c.set("userEmail", null);
    c.set("role", "owner");
    await next();
  });
  mountNotificationRoutes(app);
  return app;
}

describe("API org isolation (notifications)", () => {
  it("lists only alerts for the active organization and the current user", async () => {
    const sql = createSql(seed());
    const res = await appFor(ORG_A, USER_A, sql).request("/api/notifications");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { notifications: { id: string }[]; unread_count: number };
    expect(body.notifications.map((row) => row.id)).toEqual([NOTE_A]);
    expect(body.unread_count).toBe(1);
  });

  it("returns 404 when marking an alert from another organization", async () => {
    const sql = createSql(seed());
    const res = await appFor(ORG_A, USER_A, sql).request(`/api/notifications/${NOTE_B}/read`, {
      method: "POST",
    });
    expect(res.status).toBe(404);

    const stillThere = await appFor(ORG_B, null, sql).request("/api/notifications?read=unread");
    const body = (await stillThere.json()) as { notifications: { id: string; read_at: string | null }[] };
    expect(body.notifications[0]?.id).toBe(NOTE_B);
    expect(body.notifications[0]?.read_at).toBeNull();
  });

  it("mark-all does not clear another organization's alerts", async () => {
    const sql = createSql(seed());
    const res = await appFor(ORG_A, USER_A, sql).request("/api/notifications/read-all", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { updated: number };
    expect(body.updated).toBe(1);

    const other = await appFor(ORG_B, null, sql).request("/api/notifications?read=unread");
    const otherBody = (await other.json()) as { unread_count: number };
    expect(otherBody.unread_count).toBe(1);
  });
});
