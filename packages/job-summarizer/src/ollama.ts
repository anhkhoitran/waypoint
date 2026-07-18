import { RoleFunction } from '@waypoint/shared';
import { validateSummary, type ValidatedSummary } from './validate.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
// gemma4:e4b is an 8B model (Q4_K_M, ~9.6GB) — heavier than the 3B extractor
// model, hence the longer timeout and the pipeline running this serialized
// in the background rather than on any request path.
//
// Exported (not just used internally) so the summarize pipeline can compare
// a persisted JobSummary.model against "what's configured right now" without
// duplicating the env-var-with-default logic — the same value must be used
// for both writing and staleness checks, or backfill's re-generation
// tracking silently drifts from what's actually being requested.
export const CURRENT_SUMMARY_MODEL = process.env.OLLAMA_SUMMARY_MODEL || 'gemma4:e4b';
const CHAT_TIMEOUT_MS = 30_000;
const HEALTH_TIMEOUT_MS = 2_000;
const MAX_TEXT_CHARS = 8_000;

/** Bump whenever the prompt or response shape changes meaningfully — the
 * summarize pipeline uses this to gate re-generation (see JobSummary.promptVersion).
 * v2: the JSON schema's property names alone weren't enough guidance for an
 * 8B model — it correctly extracted "5+ years" into `requirements` but left
 * the separate `yearsExperienceMin` field null. Explicitly describing each
 * field in the prompt (not just the schema shape) fixed it in testing.
 * v3: gemma4:e4b tends to omit a non-required JSON Schema key entirely
 * rather than emit an empty array — `benefits`/`niceToHave` were silently
 * missing even when a "Benefits:" section was clearly present. Made both
 * required in the schema, which forces the model to actively decide their
 * content instead of skipping them.
 * v4: `roleFunction` had a severe "security" bias on a real 610-job backfill
 * (36% classified security). Tried to fix it with prose about what "other"
 * and "security" mean plus "prefer other when unsure" — which over-corrected
 * catastrophically: a full v4 backfill put 92% of relevant jobs (including
 * plain "DevOps Engineer", "Senior QA Engineer") into "other". Leading with
 * "other" and telling the model to prefer it made it lazy.
 * v5: replaced that with a positive per-category definition list and an
 * explicit "pick the most specific engineering category; only fall back to
 * other when none fit". Also: now that non-tech postings are filtered out
 * BEFORE summarization (classifyRelevance), the model no longer sees the
 * ambiguous non-tech roles that drove the original security bias. */
export const SUMMARY_PROMPT_VERSION = 5;

function systemPrompt(): string {
  return [
    'You are a job-posting analyst. Extract structured data from the job posting',
    'you are given. Extract ONLY information explicitly present in the text —',
    'never invent responsibilities, requirements, numbers, or benefits that are',
    'not stated.',
    '',
    'Fields:',
    '- summary: at most 2 sentences, written in the SAME language as the posting.',
    '- responsibilities: bullet list of what the person will actually do day to day.',
    '- requirements: bullet list of required skills, qualifications, or experience.',
    '- niceToHave: bullet list of preferred-but-optional skills, if the posting',
    '  distinguishes them from hard requirements. Empty array if it does not.',
    '- benefits: bullet list of perks, compensation extras, or benefits offered —',
    '  check for a dedicated "Benefits"/"Perks"/"What we offer" section as well as',
    '  benefits mentioned inline elsewhere. Empty array if none are stated.',
    '- roleFunction: the single best-fitting category. Pick the most specific',
    '  engineering category that applies; only fall back to "other" when none',
    '  genuinely fit. Categories:',
    '    frontend  — builds user-facing web UI (React, Vue, Angular, CSS, etc.)',
    '    backend   — server-side APIs, services, databases, business logic',
    '    fullstack — meaningfully spans both frontend and backend',
    '    mobile    — iOS, Android, React Native, or Flutter apps',
    '    data      — data engineering, pipelines, analytics, BI, warehousing',
    '    ml        — machine learning, AI, model training, MLOps, LLM/GenAI',
    '    devops    — infrastructure, cloud ops, CI/CD, SRE, platform engineering',
    '    security  — the role itself is cybersecurity/infosec (security engineer,',
    '                SOC analyst, pen tester, GRC). NOT for a role that merely',
    '                mentions "ensure data security" in passing.',
    '    qa        — quality assurance, testing, test automation',
    '    pm        — product, project, program, or technical delivery management',
    '    design    — UX / UI / product design',
    '    other     — a genuine software/IT role that fits none of the above, or a',
    '                non-technical role. Do not default here for a role that has a',
    '                clear engineering category above.',
    '- yearsExperienceMin: if the posting states a minimum years of experience',
    '  anywhere (e.g. "5+ years", "at least 3 years of experience", even if it',
    '  also appears inside a requirements bullet), extract that number here too.',
    '  Otherwise null.',
    '',
    'Return an empty array (or null for yearsExperienceMin) for any field with',
    'nothing to extract — do not fabricate content to fill a field.',
  ].join('\n');
}

