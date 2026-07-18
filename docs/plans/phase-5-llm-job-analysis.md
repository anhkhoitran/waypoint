# Phase 5 — LLM job analysis (structured summaries + role analytics)

**Goal:** every crawled job gets a structured, LLM-generated analysis — a short
summary plus `responsibilities / requirements / niceToHave / benefits` lists and a
`roleFunction` classification — produced by a **local** model through Ollama, stored
in Postgres, and surfaced in the Job Detail drawer and (for the bounded, low-risk
signals only) on the Market Insights page.
**Prerequisite:** Phase 2 complete (Ollama extraction pipeline + BullMQ queues +
`packages/skill-extractor` exist). This phase clones that pattern; it does not
refactor it.

---

## Model

Tag: **`gemma4:e4b`** (Ollama). Real specs (confirmed from the Ollama registry):

- arch `gemma4`, **8B parameters**, quantization `Q4_K_M`, **~9.6 GB on disk / ~10 GB
  resident RAM**. Apache-2.0. Capabilities: vision, audio, **tools**, **thinking**.
- Only the text path matters here (JD text → JSON); vision/audio are unused but are
  part of why the model is heavier than a text-only 3–4B.
- Default sampling is `temperature 1, top_k 64, top_p 0.95`. **Override temperature
  low (~0.1)** for this task — we want deterministic extraction, not creativity.
