# APMS REST API 설계

## 1. 공통 계약

기본 경로는 `/api/v1`이고 JSON을 사용한다. P2 대시보드 전환 기간에는 이슈 #003에 명시된 `/api/projects`, `/api/md/share` 비버전 경로를 우선 제공하며, `/api/v1` 별칭은 후속 호환 계층에서 추가한다.
Markdown 원문 다운로드만 `text/markdown`을 반환한다.
인증은 HttpOnly, Secure, SameSite 쿠키 기반 세션이다.
일반 사용자는 자기 리소스만, 관리자는 명시된 관리 리소스를 조회한다.

| 항목 | 규칙 |
|---|---|
| ID | UUID 문자열 |
| 시각 | ISO 8601 UTC |
| 페이지 | `cursor`, `limit` 기본 20 최대 100 |
| 멱등성 | 생성 요청에 `Idempotency-Key` 권장 |
| 오류 | code, message, details, request_id |
| 버전 | URL major version |

```json
{
  "error": {
    "code": "validation_error",
    "message": "요청을 확인해 주세요.",
    "details": [{"field": "timeout_min", "reason": "1 이상이어야 합니다."}],
    "request_id": "req_example"
  }
}
```

주요 상태 코드는 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500이다.
권한 없음과 다른 사용자 리소스 미존재는 정보 노출을 막기 위해 404로 통일할 수 있다.

## 2. 엔드포인트 요약

| Method | Path | 권한 | 설명 |
|---|---|---|---|
| POST | `/auth/login` | 공개 | 로그인 |
| POST | `/auth/logout` | user | 로그아웃 |
| GET | `/auth/me` | user | 현재 계정 |
| GET | `/users` | admin | 사용자 목록 |
| POST | `/users` | admin | 사용자 생성 |
| PATCH | `/users/{userId}` | admin | 역할·상태 변경 |
| DELETE | `/users/{userId}` | admin | 사용자 비활성화 |
| GET | `/projects` | user | 프로젝트 목록/카드 데이터 |
| POST | `/projects` | user | 프로젝트 생성 |
| GET | `/projects/{projectId}` | user | 프로젝트 상세 |
| PATCH | `/projects/{projectId}` | user | 이름·보기 방식 수정 |
| DELETE | `/projects/{projectId}` | user | 프로젝트 archive |
| GET | `/projects/{projectId}/tasks` | user | 상태별 작업 목록 |
| POST | `/projects/{projectId}/tasks/from-chat` | user | 챗봇 발주 |
| POST | `/tasks/{taskId}/move` | user | 허용 상태 전이 |
| GET | `/tasks/{taskId}/report` | user | 최신 보고서 |
| GET | `/workers/status` | admin | 워커·큐 상태 |
| GET | `/workers/config` | admin | 워커 설정 |
| PATCH | `/workers/config` | admin | 워커 설정 변경 |
| GET | `/usage` | user | 자기 사용량 |
| GET | `/admin/usage` | admin | 전체 사용량 |
| GET | `/llm-connections` | admin | 연결 목록 |
| POST | `/llm-connections` | admin | 연결 생성 |
| PATCH | `/llm-connections/{id}` | admin | 연결 수정 |
| DELETE | `/llm-connections/{id}` | admin | 연결 비활성화 |
| GET | `/settings` | user | 계정 설정 |
| PUT | `/settings/{key}` | user | 계정 설정 upsert |
| DELETE | `/settings/{key}` | user | 계정 설정 삭제 |
| GET | `/md` | user | Markdown 보기 |
| POST | `/md/share-links` | user | 공유 링크 생성 |
| DELETE | `/md/share-links/{id}` | user | 공유 링크 폐기 |
| GET | `/md/download` | user/share | Markdown 다운로드 |

## 3. 인증

### POST `/auth/login`

```json
{"email":"user@example.com","password":"example-password"}
```

```json
{"user":{"id":"uuid","email":"user@example.com","role":"user"}}
```

성공 시 세션 쿠키를 설정한다.
실패 메시지는 계정 존재 여부를 구분하지 않는다.
IP와 계정 기준 rate limit을 적용한다.

### POST `/auth/logout`

요청 본문은 없고 세션을 폐기한 뒤 204를 반환한다.

### GET `/auth/me`

```json
{"id":"uuid","email":"user@example.com","display_name":"사용자","role":"user"}
```

## 4. 사용자 관리

### GET `/users?cursor=&limit=20&role=user&status=active`

```json
{"items":[{"id":"uuid","email":"user@example.com","role":"user","disabled":false}],"next_cursor":null}
```

### POST `/users`

```json
{"email":"new@example.com","display_name":"새 사용자","role":"user","temporary_password":"one-time-value"}
```

