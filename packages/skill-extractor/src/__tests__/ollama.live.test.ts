import { describe, expect, it } from 'vitest';
import { extractWithFallback, isOllamaUp } from '../ollama.js';

// Hits a real local Ollama instance. Skipped unless LIVE=1 is set, so
// normal test runs (and CI) never depend on Ollama being installed/running.
// Run manually with: LIVE=1 pnpm --filter @waypoint/skill-extractor test -- ollama.live
describe.runIf(process.env.LIVE === '1')('extractWithFallback (live Ollama)', () => {
  it('is reachable', async () => {
    expect(await isOllamaUp()).toBe(true);
  });

  it('extracts real skills from a realistic job description', async () => {
    const jd = `
      We are hiring a Senior Backend Engineer to join our platform team.
      You'll work with Node.js, NestJS, and PostgreSQL to build our core API,
      deploy on AWS using Docker and Kubernetes, and collaborate with the
      frontend team building in React and TypeScript.
      Compensation: $70,000 - $95,000 depending on experience.
    `;

    const result = await extractWithFallback(jd, 'Senior Backend Engineer');

    expect(result.extractor).toBe('ollama');
    const skillNames = result.skills.map((s) => s.skill);
    // A 3B model won't be perfectly reliable, so assert on a reasonable
    // subset rather than every skill mentioned.
    expect(skillNames.length).toBeGreaterThan(0);
    expect(result.seniority).not.toBe('unknown');
  }, 30_000);
});
