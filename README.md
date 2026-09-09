# APMS - Agentic Project Management System

An open-source, multi-user agentic project management system: project guidelines, task instruction queues, and multi-worker execution driven by LLM agents.

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

- [Architecture](docs/ARCHITECTURE.md)
- [Folder specification](docs/FOLDER-SPEC.md)
- [Data model](docs/DATA-MODEL.md)
- [REST API](docs/API.md)
- [Scheduler and worker](docs/WORKER.md)
