import { readFileSync } from "node:fs";
import postgres from "postgres";

// Runs supabase/migrations/seeds.sql directly against the database,
// bypassing the Supabase SQL Editor's paste size limit (the seed file
// is a single ~1.5MB DO $$ block and exceeds it).
//
// Usage (PowerShell):
//   $env:DATABASE_URL = "postgresql://postgres:[PASSWORD]@db.<project-ref>.supabase.co:5432/postgres"
//   node scripts/run_seed.mjs
//
// Get the connection string from: Supabase Dashboard -> Project Settings
// -> Database -> Connection string -> URI ("Direct connection", port 5432,
// not the pgbouncer pooler -- the seed runs as one large transaction).

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set DATABASE_URL first, e.g.:");
  console.error('  $env:DATABASE_URL = "postgresql://postgres:[PASSWORD]@db.<project-ref>.supabase.co:5432/postgres"');
  process.exit(1);
}

const filePath = process.argv[2] ?? new URL("../supabase/migrations/seeds.sql", import.meta.url);
const sql = postgres(connectionString, { max: 1 });

try {
  const text = readFileSync(filePath, "utf-8");
  console.log(`running ${filePath}...`);
  await sql.unsafe(text);
  console.log("done.");
} finally {
  await sql.end();
}
