import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
export async function currentUser(){const session=await readSession((await cookies()).get("apms_session")?.value);if(!session)return null;const r=await db.query("SELECT id,email,slug,display_name,role,disabled_at FROM users WHERE lower(email)=lower($1) AND disabled_at IS NULL",[session.email]);return r.rows[0]??null;}
export async function requireUser(){const user=await currentUser();if(!user)throw new Response("Unauthorized",{status:401});return user;}
export async function requireAdmin(){const user=await requireUser();if(user.role!=="admin")throw new Response("Forbidden",{status:403});return user;}
export function apiError(error:unknown){if(error instanceof Response)return error;console.error(error);return Response.json({error:"요청을 처리하지 못했습니다."},{status:500});}
