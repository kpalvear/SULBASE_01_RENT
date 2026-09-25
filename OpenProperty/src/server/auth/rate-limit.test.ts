import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { clientIp } from "./rate-limit";

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
