import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = join(root, "src/server/index.ts");
const outDir = join(root, "src/server/routes");
mkdirSync(outDir, { recursive: true });

const lines = readFileSync(indexPath, "utf8").split(/\r?\n/);
const start = lines.findIndex((l) => l.includes("// ── Properties"));
const end = lines.findIndex((l) => l.includes("// ── Health"));
const routeLines = lines.slice(start, end);

const header = `import { z } from "zod";
import type { Hono } from "hono";
import type { AppEnv } from "../env";
import {
  buildUpdate,
  get,
  normalizeRow,
  normalizeRows,
  orgId,
  query,
  run,
  uuidParam,
  type SqlParam,
} from "../pg";
import { parseJson } from "../validation";
`;

const settingsExtra = `import { DEFAULT_SETTINGS } from "../seed";
`;

const sections = [];
let current = null;
for (const line of routeLines) {
  const m = line.match(/^\/\/ ── (.+?) ─+/);
  if (m) {
    if (current) sections.push(current);
    current = { title: m[1], lines: [] };
  } else if (current) {
    current.lines.push(line);
  }
}
if (current) sections.push(current);

const nameMap = {
  Properties: { file: "properties", fn: "mountPropertiesRoutes" },
  Units: { file: "units", fn: "mountUnitsRoutes" },
  Tenants: { file: "tenants", fn: "mountTenantsRoutes" },
  Leases: { file: "leases", fn: "mountLeasesRoutes" },
  "Rent charges & payments": { file: "rent", fn: "mountRentRoutes" },
  Vendors: { file: "vendors", fn: "mountVendorsRoutes" },
  "Work orders": { file: "work-orders", fn: "mountWorkOrdersRoutes" },
  Applications: { file: "applications", fn: "mountApplicationsRoutes" },
  "Dashboard summary": { file: "dashboard", fn: "mountDashboardRoutes" },
  "Settings (key/value)": { file: "settings", fn: "mountSettingsRoutes" },
};

const mounts = [];
for (const sec of sections) {
  const meta = nameMap[sec.title];
  if (!meta) continue;
  const body = sec.lines.join("\n").trim();
  const extra = meta.file === "settings" ? settingsExtra : "";
  const content = `${header}${extra}
export function ${meta.fn}(app: Hono<AppEnv>) {
${body}
}
`;
  writeFileSync(join(outDir, `${meta.file}.ts`), content);
  mounts.push(meta);
}

const register = `${mounts.map((m) => `import { ${m.fn} } from "./${m.file}";`).join("\n")}

import type { Hono } from "hono";
import type { AppEnv } from "../env";

export function registerApiRoutes(app: Hono<AppEnv>) {
${mounts.map((m) => `  ${m.fn}(app);`).join("\n")}
}
`;

writeFileSync(join(outDir, "register.ts"), register);
console.log("Wrote", mounts.length, "route modules");
