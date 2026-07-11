# Phase 1 — Crawler engine + Job Feed

**Goal:** open the app and see fresh, deduplicated, real jobs from 4+ sources.
**Prerequisite:** Phase 0 (already on `main`).
**Estimated shape:** ~10 steps, each independently committable.

---

## Step 1 — Wire Prisma into the API

The schema already exists as a design doc at `apps/api/prisma/schema.prisma`.

1. `cd apps/api && pnpm add @prisma/client && pnpm add -D prisma`
2. Add scripts to `apps/api/package.json`:
   - `"db:migrate": "prisma migrate dev"`, `"db:generate": "prisma generate"`, `"db:studio": "prisma studio"`
3. Ensure `apps/api/.env` exists with `DATABASE_URL` from `.env.example`; start Docker (`docker compose up -d`).
4. Run `pnpm db:migrate -- --name init` — this creates the first migration from the existing schema.
5. Create `apps/api/src/prisma/prisma.service.ts` — standard Nest `PrismaService extends PrismaClient implements OnModuleInit` — and a global `PrismaModule` exporting it.
6. Create `apps/api/prisma/seed.ts` that upserts the six `Source` rows (ids = `JobSource.options` from `@waypoint/shared`, display names from a local map). Add `"db:seed": "tsx prisma/seed.ts"` (add `tsx` as devDep) and a `"prisma": { "seed": … }` block.

**Verify:** `pnpm db:seed` then `pnpm db:studio` (or `psql`) shows 6 sources.
**Test note:** no unit tests for generated code; e2e covers it in step 8.

## Step 2 — Testing infrastructure

1. Add Vitest to `packages/crawler-engine`, `packages/shared`: `pnpm add -D vitest` in each; script `"test": "vitest run"`.
2. Root `turbo.json`: add `"test": { "dependsOn": ["^build"] }` task; root `package.json` script `"test": "turbo run test"`. Workspaces without tests should NOT define a `test` script (turbo skips them).
3. Write the first unit tests in `packages/crawler-engine/src/__tests__/`:
   - `dedup.test.ts` — same company/title/location → same key; case/punctuation/"(Remote)" noise → same key; different company → different key; Vietnamese diacritics preserved (`"Hà Nội"` ≠ `"Ha Noi"` is ACCEPTABLE — assert current behavior, document it).
   - `rate-limiter.test.ts` — two requests to the same host are spaced ≥ minInterval (use fake timers); different hosts are not; concurrency cap respected.
   - `pipeline.test.ts` — with an in-memory `JobStore` and a fake adapter: new jobs saved; duplicate dedupKeys (both pre-existing and within-run) filtered; adapter `extract` throwing for one job → run status `partial`, other jobs still saved; `discover` throwing → status `failed`, run summary still persisted.

**Verify:** `pnpm test` green at root.

## Step 3 — RemoteOK adapter (HTTP/JSON)

File: `packages/crawler-engine/src/adapters/remoteok.ts` (+ export from `index.ts`).

- Endpoint: `https://remoteok.com/api` (JSON array; **element 0 is a legal-notice object, skip it**; requires a User-Agent header — the pipeline already sends one).
- `discover()` fetches the array once and attaches full `raw: RawJob` to each item (no separate `extract` round-trip). Map: `id`→externalId, `position`→title, `company`, `location`, `tags`, `description`→descriptionHtml, `date`→postedAt, `url`. Build `salaryText` from `salary_min`/`salary_max` when present.
- Filter to software roles: keep items whose tags intersect a keep-list (`dev`, `engineer`, `javascript`, `react`, `node`, `backend`, `frontend`, `full stack`, …) — put the list in one exported const so it's tunable.

**Tests:** save a trimmed real response (≈5 items + the legal element) to `__fixtures__/remoteok.json`; unit test parses it via a stub `AdapterContext` and asserts count, field mapping, legal-element skipping, and Zod validity of every emitted `RawJob`.
**Verify live:** temporary script or vitest `.skip`-gated integration test hitting the real API once (`pnpm vitest run -t remoteok-live` style, env-gated with `LIVE=1`).

## Step 4 — WeWorkRemotely adapter (RSS)

File: `packages/crawler-engine/src/adapters/weworkremotely.ts`.

- Add `fast-xml-parser` dependency to crawler-engine.
- Feeds (crawl both): `https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss` and `…/remote-back-end-programming-jobs.rss`.
- Item `<title>` format is `Company: Job Title` — split on first `: `. `<guid>`→externalId, `<link>`→url, `<description>`→descriptionHtml, `<pubDate>`→postedAt, `<region>` (if present)→location.

**Tests:** fixture `__fixtures__/wwr.rss` (2–3 real items); assert title/company split, dates, Zod validity, and that a malformed item is skipped with an error rather than aborting the batch.

## Step 5 — HN "Who is hiring" adapter (Algolia API)

File: `packages/crawler-engine/src/adapters/hn-whos-hiring.ts`.

- Find the latest thread: `https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=hiring` → take the newest hit whose title starts with `Ask HN: Who is hiring?`.
- Fetch it: `https://hn.algolia.com/api/v1/items/{id}` → `children` = top-level comments (dead/deleted have `text: null` — skip).
- Each comment is one job. Convention: first line `Company | Role | Location | …` split on `|`; fall back to `title = first 80 chars`, `company = first segment` when the pattern doesn't match. `externalId` = comment id, `url` = `https://news.ycombinator.com/item?id={id}`, whole comment HTML → descriptionHtml.
- Cap at ~150 comments per run.

**Tests:** fixtures for both the search response and a trimmed items response; assert pipe-format parsing, fallback path, dead-comment skipping.

