import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const { DATABASE_URL, APMS_ADMIN_EMAIL, APMS_ADMIN_PASSWORD } = process.env;
if (!DATABASE_URL || !APMS_ADMIN_EMAIL || !APMS_ADMIN_PASSWORD) throw new Error("Database and admin settings are required");
const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
try {
  const passwordHash = await bcrypt.hash(APMS_ADMIN_PASSWORD, 12);
  await client.query(`INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin') ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'`, [APMS_ADMIN_EMAIL.toLowerCase(), passwordHash]);
  console.log("Admin account seeded");
} finally { await client.end(); }
