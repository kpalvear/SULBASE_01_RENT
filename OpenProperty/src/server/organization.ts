import { eq } from "drizzle-orm";
import { organizations } from "../db/schema";
import type { AppDb } from "./db";

export async function resolveOrganizationId(
  db: AppDb,
  slug: string,
): Promise<string> {
  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (existing[0]) return existing[0].id;

  const inserted = await db
    .insert(organizations)
    .values({ name: "Development", slug })
    .returning({ id: organizations.id });

  return inserted[0]!.id;
}
