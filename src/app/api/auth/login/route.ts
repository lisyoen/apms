import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, sessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "잘못된 요청입니다." }, { status: 400 }); }
  if (!body.email || !body.password) return Response.json({ error: "이메일과 비밀번호를 입력하세요." }, { status: 400 });
  const email = body.email.trim().toLowerCase();
  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim().slice(0, 64);
  const limit = Math.max(1, Number(process.env.DIRIGO_LOGIN_MAX_ATTEMPTS || 5));
  const windowMinutes = Math.max(1, Number(process.env.DIRIGO_LOGIN_LOCKOUT_MINUTES || 15));
  const failures = await db.query("SELECT count(*)::int count,min(attempted_at) first_at FROM login_attempts WHERE lower(email)=lower($1) AND ip=$2 AND NOT succeeded AND attempted_at > now()-($3*interval '1 minute')", [email, ip, windowMinutes]);
  if (failures.rows[0].count >= limit) {
    const retry = Math.max(1, Math.ceil((new Date(failures.rows[0].first_at).getTime() + windowMinutes * 60_000 - Date.now()) / 1000));
    return Response.json({ error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요." }, { status: 429, headers: { "Retry-After": String(retry) } });
  }
  const result = await db.query("SELECT email,password_hash,role FROM users WHERE lower(email)=lower($1) AND disabled_at IS NULL", [email]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
    await db.query("INSERT INTO login_attempts(email,ip,succeeded) VALUES($1,$2,false)", [email, ip]);
    return Response.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  await db.query("DELETE FROM login_attempts WHERE lower(email)=lower($1) AND ip=$2", [email, ip]);
  const token = await createSession({ email: user.email, role: user.role });
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", sessionCookie(token));
  return response;
}
