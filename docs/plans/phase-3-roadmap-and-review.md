# Phase 3 — Prep Roadmap + Daily Review

**Goal:** a generated, market-aware weekly study plan across the four tracks (DSA,
system design, cloud infra, web fundamentals), and a daily spaced-repetition queue.
**Prerequisite:** Phase 2 (`/insights/gap`, profile).

---

## Step 1 — Content data model

Prisma additions (one migration):

- `Track` — id (`dsa | system_design | cloud | web`), name, description.
- `Topic` — belongs to Track; name, slug, order, `skills String[]` (taxonomy names
  that make this topic market-relevant), `difficulty Int 1-3`.
- `Resource` — belongs to Topic; title, url, kind (`article | video | course |
  problem_set | book_chapter`), free-form note, `estMinutes Int`.
- `RoadmapItem` — topicId, weekIndex, status (`todo | in_progress | done`),
  `reason String` (why it was scheduled — e.g. "kafka appears in 34% of JDs you
  can't cover"), createdAt/completedAt.
- `ReviewCard` — trackId, prompt (markdown), answer (markdown), `topicSlug?`;
  SM-2 state: `easiness Float @default(2.5)`, `intervalDays Int @default(0)`,
  `repetitions Int @default(0)`, `dueAt DateTime @default(now())`, `lapses Int`.
- `ReviewLog` — cardId, grade, reviewedAt, previous/next interval (for the stats).

## Step 2 — Seed content

This is curation work — quality matters more than volume. Create
`apps/api/prisma/content/` JSON files, seeded idempotently (upsert by slug):

1. **Tracks/topics** (~40 topics total):
   - DSA: the NeetCode-style pattern ladder — arrays & hashing, two pointers,
     sliding window, stack, binary search, linked list, trees, tries, heaps,
     backtracking, graphs, 1-D DP, 2-D DP, greedy, intervals. Order = ladder order.
   - System design: fundamentals (estimation, CAP, consistency), building blocks
     (LB, cache, queue, CDN, sharding), classic designs (URL shortener, feed,
     chat, rate limiter, notification system), interview method.
   - Cloud: containers & Docker, K8s basics, AWS core (EC2/S3/RDS/Lambda/IAM),
     networking & DNS, IaC/Terraform, CI/CD, observability.
   - Web: HTTP deep-dive, auth (sessions/JWT/OAuth), REST/GraphQL design, browser
     internals & rendering, caching layers, security (OWASP top 10), performance,
     websockets, database indexing & transactions.
2. **Resources**: 2–4 per topic, free only (NeetCode lists, System Design Primer
   sections, roadmap.sh nodes, AWS free docs/workshops, MDN, web.dev, Hussein
   Nasser/ByteByteGo videos). Every resource needs `estMinutes`.
3. **Review cards** (~120 to start, in `content/cards/*.json` by track): DSA
   pattern-recognition prompts ("Given sorted array + target sum → which pattern and
   why?"), complexity flashcards, system-design mini-prompts ("Design a rate
   limiter — name 3 algorithms and their trade-offs"), cloud/web concept cards.
   Prompts and answers are markdown.

**Tests:** seed-file schema validation (Zod) runs inside the seed script and as a
unit test — malformed content fails CI, not runtime.

## Step 3 — SM-2 scheduler

`packages/shared/src/sm2.ts` (pure):

```ts
sm2(state: { easiness, intervalDays, repetitions }, grade: 0|1|2|3|4|5)
  → { easiness, intervalDays, repetitions, dueInDays, lapsed }
```

Standard SM-2: grade <3 resets repetitions and interval to 1 (lapse); easiness
`max(1.3, e + 0.1 - (5-g)*(0.08+(5-g)*0.02))`; intervals 1, 6, then `round(prev*e)`.

**Tests:** the canonical sequences — all-5s produce 1, 6, 15/16, …; a grade-2 after
success chain resets; easiness floor at 1.3; property test: interval always ≥1.

## Step 4 — Roadmap generator

`apps/api/src/roadmap/roadmap.service.ts`:

1. Inputs: `/insights/gap` data (skill → demand share), profile, topics (with their
   `skills[]`), and hours/week budget (profile field, default 8h).
2. Scoring per topic: market weight (max demand share of its skills, 0 if none) ×
   0.5 + gap weight (skill not in profile) × 0.3 + prerequisite order × 0.2. DSA
   ladder topics keep ladder order regardless (interleave: every week gets ≥1 DSA
   topic + 1–2 topics from other tracks).
3. Pack topics into weeks by summing resource `estMinutes` against the weekly
   budget; 6-week horizon; each `RoadmapItem.reason` records the driving stat.
4. Endpoints: `POST /roadmap/generate` (idempotent: wipes `todo` items, keeps
   done/in_progress), `GET /roadmap`, `PATCH /roadmap/items/:id` (status).

**Tests:** deterministic fixture (fake gap data + 10 topics) → assert week packing
respects budget, DSA interleaving, reasons populated; regeneration preserves
completed items.

## Step 5 — Review API

`apps/api/src/review/`:

- `GET /review/queue?limit=20` — cards with `dueAt <= now()`, ordered by dueAt;
  include new-card ration (max 10 new/day — `repetitions = 0` cards beyond that
  stay out of the queue).
- `POST /review/cards/:id/grade` body `{ grade: 0-5 }` — applies `sm2`, writes
  `ReviewLog`, returns next state.
- `GET /review/stats` — due today, done today, streak (consecutive days with ≥1
  review), per-track counts, 30-day review heatmap data.

**Tests:** e2e — grading updates dueAt correctly (freeze time), new-card cap
enforced, streak math across day boundaries (use fixed timezone: Asia/Ho_Chi_Minh).

## Step 6 — Roadmap page UI

Replace the empty state:

1. Header: hours/week control + "Regenerate" button (confirm dialog: keeps
   completed work).
2. Week accordion (current week expanded): topic cards with track badge (color per
   track: accent=DSA, info=system design, warning=cloud, success=web), difficulty
   dots, the `reason` line in muted text ("34% of mid-level JDs mention kafka"),
   and resources as checkable rows with kind icon + est. time.
3. Topic status flows: checkbox → in_progress/done; week progress bar; overall
   progress ring in the header.
4. Empty state (no crawl data yet): generator still works from gap=∅ — pure
   ladder/foundations order; banner explains scores improve once data flows.

**Verify (browser):** generate against real data, complete a topic, regenerate and
confirm completion survives; both themes.

## Step 7 — Daily Review page UI

1. Queue view: one card at a time — prompt (markdown-rendered; add `marked` +
   sanitize or `react-markdown`), "Show answer" reveal, then grade buttons
   Again(0) / Hard(3) / Good(4) / Easy(5) with the next interval printed under
   each ("Good → 6d"). Keyboard: space = reveal, 1–4 = grade.
2. Session end screen: reviewed count, streak, per-track breakdown.
3. Stats strip on top: due today / done today / streak flame.
4. Sidebar badge: due count on the Daily Review nav item (poll `/review/stats`).

**Verify (browser):** grade through ≥10 cards, confirm intervals change, streak
increments, keyboard shortcuts work, markdown (code blocks in DSA cards) renders
with `--font-mono`.

---

## Exit criteria

- [x] All green: typecheck, build, unit + e2e. 182 tests across the repo.
- [x] Seed loads: 4 tracks, 43 topics, 88 resources, 120 cards, all schema-valid.
      Validated by a Zod schema with cross-reference checks (topic->track,
      card->topic, unique contentIds), enforced both in the seed script and as
      a unit test against the real content.
- [x] `POST /roadmap/generate` produces a 6-week plan with reasons tied to real
      insight data; regeneration preserves progress. Verified live: 18 items
      across 6 weeks, reasons like "aws appears in 45% of tracked jobs you
      can't yet cover"; marked a topic done, regenerated, confirmed it
      survived untouched and wasn't rescheduled.
- [x] Daily review loop works end-to-end with SM-2 intervals verified against the
      canonical sequence (1, 6, 16, 45 — unit-tested). Verified live: graded a
      full 10-card session (which exercised the daily new-card cap), watched
      due/done/streak/sidebar-badge update after every grade, hit the
      session-end screen with a correct per-track breakdown.
- [x] Both new pages match the design system in light + dark, no console errors.

### Notes

- The new-card daily cap (10/day) throttles `GET /review/queue` but not the
  `dueToday` stat, which counts the full backlog — the Daily Review empty
  state distinguishes "today's new-card limit reached" from "nothing due" so
  this doesn't read as a bug when a large unseen deck exists.
- Keyboard shortcut verification: digit-key grading (1-4) was confirmed live;
  the space-to-reveal shortcut could not be exercised through the Browser
  pane's automation (it dispatches a keydown with empty `key`/`code` for the
  space character specifically — a tool limitation, not app behavior). The
  handler is a straightforward `e.code === 'Space'` check identical in shape
  to the working digit-key handler, so this is a coverage gap in automated
  verification, not a known defect.
