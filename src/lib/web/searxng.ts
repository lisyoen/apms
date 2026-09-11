export type SearchResult = { title: string; url: string; snippet: string; engine: string };
export type SearchResponse = { query: string; language: "ko-KR" | "en"; results: SearchResult[]; unresponsiveEngines: number };
export type SearchErrorCode = "unavailable" | "no_results" | "rate_limit";

export class SearchError extends Error {
  constructor(public code: SearchErrorCode, message: string, public unresponsiveEngines = 0) { super(message); }
}

export const SEARCH_ERROR_MESSAGES = {
  unavailable: "검색 실패 — SearXNG 연결 불가",
  no_results: (count: number) => `검색 실패 — 결과 없음(응답 엔진 ${count}개)`,
  rate_limit: "검색 실패 — 요청 한도 초과",
};

const requests = new Map<string, number[]>();
export function resetSearchRateLimits() { requests.clear(); }
export function checkSearchRateLimit(sessionId: string, now = Date.now()) {
  const recent = (requests.get(sessionId) ?? []).filter((value) => now - value < 60_000);
  if (recent.length >= 5) throw new SearchError("rate_limit", SEARCH_ERROR_MESSAGES.rate_limit);
  recent.push(now); requests.set(sessionId, recent);
}

export function searchLanguage(query: string): "ko-KR" | "en" { return /[가-힣]/.test(query) ? "ko-KR" : "en"; }

export async function webSearch(query: string, count: number, sessionId: string, options: { baseUrl?: string; fetchImpl?: typeof fetch; now?: number } = {}): Promise<SearchResponse> {
  checkSearchRateLimit(sessionId, options.now);
  const baseUrl = options.baseUrl ?? process.env.DIRIGO_SEARXNG_URL;
  if (!baseUrl) throw new SearchError("unavailable", SEARCH_ERROR_MESSAGES.unavailable);
  const language = searchLanguage(query);
  const url = new URL("search", `${baseUrl.replace(/\/+$/, "")}/`);
  url.search = new URLSearchParams({ q: query, format: "json", language }).toString();
  let response: Response;
  try { response = await (options.fetchImpl ?? fetch)(url, { signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" } }); }
  catch { throw new SearchError("unavailable", SEARCH_ERROR_MESSAGES.unavailable); }
  if (!response.ok) throw new SearchError("unavailable", SEARCH_ERROR_MESSAGES.unavailable);
  let data: any;
  try { data = await response.json(); } catch { throw new SearchError("unavailable", SEARCH_ERROR_MESSAGES.unavailable); }
  const unresponsiveEngines = Array.isArray(data.unresponsive_engines) ? data.unresponsive_engines.length : 0;
  const limit = Math.max(1, Math.min(5, Number.isFinite(Number(count)) ? Math.floor(Number(count)) : 5));
  const results = (Array.isArray(data.results) ? data.results : []).slice(0, limit).map((item: any) => ({
    title: String(item.title ?? "").trim(), url: String(item.url ?? "").trim(), snippet: String(item.content ?? item.snippet ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(), engine: String(item.engine ?? item.engines?.[0] ?? "unknown"),
  })).filter((item: SearchResult) => item.title && /^https?:\/\//.test(item.url));
  if (!results.length) throw new SearchError("no_results", SEARCH_ERROR_MESSAGES.no_results(unresponsiveEngines), unresponsiveEngines);
  return { query, language, results, unresponsiveEngines };
}
