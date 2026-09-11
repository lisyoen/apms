import { complete, type Connection } from "@/lib/llm/providers";

const DEFAULT_TITLES = new Set(["새 채팅", "새 대화"]);

export function isDefaultSessionTitle(title: unknown) {
  return (
    title == null ||
    String(title).trim() === "" ||
    DEFAULT_TITLES.has(String(title).trim())
  );
}

export function buildTitlePrompt(firstMessage: string) {
  const request = firstMessage.slice(0, 2000);
  return `다음 요청을 세션 목록에서 구분할 수 있는 한 줄 제목으로 요약하세요. 25자 이내, 마침표·따옴표·이모지 없이 명사구로 작성하고, 원문 앞부분을 그대로 복사하지 마세요. 제목만 출력하세요.\n\n요청:\n${request}`;
}

export function sanitizeTitle(raw: string) {
  let title = raw
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  title = title.replace(/^제목\s*[:：]\s*/i, "").trim();
  title = title.replace(/^["'“”‘’「」『』]+|["'“”‘’「」『』]+$/g, "").trim();
  title = title.replace(/[.。]+$/g, "").trim();
  return title.length > 30 ? `${title.slice(0, 30).trimEnd()}…` : title;
}

export function fallbackTitle(firstMessage: string) {
  const firstLine = firstMessage
    .split(/\r?\n/, 1)[0]
    .replace(/\s+/g, " ")
    .trim();
  if (!firstLine) return "새 대화";
  return firstLine.length > 30
    ? `${firstLine.slice(0, 30).trimEnd()}…`
    : firstLine;
}

export async function generateSessionTitle(
  conn: Connection,
  firstMessage: string,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const result = await complete(
      conn,
      [{ role: "user", content: buildTitlePrompt(firstMessage) }],
      [],
      { maxTokens: 40, temperature: 0.2, signal: controller.signal },
    );
    const title = sanitizeTitle(result.content);
    if (!title) throw new Error("Session title completion was empty");
    return title;
  } finally {
    clearTimeout(timer);
  }
}
