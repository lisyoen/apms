import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { userSlug } from "@/lib/storage/index";

export async function currentUser() { const session = await readSession((await cookies()).get("apms_session")?.value); if (!session) return null; const result = await db.query("SELECT id,email,role FROM users WHERE lower(email)=lower($1) AND disabled_at IS NULL", [session.email]).catch(async () => db.query("SELECT id,email,role FROM users WHERE lower(email)=lower($1)", [session.email])); const row = result.rows[0]; return row ? { ...row, storageSlug: userSlug(row.email, row.id) } : null; }
export async function ownedProject(slug: string) { const user = await currentUser(); if (!user) return { error: Response.json({ error: "unauthorized" }, { status: 401 }) } as const; const result = await db.query("SELECT p.* FROM projects p WHERE p.slug=$1 AND p.archived_at IS NULL", [slug]); const project = result.rows.find((row) => row.owner_id === user.id); if (!project) return { error: Response.json({ error: result.rowCount ? "forbidden" : "not_found" }, { status: result.rowCount ? 403 : 404 }) } as const; return { user, project } as const; }
export function jsonError(message: string, status = 400) { return Response.json({ error: message }, { status }); }
export async function requestJson<T>(request: Request): Promise<T | null> { try { return await request.json() as T; } catch { return null; } }
