import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);
const tables = await sql`
  select tablename from pg_tables where schemaname = 'public' order by 1
`;
let migrations = [];
try {
  migrations = await sql`select id, hash, created_at from drizzle.__drizzle_migrations`;
} catch (e) {
  migrations = [{ error: String(e) }];
}
console.log(JSON.stringify({ tables, migrations }, null, 2));
await sql.end();
