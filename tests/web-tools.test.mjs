import test from "node:test";
import assert from "node:assert/strict";
import { assertPublicUrl, extractHtml, fetchUrl, FetchUrlError } from "../src/lib/web/fetch-url.ts";
import { resetSearchRateLimits, searchLanguage, webSearch, SearchError } from "../src/lib/web/searxng.ts";
import { appendSources, sourceBlock, sourceUrlsFromOutput } from "../src/lib/chat/sources.ts";
import { getToolSpecs } from "../src/lib/llm/tools.ts";
import { readFile } from "node:fs/promises";

const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];

test("SSRF guard blocks localhost, loopback, private and link-local targets", async () => {
  for (const url of ["http://localhost/x", "http://127.0.0.1/x", "http://10.1.2.3/x", "http://169.254.169.254/latest"]) {
    await assert.rejects(assertPublicUrl(url, publicResolver), (error) => error instanceof FetchUrlError && error.code === "blocked_address" && /차단된 주소\(내부망\)/.test(error.message));
  }
  await assert.rejects(assertPublicUrl("https://rebinding.example", async () => [{ address: "93.184.216.34" }, { address: "192.168.1.2" }]), /차단된 주소/);
});

test("HTML extraction removes navigation and scripts and marks 8,000-character truncation", () => {
  const short = extractHtml("<html><head><title>A &amp; B</title><script>bad()</script></head><body><nav>menu</nav><main><h1>Hello</h1><p>Useful text</p></main></body></html>");
  assert.equal(short.title, "A & B"); assert.match(short.text, /Hello\nUseful text/); assert.doesNotMatch(short.text, /menu|bad/); assert.equal(short.truncated, false);
  const long = extractHtml(`<main>${"x".repeat(8_010)}</main>`);
  assert.equal(long.truncated, true); assert.match(long.text, /8,000자에서 절단됨/);
});

test("fetch_url follows at most three redirects and revalidates each location", async () => {
  let calls = 0;
  const ok = await fetchUrl("https://example.com/0", { resolver: publicResolver, fetchImpl: async () => {
    calls++; return calls <= 3 ? new Response(null, { status: 302, headers: { location: `https://example.com/${calls}` } }) : new Response("<title>Done</title><main>Body</main>", { headers: { "content-type": "text/html" } });
  }});
  assert.equal(ok.title, "Done"); assert.equal(calls, 4);
  calls = 0;
  await assert.rejects(fetchUrl("https://example.com/0", { resolver: publicResolver, fetchImpl: async () => { calls++; return new Response(null, { status: 302, headers: { location: `https://example.com/${calls}` } }); } }), (error) => error.code === "redirect_limit");
  await assert.rejects(fetchUrl("https://example.com", { resolver: publicResolver, fetchImpl: async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }) }), (error) => error.code === "blocked_address");
});

