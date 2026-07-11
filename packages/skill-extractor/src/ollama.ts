import { ALIAS_TO_SKILL, SeniorityLevel, SKILL_TAXONOMY } from '@waypoint/shared';
import { z } from 'zod';
import { extractSalary, extractSeniority, extractSkills, type ExtractedSkill } from './rules.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
const CHAT_TIMEOUT_MS = 20_000;
const HEALTH_TIMEOUT_MS = 2_000;
const MAX_TEXT_CHARS = 6_000;

const TAXONOMY_NAMES = SKILL_TAXONOMY.map((s) => s.name).join(', ');

function systemPrompt(): string {
  return [
    'You are a technical recruiter assistant. Extract structured data from a job description.',
    `Only use skill names from this exact list (do not invent new ones): ${TAXONOMY_NAMES}`,
    'Respond with ONLY valid JSON, no other text, matching exactly this shape:',
    '{"skills": [{"name": "<skill from the list>", "confidence": <number 0-1>}], "seniority": "<intern|junior|mid|senior|lead|unknown>", "salaryText": "<string or null>"}',
  ].join('\n');
}

const OllamaJsonSchema = z.object({
  skills: z
    .array(z.object({ name: z.string(), confidence: z.number() }))
    .default([]),
  seniority: z.string().nullable().optional(),
  salaryText: z.string().nullable().optional(),
});

interface OllamaChatResponse {
  message?: { content?: string };
}

/** Maps model-returned skill names through the alias table; drops anything not in the taxonomy. */
function mapOllamaSkills(raw: Array<{ name: string; confidence: number }>): ExtractedSkill[] {
  // A model can mention the same skill under two different aliases (or just
  // repeat itself) — dedupe by canonical name, keeping the highest confidence.
  const byCanonical = new Map<string, ExtractedSkill>();
  for (const item of raw) {
    const canonical = ALIAS_TO_SKILL.get(item.name.toLowerCase().trim());
    if (!canonical) continue; // never invent taxonomy entries from model output
    const confidence = Math.max(0, Math.min(1, item.confidence));
    const existing = byCanonical.get(canonical);
    if (!existing || confidence > existing.confidence) {
      byCanonical.set(canonical, { skill: canonical, confidence, evidence: '' });
    }
  }
  return [...byCanonical.values()];
}

async function callOllama(text: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        format: 'json',
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'user', content: text.slice(0, MAX_TEXT_CHARS) },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ollama http ${res.status}`);
    const data = (await res.json()) as OllamaChatResponse;
    if (!data.message?.content) throw new Error('ollama response missing message content');
    return JSON.parse(data.message.content);
  } finally {
    clearTimeout(timeout);
  }
}

/** Health probe — call once per batch, not per job. */
export async function isOllamaUp(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export interface ExtractionResult {
  skills: ExtractedSkill[];
  seniority: SeniorityLevel;
  salaryText?: string;
  extractor: 'ollama' | 'rules';
}

/**
 * Tries Ollama first (with a hard timeout); on any connection error, timeout,
 * or unparseable/invalid response, falls back to the deterministic rule-based
 * extractor. Seniority/salary are backfilled from the rule-based extractor
 * whenever Ollama doesn't provide them, regardless of which path produced
 * the skills — both computations are cheap and this gives the best signal
 * available rather than leaving a field unnecessarily blank.
 */
export async function extractWithFallback(text: string, title = ''): Promise<ExtractionResult> {
  try {
    const raw = await callOllama(text);
    const parsed = OllamaJsonSchema.parse(raw);
    const skills = mapOllamaSkills(parsed.skills);

    const seniorityResult = parsed.seniority ? SeniorityLevel.safeParse(parsed.seniority) : null;
    const seniority = (seniorityResult?.success ? seniorityResult.data : undefined) ?? extractSeniority(title, text);
    const salaryText = parsed.salaryText ?? extractSalary(text);

    return { skills, seniority, salaryText, extractor: 'ollama' };
  } catch {
    return {
      skills: extractSkills(text),
      seniority: extractSeniority(title, text),
      salaryText: extractSalary(text),
      extractor: 'rules',
    };
  }
}
