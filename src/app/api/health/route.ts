import { db } from "@/lib/db";
export async function GET() { try { await db.query("SELECT 1"); return Response.json({ status: "ok", db: true }); } catch { return Response.json({ status: "error", db: false }, { status: 503 }); } }
