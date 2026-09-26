import type { Context, Hono } from "hono";
import { decideInvite, decideRemove, decideRoleChange } from "../auth/member-policy";
import { assertCanManage } from "../auth/guards";
import type { MembershipRole } from "../auth/roles";
import type { AppEnv } from "../env";
import { get, orgId, query, uuidParam } from "../pg";
import { inviteMemberSchema, memberRoleSchema } from "../schemas/common";
import { parseJson } from "../validation";

type MemberRow = {
  user_id: string;
  role: MembershipRole;
  email: string | null;
  created_at: string;
};

type InvitationRow = {
  id: string;
  email: string;
  role: MembershipRole;
  expires_at: string;
  created_at: string;
};

const INVITE_DAYS = 14;

export function mountMemberRoutes(app: Hono<AppEnv>) {
  app.get("/api/settings/members", async (c) => {
    const denied = assertCanManage(c);
    if (denied) return denied;
    const o = orgId(c);
    const members = await query<MemberRow>(
      c,
      `SELECT m.user_id, m.role, u.email, m.created_at
       FROM memberships m
       LEFT JOIN auth.users u ON u.id = m.user_id
       WHERE m.organization_id = $1
       ORDER BY m.created_at ASC`,
      [o],
    );
    const invitations = await query<InvitationRow>(
      c,
      `SELECT id, email, role, expires_at, created_at
       FROM organization_invitations
       WHERE organization_id = $1
         AND accepted_at IS NULL
         AND expires_at > now()
       ORDER BY created_at ASC`,
      [o],
    );
    return c.json({ members, invitations });
  });

  app.post("/api/settings/members", async (c) => {
    const denied = assertCanManage(c);
    if (denied) return denied;
    const parsed = await parseJson(c, inviteMemberSchema);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const decision = decideInvite(c.get("role"), parsed.data.role);
    if (!decision.ok) return c.json({ error: decision.error }, 403);

    const o = orgId(c);
    const email = parsed.data.email.trim().toLowerCase();
    const actor = c.get("userId");

    const existing = await get<{ user_id: string }>(
      c,
      `SELECT m.user_id
       FROM memberships m
       JOIN auth.users u ON u.id = m.user_id
       WHERE m.organization_id = $1 AND lower(u.email) = $2`,
      [o, email],
    );
    if (existing) return c.json({ error: "That email is already a member" }, 409);

    const linked = await get<{ user_id: string }>(
      c,
      `INSERT INTO memberships (organization_id, user_id, role)
       SELECT $1::uuid, u.id, $3::membership_role
       FROM auth.users u
       WHERE lower(u.email) = $2
       LIMIT 1
       RETURNING user_id`,
      [o, email, parsed.data.role],
    );
    if (linked) {
      return c.json({ member: { user_id: linked.user_id, email, role: parsed.data.role } }, 201);
    }

    try {
      const invitation = await get<InvitationRow>(
        c,
        `INSERT INTO organization_invitations
           (organization_id, email, role, invited_by, expires_at)
         VALUES ($1::uuid, $2, $3::membership_role, $4::uuid, now() + ($5::int * interval '1 day'))
         RETURNING id, email, role, expires_at, created_at`,
        [o, email, parsed.data.role, actor, INVITE_DAYS],
      );
      return c.json({ invitation }, 201);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json({ error: "There is already a pending invitation for that email" }, 409);
      }
      throw err;
    }
  });

  app.patch("/api/settings/members/:userId", async (c) => {
    const denied = assertCanManage(c);
    if (denied) return denied;
    const userId = uuidParam(c.req.param("userId"));
    if (!userId) return c.json({ error: "Invalid user id" }, 400);
    const parsed = await parseJson(c, memberRoleSchema);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const outcome = await withMemberLock(c, userId, async (tx, current, ownerCount) => {
      const decision = decideRoleChange({
        actor: c.get("role"),
        targetRole: current.role,
        nextRole: parsed.data.role,
        ownerCount,
      });
      if (!decision.ok) return { status: 403 as const, error: decision.error };
      await tx.unsafe(
        `UPDATE memberships SET role = $3::membership_role
         WHERE organization_id = $1::uuid AND user_id = $2::uuid`,
        [orgId(c), userId, parsed.data.role],
      );
      return { status: 200 as const };
    });
    if ("error" in outcome) {
      return c.json({ error: outcome.error }, outcome.status);
    }
    return c.json({ user_id: userId, role: parsed.data.role });
  });

  app.delete("/api/settings/members/:userId", async (c) => {
    const denied = assertCanManage(c);
    if (denied) return denied;
    const userId = uuidParam(c.req.param("userId"));
    if (!userId) return c.json({ error: "Invalid user id" }, 400);

    const outcome = await withMemberLock(c, userId, async (tx, current, ownerCount) => {
      const decision = decideRemove({
        actor: c.get("role"),
        targetRole: current.role,
        ownerCount,
      });
      if (!decision.ok) return { status: 403 as const, error: decision.error };
      await tx.unsafe(
        `DELETE FROM memberships WHERE organization_id = $1::uuid AND user_id = $2::uuid`,
        [orgId(c), userId],
      );
      return { status: 200 as const };
    });
    if ("error" in outcome) return c.json({ error: outcome.error }, outcome.status);
    return c.json({ ok: true });
  });

  app.delete("/api/settings/invitations/:id", async (c) => {
    const denied = assertCanManage(c);
    if (denied) return denied;
    const id = uuidParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid invitation id" }, 400);
    const removed = await get<{ id: string }>(
      c,
      `DELETE FROM organization_invitations
       WHERE id = $1::uuid AND organization_id = $2::uuid AND accepted_at IS NULL
       RETURNING id`,
      [id, orgId(c)],
    );
    if (!removed) return c.json({ error: "Invitation not found" }, 404);
    return c.json({ ok: true });
  });
}

type Exec = {
  unsafe: (query: string, params?: unknown[]) => Promise<unknown>;
};

async function withMemberLock(
  c: Context<AppEnv>,
  userId: string,
  fn: (
    tx: Exec,
    current: { role: MembershipRole },
    ownerCount: number,
  ) => Promise<{ status: 200 } | { status: 403 | 404; error: string }>,
): Promise<{ status: 200 } | { status: 403 | 404; error: string }> {
  const o = orgId(c);
  return c.get("sql").begin(async (tx) => {
    const rows = await tx.unsafe<{ role: MembershipRole }[]>(
      `SELECT role FROM memberships
       WHERE organization_id = $1::uuid AND user_id = $2::uuid
       FOR UPDATE`,
      [o, userId],
    );
    const current = rows[0];
    if (!current) return { status: 404 as const, error: "Member not found" };
    const counts = await tx.unsafe<{ n: number }[]>(
      `SELECT COUNT(*)::int AS n FROM memberships
       WHERE organization_id = $1::uuid AND role = 'owner'`,
      [o],
    );
    const ownerCount = counts[0]?.n ?? 0;
    return fn(tx as unknown as Exec, current, ownerCount);
  });
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}
