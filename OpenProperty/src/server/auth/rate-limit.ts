import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "../env";

export function clientIp(c: Context<AppEnv>): string {
  const forwarded = c.req.header("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();
  return c.req.header("cf-connecting-ip") ?? firstForwarded ?? "unknown";
}

type Window = {
  windowMs: number;
  limit: number;
  /** Include pathname so /api/me and /api/auth/* do not share one bucket. */
  includePath?: boolean;
  scope: string;
};

/**
 * Fixed window per isolate. Counts only inside the request handler — no timers at module load
 * (Workers reject setTimeout/fetch during global init; hono-rate-limiter does that).
 */
const hits = new Map<string, { start: number; count: number }>();

export function createIpRateLimit(opts: Window): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const now = Date.now();
    const path = opts.includePath ? new URL(c.req.url).pathname : "";
    const key = `${opts.scope}:${clientIp(c)}:${path}`;
    const current = hits.get(key);

    if (!current || now - current.start >= opts.windowMs) {
      hits.set(key, { start: now, count: 1 });
      pruneExpired(now);
      setRateHeaders(c, opts.limit, opts.limit - 1);
      await next();
      return;
    }

    if (current.count >= opts.limit) {
      const retryAfterSec = Math.max(1, Math.ceil((current.start + opts.windowMs - now) / 1000));
      c.header("Retry-After", String(retryAfterSec));
      setRateHeaders(c, opts.limit, 0);
      return c.json({ error: "Too many requests" }, 429);
    }

    current.count += 1;
    setRateHeaders(c, opts.limit, opts.limit - current.count);
    await next();
  };
}

function setRateHeaders(c: Context<AppEnv>, limit: number, remaining: number) {
  c.header("RateLimit-Limit", String(limit));
  c.header("RateLimit-Remaining", String(Math.max(0, remaining)));
}

/** Drop stale buckets during a request so the map cannot grow without a timer. */
function pruneExpired(now: number) {
  if (hits.size < 2000) return;
  for (const [key, bucket] of hits) {
    if (now - bucket.start >= 60_000) hits.delete(key);
  }
}

/** Broad limit for all API routes (per edge isolate; pair with Cloudflare WAF for global limits). */
export const apiRateLimit = createIpRateLimit({
  windowMs: 60_000,
  limit: 120,
  scope: "api",
});

/** Tighter limit for session bootstrap and profile (auth-adjacent, no org header yet). */
export const authRouteRateLimit = createIpRateLimit({
  windowMs: 60_000,
  limit: 30,
  includePath: true,
  scope: "auth",
});

/** Send and reply share one bucket so a script cannot flood the mailbox. */
export const messageSendRateLimit = createIpRateLimit({
  windowMs: 60_000,
  limit: 20,
  scope: "messages-send",
});
