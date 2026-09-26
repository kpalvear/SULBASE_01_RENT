import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const configFile = path.join(root, "vite.config.ts");

await rm(dist, { recursive: true, force: true });
await build({ configFile });

const server = await createServer({
  configFile,
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const landing = await server.ssrLoadModule("/src/landing/entry-server.tsx");
  const site = await server.ssrLoadModule("/src/shared/public-site.ts");
  await mkdir(dist, { recursive: true });
  await writeFile(path.join(dist, "index.html"), await landing.renderLandingDocument());
  await writeFile(path.join(dist, "robots.txt"), site.robotsTxt());
  await writeFile(path.join(dist, "sitemap.xml"), site.sitemapXml());
  await writeFile(path.join(dist, "llms.txt"), site.llmsTxt());
  await copyFile(path.join(root, "icon.svg"), path.join(dist, "icon.svg"));
} finally {
  await server.close();
}
