# Waypoint

**Local-first job intelligence & interview prep dashboard.**

Waypoint runs its own crawling engine against job boards you care about, analyzes what
skills the market actually demands, and turns the gap between market demand and your
profile into a personalized interview-prep roadmap — with zero paid services.

## Architecture

```
waypoint/
├── apps/
│   ├── web/               # React + Vite — the dashboard UI
│   └── api/               # NestJS + Prisma + PostgreSQL, BullMQ workers
├── packages/
│   ├── crawler-engine/    # Framework-agnostic crawling engine (adapters, pipeline, dedup)
│   ├── shared/            # Zod schemas & types shared across all packages
│   └── ui/                # Design tokens + component library
```

## Screenshot

![Job Radar with live crawled data](docs/images/radar.png)

## Getting started

```bash
pnpm install
pnpm exec playwright install chromium   # needed for the ITviec adapter
docker compose up -d                    # Postgres :5433, Redis :6380
cp apps/api/.env.example apps/api/.env
cd apps/api && pnpm db:migrate && pnpm db:seed && cd ../..
pnpm dev:web                            # dashboard at http://localhost:5175
pnpm dev:api                            # API at http://localhost:3001
```

Trigger a crawl once both are running: `curl -X POST http://localhost:3001/crawl/run`
(or use the "Run crawl" button in the Radar UI).

### Ports

| Service    | Port | Notes                                    |
| ---------- | ---- | ----------------------------------------- |
| Web        | 5175 | 5173 is reserved for another local project |
| API        | 3001 |                                            |
| Postgres   | 5433 | mapped from container's 5432              |
| Redis      | 6380 | mapped from container's 6379               |

## Roadmap

Detailed step-by-step execution plans live in [docs/plans/](docs/plans/README.md).

- [x] **Phase 0** — Monorepo foundation, design system, app shell
- [x] **Phase 1** — Crawler engine + job feed (RemoteOK, WeWorkRemotely, HN Who's Hiring, ITviec)
- [ ] **Phase 2** — Market insights + local LLM skill extraction (Ollama, rule-based fallback)
- [ ] **Phase 3** — Prep roadmap + spaced-repetition question bank (DSA, system design, cloud, web)
- [ ] **Phase 4** — Application tracker + polish

### Scoping notes

- Everything runs locally: Postgres/Redis in Docker, optional Ollama for JD parsing. No API keys, no paid services.
- LinkedIn is deliberately excluded (aggressive anti-bot measures and terms-of-service risk).
- Crawler adapters treat failure as data: source health is surfaced in the UI rather than silently ignored.
