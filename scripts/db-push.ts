import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { Client } from "pg";

import { requireEnv } from "./_shared";

/**
 * Apply supabase/migrations/*.sql to the database in DATABASE_URL.
 *
 *   npm run db:push
 *   npm run db:push -- --force   # re-run migrations that are already recorded
 *
 * The Supabase CLI was not available in this environment, so this is the
 * repeatable path: it records what it applied in `public.schema_migrations`,
 * runs each file in its own transaction, and skips anything already applied.
 * The migrations are written to be idempotent, so --force is safe too.
 *
 * Needs DATABASE_URL (Project Settings -> Database -> Connection string), which
 * is only used by this script - the app itself never connects to Postgres
 * directly, it goes through Supabase with the anon key so RLS applies.
 */
const MIGRATIONS_DIR = join("supabase", "migrations");

async function main() {
  const force = process.argv.includes("--force");
  const connectionString = requireEnv("DATABASE_URL");

  const client = new Client({
    connectionString,
    // Supabase terminates TLS with its own CA; verifying it would need the
    // bundled root certificate, which is not worth shipping for a setup script
    // that only ever talks to the project in DATABASE_URL.
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120_000,
  });

  try {
    await client.connect();
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENETUNREACH" || code === "EHOSTUNREACH") {
      const host = (() => {
        try {
          return new URL(connectionString).host;
        } catch {
          return "the configured host";
        }
      })();
      console.error(
        `\nCould not reach ${host}.\n\n` +
          "Supabase's direct connection host (db.<ref>.supabase.co) is IPv6-only.\n" +
          "If your network has no routable IPv6 address, use the IPv4 connection\n" +
          "pooler instead: Supabase dashboard -> Connect -> Session pooler. It looks\n" +
          "like\n\n" +
          "  postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres\n\n" +
          "Put that in DATABASE_URL and run this again.\n",
      );
      process.exit(1);
    }
    throw error;
  }

  console.log("Connected.\n");

  await client.query(`
    create table if not exists public.schema_migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  /*
   * This is the script's own bookkeeping, but it lives in `public`, which
   * Supabase exposes through PostgREST and grants to anon/authenticated by
   * default. Enabling RLS with no policies at all makes it deny-by-default for
   * every client while this script - connecting as the table owner - is
   * unaffected. Without it, anyone could list our migration filenames.
   */
  await client.query(
    "alter table public.schema_migrations enable row level security",
  );
  await client.query(
    "revoke all on public.schema_migrations from anon, authenticated",
  );

  const { rows } = await client.query<{ name: string }>(
    "select name from public.schema_migrations",
  );
  const applied = new Set(rows.map((row) => row.name));

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  let ran = 0;

  for (const file of files) {
    if (applied.has(file) && !force) {
      console.log(`  skip    ${file} (already applied)`);
      continue;
    }

    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");

    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        `insert into public.schema_migrations (name) values ($1)
         on conflict (name) do update set applied_at = now()`,
        [file],
      );
      await client.query("commit");
      console.log(`  applied ${file}`);
      ran += 1;
    } catch (error) {
      await client.query("rollback");
      console.error(`\nFailed on ${file}:`);
      throw error;
    }
  }

  // Report what actually exists afterwards, rather than trusting the above.
  const { rows: tables } = await client.query<{
    table_name: string;
    rls: boolean;
    policies: number;
  }>(`
    select c.relname as table_name,
           c.relrowsecurity as rls,
           (select count(*) from pg_policy p where p.polrelid = c.oid)::int as policies
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `);

  console.log(`\n${ran} migration(s) applied.\n`);
  console.log("Tables in public schema:");
  console.log("  table                      RLS     policies");
  for (const table of tables) {
    console.log(
      `  ${table.table_name.padEnd(26)} ${String(table.rls).padEnd(7)} ${table.policies}`,
    );
  }

  const unprotected = tables.filter(
    (table) => table.table_name !== "schema_migrations" && !table.rls,
  );
  if (unprotected.length > 0) {
    console.error(
      `\nWARNING: RLS is NOT enabled on: ${unprotected
        .map((table) => table.table_name)
        .join(", ")}`,
    );
    process.exitCode = 1;
  }

  await client.end();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
