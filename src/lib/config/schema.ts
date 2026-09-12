import { z } from "zod";

const envReference = /^\$\{env:[A-Z_][A-Z0-9_]*\}$/;
const url = z.string().refine((value) => envReference.test(value) || URL.canParse(value), "invalid url");
const secret = z.string().refine((value) => envReference.test(value) || value.length < 8 || value.includes("${"), "plaintext secret is forbidden; use ${env:NAME}");

const providerSchema = z.object({
  name: z.string().min(1), type: z.enum(["openai-compatible", "anthropic"]),
  base_url: url, api_key: secret.optional(), models: z.array(z.string().min(1)).default([]),
}).strict();

export const configSchema = z.object({
  server: z.object({ base_url: url, session_ttl_hours: z.number().int().min(1).max(720), remember_ttl_days: z.number().int().min(1).max(365) }).strict(),
  llm: z.object({ providers: z.array(providerSchema), default_model: z.string(), usage_budget: z.number().min(0) }).strict(),
  worker: z.object({ scheduler_interval_ms: z.number().int().min(100).max(3_600_000), max_workers: z.number().int().min(1).max(100), runner: z.enum(["subprocess", "container", "dummy"]), opencode_bin: z.string().min(1), opencode_path: z.string(), workdir_allowlist: z.array(z.string()) }).strict(),
  search: z.object({ searxng_url: url.or(z.literal("")), max_results: z.number().int().min(1).max(50), rate_limit_per_min: z.number().int().min(1).max(1000) }).strict(),
  fetch: z.object({ timeout_ms: z.number().int().min(100).max(120_000), max_bytes: z.number().int().min(1024).max(100_000_000), max_chars: z.number().int().min(100).max(1_000_000) }).strict(),
  notifications: z.object({ smtp_url: secret.optional(), smtp_from: z.string(), enabled: z.boolean() }).strict(),
  planning: z.object({ record_proposals: z.boolean(), expand_keywords: z.boolean() }).strict(),
  policy: z.object({ task_concurrency: z.number().int().min(1).max(100), allow_shell: z.boolean(), allow_network: z.boolean() }).strict(),
  cli: z.object({ expose: z.array(z.enum(["init", "get", "validate", "diff", "apply"])) }).strict(),
}).strict();

export type DirigoConfig = z.infer<typeof configSchema>;
export type ConfigSource = "default" | "yaml" | "project" | "env";
export type ConfigIssue = { path: string; message: string };

export const defaultConfig: DirigoConfig = {
  server: { base_url: "http://127.0.0.1:9107", session_ttl_hours: 24, remember_ttl_days: 30 },
  llm: { providers: [], default_model: "", usage_budget: 0 },
  worker: { scheduler_interval_ms: 10_000, max_workers: 20, runner: "subprocess", opencode_bin: "opencode", opencode_path: "opencode", workdir_allowlist: [] },
  search: { searxng_url: "", max_results: 5, rate_limit_per_min: 5 },
  fetch: { timeout_ms: 10_000, max_bytes: 2 * 1024 * 1024, max_chars: 8_000 },
  notifications: { smtp_from: "", enabled: true },
  planning: { record_proposals: true, expand_keywords: true },
  policy: { task_concurrency: 20, allow_shell: true, allow_network: true },
  cli: { expose: ["init", "get", "validate", "diff", "apply"] },
};

export function formatZodIssues(error: z.ZodError): ConfigIssue[] {
  return error.issues.map((issue) => ({ path: issue.path.map((part) => typeof part === "number" ? `[${part}]` : String(part)).join(".").replace(/\.\[/g, "["), message: issue.message }));
}