- **Disable "thinking"** for v1 (it adds reasoning-token latency this bounded task
  doesn't need). Keep it as a tuning knob to A/B later.
- Because it's an 8B model, inference is seconds-to-tens-of-seconds per job on CPU.
  This phase therefore runs summarization **in the background, serialized
  (worker concurrency 1), rate-limited, and version-gated** — never on the request
  path. Model is configurable via `OLLAMA_SUMMARY_MODEL` so it can be A/B'd against
  the lighter `qwen2.5:3b` already used for skill extraction.

## The load-bearing principle: display enrichment vs. analytics

LLM output enriches **display** freely, but only **bounded, ground-checkable** fields
are allowed to feed **Insights aggregates**. The current charts are trustworthy
because they're deterministic (taxonomy skills, regex salary); one hallucinated
number silently corrupts an aggregate with no visible tell.

| Field | Use | Verdict |
| ----- | --- | ------- |
| `summary`, `responsibilities[]`, `requirements[]`, `niceToHave[]`, `benefits[]` | Drawer only | Free |
| `roleFunction` (fixed enum) | Drawer **+ Insights donut** | Allowed — enum-constrained, robust in aggregate |
| `yearsExperienceMin` (int) | Insights distribution | Allowed **only if** the integer is verified to appear near "year"/"yr" in the source text; else `null` |
| salary numbers | median / salary charts | **Forbidden** — stays deterministic (`parseUsdMidpoint`). The LLM never feeds salary aggregates. |

`roleFunction` is the flagship analytics win: "what *kinds* of roles is the market
posting" is something the deterministic pipeline cannot answer today.

---

## Step 1 — Data model + shared types

1. New Prisma model `JobSummary` (1:1 with `Job`, separate table — keeps `Job` lean,
   nullable, regenerable, carries provenance; mirrors how `JobSkill` is separated):

   ```prisma
   model JobSummary {
     jobId              String   @id
     job                Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
     summary            String
     responsibilities   String[]
     requirements       String[]
     niceToHave         String[]
     benefits           String[]
     roleFunction       String                       // enum-ish; see taxonomy below
     yearsExperienceMin Int?                          // nullable; ground-checked
     model              String                        // provenance, e.g. "gemma4:e4b"
     promptVersion      Int                           // bump to force re-generation
     sourceHash         String                        // hash(descriptionText)
     generatedAt        DateTime @default(now())
   }
   ```
   Add `summary JobSummary?` back-relation on `Job`. Run `prisma migrate dev`.

2. `roleFunction` taxonomy (fixed enum, shared constant in `packages/shared`):
   `frontend | backend | fullstack | mobile | data | ml | devops | security | qa |
   pm | design | other`.

3. In `packages/shared/src/index.ts`, add a `JobSummary` Zod schema and extend
   `JobRecord` with `summary: JobSummary.nullable().optional()`. Rebuild shared.

**Tests:** shared schema round-trips; `roleFunction` enum rejects off-taxonomy values.

## Step 2 — `packages/job-summarizer` package

New package, same tsup setup as `skill-extractor`. Structure clones it: `index.ts`,
`ollama.ts`, `validate.ts`, `__tests__/`.

1. **Client** — `POST {OLLAMA_URL}/api/chat`, `model` from
   `OLLAMA_SUMMARY_MODEL` (default `gemma4:e4b`), `stream: false`,
   `options: { temperature: 0.1 }`, `think: false`. Use Ollama **structured output**:
   pass `format` as a **JSON-schema object** (not the legacy `format: "json"` string
   the skill-extractor uses) — grammar-constrains a model into valid JSON far more
   reliably, and makes `roleFunction` a schema `enum` the model *cannot* violate.
   Hard timeout (~30s — larger than extraction's 20s because 8B + summarization is
   slower). Truncate input to ~8k chars.

2. **System prompt**, tightly scoped:
   *"You are a job-posting analyst. Extract ONLY information explicitly present in the
   text. If a field is absent, return an empty array or null. Never invent
   responsibilities, requirements, numbers, or benefits. Summary ≤ 2 sentences."*
   Provide `title` + `descriptionText` as the user message.

3. **Validators** (`validate.ts`) — the anti-hallucination core:
   - Zod-parse the JSON; on any failure → return `null`.
   - `yearsExperienceMin`: accept only if that integer appears near `year|yr` in the
     source text (regex ground-check); else `null`.
   - Cap each array to N items and each string to M chars.
   - `roleFunction`: must be in the enum or coerce to `"other"`.
   - Reject a `summary` that is empty or a near-verbatim copy of the first N chars of
     the source (a sign the model echoed instead of summarizing).

4. **`summarizeWithFallback(text, title): JobSummaryResult | null`** — tries Ollama;
   on down/timeout/invalid returns **`null`** (no fabrication). Reuse
   `skill-extractor`'s `isOllamaUp()` health-probe idea (call once per batch).
   Note: the *drawer's* deterministic fallback stays client-side (Step 5), so a
   `null` here is fine — it just means "no LLM summary; the UI degrades."

**Tests:** mirror `skill-extractor/src/__tests__/ollama.test.ts` — mock `fetch`, feed
fixture JSON, assert: valid parse maps through; ungrounded `yearsExperienceMin` is
dropped; off-enum `roleFunction` → `other`; oversized arrays capped; echoed summary
rejected; Ollama-down → `null`. Plus a gated `summarize.live.test.ts` (behind an env
flag, like `ollama.live.test.ts`) that hits a real local model.

## Step 3 — Summarize pipeline (`apps/api/src/summarize/`)

Clone `apps/api/src/extract/` module structure.

1. `summarize.processor.ts` — BullMQ `SUMMARIZE_QUEUE`, **worker concurrency 1**.
   `process(job)`: load the `Job`; compute `sourceHash`; **skip** if an existing
   `JobSummary` already matches `model + promptVersion + sourceHash`; else call
   `summarizeWithFallback`; on non-null, **upsert** `JobSummary` (upsert, not
   delete+create — it's 1:1). On `null`, log and leave any prior summary intact.
2. `summarize.service.ts` — `enqueue(jobIds)` with `jobId: summarize-${id}`,
   `removeOnComplete: true`, `removeOnFail: 50` (copy extract's rationale comment);
   `backfill()` = enqueue every job whose summary is missing or stale (model/prompt/
   hash mismatch).
3. `summarize.controller.ts` — `POST /summarize/backfill`, and (optional now, used in
   Step 7) `POST /summarize/:jobId` for on-demand priority.
4. `summarize.module.ts` — register the queue; export the service.
5. **Trigger**: in `crawl.processor.ts`, add one line beside the existing
   `extractService.enqueue(...)`: `await this.summarizeService.enqueue(rows.map(r => r.id))`.

**Tests:** processor idempotency (same hash → skip, no Ollama call); upsert overwrites
cleanly; `null` result leaves prior row untouched.
**Verify:** `docker compose up`, `ollama pull gemma4:e4b`, run a crawl, watch the
worker log summarize one job end-to-end, inspect the `JobSummary` row.

## Step 4 — Backfill + prompt tuning

1. `POST /summarize/backfill` over existing jobs. Because the model is 8B and
   serialized, expect this to take a while — that's fine, it's background.
2. Eyeball 15–20 real outputs (mix of ITviec Vietnamese + HN/RemoteOK English).
   Iterate the system prompt; **bump `promptVersion`** and re-backfill (version-gating
   makes this a no-manual-wipe operation).
3. Optional A/B: set `OLLAMA_SUMMARY_MODEL=qwen2.5:3b` (≈2 GB, much faster) vs
   `gemma4:e4b` (≈10 GB, higher quality) and compare on the same jobs. Record the
   call in the commit body.

## Step 5 — Drawer rendering

1. Include the `summary` relation in `jobs.service.ts`'s existing in-memory load and
   map it onto `JobRecord`.
2. Drawer layered rendering (keeps the Phase-4 heuristic as the deterministic
   fallback):
   1. DB `JobSummary` present → render structured sections **with a small
      "AI summary · gemma4:e4b" label** (transparency — never present model output as
      fact silently).
   2. else → existing client `splitDescriptionSections()` heuristic
      (`apps/web/src/lib/jobDescription.ts`).
   3. else → raw text block.
3. Optional "Regenerate" affordance calling `POST /summarize/:jobId`.

**i18n** (per the project i18n convention): section labels + the "AI summary" disclaimer = UI chrome
→ EN + VI. The summary **content** is third-party-derived → **not** translated (same
bucket as the raw description today). See Decision 3 on summary language.

## Step 6 — Insights: "Role function mix"

1. `GET /insights/role-functions?window=` — a `groupBy` on `JobSummary.roleFunction`
   for non-hidden jobs in window, same response shape as `workModeSplit`.
2. `useRoleFunctions(window)` hook (clone `useWorkModeSplit`).
3. New donut card reusing `WorkModeDonutChart`'s structure; slot into
   `InsightsPage` near the work-mode split. i18n title/hint + `roleFunction.*` label
   lookups (EN + VI), enum values through `t(\`roleFunction.${value}\`)`.

**Verify:** donut renders real role mix in both themes/languages; jobs without a
summary yet are simply absent from the aggregate (no crash, no fabricated bucket).

## Step 7 — (Optional / later) experience distribution + on-demand

1. "Experience required" distribution from the **ground-checked** `yearsExperienceMin`,
   clearly labeled as LLM-derived.
2. Hybrid compute strategy: keep background-after-crawl, but wire the on-demand
   `POST /summarize/:jobId` so opening an un-summarized job jumps the queue and the
   drawer shows a spinner→result. Best compute economy for a personal-scale tool.

---

## Open decisions — all confirmed

1. **Model** — ✅ `gemma4:e4b`, configurable via `OLLAMA_SUMMARY_MODEL`, A/B against
   `qwen2.5:3b` during Step 4.
2. **Compute strategy** — ✅ background-after-crawl only (Steps 3–4). Step 7's
   on-demand priority path is explicitly **out of scope** for this pass.
3. **Summary language** — ✅ source language (no translation; matches how the raw
   description is already treated).
4. **Insights scope in first pass** — ✅ only the `roleFunction` donut (Step 6).
   Step 7 (experience distribution) is **deferred**, not built this pass.

Scope for this execution: **Steps 1–6**. Step 7 stays documented above as the
natural next increment but is not implemented now.

## Ops / config appendix

- `.env` / `.env.example`: add `OLLAMA_SUMMARY_MODEL=gemma4:e4b` (reuse existing
  `OLLAMA_URL`). Ollama stays a **host** process on `:11434` (consistent with Phase 2;
  not added to docker-compose).
- README: document `ollama pull gemma4:e4b` (~9.6 GB download; ensure ~10 GB free RAM
  when the worker is active — it coexists with Postgres/Redis/the API).
- Worker concurrency **1**; the queue is the rate limiter. Never call the summarizer
  on a request path (except the explicit on-demand endpoint, which still goes through
  the queue at high priority).
- `promptVersion` + `model` + `sourceHash` gate all re-generation — iterate the prompt
  freely and re-backfill without manual DB surgery.
