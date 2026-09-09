import { SignJWT, jwtVerify } from "jose";
export type Session = { email: string; role: string };
function secret() { const value = process.env.AUTH_SECRET; if (!value) throw new Error("AUTH_SECRET is not configured"); return new TextEncoder().encode(value); }
export async function createSession(payload: Session) { return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("24h").sign(secret()); }
export async function readSession(token?: string): Promise<Session | null> { if (!token) return null; try { const { payload } = await jwtVerify(token, secret()); return typeof payload.email === "string" && typeof payload.role === "string" ? { email: payload.email, role: payload.role } : null; } catch { return null; } }
