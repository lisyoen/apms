import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { getConfig } from "../config/loader";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 8_000;
const TIMEOUT_MS = 10_000;

export type FetchUrlResult = { url: string; finalUrl: string; title: string; text: string; truncated: boolean };
export type FetchUrlErrorCode = "connection" | "timeout" | "blocked_status" | "unsupported_type" | "blocked_address" | "redirect_limit" | "too_large";

export class FetchUrlError extends Error {
  constructor(public code: FetchUrlErrorCode, message: string, public status?: number) { super(message); }
}

export const FETCH_URL_ERROR_MESSAGES: Record<FetchUrlErrorCode, string> = {
  connection: "URL 읽기 실패 — 접속 오류",
  timeout: "URL 읽기 실패 — 타임아웃(10초)",
  blocked_status: "URL 읽기 실패 — 차단(403·429)",
  unsupported_type: "URL 읽기 실패 — 지원하지 않는 형식",
  blocked_address: "URL 읽기 실패 — 차단된 주소(내부망)",
  redirect_limit: "URL 읽기 실패 — 리다이렉트 한도 초과",
  too_large: "URL 읽기 실패 — 본문 크기 초과(2MB)",
};

function isBlockedIp(value: string) {
  const ip = value.toLowerCase().split("%")[0];
  if (ip === "::1" || ip === "::" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb")) return true;
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const candidate = mapped ?? ip;
  if (isIP(candidate) !== 4) return false;
  const [a, b] = candidate.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

export async function assertPublicUrl(raw: string, resolver = lookup) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new FetchUrlError("connection", FETCH_URL_ERROR_MESSAGES.connection); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new FetchUrlError("blocked_address", FETCH_URL_ERROR_MESSAGES.blocked_address);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal" || host.endsWith(".internal")) throw new FetchUrlError("blocked_address", FETCH_URL_ERROR_MESSAGES.blocked_address);
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new FetchUrlError("blocked_address", FETCH_URL_ERROR_MESSAGES.blocked_address);
  } else {
    let addresses: { address: string }[];
    try { addresses = await resolver(host, { all: true, verbatim: true }) as { address: string }[]; }
    catch { throw new FetchUrlError("connection", FETCH_URL_ERROR_MESSAGES.connection); }
    if (!addresses.length || addresses.some((entry) => isBlockedIp(entry.address))) throw new FetchUrlError("blocked_address", FETCH_URL_ERROR_MESSAGES.blocked_address);
  }
  return url;
}

function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity: string) => entity[0] === "#" ? String.fromCodePoint(Number(entity[1].toLowerCase() === "x" ? `0x${entity.slice(2)}` : entity.slice(1))) : named[entity.toLowerCase()] ?? `&${entity};`);
}

export function extractHtml(html: string, maxText = MAX_TEXT) {
  const title = decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const cleaned = html
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<(script|style|nav|header|footer|aside|noscript|svg|form)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const region = cleaned.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? cleaned;
  const text = decodeEntities(region.replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6]|section|tr)>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const truncated = text.length > maxText;
  return { title, text: truncated ? `${text.slice(0, maxText)}\n\n[본문이 ${maxText.toLocaleString()}자에서 절단됨]` : text, truncated };
}

async function readLimited(response: Response, maxBytes = MAX_BYTES) {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new FetchUrlError("too_large", FETCH_URL_ERROR_MESSAGES.too_large);
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new FetchUrlError("too_large", FETCH_URL_ERROR_MESSAGES.too_large); }
    chunks.push(value);
  }
  const all = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(all);
}

export async function fetchUrl(raw: string, options: { fetchImpl?: typeof fetch; resolver?: typeof lookup; timeoutMs?: number } = {}): Promise<FetchUrlResult> {
  const settings = getConfig().config.fetch;
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolver = options.resolver ?? lookup;
  let current = await assertPublicUrl(raw, resolver);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? settings.timeout_ms);
  try {
    for (let redirects = 0; ; redirects++) {
      let response: Response;
      try { response = await fetchImpl(current, { redirect: "manual", signal: controller.signal, headers: { "user-agent": "Dirigo URL Reader/1.0", accept: "text/html,application/xhtml+xml" } }); }
      catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) throw new FetchUrlError("timeout", FETCH_URL_ERROR_MESSAGES.timeout);
        throw new FetchUrlError("connection", FETCH_URL_ERROR_MESSAGES.connection);
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirects >= MAX_REDIRECTS) throw new FetchUrlError("redirect_limit", FETCH_URL_ERROR_MESSAGES.redirect_limit);
        const location = response.headers.get("location");
        if (!location) throw new FetchUrlError("connection", FETCH_URL_ERROR_MESSAGES.connection);
        current = await assertPublicUrl(new URL(location, current).toString(), resolver);
        continue;
      }
      if (response.status === 403 || response.status === 429) throw new FetchUrlError("blocked_status", FETCH_URL_ERROR_MESSAGES.blocked_status, response.status);
      if (!response.ok) throw new FetchUrlError("connection", FETCH_URL_ERROR_MESSAGES.connection, response.status);
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new FetchUrlError("unsupported_type", FETCH_URL_ERROR_MESSAGES.unsupported_type);
      const extracted = extractHtml(await readLimited(response, settings.max_bytes), settings.max_chars);
      return { url: raw, finalUrl: current.toString(), ...extracted };
    }
  } finally { clearTimeout(timer); }
}
