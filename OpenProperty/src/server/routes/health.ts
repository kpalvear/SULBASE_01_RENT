import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { get } from "../pg";

export function mountHealthRoutes(app: Hono<AppEnv>) {
  app.get("/api/health", async (c) => {
    try {
      await get(c, "SELECT 1 as ok");
      return c.json({ ok: true, database: "postgres" });
    } catch {
      return c.json({ ok: false, database: "postgres" }, 503);
    }
  });
}
