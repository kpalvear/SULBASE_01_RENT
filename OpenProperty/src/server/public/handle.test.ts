import { describe, expect, it } from "vitest";
import type { WorkerBindings } from "../env";
import { handlePublicRequest } from "./handle";

function bindings(assets: Fetcher, redirect = false): WorkerBindings {
  return {
    ASSETS: assets,
    DATABASE_URL: "postgres://unused",
    CANONICAL_REDIRECT: redirect ? "true" : "false",
  };
}

function assetFetcher(): Fetcher {
  return {
    async fetch(input: RequestInfo | URL) {
      const url = input instanceof Request ? input.url : String(input);
      const path = new URL(url).pathname;
      if (path === "/app/index.html") {
        return new Response("<!DOCTYPE html><title>RENT</title>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (path === "/" || path === "/index.html") {
        return new Response("landing-asset", { status: 200 });
      }
      if (path === "/robots.txt") return new Response("robots", { status: 200 });
      return new Response("missing", { status: 404 });
    },
  } as Fetcher;
}

describe("public request handler", () => {
  it("serves the app shell with noindex and redirects legacy paths", async () => {
    const env = bindings(assetFetcher());
    const app = await handlePublicRequest(new Request("https://rent.sulbase.com/app/rent"), env);
    expect(app.status).toBe(200);
    expect(app.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(await app.text()).toContain("RENT");

    const legacy = await handlePublicRequest(
      new Request("https://rent.sulbase.com/properties/abc"),
      env,
    );
    expect(legacy.status).toBe(301);
    expect(legacy.headers.get("Location")).toBe("https://rent.sulbase.com/app/properties/abc");

    const home = await handlePublicRequest(new Request("https://rent.sulbase.com/"), env);
    expect(await home.text()).toBe("landing-asset");
  });

  it("redirects the lab host only when the flag is on", async () => {
    const request = new Request("https://rent.sistemas-d5d.workers.dev/app");
    const off = await handlePublicRequest(request, bindings(assetFetcher(), false));
    expect(off.status).toBe(200);

    const on = await handlePublicRequest(request, bindings(assetFetcher(), true));
    expect(on.status).toBe(301);
    expect(on.headers.get("Location")).toBe("https://rent.sulbase.com/app");
  });
});
