# Phase 4 — Application Tracker + resume-ready polish

**Goal:** a kanban pipeline for applications linked to Radar jobs, plus everything
that makes the repo presentable: CI, tests badge, README with screenshots and an
architecture diagram, and a final UX pass.
**Prerequisite:** Phase 1 (jobs). Phases 2–3 recommended but not required.

---

## Step 1 — Applications data model + API

1. Prisma: `Application` — `jobId?` (nullable: manual entries allowed), company,
   title, url, `stage` (`saved | applied | screening | interviewing | offer |
   rejected | withdrawn`), `appliedAt?`, `nextActionAt?`, `nextActionNote?`,
   salaryExpectation?, createdAt/updatedAt. `ApplicationEvent` — applicationId,
   kind (`note | stage_change | interview`), body (markdown), `interviewKind?`
   (`phone | technical | system_design | behavioral | final`), occurredAt.
2. API `applications` module: CRUD + `POST /applications/:id/events` +
   `PATCH /applications/:id/stage` (writes a `stage_change` event atomically);
   `GET /applications?stage=` grouped response for the board;
   `GET /applications/stats` — funnel counts, response rate (past `applied`),
   interviews per week, average days-in-stage.
3. Radar integration: "Track application" action on a job card creates an
   Application at `saved` prefilled from the job (dedupe: one application per job).

**Tests:** e2e for stage transition + event log atomicity, funnel stat math on a
seeded fixture, job→application dedupe.

## Step 2 — Kanban board UI

1. `pnpm add @dnd-kit/core @dnd-kit/sortable` in web.
2. Board: 7 columns (collapse `rejected`/`withdrawn` into a de-emphasized rail on
   the right), column counts, drag between columns → `PATCH stage` (optimistic,
   revert on failure). Cards: company, title, match pill (if linked job), days in
   stage, next-action chip (amber when overdue).
3. Application drawer (click card): details, editable next action, event timeline
   (notes with markdown, interview entries with kind badges), quick "add note" box.
4. Stats strip above board from `/applications/stats`.
5. Keyboard/a11y: dnd-kit keyboard sensor enabled; drawer closes on Esc.

**Verify (browser):** create → drag through stages → timeline shows the history;
overdue next-action turns amber; both themes.

## Step 3 — App-wide UX polish pass

Work through this checklist page by page (Radar, Insights, Roadmap, Review,
Tracker, Profile):

- [ ] Every async view has loading / empty / error states (no blank flashes).
- [ ] Focus states visible on all interactive elements (accent outline token).
- [ ] `aria-label`s on icon-only buttons; landmark roles sane; tab order logical.
- [ ] Responsive to 900px: sidebar collapses to icon rail (tooltip labels).
- [ ] React error boundary at the layout level with a styled fallback.
- [ ] Toast system (one small custom component, no dep) for mutations: saved,
      crawl started, application moved, etc.
- [ ] Sweep for hardcoded colors/px creep — everything through tokens.
- [ ] `document.title` per page ("Radar — Waypoint").

## Step 4 — CI + repo hygiene

1. `.github/workflows/ci.yml`: on push/PR — pnpm setup with cache, `pnpm install
   --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test`. Postgres +
   Redis as service containers for API e2e (env-gate e2e so they skip cleanly when
   services are absent locally).
2. Add ESLint (flat config, typescript-eslint recommended + react-hooks) at root;
   fix or consciously disable findings; add `pnpm lint` to CI.
3. `LICENSE` (MIT), `CONTRIBUTING.md` optional.

## Step 5 — README as a portfolio piece

This README is what a hiring manager sees. Structure:

1. Hero: one-line pitch + two screenshots side by side (Radar light, Insights dark)
   in a table; CI badge.
2. "Why this exists" — 3 sentences: own crawler, market-driven prep, zero paid
   services.
3. Architecture: a Mermaid diagram (monorepo packages, crawl pipeline flow
   crawler → queue → Postgres → insights → roadmap) plus a short "design
   decisions" list (adapter pattern, failure-as-data source health, local-first
   LLM with graceful fallback, SM-2, dedup strategy). These are interview talking
   points — write them as such.
4. Getting started (verified-fresh: clone → running in ≤5 commands on a clean
   machine — actually test this).
5. Screenshots section for every module.
6. Honest scoping notes (LinkedIn exclusion, adapter fragility policy).

**Verify:** clone the repo to a temp dir and follow your own README start-to-finish.

## Step 6 — Demo seed (optional but valuable)

`pnpm demo:seed` — loads a realistic snapshot (60 jobs across sources with
extracted skills, a half-completed roadmap, 20 review logs, 8 applications across
stages) so the app screenshots well and anyone cloning it sees a living dashboard
without waiting for a crawl. Keep the dataset in `apps/api/prisma/demo/`.

---

## Exit criteria

- [ ] CI green on GitHub on a fresh push (typecheck, lint, build, unit + e2e).
- [ ] Board drag-and-drop works with optimistic updates and keyboard support.
- [ ] Polish checklist fully ticked; no console errors anywhere.
- [ ] README renders beautifully on GitHub: badges, diagram, screenshots.
- [ ] Fresh-clone test passes: a new machine reaches a running dashboard in ≤5
      commands.
- [ ] All four README roadmap checkboxes flipped — project is resume-ready.
