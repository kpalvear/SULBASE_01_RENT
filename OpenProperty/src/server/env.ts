import type { Hyperdrive } from "@cloudflare/workers-types";
import type { AppDb, Sql } from "./db";
import type { MembershipRole } from "./auth/roles";

export type WorkerBindings = {
  ASSETS: Fetcher;
  /** Transaction pooler (6543) or Hyperdrive connection string — never commit real values. */
  DATABASE_URL: string;
  /** Slug for local dev when AUTH_DEV_BYPASS or no JWT secret (never in production). */
  DEV_ORGANIZATION_SLUG?: string;
  /** HS256 secret from Supabase project settings — required in production. */
  SUPABASE_JWT_SECRET?: string;
  /** Set to "true" only in local wrangler.toml; omit in production. */
  AUTH_DEV_BYPASS?: string;
  HYPERDRIVE?: Hyperdrive;
};

export type WorkerVariables = {
  orgId: string;
  sql: Sql;
  db: AppDb;
  userId: string | null;
  userEmail: string | null;
  role: MembershipRole;
};

declare module "hono" {
  interface ContextVariableMap extends WorkerVariables {}
}

export type AppEnv = {
  Bindings: WorkerBindings;
  Variables: WorkerVariables;
};

export function resolveDatabaseUrl(env: WorkerBindings): string {
  const fromHyperdrive = env.HYPERDRIVE?.connectionString;
  if (fromHyperdrive) return fromHyperdrive;
  if (env.DATABASE_URL) return env.DATABASE_URL;
  throw new Error(
    "DATABASE_URL (or HYPERDRIVE binding) is required. Use Supabase transaction pooler (port 6543) with prepare disabled.",
  );
}
