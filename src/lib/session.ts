import { SignJWT, jwtVerify } from "jose";
export type Session = { email: string; role: string };
function secret() { const value = process.env.AUTH_SECRET; if (!value) throw new Error("AUTH_SECRET is not configured"); return new TextEncoder().encode(value); }
export function sessionTtlSeconds(remember = false) {
  const value = remember
    ? Number(process.env.DIRIGO_REMEMBER_TTL_DAYS || 30) * 86_400
    : Number(process.env.DIRIGO_SESSION_TTL_HOURS || 24) * 3_600;
  return Math.max(1, Math.floor(value));
}
export async function createSession(payload: Session, remember = false) { return new SignJWT({ ...payload, remember }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${sessionTtlSeconds(remember)}s`).sign(secret()); }
export async function readSession(token?: string): Promise<Session | null> { if (!token) return null; try { const { payload } = await jwtVerify(token, secret()); return typeof payload.email === "string" && typeof payload.role === "string" ? { email: payload.email, role: payload.role } : null; } catch { return null; } }
export function sessionCookie(token: string, remember = false, now = Date.now()) { const ttl = sessionTtlSeconds(remember); return `dirigo_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ttl}; Expires=${new Date(now + ttl * 1000).toUTCString()}`; }
