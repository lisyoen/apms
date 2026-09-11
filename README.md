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

*Implementation status: minimal settings screen implemented; editing is planned in #033*

The header shows the current display name, falling back to the account email. Selecting it opens the authenticated `/settings` screen, which currently provides read-only email, slug, role, and display-name details. Mobile email and telephone auto-detection is disabled, and Dirigo does not turn the account label into an email action.

Only users with the `admin` role receive the **Admin** header link. Both the `/admin` server page and every `/api/admin/*` handler verify that role on the server; direct non-admin page access shows a Korean 403 permission screen and admin APIs return HTTP 403.

## Design documents

English is the source language for design documents. Korean translations use the same filenames under `docs/ko/`.

- [Documentation index](docs/README.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Folder specification](docs/FOLDER-SPEC.md)
- [Data model](docs/DATA-MODEL.md)
- [REST API](docs/API.md)
- [Scheduler and worker](docs/WORKER.md)
