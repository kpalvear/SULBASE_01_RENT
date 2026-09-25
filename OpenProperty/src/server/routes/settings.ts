import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { orgId, query, run } from "../pg";
import { settingsPatchSchema } from "../schemas/common";
import { parseJson } from "../validation";
import { DEFAULT_SETTINGS } from "../seed";
import { assertCanManage } from "../auth/guards";

export function mountSettingsRoutes(app: Hono<AppEnv>) {
  app.get("/api/settings", async (c) => {
    const o = orgId(c);
    const rows = await query<{ key: string; value: string }>(
      c,
      "SELECT key, value FROM settings WHERE organization_id = $1",
      [o],
    ).catch(() => []);
    const out: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const r of rows) out[r.key] = r.value;
    return c.json({ settings: out });
  });

  app.put("/api/settings", async (c) => {
    const denied = assertCanManage(c);
    if (denied) return denied;
    const parsed = await parseJson(c, settingsPatchSchema);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const o = orgId(c);
    const entries = Object.entries(parsed.data).filter(([, v]) => v !== undefined && v !== null);
    for (const [key, value] of entries) {
      await run(
        c,
        `INSERT INTO settings (organization_id, key, value, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [o, key, String(value)],
      );
    }
    const rows = await query<{ key: string; value: string }>(
      c,
      "SELECT key, value FROM settings WHERE organization_id = $1",
      [o],
    );
    const out: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const r of rows) out[r.key] = r.value;
    return c.json({ settings: out });
  });
}
