# Waypoint — implementation plans

Step-by-step execution plans for phases 1–4. Each phase document is written so an
agent (or a human) can pick it up cold and execute top-to-bottom.

| Phase | Document | Outcome |
| ----- | -------- | ------- |
| 1 | [phase-1-crawler-and-job-feed.md](phase-1-crawler-and-job-feed.md) | Real jobs from 4+ sources in the Radar UI |
| 2 | [phase-2-insights-and-local-agent.md](phase-2-insights-and-local-agent.md) | Skill analytics dashboard + Ollama extraction |
| 3 | [phase-3-roadmap-and-review.md](phase-3-roadmap-and-review.md) | Personalized study plan + spaced repetition |
| 4 | [phase-4-tracker-and-polish.md](phase-4-tracker-and-polish.md) | Application kanban + CI + resume-ready README |

## Ground rules (apply to every phase)

**Working style**

1. Execute steps in order — later steps assume earlier ones landed.
2. One git commit per numbered step (or tighter). Commit message format:
   `feat(scope): <step summary>` / `test(scope): …` / `chore(scope): …`.
3. After every step: `pnpm typecheck && pnpm build && pnpm test` must pass from the
   repo root before committing. Never commit red.
4. When a step says **Verify**, actually perform the verification (run the command,
   open the browser, check the response) — don't assume.
5. If an external site's HTML/API doesn't match what the plan describes, adapt the
   adapter, save a fresh fixture, and note the change in the commit body. Source
   sites drift; the plan describes intent, not gospel selectors.

**Conventions already established in the codebase**

- Zod schemas in `packages/shared` are the single source of truth for domain types.
  API DTOs and web types derive from them; do not redeclare shapes.
- All adapter network access goes through `AdapterContext` (rate-limited). Adapters
  never call `fetch` directly.
- UI: use tokens from `packages/ui/src/tokens.css` (CSS variables) — never hardcode
  colors. Serif (`--font-display`) for headings/job titles, sans for everything else.
- Crawler failures are data: degrade to `partial`/`failed` run status, never throw
  past the pipeline boundary.
- Ports: web 5175, api 3001, Postgres 5433, Redis 6380 (5173 belongs to another
  project on this machine).

**Environment**

```bash
pnpm install
docker compose up -d          # Postgres + Redis
cp apps/api/.env.example apps/api/.env
pnpm dev:web                  # http://localhost:5175
pnpm dev:api                  # http://localhost:3001
```

**Testing stack** (introduced in Phase 1, step 2): Vitest for unit tests in packages
and API modules; Supertest for API e2e; fixture-based tests (saved HTML/JSON under
`__fixtures__/`) for adapters so tests never hit the network.

**Definition of done for a phase**

- All steps committed, all checks green.
- The phase's "Exit criteria" checklist at the bottom of its document is verified
  in a running app (browser + API), not just in tests.
- README roadmap checkbox for the phase flipped to `[x]`.
