# Phase 2 — Market Insights + local LLM agent

**Goal:** the Insights page charts real skill demand extracted from crawled JDs;
extraction runs through local Ollama with a rule-based fallback; every job gets a
match score against the user's profile.
**Prerequisite:** Phase 1 complete (jobs flowing into Postgres).

---

## Step 1 — Skill taxonomy

1. Create `packages/shared/src/taxonomy.ts`: a curated list of ~120 skills, each
   `{ name, category, aliases[] }` with categories `language | frontend | backend |
   database | cloud | devops | practice`. Include everything relevant to the user's
   targets: react, nextjs, typescript, nestjs, node, express, postgresql, mysql,
   redis, kafka, rabbitmq, docker, kubernetes, aws (+ common services as aliases:
   ec2, s3, lambda, rds), gcp, azure, terraform, ci/cd, graphql, rest, grpc,
   microservices, system design, testing (jest/vitest/cypress/playwright), etc.
   Aliases capture JD spellings: `k8s`→kubernetes, `postgres`→postgresql,
   `react.js`/`reactjs`→react, `golang`→go.
2. Extend the API seed script to upsert `Skill` rows from the taxonomy.

**Tests:** taxonomy invariants — unique canonical names, no alias maps to two skills,
all categories valid.

## Step 2 — Rule-based extractor

File: `packages/skill-extractor/` (new package, same tsup setup as shared).

1. `extractSkills(text: string): ExtractedSkill[]` where `ExtractedSkill =
   { skill: string; confidence: number; evidence: string }`.
   - Build one regex per skill from name+aliases with word boundaries; special-case
     symbols (`c++`, `c#`, `.net`, `node.js`).
   - Confidence: 1.0 for exact canonical hit, 0.9 for alias hit; +cap at 1.0 if hit
     ≥3 times. Evidence = first matching line (trimmed, ≤120 chars) — this powers
     tooltips later.
2. Export `extractSeniority(title, text)` and `extractSalary(text)` refinements
   (VND ranges like `25 - 40 triệu`, USD `$60k–$85k`, `$1,800/month`) that upgrade
   the Phase-1 heuristics.

**Tests:** table-driven cases from realistic JD snippets (EN + VN): `"experience
with React.js and Node"` → react, node; `"k8s on AWS (EKS)"` → kubernetes, aws;
`"Java"` must NOT match "JavaScript"; salary parser cases for VND/USD/monthly/annual.

## Step 3 — Ollama extractor with fallback

Same package, `src/ollama.ts`.

1. Client for `POST {OLLAMA_URL:-http://localhost:11434}/api/chat` with
   `format: "json"`, model from `OLLAMA_MODEL` (default `qwen2.5:3b`). Prompt:
   given JD text (truncate to ~6k chars), return
   `{ "skills": [{"name": …, "confidence": 0-1}], "seniority": …, "salaryText": … }`
   constrained to canonical taxonomy names (include the list in the system prompt).
2. Validate the response with Zod; map unknown skill names through the alias table;
   drop anything still unknown (never invent taxonomy entries from model output).
3. `extractWithFallback(text)`: try Ollama with a 20s timeout; on connection error,
   timeout, or unparseable JSON → rule-based extractor. Return
   `{ skills, extractor: 'ollama' | 'rules' }`.
4. Health probe `isOllamaUp()` (GET `/api/tags`, 2s timeout) so the pipeline checks
   once per batch, not per job.

**Tests:** mock the HTTP layer — valid response mapping; alias normalization;
unknown-skill dropping; timeout → fallback; malformed JSON → fallback. No live
Ollama in CI. Add one `LIVE=1`-gated live test for local runs.

## Step 4 — Extraction pipeline in the API

1. New BullMQ queue `extract`: after a crawl run saves N new jobs, enqueue their ids.
   Worker loads each job, runs `extractWithFallback`, writes `JobSkill` rows
   (`extractor`, `confidence`) and updates `seniority`/`salaryText` when the
   extractor is more specific than `unknown`/null.
2. Backfill command: `POST /extract/backfill` enqueues all jobs with zero JobSkill
   rows. Also a `pnpm --filter @waypoint/api backfill` script alias for CLI use.
3. Idempotency: re-extracting a job first deletes its existing `JobSkill` rows in
   the same transaction.

**Verify:** run backfill against Phase-1 data; `SELECT extractor, count(*) FROM
"JobSkill" GROUP BY 1;` shows rows (rules-only if Ollama isn't installed — that's
a supported configuration, say so in README).

## Step 5 — User profile

1. Prisma: `Profile` table (single row): `skills String[]` (canonical names),
   `yearsOfExperience Int`, `targetSeniority String`, `targetWorkModes String[]`,
   `locations String[]`. Seed with the project owner's defaults: react, nestjs,
   typescript, node, postgresql, mysql; 3 YOE; mid/senior; HCMC + remote.
2. API: `GET/PUT /profile` (Zod-validated; skills must exist in taxonomy).
3. Web: a modest **Settings/Profile page** (new nav item under a divider, gear icon):
   skill multi-select chips grouped by category, YOE stepper, seniority + work-mode
   selectors. Uses existing form styles; keep it one screen.

**Tests:** API e2e for validation (unknown skill rejected); web renders and saves.

## Step 6 — Match scoring

