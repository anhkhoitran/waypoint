import { RoleFunction } from '@waypoint/shared';
import { z } from 'zod';

const MAX_ARRAY_ITEMS = 8;
const MAX_ITEM_CHARS = 240;
const MAX_SUMMARY_CHARS = 400;
const MIN_YEARS = 0;
const MAX_YEARS = 30;

export interface ValidatedSummary {
  summary: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  benefits: string[];
  roleFunction: RoleFunction;
  yearsExperienceMin: number | null;
}

const RawSummarySchema = z.object({
  summary: z.string(),
  responsibilities: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  niceToHave: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
  roleFunction: z.string(),
  yearsExperienceMin: z.number().nullable().optional(),
});

function capArray(items: string[]): string[] {
  return items
    .slice(0, MAX_ARRAY_ITEMS)
    .map((item) => item.trim().slice(0, MAX_ITEM_CHARS))
    .filter(Boolean);
}

/**
 * Only trusts a model-returned yearsExperienceMin if that exact integer
 * appears near "year(s)"/"yr(s)" in the source text — the model doesn't get
 * to invent an experience requirement that isn't actually stated.
 */
function groundCheckYears(value: number | null | undefined, sourceText: string): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const years = Math.trunc(value);
  if (years < MIN_YEARS || years > MAX_YEARS) return null;
  const pattern = new RegExp(`\\b${years}\\s*\\+?\\s*(years?|yrs?)\\b`, 'i');
  return pattern.test(sourceText) ? years : null;
}

/**
 * A "summary" that's just a verbatim chunk of the source text isn't a
 * summary — it's the model echoing instead of synthesizing. Reject it
 * rather than store a pointless duplicate of the description.
 *
 * Checks the summary's FULL text against the whole source, not just a
 * prefix-of-prefix comparison — many job postings naturally open with
 * "We are hiring a <role> to join our <team>", so a genuine, well-written
 * summary often *starts* the same way as the source while still being real
 * synthesis throughout. Comparing only the first ~30 characters produced
 * false positives on exactly that pattern; requiring the entire summary to
 * appear verbatim is a much stronger (and still cheap) signal that nothing
 * was actually paraphrased.
 */
function looksEchoed(summary: string, sourceText: string): boolean {
  const normalized = summary.trim().toLowerCase();
  if (normalized.length < 30) return false;
  return sourceText.toLowerCase().includes(normalized);
}

/**
 * Validates and sanitizes raw model output against the source text it was
 * derived from. Returns null on any shape failure or failed
 * anti-hallucination check — callers treat null exactly like "Ollama
 * unreachable": no summary persisted this run, try again next crawl.
 */
export function validateSummary(raw: unknown, sourceText: string): ValidatedSummary | null {
  const parsed = RawSummarySchema.safeParse(raw);
  if (!parsed.success) return null;

  const summary = parsed.data.summary.trim().slice(0, MAX_SUMMARY_CHARS);
  if (summary.length === 0) return null;
  if (looksEchoed(summary, sourceText)) return null;

  const roleFunctionResult = RoleFunction.safeParse(parsed.data.roleFunction);
  const roleFunction = roleFunctionResult.success ? roleFunctionResult.data : 'other';

  return {
    summary,
    responsibilities: capArray(parsed.data.responsibilities),
    requirements: capArray(parsed.data.requirements),
    niceToHave: capArray(parsed.data.niceToHave),
    benefits: capArray(parsed.data.benefits),
    roleFunction,
    yearsExperienceMin: groundCheckYears(parsed.data.yearsExperienceMin, sourceText),
  };
}
