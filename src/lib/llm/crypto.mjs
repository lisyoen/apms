import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function derive(secret) {
  if (!secret) throw new Error("AUTH_SECRET is required for LLM key encryption");
  return createHash("sha256").update(`apms:llm:v1:${secret}`).digest();
}
export function encryptApiKey(value, secret = process.env.AUTH_SECRET) {
  if (!value) throw new Error("API key is required");
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", derive(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}
export function decryptApiKey(envelope, secret = process.env.AUTH_SECRET) {
  const [version, iv, tag, ciphertext] = String(envelope).split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted API key");
  const decipher = createDecipheriv("aes-256-gcm", derive(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
