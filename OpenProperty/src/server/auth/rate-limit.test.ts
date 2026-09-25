import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { clientIp, createIpRateLimit } from "./rate-limit";

describe("clientIp", () => {
  it("prefers cf-connecting-ip over x-forwarded-for", async () => {
    const app = new Hono<AppEnv>();
    app.get("/t", (c) => c.json({ ip: clientIp(c) }));
    const res = await app.request("/t", {
      headers: {
        "cf-connecting-ip": "1.2.3.4",
        "x-forwarded-for": "9.9.9.9",
      },
    });
    const body = (await res.json()) as { ip: string };
    expect(body.ip).toBe("1.2.3.4");
  });
});

describe("createIpRateLimit", () => {
  it("returns 429 after the limit without using timers at setup", async () => {
    const app = new Hono<AppEnv>();
    app.use(
      "*",
      createIpRateLimit({ windowMs: 60_000, limit: 2, scope: `test-${crypto.randomUUID()}` }),
    );
    app.get("/t", (c) => c.json({ ok: true }));

    const first = await app.request("/t", { headers: { "cf-connecting-ip": "8.8.8.8" } });
    const second = await app.request("/t", { headers: { "cf-connecting-ip": "8.8.8.8" } });
    const third = await app.request("/t", { headers: { "cf-connecting-ip": "8.8.8.8" } });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.headers.get("Retry-After")).toBeTruthy();
  });
});