1. `packages/shared/src/match.ts`: `matchScore(profile, jobSkills, jobSeniority):
   { score: 0-100, matched: string[], missing: string[] }`.
   Scoring: coverage of job's skills by profile (weighted by confidence) 70%,
   seniority alignment 20% (exact 1.0, adjacent 0.6, else 0.2), work-mode fit 10%.
   Pure function — belongs in shared so web can re-score client-side.
2. API: include `matchScore` in `GET /jobs` responses (computed, not stored; load
   profile once per request).
3. Web Radar: score pill on each card (e.g. `82% match`, tone: success ≥70, warning
   40–69, neutral <40); new sort dropdown (Newest / Best match); missing skills
   shown in the job detail as "Gap: kafka, kubernetes".

**Tests:** unit tests with hand-computed expected scores incl. edge cases (job with
zero extracted skills → score null, UI hides pill).

## Step 7 — Insights aggregation API

`apps/api/src/insights/` module, endpoints (all read-only, SQL via Prisma):

- `GET /insights/skill-demand?window=30d&seniority=&source=` → `[{ skill, category,
  jobCount, share }]` (share = jobCount / jobs-in-window).
- `GET /insights/skill-trend?skills=react,aws&window=90d&bucket=week` → time series.
- `GET /insights/gap` → profile-aware: top demanded skills the profile lacks, with
  counts — **this feeds Phase 3's roadmap generator; keep its shape stable.**
- `GET /insights/summary` → totals for stat tiles (jobs in window, sources healthy,
  median salary where parseable, top 3 gap skills).

**Tests:** seed a known small dataset in e2e and assert exact aggregate numbers.

## Step 8 — Insights page UI

Replace the Phase-0 empty state. Before writing chart code, follow the repo rule:
tokens only, no hardcoded colors; charts must read cleanly in both themes.

1. Add `recharts`. Create themed chart wrappers in `apps/web/src/components/charts/`
   (bar, line) that pull colors from CSS variables (accent for primary series,
   `--info`/`--success` for comparisons; grid lines = `--border`).
2. Layout, top to bottom:
   - Stat tile row (4 tiles from `/insights/summary`).
   - **Skill demand** horizontal bar chart (top 15, toggle: all/frontend/backend/
     cloud), each bar labeled with share %; profile-owned skills get accent bars,
     gaps get neutral bars with an accent outline — the gap is visible at a glance.
   - **Trend** line chart with a small multi-select of skills (default: top 3 gaps).
   - **Your gap** card: ranked missing skills with demand counts and a "→ add to
     roadmap" affordance (disabled with "Phase 3" tooltip for now).
3. Window selector (7/30/90 days) in the page header, shared by all queries.

**Verify (browser):** with real crawled data, charts render in light+dark, tooltips
work, no console errors; resize to ~1000px width and confirm no overflow.

---

## Exit criteria

- [x] All green: typecheck, build, unit + e2e tests. 178+ tests across the repo.
- [x] Backfill extracted skills for every crawled job; JobSkill rows exist with both
      `rules` and (if Ollama installed) `ollama` extractors. Ran the real backfill
      against all 286 Phase 1 jobs through a real local Ollama (qwen2.5:3b);
      confirmed both extractor values present. (26 jobs — non-tech/spam postings
      like "Barista", "Mason" — legitimately extracted zero skills; see Step 7's
      commit for why that looks like a stuck backfill in a naive progress query
      but isn't.)
- [x] Killing Ollama mid-run degrades gracefully to rules (verified manually).
      Simulated by pointing `OLLAMA_URL` at an unreachable address (not the real
      Ollama install) and re-running extraction on cleared jobs — confirmed fast,
      correct fallback to `rules` for all of them. This test also caught and fixed
      a real bug: completed BullMQ jobs with a stable custom jobId blocked all
      future re-enqueues of that same job (missing `removeOnComplete`).
- [x] Radar cards show match scores and sort by best match. Verified live: sort by
      "Best match" correctly re-ordered cards (51%, 45%, 44%, 38%...).
- [x] Insights page renders live aggregates in both themes with the gap
      highlighted. Verified live in light + dark: stat tiles, skill-demand bar
      chart (emphasis coloring for owned vs. gap skills), category filter, trend
      chart, gap list — no console errors, no overflow at 1000px.
- [x] `/insights/gap` response shape documented (Phase 3 dependency). Shape:
      `{ skill, category, jobCount, share }[]`, defined as `SkillDemandItem` in
      `packages/shared/src/index.ts`.

### Post-wrap-up addendum

Found while closing a scope gap before Phase 3 (the Job Radar had no detail
view for a listing — added as a drawer, reusing this plan's "job detail"
language from Step 6):

- The drawer was the first UI surface to ever render a job's full
  `descriptionText`, which exposed two crawl-pipeline bugs no card view had
  been able to show: `stripHtml()` never decoded HTML entities, and the
  ITviec adapter sliced the description starting at the marker attribute
  itself, leaking that attribute text into the front of every ITviec
  description. Both fixed at the source, plus a one-off idempotent script
  repaired the 144/287 already-crawled jobs affected.
- Re-verified this phase's Ollama-outage exit criterion: 9 jobs were still
  sitting on the `rules` extractor from that test. 3 re-processed cleanly
  once re-enqueued; the other 6 had a stale Redis `completed` record from
  *before* the `removeOnComplete` fix landed, silently blocking re-enqueue
  the same way the original bug did — cleared those records manually and
  re-ran extraction. All jobs now correctly show `ollama`.
