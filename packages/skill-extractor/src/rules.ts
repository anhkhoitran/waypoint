import { SKILL_TAXONOMY, type SeniorityLevel } from '@waypoint/shared';

export interface ExtractedSkill {
  skill: string;
  confidence: number;
  evidence: string;
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Word-boundary via lookaround rather than \b: \b fails to fire when the
 * token's edge character is itself non-word (e.g. "c++" ends in "+", a \W
 * char, so "\bc\+\+\b" would not match "c++ developer" — no \w/\W
 * transition exists between "+" and the following space). Lookaround
 * boundaries just require "not a word character adjacent", which holds
 * regardless of which side is a symbol.
 */
function boundaryPattern(literal: string): string {
  return `(?<![\\w])${escapeRegExp(literal)}(?![\\w])`;
}

interface CompiledSkillPattern {
  skillName: string;
  canonicalRegex: RegExp;
  aliasRegex: RegExp | null;
}

const COMPILED_PATTERNS: CompiledSkillPattern[] = SKILL_TAXONOMY.map((skill) => {
  const canonicalRegex = new RegExp(boundaryPattern(skill.name), 'gi');
  let aliasRegex: RegExp | null = null;
  if (skill.aliases.length > 0) {
    const alternation = skill.aliases
      .slice()
      .sort((a, b) => b.length - a.length)
      .map((alias) => boundaryPattern(alias))
      .join('|');
    aliasRegex = new RegExp(alternation, 'gi');
  }
  return { skillName: skill.name, canonicalRegex, aliasRegex };
});

function firstMatchingLine(text: string, regex: RegExp): string {
  for (const rawLine of text.split(/\r?\n/)) {
    regex.lastIndex = 0;
    if (regex.test(rawLine)) {
      return rawLine.trim().slice(0, 120);
    }
  }
  return '';
}

/**
 * Scans job description text for taxonomy skills. Confidence: 1.0 for a
 * canonical-name hit, 0.9 for an alias-only hit, capped at 1.0 once a
 * skill is mentioned 3+ times total (canonical + alias).
 */
export function extractSkills(text: string): ExtractedSkill[] {
  const results: ExtractedSkill[] = [];

  for (const { skillName, canonicalRegex, aliasRegex } of COMPILED_PATTERNS) {
    const canonicalMatches = text.match(canonicalRegex) ?? [];
    const aliasMatches = aliasRegex ? (text.match(aliasRegex) ?? []) : [];
    const totalHits = canonicalMatches.length + aliasMatches.length;
    if (totalHits === 0) continue;

    const base = canonicalMatches.length > 0 ? 1.0 : 0.9;
    const confidence = totalHits >= 3 ? 1.0 : base;
    const evidenceRegex = canonicalMatches.length > 0 ? canonicalRegex : aliasRegex!;

    results.push({
      skill: skillName,
      confidence,
      evidence: firstMatchingLine(text, evidenceRegex),
    });
  }

  return results;
}

function seniorityFromText(raw: string): SeniorityLevel {
  const text = raw.toLowerCase();
  if (/\bintern(ship)?\b/.test(text)) return 'intern';
  if (/\b(junior|fresher|entry[- ]level)\b/.test(text)) return 'junior';
  if (/\b(staff|principal|architect|head of|director)\b/.test(text)) return 'lead';
  if (/\blead\b/.test(text)) return 'lead';
  if (/\bsenior\b|\bsr\.?\s/.test(text)) return 'senior';
  if (/\bmid[- ]?(level)?\b|\bmiddle\b/.test(text)) return 'mid';
  return 'unknown';
}

/** Refines Phase 1's title-only seniority guess by also checking the body text. */
export function extractSeniority(title: string, text: string): SeniorityLevel {
  const fromTitle = seniorityFromText(title);
  if (fromTitle !== 'unknown') return fromTitle;
  return seniorityFromText(text.slice(0, 1000));
}

const VND_RANGE = /(\d{1,3})\s*[-–—]\s*(\d{1,3})\s*(?:triệu|tr)\b/i;
const USD_K_RANGE = /\$\s?(\d{1,3}(?:\.\d+)?)\s?[kK]\s?[-–—]\s?\$?\s?(\d{1,3}(?:\.\d+)?)\s?[kK]/;
const USD_MONTHLY = /\$\s?([\d,]+)\s?\/\s?(?:month|mo)\b/i;
const USD_FULL_RANGE = /\$\s?([\d,]{4,})\s?[-–—]\s?\$?\s?([\d,]{4,})/;

/** Extracts a normalized salary string from free-text, or undefined if none found. */
export function extractSalary(text: string): string | undefined {
  const vnd = text.match(VND_RANGE);
  if (vnd) return `${vnd[1]}–${vnd[2]} triệu VND`;

  const usdK = text.match(USD_K_RANGE);
  if (usdK) return `$${usdK[1]}k – $${usdK[2]}k`;

  const usdMonthly = text.match(USD_MONTHLY);
  if (usdMonthly) return `$${usdMonthly[1]}/month`;

  const usdFull = text.match(USD_FULL_RANGE);
  if (usdFull) return `$${usdFull[1]} – $${usdFull[2]}`;

  return undefined;
}
