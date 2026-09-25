import type { Sql } from "../db";

/**
 * After email confirm, Supabase may issue a new auth.users id for the same email.
 * Re-assign memberships from older user rows that share the verified JWT email.
 */
export async function reconcileMembershipsByEmail(
  sql: Sql,
  userId: string,
  email: string,
): Promise<number> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return 0;

  const rows = await sql.unsafe<{ n: number }[]>(
    `
    WITH moved AS (
      UPDATE memberships m
      SET user_id = $1::uuid
      FROM auth.users u
      WHERE m.user_id = u.id
        AND lower(u.email) = $2
        AND m.user_id <> $1::uuid
      RETURNING 1
    )
    SELECT COUNT(*)::int AS n FROM moved
    `,
    [userId, normalized],
  );

  const n = rows[0]?.n;
  return typeof n === "number" ? n : 0;
}
