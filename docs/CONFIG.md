# Configuration

Dirigo's source of truth is YAML. Global configuration is stored at `$DIRIGO_DATA_ROOT/config/dirigo.yaml`; project overrides are stored at `$DIRIGO_DATA_ROOT/projects/<slug>/project.yaml`. Missing files mean “use defaults.” Precedence, from lowest to highest, is defaults, global YAML, project YAML, and environment. Every effective leaf has a `default`, `yaml`, `project`, or `env` source.

## Schema

| Section | Keys |
|---|---|
| `server` | `base_url`, `session_ttl_hours`, `remember_ttl_days` |
| `llm` | `providers[]` (`name`, `type`, `base_url`, `api_key`, `models[]`), `default_model`, `usage_budget` |
| `worker` | `scheduler_interval_ms`, `max_workers`, `runner`, `opencode_bin`, `opencode_path`, `workdir_allowlist` |
| `search` | `searxng_url`, `max_results`, `rate_limit_per_min` |
| `fetch` | `timeout_ms`, `max_bytes`, `max_chars` |
| `notifications` | `smtp_url`, `smtp_from`, `enabled` |
| `planning` | `record_proposals`, `expand_keywords` |
| `policy` | `task_concurrency`, `allow_shell`, `allow_network` |
| `cli` | exposed config subcommands |

Unknown keys, wrong types, and out-of-range values fail with a leaf path, for example `llm.providers[0].base_url: invalid url`. Project YAML cannot override global `server`, `worker`, or `cli` sections.

## Secrets

Never put a secret value in YAML. Use `${env:NAME}`. An unset reference is a validation warning, while a plaintext value of eight or more characters in a key ending in `api_key`, `password`, or `token` is an error. API responses mask secret fields as `***`. Database URLs, JWT secrets, API keys, and SMTP passwords remain in the environment.

## Environment compatibility

| Environment | YAML key |
|---|---|
| `DIRIGO_BASE_URL` | `server.base_url` |
| `DIRIGO_SESSION_TTL_HOURS`, `DIRIGO_REMEMBER_TTL_DAYS` | matching `server.*` keys |
| `DIRIGO_SCHEDULER_INTERVAL_MS`, `DIRIGO_MAX_WORKERS`, `DIRIGO_WORKER_RUNNER` | matching `worker.*` keys |
| `DIRIGO_OPENCODE_BIN`, `DIRIGO_OPENCODE_PATH`, `DIRIGO_WORKDIR_ALLOWLIST` | matching `worker.*` keys |
| `DIRIGO_SEARXNG_URL`, `DIRIGO_SEARCH_MAX_RESULTS`, `DIRIGO_SEARCH_RATE_LIMIT_PER_MIN` | matching `search.*` keys |
| `DIRIGO_FETCH_TIMEOUT_MS`, `DIRIGO_FETCH_MAX_BYTES`, `DIRIGO_FETCH_MAX_CHARS` | matching `fetch.*` keys |
| `DIRIGO_SMTP_URL`, `DIRIGO_SMTP_FROM` | matching `notifications.*` keys |

Run `dirigo config init --local`, edit only non-secret values, validate, inspect the diff, and apply. Writes use a same-directory temporary file and rename, require the current SHA-256 when supplied, append timestamp/actor/changed keys to `config/history.log`, and are visible on the next request or scheduler settings tick. See [`config/dirigo.example.yaml`](../config/dirigo.example.yaml).
