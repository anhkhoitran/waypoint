import { describe, expect, it } from 'vitest';
import { isOllamaUp, summarizeWithFallback } from '../ollama.js';

// Hits a real local Ollama instance running OLLAMA_SUMMARY_MODEL (default
// gemma4:e4b, ~9.6GB — `ollama pull gemma4:e4b` first). Skipped unless
// LIVE=1 is set, so normal test runs (and CI) never depend on it.
// Run manually with: LIVE=1 pnpm --filter @waypoint/job-summarizer test -- summarize.live
describe.runIf(process.env.LIVE === '1')('summarizeWithFallback (live Ollama)', () => {
  it('is reachable', async () => {
    expect(await isOllamaUp()).toBe(true);
  });

  it('summarizes a realistic job description', async () => {
    const jd = `
      About the role: We are hiring a Senior Backend Engineer to join our
      platform team.

      Responsibilities:
      - Design and ship APIs used by every product team
      - Own our on-call rotation
      - Mentor junior engineers

      Requirements:
      - 5+ years of backend experience
      - Strong Node.js and PostgreSQL skills
      - Experience with AWS

      Benefits:
      - Health insurance
      - Generous PTO
      - $2,000/yr learning budget
    `;

    const result = await summarizeWithFallback(jd, 'Senior Backend Engineer');

    expect(result).not.toBeNull();
    expect(result!.summary.length).toBeGreaterThan(0);
    expect(result!.roleFunction).toBe('backend');
    // An 8B model on real prose won't be perfectly reliable, so assert on
    // structure/grounding rather than exact array contents.
    expect(result!.responsibilities.length).toBeGreaterThan(0);
    expect(result!.yearsExperienceMin).toBe(5);
  }, 60_000);
});
