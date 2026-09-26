import type { Sql } from "../db";

/**
 * Turn unexpired invitations for this email into memberships.
 * Existing memberships keep their role (`ON CONFLICT DO NOTHING`).
 */
export async function acceptPendingInvitations(
  sql: Sql,
  userId: string,
  email: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  await sql.unsafe(
    `
    WITH pending AS (
      SELECT id, organization_id, role
      FROM organization_invitations
      WHERE lower(email) = $2
        AND accepted_at IS NULL
        AND expires_at > now()
    ),
    inserted AS (
      INSERT INTO memberships (organization_id, user_id, role)
      SELECT organization_id, $1::uuid, role
      FROM pending
      ON CONFLICT (organization_id, user_id) DO NOTHING
      RETURNING organization_id
    )
    UPDATE organization_invitations i
    SET accepted_at = now()
    FROM pending p
    WHERE i.id = p.id
      AND EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.organization_id = p.organization_id
          AND m.user_id = $1::uuid
      )
    `,
    [userId, normalized],
  );
}
