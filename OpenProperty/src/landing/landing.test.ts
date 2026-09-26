import { describe, expect, it } from "vitest";
import { renderLandingDocument } from "./entry-server";

describe("landing document", () => {
  it("prerenders Spanish copy, login, and JSON-LD without noindex", async () => {
    const html = await renderLandingDocument();
    expect(html).toContain("<html lang=\"es\">");
    expect(html).toContain("Gestión de arrendamientos");
    expect(html).toContain('href="/app/"');
    expect(html).toContain('rel="canonical" href="https://rent.sulbase.com/"');
    expect(html).toContain("metros cuadrados");
    expect(html).not.toContain("noindex");

    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).toBeTruthy();
    const data = JSON.parse(match?.[1] ?? "{}") as { "@graph": Array<{ "@type": string }> };
    expect(data["@graph"].map((node) => node["@type"])).toEqual([
      "Organization",
      "SoftwareApplication",
    ]);
  });
});
