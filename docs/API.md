# APMS rest API design

## 1. Common Agreement

*Implementation status: partial*

The default path is`/api/v1 `and use JSON. During the P2 dashboard transition period, the`/api/projects`, `/api/md/share` non-version paths outlined in issue # 003 will first be provided, and the `/api/v1` alias will be added in the backwards compatibility hierarchy.
Only the original Markdown download returns` text/markdown `.
Authentication is a HttpOnly, Secure, SameSite cookie-based session.
The average user views only their own resources, while the administrator views the specified administrative resources.

| Items | Rules |
|---|---|
| ID | UUID string |
| Time | ISO 8601 UTC |
| page | `cursor`, `limit` default 20 up to 100 |
| Idempotency | `Idempotency-Key` recommended for creation requests |
| Error | code, message, details, request_id |
| Version | URL major version |

```json
{
  "error": {
    "code": "validation_error",
"message": "Please confirm your request.",
"details": [{"field": "timeout_min", "reason": "Must be at least 1."}],
    "request_id": "req_example"
  }
}
```

The major status codes are 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500.
Unauthorized and other non-existent user resources may unify to 404 to prevent information disclosure.

## 2. Endpoint Summary

*Implementation status: partial*

| Method | Path | Permissions | Description |
|---|---|---|---|
| post | `/auth/login` | Public | Login |
| post | `/auth/logout` | user | Logout |
| get | `/auth/me` | user | Current account |
| get | `/users` | admin | User list |
| post | `/users` | admin | Create user |
| patch | `/users/{userId}` | admin | Change role/status |
| delete | `/users/{userId}` | admin | Deactivate user |
| get | `/projects` | user | Project list/card data |
| post | `/projects` | user | Create Project |
| get | `/projects/{projectId}` | user | Project details |
| patch | `/projects/{projectId}` | user | Edit name · view mode |
| delete | `/projects/{projectId}` | user | project archive |
| get | `/projects/{projectId}/tasks` | user | Task list by status |
| post | `/projects/{projectId}/tasks/from-chat` | user | Chatbot Order |
| post | `/tasks/{taskId}/move` | user | Allowed state transitions |
| get | `/tasks/{taskId}/report` | user | Latest reports |
| get | `/workers/status` | admin | worker · cue status |
| get | `/workers/config` | admin | worker Settings |
| patch | `/workers/config` | admin | Change worker Settings |
| get | `/usage` | user | Self Usage |
| get | `/admin/usage` | admin | Total usage |
| get | `/llm-connections` | admin | Connections list |
| post | `/llm-connections` | admin | Create connection |
| patch | `/llm-connections/{id}` | admin | Edit connection |
| delete | `/llm-connections/{id}` | admin | Disable connection |
| get | `/settings` | user | Account Settings |
| put | `/settings/{key}` | user | Account settings upsert |
| delete | `/settings/{key}` | user | Delete account settings |
| get | `/md` | user | View Markdown |
| post | `/md/share-links` | user | Create share link |
| delete | `/md/share-links/{id}` | user | Revoke share link |
| get | `/md/download` | user/share | Markdown Download |
| get | `/chat/sessions?project_slug={slug}` | user | List sessions restricted to an owned project |
| post | `/chat/sessions` | user | Create a session; `project_slug` binds it to an owned project |
| get | `/sessions?project_slug={slug}` | user | List project sessions, or projectless sessions when omitted |
| post | `/sessions` | user | Create a project-bound or projectless chat session |
| patch | `/sessions/{id}` | owner | Rename a chat session |
| delete | `/sessions/{id}` | owner | Delete a session and cascade-delete its messages |
| post | `/admin/llm-connections/{id}` | admin | Test a connection and return its final request URL |

### Chat panel and LLM URL behavior

*Implementation status: implemented*

Project chat clients send `project_slug` instead of accepting a freely selected project ID. The server resolves ownership and stores the resulting `project_id`. OpenAI and compatible connection base URLs are stored without trailing slashes or a trailing `/v1`; calls append exactly `/v1/chat/completions`. Connection tests return `url` alongside the abbreviated model response.

### Chat session lifecycle

