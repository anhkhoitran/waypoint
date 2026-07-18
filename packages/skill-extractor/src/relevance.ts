import { extractSkills } from './rules.js';

/**
 * A posting is treated as SWE/IT-relevant if its title reads like a technical
 * role, OR its text mentions enough distinct taxonomy skills to be a genuine
 * engineering posting rather than a non-tech role that merely name-drops a
 * cloud provider. Deliberately deterministic (no LLM) — this is the cheap
 * pre-filter that lets the summarizer skip irrelevant jobs entirely.
 *
 * Leans inclusive: the title path catches technical roles even when the JD is
 * short, and the skill path is a backstop for tech roles with unusual titles.
 * False positives (an occasional non-tech role slipping through) are
 * preferred over false negatives (a real engineering job being hidden).
 */

// Title reads as a technical/engineering role. Word-boundary anchored so
// "designer" doesn't match "sign", etc. Kept to clearly-technical role words —
// the skill-count path handles anything these miss.
const TECH_TITLE_RE = new RegExp(
  [
    'engineer',
    'developer',
    '\\bdev\\b',
    'programmer',
    'devops',
    '\\bsre\\b',
    'site reliability',
    'sysadmin',
    'system admin',
    'architect',
    'data scientist',
    'data engineer',
    'data analyst',
    'machine learning',
    '\\bml\\b',
    'mlops',
    '\\bqa\\b',
    'quality assurance',
    'tester',
    'test engineer',
    'full[ -]?stack',
    'front[ -]?end',
    'back[ -]?end',
    'software',
    'web developer',
    '\\bios\\b',
    'android',
    'mobile developer',
    'mobile engineer',
    'embedded',
    'firmware',
    '\\bdba\\b',
    'database admin',
    'platform engineer',
    'infrastructure engineer',
    'security engineer',
    'security analyst',
    'security specialist',
    'cyber ?security',
    'information security',
    'infosec',
    'network engineer',
    'cloud engineer',
    'tech(nical)? lead',
    'engineering manager',
    '\\bcto\\b',
    'blockchain',
    'site reliability',
  ].join('|'),
  'i',
);

// A non-tech posting can incidentally mention 1–2 tech terms (e.g. a marketing
// role for an "AWS" client). Requiring several distinct taxonomy skills keeps
// those out while still admitting any real engineering JD, which reliably
// clears this easily. Tunable — raise to be stricter, lower to be broader.
const SKILL_THRESHOLD = 3;

export function classifyRelevance(title: string, descriptionText: string, tags: string[] = []): boolean {
  if (TECH_TITLE_RE.test(title)) return true;
  // A taxonomy skill named in the title itself (e.g. "… (Python/C++)") is a
  // strong, low-noise signal — non-tech titles almost never contain one.
  if (extractSkills(title).length >= 1) return true;
  const skillHits = extractSkills(`${title}\n${descriptionText}\n${tags.join(' ')}`).length;
  return skillHits >= SKILL_THRESHOLD;
}
