import { describe, expect, it } from "vitest";
import {
  canonicalRedirectTarget,
  internalFromLocation,
  jsonLdGraph,
  legacyRedirectPath,
  llmsTxt,
  robotsTxt,
  sitemapXml,
  toAppHref,
  withAppPath,
} from "./public-site";

describe("app paths", () => {
  it("prefixes in-app links and keeps the landing at /", () => {
    expect(toAppHref("/properties")).toBe("/app/properties");
    expect(toAppHref("/")).toBe("/app");
    expect(toAppHref("/app/rent")).toBe("/app/rent");
    expect(internalFromLocation("/app/tenants")).toBe("/tenants");
    expect(internalFromLocation("/app")).toBe("/");
    expect(legacyRedirectPath("/")).toBeNull();
    expect(legacyRedirectPath("/properties/abc")).toBe("/app/properties/abc");
    expect(legacyRedirectPath("/app/leases")).toBeNull();
    expect(withAppPath("https://rent.sulbase.com")).toBe("https://rent.sulbase.com/app");
    expect(withAppPath("https://rent.sulbase.com/app")).toBe("https://rent.sulbase.com/app");
  });

  it("redirects only the lab workers.dev host", () => {
    const lab = new URL("https://rent.sistemas-d5d.workers.dev/app/rent?x=1");
    expect(canonicalRedirectTarget(lab, true)).toBe("https://rent.sulbase.com/app/rent?x=1");
    expect(canonicalRedirectTarget(lab, false)).toBeNull();
    expect(canonicalRedirectTarget(new URL("http://localhost:5173/"), true)).toBeNull();
    expect(canonicalRedirectTarget(new URL("https://rent.sulbase.com/"), true)).toBeNull();
  });
});

describe("public files", () => {
  it("publishes only the landing in the sitemap and blocks the app", () => {
    expect(sitemapXml()).toContain("https://rent.sulbase.com/</loc>");
    expect(sitemapXml()).not.toContain("/app");
    expect(robotsTxt()).toContain("Disallow: /app/");
    expect(robotsTxt()).toContain("Disallow: /api/");
    expect(robotsTxt()).toContain("User-agent: GPTBot");
    expect(robotsTxt()).toContain("Sitemap: https://rent.sulbase.com/sitemap.xml");
    expect(llmsTxt()).toContain("https://rent.sulbase.com/app");
  });

  it("describes the product without a price offer", () => {
    const graph = jsonLdGraph()["@graph"] as Array<Record<string, unknown>>;
    expect(graph.map((node) => node["@type"])).toEqual(["Organization", "SoftwareApplication"]);
    expect(JSON.stringify(graph)).not.toContain("Offer");
  });
});
