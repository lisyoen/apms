export const SETTING_TYPES = {
  repo: "string", branch: "string", push_policy: "string", verify_cmd: "string", workdir: "string",
  workspace: "string", remote_host: "string", remote_port: "integer", remote_user: "string",
  remote_os: "string", remote_workdir: "string", max_concurrent: "integer", guides: "string[]", secrets: "string[]",
} as const;

function parseScalar(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (/^\d+$/.test(value)) return Number(value);
  if (value.startsWith("[") && value.endsWith("]")) return value.slice(1, -1).split(",").map((item) => item.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  return value.replace(/^['"]|['"]$/g, "");
}

export function validateSetting(content: string) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return "setting 문서는 YAML frontmatter(---)가 필요합니다.";
  const values: Record<string, unknown> = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const field = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!field) return `setting frontmatter 형식이 올바르지 않습니다: ${line}`;
    const [, key, raw] = field;
    if (!(key in SETTING_TYPES)) return `허용되지 않은 setting 키입니다: ${key}`;
    if (key in values) return `중복된 setting 키입니다: ${key}`;
    values[key] = parseScalar(raw);
  }
  for (const [key, value] of Object.entries(values)) {
    const expected = SETTING_TYPES[key as keyof typeof SETTING_TYPES];
    if (expected === "string" && typeof value !== "string") return `${key}는 문자열이어야 합니다.`;
    if (expected === "integer" && !Number.isInteger(value)) return `${key}는 정수여야 합니다.`;
    if (expected === "string[]" && (!Array.isArray(value) || value.some((item) => typeof item !== "string"))) return `${key}는 문자열 이름 배열이어야 합니다.`;
  }
  if (values.workspace && !["local", "remote"].includes(String(values.workspace))) return "workspace는 local 또는 remote여야 합니다.";
  if (values.secrets && Array.isArray(values.secrets) && values.secrets.some((item) => !/[A-Za-z0-9_.-]+/.test(String(item)))) return "secrets에는 값이 아닌 비밀 이름만 입력할 수 있습니다.";
  return null;
}
