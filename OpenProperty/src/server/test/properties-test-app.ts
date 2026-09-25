import type { MembershipRole } from "../auth/roles";
import { factory } from "../factory";
import type { AppDb, Sql } from "../db";
import { mountPropertiesRoutes } from "../routes/properties";

export function createPropertiesTestApp(options: {
  orgId: string;
  sql: Sql;
  role?: MembershipRole;
  userId?: string;
}) {
  const app = factory.createApp();

  app.use("*", async (c, next) => {
    c.set("sql", options.sql);
    c.set("db", {} as AppDb);
    c.set("orgId", options.orgId);
    c.set("userId", options.userId ?? "00000000-0000-4000-8000-000000000099");
    c.set("userEmail", null);
    c.set("role", options.role ?? "owner");
    await next();
  });

  mountPropertiesRoutes(app);
  return app;
}
