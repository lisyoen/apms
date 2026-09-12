export const CONFIG_TEMPLATE = `# Dirigo configuration — environment variables override these values.
server:
  base_url: http://127.0.0.1:9107
  session_ttl_hours: 24
  remember_ttl_days: 30
llm:
  # providers may reference credentials as \${env:PROVIDER_API_KEY}
  providers: []
  default_model: ""
  usage_budget: 0
worker:
  scheduler_interval_ms: 10000
  max_workers: 20
  runner: subprocess
  opencode_bin: opencode
  opencode_path: opencode
  workdir_allowlist: []
search:
  searxng_url: \${env:DIRIGO_SEARXNG_URL}
  max_results: 5
  rate_limit_per_min: 5
fetch: { timeout_ms: 10000, max_bytes: 2097152, max_chars: 8000 }
notifications: { smtp_from: "", enabled: true }
planning: { record_proposals: true, expand_keywords: true }
policy: { task_concurrency: 20, allow_shell: true, allow_network: true }
cli: { expose: [init, get, validate, diff, apply] }
`;
