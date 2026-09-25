# Postgres backup and restore (Supabase Free)

The Free plan has **no** automatic backups or PITR. Keep dumps **outside** the git repo.

## Backup (development or production project)

From a machine with network access to Supabase:

1. Dashboard → **Project Settings** → **Database** → copy the **direct** connection string (port **5432**, not the pooler), or use `DATABASE_URL` with `?pgbouncer=false` for `pg_dump`.
2. Run:

```bash
pg_dump "$DATABASE_DIRECT_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="rent-$(date +%Y%m%d).dump"
```

Store the file in encrypted storage (not in this repository).

## Restore (verify on a **non-production** project first)

1. Create an empty Supabase project or truncate a lab database.
2. Apply Drizzle migrations if the target is fresh: `pnpm run db:pg:migrate` from `OpenProperty/` with `DATABASE_URL` pointing at the target.
3. Restore:

```bash
pg_restore --dbname="$DATABASE_DIRECT_URL" --no-owner --no-acl --clean --if-exists rent-YYYYMMDD.dump
```

4. Smoke test: `pnpm run typecheck`, sign in, hit `/api/health` and one tenant-scoped route.

## Checklist (Fase 5 / pre-launch)

- [ ] At least one successful backup stored off-repo
- [ ] Restore tested on lab project and documented date
- [ ] Production uses a **separate** Supabase project before real user data (see `AGENTS.md`)
