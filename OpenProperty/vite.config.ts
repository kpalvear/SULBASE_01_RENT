import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { legacyRedirectPath, llmsTxt, robotsTxt, sitemapXml } from "./src/shared/public-site";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function landingDevPlugin(): Plugin {
  return {
    name: "rent-landing-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || (req.method !== "GET" && req.method !== "HEAD")) return next();
        const pathname = req.url.split("?")[0] ?? "";
        if (pathname === "/app") {
          const query = req.url.includes("?") ? `?${req.url.split("?")[1]}` : "";
          res.statusCode = 302;
          res.setHeader("Location", `/app/${query}`);
          res.end();
          return;
        }
        if (pathname.startsWith("/api") || pathname.startsWith("/app/")) return next();

        const legacy = legacyRedirectPath(pathname);
        if (legacy) {
          res.statusCode = 302;
          res.setHeader("Location", legacy);
          res.end();
          return;
        }

        if (pathname === "/icon.svg") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "image/svg+xml");
          fs.createReadStream(path.join(rootDir, "icon.svg")).pipe(res);
          return;
        }

        const send = (body: string, type: string) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", type);
          res.end(req.method === "HEAD" ? undefined : body);
        };

        if (pathname === "/robots.txt") return send(robotsTxt(), "text/plain; charset=utf-8");
        if (pathname === "/sitemap.xml") return send(sitemapXml(), "application/xml; charset=utf-8");
        if (pathname === "/llms.txt") return send(llmsTxt(), "text/plain; charset=utf-8");
        if (pathname === "/" || pathname === "/index.html") {
          const mod = (await server.ssrLoadModule("/src/landing/entry-server.tsx")) as {
            renderLandingDocument: () => Promise<string>;
          };
          send(await mod.renderLandingDocument(), "text/html; charset=utf-8");
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: "/app/",
  plugins: [react(), tailwindcss(), landingDevPlugin()],
  build: {
    outDir: "dist/app",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src/client"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
