import { Client } from "@neondatabase/serverless";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
if (typeof WebSocket === "undefined") {
  console.error("db:migrate needs a global WebSocket (Node 22+)");
  process.exit(1);
}

const LOCK_ID = 727274;
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const names = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();

const client = new Client(url);
await client.connect();

const done = [];
try {
  await client.query(`select pg_advisory_lock(${LOCK_ID})`);
  await client.query(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())",
  );
  const { rows } = await client.query("select name from schema_migrations");
  const applied = new Set(rows.map((row) => row.name));

  for (const name of names) {
    if (applied.has(name)) continue;
    const text = await readFile(path.join(dir, name), "utf8");
    await client.query("begin");
    try {
      await client.query(text);
      await client.query("insert into schema_migrations (name) values ($1)", [name]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
    done.push(name);
  }
} finally {
  await client.end();
}

console.log(done.length ? `Applied: ${done.join(", ")}` : "No pending migrations");
