# Waypoint — project instructions

## i18n: every new UI string ships in English and Vietnamese

The web app (`apps/web`) supports English and Vietnamese via `react-i18next`.
Scope is **UI chrome only**: nav, buttons, headers/subtitles, empty states,
form labels, tooltips, aria-labels, and dynamically-generated template text
(e.g. roadmap "reason" strings, stat labels). It deliberately does **not**
cover: curated content authored once and read many times (Daily Review card
prompts/answers, roadmap resource titles/notes), or third-party data we don't
own (crawled job postings). If a new feature needs a call on which bucket a
string falls into, ask rather than guessing — the line is deliberate, not an
oversight.

**Whenever you add or change UI-chrome text:**

1. Never hardcode a string directly in JSX. Add a key to
   `apps/web/src/i18n/locales/en.json`, add the matching key to
   `apps/web/src/i18n/locales/vi.json` in the same commit, and reference it via
   `useTranslation()`'s `t('namespace.key')` (or `i18n.t(...)` directly for
   plain utility functions that aren't components — see `lib/time.ts`).
2. Nest keys under the page/feature they belong to (`radar.*`, `roadmap.*`,
   `review.*`, `profile.*`, `common.*` for cross-page strings, `time.*` for
   the `timeAgo()` utility). Match the existing structure in `en.json` rather
   than inventing a new top-level shape.
3. For strings with a count, use i18next's native `_one`/`_other` suffixes
   (e.g. `sessionCompleteReviewed_one` / `_other`) and pass `{ count }` —
   don't hand-roll pluralization with string concatenation.
4. Enum-like data rendered as a badge/label (job seniority, work mode, track
   name) goes through a translated lookup (`t(\`workMode.${value}\`)`,
   `t(\`track.${trackId}\`)`), not a hardcoded `Record<Enum, string>` map.
5. Vietnamese should read naturally, not as a literal word-for-word
   translation. Keep widely-used English tech/industry terms as-is where a
   Vietnamese engineer would actually say them in conversation (React, AWS,
   Docker, API, DSA, System Design, DevOps, SM-2, etc.) — translate the
   surrounding sentence, not the jargon.
6. Before calling a feature done, switch the running app to Vietnamese (the
   toggle next to the theme switch in the sidebar) and check the new UI in
   both languages, both themes — a key that resolves to `key.path` instead of
   real text means an entry is missing from one of the two JSON files.