test("fetch_url distinguishes timeout, blocked status, unsupported type and connection errors", async () => {
  const abortingFetch = (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  await assert.rejects(fetchUrl("https://example.com", { resolver: publicResolver, fetchImpl: abortingFetch, timeoutMs: 5 }), /타임아웃\(10초\)/);
  await assert.rejects(fetchUrl("https://example.com", { resolver: publicResolver, fetchImpl: async () => new Response("", { status: 403 }) }), /차단\(403·429\)/);
  await assert.rejects(fetchUrl("https://example.com/a.pdf", { resolver: publicResolver, fetchImpl: async () => new Response("pdf", { headers: { "content-type": "application/pdf" } }) }), /지원하지 않는 형식/);
  await assert.rejects(fetchUrl("https://example.com", { resolver: publicResolver, fetchImpl: async () => { throw new Error("offline"); } }), /접속 오류/);
});

test("SearXNG client selects language and parses top N results", async () => {
  resetSearchRateLimits(); let requested;
  const response = await webSearch("Next.js 변경점", 1, "session-a", { baseUrl: "http://search.test", fetchImpl: async (url) => { requested = new URL(url); return Response.json({ results: [{ title: "One", url: "https://one.test", content: "<b>snippet</b>", engine: "brave" }, { title: "Two", url: "https://two.test", content: "two" }], unresponsive_engines: [["google", "rate limit"]] }); } });
  assert.equal(searchLanguage("한글 query"), "ko-KR"); assert.equal(searchLanguage("english"), "en");
  assert.equal(requested.searchParams.get("language"), "ko-KR"); assert.equal(response.results.length, 1); assert.deepEqual(response.results[0], { title: "One", url: "https://one.test", snippet: "snippet", engine: "brave" });
});

test("SearXNG distinguishes zero results, connection failure and per-session rate limit", async () => {
  resetSearchRateLimits();
  await assert.rejects(webSearch("none", 5, "zero", { baseUrl: "http://search.test", fetchImpl: async () => Response.json({ results: [], unresponsive_engines: [["a", "x"], ["b", "x"]] }) }), (error) => error instanceof SearchError && error.code === "no_results" && error.message === "검색 실패 — 결과 없음(응답 엔진 2개)");
  await assert.rejects(webSearch("offline", 5, "offline", { baseUrl: "http://search.test", fetchImpl: async () => { throw new Error("offline"); } }), /SearXNG 연결 불가/);
  const ok = async () => Response.json({ results: [{ title: "x", url: "https://x.test" }] });
  for (let i = 0; i < 5; i++) await webSearch("x", 1, "limited", { baseUrl: "http://search.test", fetchImpl: ok, now: 1_000 });
  await assert.rejects(webSearch("x", 1, "limited", { baseUrl: "http://search.test", fetchImpl: ok, now: 1_000 }), /요청 한도 초과/);
});

test("web_search is hidden without configuration and source helpers cover answers and planning/task bodies", () => {
  const previous = process.env.DIRIGO_SEARXNG_URL; delete process.env.DIRIGO_SEARXNG_URL;
  assert.equal(getToolSpecs().some((tool) => tool.name === "web_search"), false);
  process.env.DIRIGO_SEARXNG_URL = "http://search.test"; assert.equal(getToolSpecs().some((tool) => tool.name === "web_search"), true);
  if (previous === undefined) delete process.env.DIRIGO_SEARXNG_URL; else process.env.DIRIGO_SEARXNG_URL = previous;
  const urls = sourceUrlsFromOutput("web_search", { results: [{ url: "https://one.test" }, { url: "javascript:bad" }] });
  assert.deepEqual(urls, ["https://one.test"]); assert.equal(sourceBlock(urls), "출처:\n- https://one.test"); assert.match(appendSources("기획 항목 또는 작업 본문", urls), /출처:\n- https:\/\/one\.test$/);
  assert.match(appendSources("요약에 출처: https://one.test가 있음", urls), /\n\n출처:\n- https:\/\/one\.test$/);
});

test("chat route limits tool rounds and stores tool status, duration, and URLs", async () => {
  const source = await readFile(new URL("../src/app/api/chat/route.ts", import.meta.url), "utf8");
  assert.match(source, /const MAX_TOOL_ROUNDS = 3/);
  assert.match(source, /round < MAX_TOOL_ROUNDS/);
  assert.match(source, /duration_ms: durationMs/);
  assert.match(source, /tool: call\.name[\s\S]*url,[\s\S]*status:/);
  assert.match(source, /role IN \('user','assistant'\)/);
});

test("chat orchestration hard-limits tool rounds and preserves source metadata contracts", async () => {
  const source = await readFile(new URL("../src/app/api/chat/route.ts", import.meta.url), "utf8");
  assert.match(source, /MAX_TOOL_ROUNDS = 3/);
  assert.match(source, /round < MAX_TOOL_ROUNDS/);
  assert.match(source, /duration_ms: durationMs/);
  assert.match(source, /appendSources\(String\(args\.body/);
  assert.match(source, /args\.entries = .*new Set\(sources\)/);
});
