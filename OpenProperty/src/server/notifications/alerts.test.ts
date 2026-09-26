import { describe, expect, it } from "vitest";
import type { Sql } from "../db";
import { ALERT_BATCH_SIZE, generateMailboxAlerts, MARK_OVERDUE_ALL_SQL } from "./alerts";

describe("mailbox alert generation", () => {
  it("marks overdue charges and inserts one batch per kind", async () => {
    const calls: Array<{ text: string; params: unknown[] }> = [];
    const sql = {
      unsafe: async (text: string, params: unknown[] = []) => {
        calls.push({ text, params });
        if (text.startsWith("UPDATE")) return Object.assign([], { count: 3 });
        return [{ id: "inserted" }];
      },
    } as unknown as Sql;

    const summary = await generateMailboxAlerts(sql, 5);
    expect(summary).toEqual({
      overdueMarked: 3,
      rentDue: 1,
      rentOverdue: 1,
      leaseExpiring: 1,
      workOrders: 1,
    });
    expect(calls[0]?.text).toBe(MARK_OVERDUE_ALL_SQL);
    expect(calls.filter((call) => call.text.includes("ON CONFLICT ON CONSTRAINT uq_notifications_dedupe"))).toHaveLength(4);
    expect(calls.filter((call) => call.text.includes("LIMIT $1"))).toHaveLength(4);
    expect(calls.slice(1).every((call) => call.params[0] === 5)).toBe(true);
    expect(ALERT_BATCH_SIZE).toBeLessThanOrEqual(50);
  });
});
