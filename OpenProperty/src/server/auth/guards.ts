import type { Context } from "hono";
import type { AppEnv } from "../env";
import { canManage } from "./roles";

export function assertCanManage(c: Context<AppEnv>): Response | null {
  if (!canManage(c.get("role"))) {
    return c.json({ error: "Insufficient permissions" }, 403);
  }
  return null;
}
