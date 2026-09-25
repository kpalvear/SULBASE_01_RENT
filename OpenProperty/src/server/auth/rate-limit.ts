import type { Context } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import type { AppEnv } from "../env";

export function clientIp(c: Context<AppEnv>): string {
  const forwarded = c.req.header("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();
  return c.req.header("cf-connecting-ip") ?? firstForwarded ?? "unknown";
}

/** Broad limit for all API routes (per edge isolate; pair with Cloudflare WAF for global limits). */
export const apiRateLimit = rateLimiter<AppEnv>({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-6",
  keyGenerator: (c) => `api:${clientIp(c)}`,
});

/** Tighter limit for session bootstrap and profile (auth-adjacent, no org header yet). */
export const authRouteRateLimit = rateLimiter<AppEnv>({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-6",
  keyGenerator: (c) => {
    const path = new URL(c.req.url).pathname;
    return `auth:${clientIp(c)}:${path}`;
  },
});
