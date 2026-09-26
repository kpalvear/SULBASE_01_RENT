import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { organizations } from "../../db/schema";
import { assertCanManage } from "../auth/guards";
import type { AppEnv } from "../env";
import { orgId, query, run } from "../pg";
import { organizationPatchSchema, settingsPatchSchema } from "../schemas/common";
import { DEFAULT_SETTINGS } from "../seed";
import { isTimeZone, normalizeSettingEntries } from "../settings/preferences";
import { parseJson } from "../validation";

async function loadSettings(c: Parameters<typeof orgId>[0]): Promise<Record<string, string>> {
  const o = orgId(c);
  const rows = await query<{ key: string; value: string }>(
    c,
    "SELECT key, value FROM settings WHERE organization_id = $1",
    [o],
  ).catch(() => []);
  const out: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function mountSettingsRoutes(app: Hono<AppEnv>) {
  app.get("/api/settings", async (c) => {
    return c.json({ settings: await loadSettings(c) });
  });

  app.put("/api/settings", async (c) => {
    const denied = assertCanManage(c);
    if (denied) return denied;
    const parsed = await parseJson(c, settingsPatchSchema);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const normalized = normalizeSettingEntries(parsed.data);
    if (!normalized.ok) return c.json({ error: normalized.error }, 400);
    const o = orgId(c);
    for (const [key, value] of normalized.entries) {
      await run(
        c,
        `INSERT INTO settings (organization_id, key, value, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [o, key, value],
      );
    }
    return c.json({ settings: await loadSettings(c) });
  });

  app.get("/api/settings/organization", async (c) => {
    const o = orgId(c);
    const [org] = await c
      .get("db")
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.id, o))
      .limit(1);
    if (!org) return c.json({ error: "Organization not found" }, 404);
    const settings = await loadSettings(c);
    return c.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        timezone: settings.timezone,
        currency: settings.currency,
        language: settings.language,
        date_format: settings.date_format,
        area_unit: settings.area_unit,
      },
    });
  });

  app.patch("/api/settings/organization", async (c) => {
    const denied = assertCanManage(c);
    if (denied) return denied;
    const parsed = await parseJson(c, organizationPatchSchema);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    if (parsed.data.timezone && !isTimeZone(parsed.data.timezone)) {
      return c.json({ error: "timezone must be a valid IANA name" }, 400);
    }

    const o = orgId(c);
    const db = c.get("db");
    if (parsed.data.name) {
      await db.update(organizations).set({ name: parsed.data.name }).where(eq(organizations.id, o));
    }

    const localePatch = {
      timezone: parsed.data.timezone,
      currency: parsed.data.currency?.toUpperCase(),
      language: parsed.data.language,
      date_format: parsed.data.date_format,
      area_unit: parsed.data.area_unit,
    };
    const normalized = normalizeSettingEntries(localePatch);
    if (!normalized.ok) return c.json({ error: normalized.error }, 400);
    for (const [key, value] of normalized.entries) {
      await run(
        c,
        `INSERT INTO settings (organization_id, key, value, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [o, key, value],
      );
    }

    const [org] = await db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.id, o))
      .limit(1);
    const settings = await loadSettings(c);
    return c.json({
      settings,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        timezone: settings.timezone,
        currency: settings.currency,
        language: settings.language,
        date_format: settings.date_format,
        area_unit: settings.area_unit,
      },
    });
  });
}
