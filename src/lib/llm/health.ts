import type { Pool, PoolClient } from "pg";
import { decryptApiKey } from "./crypto.mjs";
import { normalizeBaseUrl } from "./providers";

export type LlmHealthReason =
  "no_default" | "unreachable" | "auth" | "model_missing" | "ok";
export type LlmHealthResult = {
  reason: LlmHealthReason;
  ok: boolean;
  url: string | null;
  latency_ms: number;
  last_error: string | null;
  checked_at: string;
};
type HealthConnection = {
  id?: string;
  provider: string;
  base_url: string;
  model: string;
  apiKey?: string;
  api_key_enc?: string;
};

export const LLM_HEALTH_MESSAGES: Record<LlmHealthReason, string> = {
  no_default: "기본 LLM 연결이 지정되지 않았습니다.",
  unreachable:
    "LLM 서버에 연결할 수 없습니다. 서버 실행 상태와 네트워크를 확인해 주세요.",
  auth: "LLM 인증에 실패했습니다. API 키와 권한을 확인해 주세요.",
  model_missing:
    "설정한 모델을 LLM 서버에서 찾을 수 없습니다. 모델 이름을 확인해 주세요.",
  ok: "정상 연결",
};
export const HEALTH_REASON_KO = LLM_HEALTH_MESSAGES;

export function finalHealthUrl(baseUrl: string, provider = "compatible") {
  return `${normalizeBaseUrl(baseUrl)}${provider === "anthropic" ? "/v1/messages" : "/v1/models"}`;
}

