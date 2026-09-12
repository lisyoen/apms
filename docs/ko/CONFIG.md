# 설정

Dirigo의 단일 설정 원천은 YAML입니다. 전역 파일은 `$DIRIGO_DATA_ROOT/config/dirigo.yaml`, 프로젝트 덮어쓰기 파일은 `$DIRIGO_DATA_ROOT/projects/<slug>/project.yaml`입니다. 파일이 없으면 기본값을 사용합니다. 낮은 순서부터 코드 기본값, 전역 YAML, 프로젝트 YAML, 환경변수가 적용되며 각 최종 leaf에는 `default`, `yaml`, `project`, `env` 출처가 붙습니다.

## 스키마

| 영역 | 키 |
|---|---|
| `server` | `base_url`, `session_ttl_hours`, `remember_ttl_days` |
| `llm` | `providers[]` (`name`, `type`, `base_url`, `api_key`, `models[]`), `default_model`, `usage_budget` |
| `worker` | `scheduler_interval_ms`, `max_workers`, `runner`, `opencode_bin`, `opencode_path`, `workdir_allowlist` |
| `search` | `searxng_url`, `max_results`, `rate_limit_per_min` |
| `fetch` | `timeout_ms`, `max_bytes`, `max_chars` |
| `notifications` | `smtp_url`, `smtp_from`, `enabled` |
| `planning` | `record_proposals`, `expand_keywords` |
| `policy` | `task_concurrency`, `allow_shell`, `allow_network` |
| `cli` | 노출할 config 하위 명령 |

알 수 없는 키, 잘못된 타입, 범위 오류는 `llm.providers[0].base_url: invalid url`처럼 경로를 포함해 실패합니다. 프로젝트 YAML은 전역 전용 `server`, `worker`, `cli` 영역을 덮어쓸 수 없습니다.

## 시크릿과 환경변수 호환

YAML에는 시크릿을 쓰지 말고 `${env:NAME}`으로 참조합니다. 미설정 참조는 경고이며, 이름이 `api_key`, `password`, `token`으로 끝나는 키의 8자 이상 평문은 오류입니다. API는 시크릿 필드를 `***`로 마스킹합니다. DB URL, JWT secret, API key, SMTP 비밀번호는 환경변수에 남깁니다.

기존 변수는 각각 같은 이름의 YAML 키에 최우선으로 매핑됩니다: `DIRIGO_BASE_URL`, `DIRIGO_SESSION_TTL_HOURS`, `DIRIGO_REMEMBER_TTL_DAYS`; `DIRIGO_SCHEDULER_INTERVAL_MS`, `DIRIGO_MAX_WORKERS`, `DIRIGO_WORKER_RUNNER`, `DIRIGO_OPENCODE_BIN`, `DIRIGO_OPENCODE_PATH`, `DIRIGO_WORKDIR_ALLOWLIST`; `DIRIGO_SEARXNG_URL`, `DIRIGO_SEARCH_MAX_RESULTS`, `DIRIGO_SEARCH_RATE_LIMIT_PER_MIN`; `DIRIGO_FETCH_TIMEOUT_MS`, `DIRIGO_FETCH_MAX_BYTES`, `DIRIGO_FETCH_MAX_CHARS`; `DIRIGO_SMTP_URL`, `DIRIGO_SMTP_FROM`.

`dirigo config init --local` 후 비시크릿 값만 편집하고 validate → diff → apply 순서로 적용합니다. 쓰기는 같은 디렉터리 임시 파일과 rename을 사용하고, 전달된 SHA-256 조건을 검사하며 `config/history.log`에 시각·주체·변경 키를 남깁니다. 다음 요청 또는 스케줄러 설정 tick에서 반영됩니다. 예시는 [`config/dirigo.example.yaml`](../../config/dirigo.example.yaml)입니다.