*Implementation status: implemented*

`GET /api/sessions` returns only projectless sessions; adding `project_slug` returns sessions for that owned project. Results are ordered by the most recent message time and include `last_message_at`. `PATCH /api/sessions/{id}` accepts `{"title":"..."}` and normalizes whitespace. `DELETE` returns 204 and PostgreSQL cascades deletion to messages. Both mutations return 403 when the session belongs to another user. The first user message replaces the default title with its first 40 characters after line breaks are removed.

## 3. Authentication

*Implementation status: implemented*

### POST `/auth/login`

```json
{"email":"user@example.com","password":"example-password"}
```

```json
{"user":{"id":"uuid","email":"user@example.com","role":"user"}}
```

Sets the session cookie on success.
Failure messages do not distinguish whether an account exists.
Apply the rate limit based on IP and account.

### POST `/auth/logout`

There is no request body and returns 204 after discarding the session.

### GET `/auth/me`

```json
{"id": "uuid", "email": "user@example.com", "display_name": "User", "role": "user"}
```

## 4. User management

*Implementation status: partial*

### GET `/users?cursor=&limit=20&role=user&status=active`

```json
{"items":[{"id":"uuid","email":"user@example.com","role":"user","disabled":false}],"next_cursor":null}
```

### POST `/users`

```json
{"email": "new@example.com", "display_name": "New User", "role": "user", "temporary_password": "one-time-value"}
```

```json
{"id":"uuid","email":"new@example.com","role":"user","must_change_password":true}
```

### PATCH `/users/{userId}`

```json
{"role":"admin","disabled":false}
```

Reject the removal of his or her last administrator privilege to 409.

### DELETE `/users/{userId}`

Deactivate instead of deleting the physics and return 204.

## 5. Project

*Implementation status: partial*

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

Initialize the state directory with 5 types of project docs and tasks when created.

### GET `/projects/{projectId}`

```json
{"id":"uuid","name":"Sample App","slug":"sample-app","view_mode":"card","archived":false}
```

### PATCH `/projects/{projectId}`

```json
{"name":"Renamed App","view_mode":"list"}
```

changing the slug involves moving the file path and is not allowed by the P1 API.

### DELETE `/projects/{projectId}`

If there is a job running, it returns 409, otherwise 204 after archive.

## 6. Tasks

*Implementation status: partial*

### GET `/projects/{projectId}/tasks?status=pending&cursor=&limit=20`

```json
{
  "items":[{
"id": "uuid", "filename": "20260909-001-task.md", "title": "Modify Login",
    "status":"pending","pre_task_id":null,"next_task_id":null,"created_at":"2026-09-09T06:00:00Z"
  }],
  "next_cursor":null
}
```

`status` can be specified as multiple commas, if omitted, the whole.

### POST `/projects/{projectId}/tasks/from-chat`

