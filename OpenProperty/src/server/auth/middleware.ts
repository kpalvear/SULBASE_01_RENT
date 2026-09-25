import { createDbHandle } from "../db";
import { factory } from "../factory";
import { resolveOrganizationId } from "../organization";
import { ensureSeeded } from "../seed";
import { bearerToken, verifySupabaseAccessToken } from "./jwt";
import { canMutate } from "./roles";
import { resolveTenant } from "./tenant";
import { uuidParam } from "../pg";

const PUBLIC_PATHS = new Set(["/api/health"]);
const JWT_ONLY_PATHS = new Set(["/api/auth/bootstrap", "/api/me"]);

/** Never bypass when JWT secret is configured (production must set the secret). */
function isDevBypass(env: { AUTH_DEV_BYPASS?: string; SUPABASE_JWT_SECRET?: string }): boolean {
  if (env.SUPABASE_JWT_SECRET?.trim()) return false;
  return env.AUTH_DEV_BYPASS === "true";
}

export const dbMiddleware = factory.createMiddleware(async (c, next) => {
  const handle = createDbHandle(c.env);
  c.set("sql", handle.sql);
  c.set("db", handle.db);
  try {
    await next();
  } finally {
    await handle.close();
  }
});

export const authMiddleware = factory.createMiddleware(async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_PATHS.has(path)) {
    return next();
  }

  if (!path.startsWith("/api/")) {
    return next();
  }

  const db = c.get("db");

  if (isDevBypass(c.env)) {
    const slug = c.env.DEV_ORGANIZATION_SLUG ?? "dev";
    const oid = await resolveOrganizationId(db, slug);
    c.set("userId", null);
    c.set("userEmail", null);
    c.set("orgId", oid);
    c.set("role", "owner");
    await ensureSeeded(db, oid);
    return next();
  }

  const token = bearerToken(c.req.header("Authorization"));
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let user: { sub: string; email?: string };
  try {
    user = await verifySupabaseAccessToken(token, c.env.SUPABASE_JWT_SECRET);
  } catch {
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  c.set("userId", user.sub);
  c.set("userEmail", user.email ?? null);

  if (JWT_ONLY_PATHS.has(path)) {
    return next();
  }

  const requestedOrg = uuidParam(c.req.header("X-Organization-Id"));
  const tenant = await resolveTenant(db, user.sub, requestedOrg);
  if (!tenant) {
    const msg = requestedOrg
      ? "You do not have access to this organization"
      : "Choose an organization (X-Organization-Id) or complete onboarding";
    return c.json({ error: msg }, 403);
  }

  c.set("orgId", tenant.organizationId);
  c.set("role", tenant.role);
  await ensureSeeded(db, tenant.organizationId);

  const method = c.req.method;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !canMutate(tenant.role)) {
    return c.json({ error: "Insufficient permissions" }, 403);
  }

  return next();
});