## Step 6 — ITviec adapter (Playwright)

File: `packages/crawler-engine/src/adapters/itviec.ts`.

1. Add `playwright` as an **optional peer** approach: crawler-engine gets a `BrowserContextProvider` abstraction (`newPage(): Promise<PageLike>` with `goto/content/close`) injected via `AdapterContext` extension, so the engine package itself does not depend on Playwright. The API app depends on `playwright` and supplies the provider. (`pnpm exec playwright install chromium` — document in README.)
2. Listing: `https://itviec.com/it-jobs` — job cards link to `/it-jobs/<slug>`; collect first 2 pages of links via the browser page.
3. Detail page: title (h1), company, location, salary (often "Sign in to view" → leave null), tags/skills chips, description block.
4. **Selectors will drift.** Centralize them in one `selectors` const at the top of the file. On zero results, throw a descriptive error (→ run recorded `failed`, visible in source health).

**Tests:** save one listing page and one detail page as HTML fixtures; unit-test the pure parsing functions (`parseListing(html)`, `parseDetail(html)`) with `linkedom` or regex-based extraction — structure the adapter so parsing is pure and testable without a browser.
**Verify live:** manual run in step 8; expect flakiness, that's what source health is for.

## Step 7 — Crawl orchestration in the API

1. `pnpm add @nestjs/schedule bullmq @nestjs/bullmq ioredis` in `apps/api`; `pnpm add @waypoint/crawler-engine playwright` too.
2. `apps/api/src/crawl/` module:
   - `prisma-job-store.ts` — implements `JobStore` from crawler-engine against Prisma (existingKeys via `findMany where dedupKey in`, saveJobs via `createMany skipDuplicates`, saveRun inserts `CrawlRun`).
   - `crawl.processor.ts` — BullMQ worker: job payload `{ source }`, builds the right adapter, runs `CrawlPipeline`, logs summary.
   - `crawl.service.ts` — enqueues one BullMQ job per enabled source; `@Cron('0 */6 * * *')` scheduled run.
   - `crawl.controller.ts` — `POST /crawl/run` (all or `?source=`), `GET /crawl/runs?limit=20` (latest run per source for the health panel).
3. Redis connection from `REDIS_URL` (port 6380).

**Tests:** unit-test `PrismaJobStore` mapping with a mocked Prisma client; e2e in step 8.
**Verify:** `pnpm dev:api`, then `curl -X POST localhost:3001/crawl/run?source=remoteok`, watch logs, `GET /crawl/runs` shows a success summary and Postgres has jobs.

## Step 8 — Jobs API + e2e tests

1. `apps/api/src/jobs/` module: `GET /jobs` with query params (Zod-validated via a small pipe): `q` (title/company ILIKE), `source`, `workMode`, `seniority`, `saved`, `postedWithinDays`, `cursor`/`limit` (cursor pagination on `fetchedAt,id`). `PATCH /jobs/:id` body `{ saved?, hidden? }`. Hidden jobs excluded by default.
2. e2e: `pnpm add -D supertest @types/supertest vitest` in api; `test/jobs.e2e.test.ts` boots the Nest app against the dev database, seeds 3 jobs directly via Prisma, asserts filtering/pagination/patch, cleans up (wrap in a dedicated `externalId` prefix and delete by it). Script `"test": "vitest run"`.

**Verify:** curl each filter combination against the running API.

## Step 9 — Web: live Job Radar

1. `pnpm add @tanstack/react-query` in `apps/web`; create `src/api/client.ts` (thin `fetch` wrapper, base URL `http://localhost:3001`) and `src/api/jobs.ts` (typed hooks: `useJobs(filters)`, `useUpdateJob()`, `useCrawlRuns()`, `useRunCrawl()`). Types come from `@waypoint/shared`.
2. Replace `sample-jobs.ts` usage in `RadarPage`:
   - Wire the existing filter chips (All / Remote / Vietnam / Senior / Saved) to real query params; add a search input styled like the chips row.
   - Job cards: real data, same layout; Save toggles `saved` (optimistic update); a subtle "hide" action sets `hidden`.
   - States: loading skeleton cards (3 gray pulses), error state, and an empty state that says "No jobs yet — run your first crawl" with a button that calls `POST /crawl/run`.
   - "Run crawl" header button now actually enqueues and shows a toast/inline status.
3. New **source health panel**: right-aligned compact strip or collapsible card showing each source with a status dot (success=green/partial=amber/failed=red from latest `CrawlRun`), jobs found, and relative time. Delete `sample-jobs.ts` once nothing imports it (keep `sourceLabels` — move it to `@waypoint/shared`).
4. Remove the "Design preview" banner.

**Verify (browser):** run a real crawl, watch jobs stream in on refetch; toggle save; filter by Remote; check dark mode; check console for errors.

## Step 10 — Docs + wrap-up

1. README: update Getting Started (playwright install, db migrate/seed), flip Phase 1 checkbox, add a screenshot of the live Radar (`docs/images/radar.png`).
2. Add `apps/api/.env` reminder + `ports` table to README.

---

## Exit criteria

- [ ] `pnpm typecheck && pnpm build && pnpm test` green from root.
- [ ] `POST /crawl/run` ingests from RemoteOK, WWR, and HN successfully (ITviec allowed to be `partial`/`failed` if the site is hostile today — but parsing tests pass on fixtures).
- [ ] Second crawl run reports duplicates > 0 and creates no duplicate rows.
- [ ] Radar UI shows real jobs with working filters, search, save/hide, and source health.
- [ ] Cron is registered (visible in logs at boot).
- [ ] No console errors in the browser; dark and light both clean.