// Ollama structured outputs: passing a JSON Schema object (rather than the
// bare string "json") grammar-constrains generation, which is what makes
// `roleFunction` reliably land inside the fixed enum instead of drifting.
// `description` on each property is a secondary nudge — the system prompt
// above is what's guaranteed to reach the model as real context.
const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'At most 2 sentences, same language as the posting.' },
    responsibilities: {
      type: 'array',
      items: { type: 'string' },
      description: 'What the person will actually do day to day.',
    },
    requirements: {
      type: 'array',
      items: { type: 'string' },
      description: 'Required skills, qualifications, or experience.',
    },
    niceToHave: {
      type: 'array',
      items: { type: 'string' },
      description: 'Preferred-but-optional skills, if distinguished from requirements.',
    },
    benefits: {
      type: 'array',
      items: { type: 'string' },
      description: 'Perks, compensation extras, or benefits offered.',
    },
    roleFunction: { type: 'string', enum: RoleFunction.options },
    yearsExperienceMin: {
      type: ['number', 'null'],
      description: 'Minimum years of experience stated anywhere in the posting, or null.',
    },
  },
  // niceToHave/benefits are deliberately required (not just present-if-found):
  // when a JSON Schema property isn't required, gemma4:e4b tends to omit the
  // key entirely rather than emit an empty array, even when the posting
  // clearly has a "Benefits:" section. Forcing the key's presence makes the
  // model actively decide its content instead of skipping it.
  required: ['summary', 'responsibilities', 'requirements', 'niceToHave', 'benefits', 'roleFunction'],
};

interface OllamaChatResponse {
  message?: { content?: string };
}

async function callOllama(title: string, text: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: CURRENT_SUMMARY_MODEL,
        format: RESPONSE_JSON_SCHEMA,
        stream: false,
        think: false,
        options: { temperature: 0.1 },
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'user', content: `Title: ${title}\n\n${text.slice(0, MAX_TEXT_CHARS)}` },
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

export interface SummarizeResult extends ValidatedSummary {
  model: string;
}

/**
 * Tries Ollama; returns null on any connection error, timeout, or a
 * response that fails schema validation or an anti-hallucination
 * ground-check — never fabricates. Unlike the skill extractor there is no
 * deterministic fallback here: structured summarization genuinely needs a
 * model. Callers (the Job Detail drawer) fall back to a client-side
 * heuristic split of the raw description instead of a server summary.
 */
export async function summarizeWithFallback(text: string, title = ''): Promise<SummarizeResult | null> {
  try {
    const raw = await callOllama(title, text);
    if (process.env.SUMMARIZER_DEBUG) console.error('[job-summarizer] raw model output:', JSON.stringify(raw));
    const validated = validateSummary(raw, text);
    if (!validated) {
      if (process.env.SUMMARIZER_DEBUG) console.error('[job-summarizer] rejected by validateSummary — see raw output above');
      return null;
    }
    return { ...validated, model: CURRENT_SUMMARY_MODEL };
  } catch (err) {
    if (process.env.SUMMARIZER_DEBUG) console.error('[job-summarizer] threw before/during validation:', err);
    return null;
  }
}
