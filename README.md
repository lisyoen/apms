# Dirigo

**Dirigo — AI-directed project management**

Dirigo (formerly APMS) is an open-source, multi-user project management system for project guidance, task instruction queues, and multi-worker execution powered by LLMs.

## Name

The name comes from the Latin *dirigere*, meaning “to direct” or “to guide straight.” *Dirigo* is the first-person present form: “I direct” or “I lead.” It shares a root with English *direct* and *director*, German *Dirigent*, and Spanish *dirigir*. “Dirigo” (“I lead”) is also the motto of the U.S. state of Maine.

The name compresses the idea that AI directs a project into one word, with the combined nuance of a director and conductor. Its three syllables are easy to pronounce in both English and Korean (디리고), it has relatively few naming collisions, and it extends naturally to domains, a CLI such as `dirigo run`, and the `dirigo` package name.

한국어 문서는 [README.ko.md](README.ko.md)를 참조하세요.

## Development

Copy `.env.example` to `.env`, fill in local-only values, and run:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

The production server uses port `9107` by default. Never commit `.env` or credentials.

| Variable | Example/default | Purpose |
|---|---:|---|
| `DIRIGO_SEARXNG_URL` | `http://localhost:8889` | Optional server-only SearXNG endpoint. If absent, project chat does not expose `web_search`. |

## Authentication environment

*Implementation status: implemented*

| Variable | Default | Purpose |
|---|---:|---|
| `DIRIGO_SESSION_TTL_HOURS` | `24` | Normal-login lifetime for both the signed JWT and persistent `dirigo_session` cookie. |
| `DIRIGO_REMEMBER_TTL_DAYS` | `30` | Automatic-login lifetime for the signed JWT and cookie. |
| `DIRIGO_LOGIN_MAX_ATTEMPTS` | `5` | Failed attempts allowed for one email and IP before lockout. |
| `DIRIGO_LOGIN_LOCKOUT_MINUTES` | `15` | Login-attempt counting and lockout window. |

**Save ID/password** stores the email, Base64-obfuscated password, and automatic-login preference in that browser's `localStorage`; it warns against use on a shared computer. **Automatic login** is nested beneath and depends on that option: enabling it also enables credential storage, while disabling credential storage clears and disables automatic login. The login API receives only `remember`, not the storage choice. A remembered session lasts 30 days and carries `remember: true` in its JWT; otherwise it lasts 24 hours. The cookie `Max-Age` and JWT expiry always match.

## Account and administration screens

*Implementation status: implemented*

The header shows the current display name, falling back to the account email. Selecting it opens authenticated `/settings`: four cards cover account details and display name, independent password change, UI language/chat width/default task sections, and completion-email preferences. A sticky bar saves or cancels profile/preferences changes, warns about unsaved navigation, and updates the header immediately; password changes submit separately. Mobile email and telephone auto-detection remains disabled.

Only users with the `admin` role receive the **Admin** header link. Both the `/admin` server page and every `/api/admin/*` handler verify that role on the server; direct non-admin page access shows a Korean 403 permission screen and admin APIs return HTTP 403.

## Planning in project chat

Project chat treats explicit planning keywords, requirement commands, and multi-item requirement lists as planning input. It refines concrete requirements, decisions, and open questions into bullets under `## 기획 YYYY-MM-DD` in the project's `.proposal.md`; an existing date section is reused and normalized duplicates are merged. A content-free prompt such as “shall we plan?” asks for details without changing the proposal, and ordinary questions or status requests do not change it.

After a successful append, chat always confirms the proposal location, summary, and open questions in a fixed four-line response. A task is created only when the user explicitly also asks to implement, order, or deploy, and planning is recorded first. Suspected credentials are rejected rather than written.

## URL reading and web search in project chat

*Implementation status: implemented*

Project chat can call `fetch_url` for a public HTTP(S) page and, when `DIRIGO_SEARXNG_URL` is configured, `web_search` for up to five SearXNG results. URL reads block localhost, private/link-local/metadata addresses, re-check up to three redirects, stop after 10 seconds or 2 MB, extract readable HTML, and truncate extracted text after 8,000 characters. Search is limited to five requests per session per minute.

Tool results feed a bounded three-round LLM tool loop. Answers end with a `출처:` URL block; combined planning and task-order requests also retain the URLs in proposal entries and task bodies. Failures remain visible and distinguish URL connection, timeout, blocked status, unsupported format, and internal-address errors from SearXNG connection, empty-result engine counts, and rate-limit errors. Tool target, status, and elapsed time are stored in message metadata.

## Design documents

English is the source language for design documents. Korean translations use the same filenames under `docs/ko/`.

- [Documentation index](docs/README.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Folder specification](docs/FOLDER-SPEC.md)
- [Data model](docs/DATA-MODEL.md)
- [REST API](docs/API.md)
- [Scheduler and worker](docs/WORKER.md)
