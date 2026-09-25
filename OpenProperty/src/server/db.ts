import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { resolveDatabaseUrl, type WorkerBindings } from "./env";

export type AppDb = PostgresJsDatabase<typeof schema>;
export type Sql = ReturnType<typeof postgres>;

export type DbHandle = {
  sql: Sql;
  db: AppDb;
  close: () => Promise<void>;
};

/** One short-lived client per request (Workers + PgBouncer transaction mode). */
export function createDbHandle(env: WorkerBindings): DbHandle {
  const url = resolveDatabaseUrl(env);
  const sql = postgres(url, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  const db = drizzle(sql, { schema });
  return {
    sql,
    db,
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}
