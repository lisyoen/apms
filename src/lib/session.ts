import { SignJWT, jwtVerify } from "jose";
export type Session = { email: string; role: string };
function secret() { const value = process.env.AUTH_SECRET; if (!value) throw new Error("AUTH_SECRET is not configured"); return new TextEncoder().encode(value); }
export function sessionTtlSeconds() { const hours = Number(process.env.DIRIGO_SESSION_TTL_HOURS || 24); return Math.max(1, Math.floor(hours * 3600)); }
export async function createSession(payload: Session) { return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${sessionTtlSeconds()}s`).sign(secret()); }
export async function readSession(token?: string): Promise<Session | null> { if (!token) return null; try { const { payload } = await jwtVerify(token, secret()); return typeof payload.email === "string" && typeof payload.role === "string" ? { email: payload.email, role: payload.role } : null; } catch { return null; } }
export function sessionCookie(token: string, now = Date.now()) { const ttl = sessionTtlSeconds(); return `dirigo_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ttl}; Expires=${new Date(now + ttl * 1000).toUTCString()}`; }