```json
{"id":"uuid","email":"new@example.com","role":"user","must_change_password":true}
```

### PATCH `/users/{userId}`

```json
{"role":"admin","disabled":false}
```

자기 자신의 마지막 관리자 권한 제거는 409로 거부한다.

### DELETE `/users/{userId}`

물리 삭제 대신 비활성화하고 204를 반환한다.

## 5. 프로젝트

### GET `/projects?view=card&cursor=&limit=20`

```json
{
  "items": [{
    "id":"uuid","name":"Sample App","slug":"sample-app","view":"card",
    "task_counts":{"pending":2,"in_progress":1,"done":7,"failed":0}
  }],
  "next_cursor": null
}
```

### POST `/projects`

```json
{"name":"Sample App","slug":"sample-app"}
```

```json
{"id":"uuid","name":"Sample App","slug":"sample-app","documents_initialized":true}
```

생성 시 프로젝트 docs 5종과 tasks 상태 디렉터리를 초기화한다.

### GET `/projects/{projectId}`

```json
{"id":"uuid","name":"Sample App","slug":"sample-app","view_mode":"card","archived":false}
```

### PATCH `/projects/{projectId}`

```json
{"name":"Renamed App","view_mode":"list"}
```

slug 변경은 파일 경로 이동을 수반하므로 P1 API에서 허용하지 않는다.

### DELETE `/projects/{projectId}`

실행 중 작업이 있으면 409, 아니면 archive 후 204를 반환한다.

## 6. 작업

### GET `/projects/{projectId}/tasks?status=pending&cursor=&limit=20`

```json
{
  "items":[{
    "id":"uuid","filename":"20260909-001-task.md","title":"로그인 수정",
    "status":"pending","pre_task_id":null,"next_task_id":null,"created_at":"2026-09-09T06:00:00Z"
  }],
  "next_cursor":null
}
```

`status`는 쉼표로 복수 지정할 수 있으며 생략하면 전체다.

### POST `/projects/{projectId}/tasks/from-chat`

```json
{
  "session_id":"uuid",
  "message":"로그인 실패 원인을 수정하고 테스트해 줘",
  "context":[{"role":"user","content":"재현 조건은 ..."}],
  "pre_task_id":null,
  "next_task_id":null,
  "timeout_min":20
}
```

```json
{
  "task":{"id":"uuid","filename":"20260909-001-task.md","status":"pending"},
  "session":{"id":"uuid","context_ratio":0.42},
  "warnings":[]
}
```

서버는 소유권, 세션 프로젝트, 의존성, timeout 범위를 검증한다.
LLM 출력 검증 후 pending 파일 원자 생성과 tasks upsert를 수행한다.
동일 Idempotency-Key 재요청은 최초 응답을 반환한다.

### POST `/tasks/{taskId}/move`

```json
{"to":"pending","reason":"문제 수정 후 재시도"}
```

사용자에게 허용되는 대표 전이는 failed→pending이다.
스케줄러 전용 전이는 내부 서비스 자격으로만 호출한다.

### GET `/tasks/{taskId}/report`

```json
{
  "task_id":"uuid","run_id":"uuid","status":"failed",
  "filename":"20260909-001-report.md","summary":"테스트 실패","download_url":"/api/v1/md/download?token=..."
}
```

## 7. 워커

### GET `/workers/status`

```json
{
  "scheduler":{"leader":true,"last_heartbeat":"2026-09-09T06:00:00Z"},
  "capacity":{"running":4,"limit":20},
  "queue":{"pending":8,"blocked":2,"failed":1},
  "workers":[{"id":"worker-1","state":"busy","task_id":"uuid"}]
}
```

### GET `/workers/config`

```json
{"poll_interval_sec":2,"global_concurrency":20,"default_timeout_min":20,"runner":"subprocess"}
```

### PATCH `/workers/config`

```json
{"poll_interval_sec":3,"global_concurrency":20,"default_timeout_min":30}
```

```json
{"poll_interval_sec":3,"global_concurrency":20,"default_timeout_min":30,"effective_at":"2026-09-09T06:01:00Z"}
```

## 8. 사용량

### GET `/usage?from=2026-09-01&to=2026-09-30&group_by=project`

```json
{
  "currency":"USD",
  "totals":{"input_tokens":1200,"output_tokens":600,"cost":"0.04200000"},
  "groups":[{"project_id":"uuid","input_tokens":1200,"output_tokens":600,"cost":"0.04200000"}]
}
```

### GET `/admin/usage?user_id=&project_id=&group_by=user`

응답 형태는 `/usage`와 같고 관리자만 다른 사용자를 필터링할 수 있다.
날짜 범위 최대값을 두어 고비용 집계를 제한한다.

