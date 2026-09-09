import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const dir = join(process.cwd(), "db", "migrations");
  for (const file of (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort()) {
    await client.query(await readFile(join(dir, file), "utf8"));
    console.log(`Applied ${file}`);
  }
} finally { await client.end(); }
