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

## Design documents

English is the source language for design documents. Korean translations use the same filenames under `docs/ko/`.

- [Documentation index](docs/README.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Folder specification](docs/FOLDER-SPEC.md)
- [Data model](docs/DATA-MODEL.md)
- [REST API](docs/API.md)
- [Scheduler and worker](docs/WORKER.md)