```json
{
  "session_id":"uuid",
"message": "Fix the login failure and test it",
"context": [{"role": "user", "content": "Reproduction conditions are..."}],
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

The server verifies ownership, session project, dependencies, and timeout scope.
After LLM output verification, pending file atom generation and tasks upsert are performed.
The same Idempotency-Key re-request will return the initial response.

### POST `/tasks/{taskId}/move`

```json
{"to": "pending", "reason": "Fix the problem and try again"}
```

The representative transition allowed for the user is→ failed pending.
Scheduler-only transitions are called only as internal service entitlements.

### GET `/tasks/{taskId}/report`

```json
{
  "task_id":"uuid","run_id":"uuid","status":"failed",
"filename": "20260909-001-report.md", "summary": "Test failed", "download_url": "/api/v1/md/download? token =..."
}
```

## 7. workers

*Implementation status: partial*

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

## 8. Usage

*Implementation status: partial*

### GET `/usage?from=2026-09-01&to=2026-09-30&group_by=project`

```json
{
  "currency":"USD",
  "totals":{"input_tokens":1200,"output_tokens":600,"cost":"0.04200000"},
  "groups":[{"project_id":"uuid","input_tokens":1200,"output_tokens":600,"cost":"0.04200000"}]
}
```

### GET `/admin/usage?user_id=&project_id=&group_by=user`

The response type is the same as`/usage `and only the administrator can filter other users.
Place a date range maximum to limit high cost aggregation.

## 9. LLM Connection

*Implementation status: partial*

### GET `/llm-connections`

```json
{"items":[{"id":"uuid","name":"primary","provider":"compatible","default_model":"model-a","has_api_key":true,"api_key_hint":"…abcd","enabled":true}]}
```

### POST `/llm-connections`

```json
{"name":"primary","provider":"compatible","base_url":"https://provider.example/v1","default_model":"model-a","api_key":"secret-value"}
```

The response does not return `api_key`.

### PATCH `/llm-connections/{id}`

```json
{"default_model":"model-b","enabled":true,"api_key":"rotated-value"}
```

If the key field is omitted, retain the existing ciphertext.

### DELETE `/llm-connections/{id}`

Deactivate the connection in use and return 204.

## 10. Account settings

*Implementation status: partial*

### GET `/settings`

```json
{"items":[{"key":"email_notifications","value":true,"sensitive":false},{"key":"personal_llm_key","value":null,"sensitive":true,"configured":true}]}
```

### PUT `/settings/{key}`

```json
{"value":true}
```

Values classified as sensitive keys are encrypted and stored and then masked in the response.

### DELETE `/settings/{key}`

Remove account-specific overrides and return 204.

## 11. View and share Markdown

*Implementation status: partial*

### GET `/md?project_id={id}&kind=guide`

```json
{"path": "sample-app/docs/sample-app.guide.md", "content": "# Project instructions\ n...", "sha256": "hex", "updated_at": "2026-09-09T 06:00:00 Z"}
```

Random absolute path input is not received and is interpreted as project ID and document kind or task ID.

### POST `/md/share-links`

```json
{"resource":{"type":"task_report","id":"uuid"},"expires_in_sec":86400,"allow_download":true}
```

```json
{"id":"uuid","url":"https://apms.craftbay.io/share/random-token","expires_at":"2026-09-10T06:00:00Z"}
```

The original shared token will only be provided once in the generated response and the hash will be stored in the DB.

### DELETE `/md/share-links/{id}`

The owner or manager discards the link and returns 204.

### GET `/md/download?project_id={id}&kind=proposal`

Require an authentication session or a valid shared token.
The response uses` text/markdown; charset = utf-8 `and a secure attachment file name.

## 12. Chatbot Order Prompt Contract

*Implementation status: partial*

LLM inputs are system rules, project guide, restricted conversation context, and current user request sequence.
The server marks the trust boundary and treats the prompt injection inside the document as data.

| Input | Required | Description |
|---|---|---|
| `user` | Yes | Slug and scope |
| `project` | Example | Slug and project metadata |
| `project_guide` | Yes | hash with original guide text |
| `conversation_context` | Yes | Ordered role/content array |
| `request` | Yes | Latest User Order Intent |
| `dependencies` | No | Allowed pre/next candidates |
| `constraints` | Yes | timeout, file dimensions, security policy |

The model output is a Markdown work order and does not include an explanatory code fence or header.

```yaml
---
title: fix login errors
project: sample-app
user: team-user
pre-task: null
next-task: null
type: task
created_at: 2026-09-09T06:00:00Z
timeout_min: 20
---
```

Required sections of the body are `Objectives`, `Scope of Work`, `Implementation Requirements`, `Validation Checklist`, and `Completion Reporting`.
The model does not determine the filename and number, and the server does it atomically.
If the model outputs an absolute path, a secret value, and an unacceptable dependency, the verification fails.
The server parses the frontmatter and contrasts the user and project values with authoritative values.
Send a structured correction prompt up to once on failure, or return 422 if it fails again.

## 13. Completion criteria

*Implementation status: partial*

- All endpoints have method, path, and permissions defined.
- The scope of inquiry between the user and the administrator is separated.
- Cards and list views are supported by the same project API.
- Create a task Markdown where the chatbot ordering is verified.
- API Keys are not exposed to responses other than generated input.
- Markdown is only viewed, shared and downloaded as a secure identifier.
- Duplicate orders and state transitions are handled idempotently.