export async function checkLlmConnection(
  connection: HealthConnection,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<LlmHealthResult> {
  const url = finalHealthUrl(connection.base_url, connection.provider),
    started = Date.now(),
    controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 5000);
  const checked_at = new Date().toISOString();
  try {
    const key =
      connection.apiKey ??
      (connection.api_key_enc ? decryptApiKey(connection.api_key_enc) : "");
    const anthropic = connection.provider === "anthropic";
    const response = await (options.fetchImpl ?? fetch)(url, {
      method: anthropic ? "POST" : "GET",
      headers:
        connection.provider === "anthropic"
          ? { "x-api-key": key, "anthropic-version": "2023-06-01" }
          : { authorization: `Bearer ${key}` },
      signal: controller.signal,
      cache: "no-store",
      body: anthropic
        ? JSON.stringify({
            model: connection.model,
            max_tokens: 1,
            messages: [{ role: "user", content: "." }],
          })
        : undefined,
    });
    const latency_ms = Date.now() - started;
    if (response.status === 401 || response.status === 403)
      return {
        reason: "auth",
        ok: false,
        url,
        latency_ms,
        last_error: `HTTP ${response.status}`,
        checked_at,
      };
    if (!response.ok)
      return {
        reason: "unreachable",
        ok: false,
        url,
        latency_ms,
        last_error: `HTTP ${response.status} ${response.statusText}`.trim(),
        checked_at,
      };
    if (anthropic)
      return {
        reason: "ok",
        ok: true,
        url,
        latency_ms,
        last_error: null,
        checked_at,
      };
    const body = await response.json().catch(() => ({}));
    const models = Array.isArray(body?.data)
      ? body.data.map((item: any) => String(item?.id ?? item?.name ?? ""))
      : [];
    if (!models.includes(connection.model))
      return {
        reason: "model_missing",
        ok: false,
        url,
        latency_ms,
        last_error: `Configured model not found: ${connection.model}`,
        checked_at,
      };
    return {
      reason: "ok",
      ok: true,
      url,
      latency_ms,
      last_error: null,
      checked_at,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      reason: "unreachable",
      ok: false,
      url,
      latency_ms: Date.now() - started,
      last_error: message,
      checked_at,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkConnectionRow(
  connection: HealthConnection,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
) {
  const result = await checkLlmConnection(connection, options);
  return {
    ...result,
    error: result.last_error,
    response_time_ms: result.latency_ms,
    response_ms: result.latency_ms,
    final_url: result.url,
    last_check_at: result.checked_at,
  };
}

export async function persistConnectionHealth(
  db: Pick<Pool | PoolClient, "query">,
  id: string,
  health: {
    ok: boolean;
    reason: LlmHealthReason;
    error?: string | null;
    last_error?: string | null;
    checked_at?: string;
    last_check_at?: string;
  },
) {
  const raw = health.error ?? health.last_error ?? null;
  const error = raw ? `[${health.reason}] ${raw}` : null;
  await db.query(
    "UPDATE llm_connections SET last_check_at=$2,last_ok=$3,last_error=$4 WHERE id=$1",
    [
      id,
      health.checked_at ?? health.last_check_at ?? new Date().toISOString(),
      health.ok,
      error,
    ],
  );
}

export async function getDefaultLlmStatus(
  db: Pick<Pool, "query">,
  refresh = false,
): Promise<
  LlmHealthResult & { connection_id: string | null; name: string | null }
> {
  const result = await db.query(
    "SELECT * FROM llm_connections WHERE enabled AND is_default AND owner_id IS NULL ORDER BY updated_at DESC LIMIT 1",
  );
  const connection = result.rows[0];
  if (!connection)
    return {
      reason: "no_default",
      ok: false,
      url: null,
      latency_ms: 0,
      last_error: LLM_HEALTH_MESSAGES.no_default,
      checked_at: new Date().toISOString(),
      connection_id: null,
      name: null,
    };
  if (!refresh && connection.last_check_at)
    return {
      reason: connection.last_ok
        ? "ok"
        : classifyStoredError(connection.last_error),
      ok: connection.last_ok === true,
      url: finalHealthUrl(connection.base_url, connection.provider),
      latency_ms: 0,
      last_error: connection.last_error,
      checked_at: new Date(connection.last_check_at).toISOString(),
      connection_id: connection.id,
      name: connection.name,
    };
  const health = await checkLlmConnection(connection);
  await db.query(
    "UPDATE llm_connections SET last_check_at=$2,last_ok=$3,last_error=$4 WHERE id=$1",
    [
      connection.id,
      health.checked_at,
      health.ok,
      health.last_error ? `[${health.reason}] ${health.last_error}` : null,
    ],
  );
  return {
    ...health,
    last_error: health.last_error
      ? `[${health.reason}] ${health.last_error}`
      : null,
    connection_id: connection.id,
    name: connection.name,
  };
}

export async function checkAllLlmConnections(
  db: Pick<Pool | PoolClient, "query">,
) {
  const rows = (
    await db.query(
      "SELECT * FROM llm_connections WHERE enabled AND owner_id IS NULL ORDER BY name",
    )
  ).rows;
  return Promise.all(
    rows.map(async (connection) => {
      const health = await checkLlmConnection(connection);
      const error = health.last_error
        ? `[${health.reason}] ${health.last_error}`
        : null;
      await db.query(
        "UPDATE llm_connections SET last_check_at=$2,last_ok=$3,last_error=$4 WHERE id=$1",
        [connection.id, health.checked_at, health.ok, error],
      );
      return {
        ...health,
        last_error: error,
        connection_id: connection.id,
        name: connection.name,
      };
    }),
  );
}

export const runLlmHealthChecks = checkAllLlmConnections;

function classifyStoredError(error: string | null): LlmHealthReason {
  const match = error?.match(/^\[(auth|model_missing|unreachable)\]/)?.[1];
  return (match as LlmHealthReason) || "unreachable";
}

export function llmStatusError(status: Pick<LlmHealthResult, "reason">) {
  const prefix =
    status.reason === "no_default" ? "LLM 연결 필요" : "LLM 연결 불가";
  return {
    error: `${prefix}: ${LLM_HEALTH_MESSAGES[status.reason]}`,
    code: status.reason,
  };
}
