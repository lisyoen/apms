# APMS - AI Project Management System

An open-source, multi-user AI project management system for project guidance, task instruction queues, and multi-worker execution powered by LLMs.

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
