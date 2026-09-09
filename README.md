# APMS - Agentic Project Management System

An open-source project management system for coordinating task queues and agentic work.

## Development

Copy `.env.example` to `.env`, fill in local-only values, and run:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

The production server uses port `9107` by default. Never commit `.env` or credentials.
