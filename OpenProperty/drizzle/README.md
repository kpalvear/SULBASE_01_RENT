# Migraciones Postgres (Drizzle)

- Generar: `pnpm db:pg:generate` (desde `OpenProperty/`, con `DATABASE_URL` en `.env`, puerto **5432**).
- Aplicar: `pnpm db:pg:migrate`.

Si `drizzle-kit` vuelve a emitir FKs compuestas antes de los índices únicos `(id, organization_id)`, mueve esos `CREATE UNIQUE INDEX uq_*_id_org` **antes** del bloque `ALTER TABLE … ADD CONSTRAINT` en el SQL nuevo (ver `0000_small_chimera.sql`).

El `db:migrate` de wrangler sigue siendo solo D1 local hasta Fase 2.
