# Rollback plan (Worker + database)

Use when a bad deploy reaches production or migrations cause an incident.

## 1. Cloudflare Worker (fast)

Production deploys only from **`main`** via GitHub Actions (`deploy` job).

1. Identify last good commit on `main` (`git log` or GitHub Releases / Actions history).
2. Revert on `main` with a normal PR (preferred) or deploy a known-good SHA:
   - **Preferred:** `git revert <bad-commit>` → PR → merge → CI redeploys automatically.
   - **Emergency:** re-run the successful **Deploy production Worker** workflow from the last green `main` run in Actions.

3. Confirm `https://rent.sistemas-d5d.workers.dev/api/health` and a signed-in smoke test.

Preview Workers from open PRs are independent; they do not affect production.

## 2. Database (slow, careful)

Schema changes are **not** rolled back by redeploying the Worker.

1. Stop destructive fixes; do not run ad-hoc SQL on production without a backup.
2. Restore from the latest off-repo dump (see [db-backup-restore.md](./db-backup-restore.md)) **only** on a lab project first.
3. For production: forward-fix with a new Drizzle migration when possible; restore is last resort.

## 3. Secrets

If a secret was rotated incorrectly, fix with `wrangler secret put <NAME>` from the sulbase account; no git change required.

## 4. Communication

Note incident start/end, bad commit SHA, revert PR link, and whether DB restore was needed.
