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

## Getting started

```bash
pnpm install
docker compose up -d        # Postgres :5433, Redis :6380
pnpm dev:web                # dashboard at http://localhost:5173
pnpm dev:api                # API at http://localhost:3001
```

## Roadmap

- [x] **Phase 0** — Monorepo foundation, design system, app shell
- [ ] **Phase 1** — Crawler engine + job feed (RemoteOK, WeWorkRemotely, HN Who's Hiring, ITviec)
- [ ] **Phase 2** — Market insights + local LLM skill extraction (Ollama, rule-based fallback)
- [ ] **Phase 3** — Prep roadmap + spaced-repetition question bank (DSA, system design, cloud, web)
- [ ] **Phase 4** — Application tracker + polish

### Scoping notes

- Everything runs locally: Postgres/Redis in Docker, optional Ollama for JD parsing. No API keys, no paid services.
- LinkedIn is deliberately excluded (aggressive anti-bot measures and terms-of-service risk).
- Crawler adapters treat failure as data: source health is surfaced in the UI rather than silently ignored.