## 9. LLM 연결

### GET `/llm-connections`

```json
{"items":[{"id":"uuid","name":"primary","provider":"compatible","default_model":"model-a","has_api_key":true,"api_key_hint":"…abcd","enabled":true}]}
```

### POST `/llm-connections`

```json
{"name":"primary","provider":"compatible","base_url":"https://provider.example/v1","default_model":"model-a","api_key":"secret-value"}
```

응답에는 `api_key`를 반환하지 않는다.

### PATCH `/llm-connections/{id}`

```json
{"default_model":"model-b","enabled":true,"api_key":"rotated-value"}
```

키 필드가 생략되면 기존 암호문을 유지한다.

### DELETE `/llm-connections/{id}`

사용 중인 연결은 비활성화하며 204를 반환한다.

## 10. 계정 설정

### GET `/settings`

```json
{"items":[{"key":"email_notifications","value":true,"sensitive":false},{"key":"personal_llm_key","value":null,"sensitive":true,"configured":true}]}
```

### PUT `/settings/{key}`

```json
{"value":true}
```

민감 키로 분류된 값은 암호화 저장하고 이후 응답에서 마스킹한다.

### DELETE `/settings/{key}`

계정별 override를 제거하고 204를 반환한다.

## 11. Markdown 보기와 공유

### GET `/md?project_id={id}&kind=guide`

```json
{"path":"sample-app/docs/sample-app.guide.md","content":"# 프로젝트 지침\n...","sha256":"hex","updated_at":"2026-09-09T06:00:00Z"}
```

임의 절대 경로 입력은 받지 않고 project ID와 문서 kind 또는 task ID로 해석한다.

### POST `/md/share-links`

```json
{"resource":{"type":"task_report","id":"uuid"},"expires_in_sec":86400,"allow_download":true}
```

```json
{"id":"uuid","url":"https://apms.craftbay.io/share/random-token","expires_at":"2026-09-10T06:00:00Z"}
```

공유 토큰 원문은 생성 응답에서 한 번만 제공하고 DB에는 hash를 저장한다.

### DELETE `/md/share-links/{id}`

소유자 또는 관리자가 링크를 폐기하고 204를 반환한다.

### GET `/md/download?project_id={id}&kind=proposal`

인증 세션 또는 유효한 공유 토큰을 요구한다.
응답은 `text/markdown; charset=utf-8`과 안전한 attachment 파일명을 사용한다.

## 12. 챗봇 발주 프롬프트 계약

LLM 입력은 시스템 규칙, project guide, 제한된 대화 컨텍스트, 현재 사용자 요청 순서다.
서버가 신뢰 경계를 표시하고 문서 안의 프롬프트 인젝션을 데이터로 취급한다.

| 입력 | 필수 | 설명 |
|---|---|---|
| `user` | 예 | slug와 권한 범위 |
| `project` | 예 | slug와 프로젝트 메타데이터 |
| `project_guide` | 예 | guide 원문과 hash |
| `conversation_context` | 예 | 순서 있는 role/content 배열 |
| `request` | 예 | 최신 사용자 발주 의도 |
| `dependencies` | 아니오 | 허용된 pre/next 후보 |
| `constraints` | 예 | timeout, 파일 규격, 보안 정책 |

모델 출력은 Markdown 작업지시서 하나이며 설명용 코드펜스나 머리말을 포함하지 않는다.

```yaml
---
title: 로그인 오류 수정
project: sample-app
user: team-user
pre-task: null
next-task: null
type: task
created_at: 2026-09-09T06:00:00Z
timeout_min: 20
---
```

본문 필수 섹션은 `목표`, `작업 범위`, `구현 요구사항`, `검증 체크리스트`, `완료 보고`다.
모델은 파일명과 번호를 결정하지 않으며 서버가 원자적으로 채번한다.
모델이 절대 경로, 비밀값, 허용되지 않은 의존성을 출력하면 검증 실패다.
서버는 frontmatter를 파싱하고 사용자·프로젝트 값을 권위 있는 값으로 대조한다.
실패 시 최대 한 번 구조화 수정 프롬프트를 보내고, 다시 실패하면 422를 반환한다.

## 13. 완료 기준

- 모든 엔드포인트에 method, path, 권한이 정의돼 있다.
- 사용자와 관리자의 조회 범위가 분리된다.
- 카드와 목록 보기가 같은 프로젝트 API로 지원된다.
- 챗봇 발주가 검증된 task Markdown을 생성한다.
- API Key는 생성 입력 외 응답에 노출되지 않는다.
- Markdown은 안전한 식별자로만 조회·공유·다운로드된다.
- 중복 발주와 상태 전이가 멱등적으로 처리된다.
