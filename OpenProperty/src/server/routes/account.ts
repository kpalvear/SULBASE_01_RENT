import type { Hono } from "hono";
import type { AppEnv } from "../env";

/**
 * User profile from the verified JWT. Password, email and display name
 * are changed in the browser with Supabase Auth (`user_metadata.display_name`).
 * The active organization is never read from this route.
 */
export function mountAccountRoutes(app: Hono<AppEnv>) {
  app.get("/api/account", (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ mode: "dev_bypass", user: null });
    }
    return c.json({
      mode: "authenticated",
      user: {
        id: userId,
        email: c.get("userEmail"),
      },
    });
  });
}
