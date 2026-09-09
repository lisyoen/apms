import { Pool } from "pg";
const globalForDb = globalThis as unknown as { apmsPool?: Pool };
export const db = globalForDb.apmsPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== "production") globalForDb.apmsPool = db;
