import { describe, expect, it } from 'vitest';
import { validateSummary } from '../validate.js';

const SOURCE = `
  We are hiring a Senior Backend Engineer to join our platform team. You'll
  design and ship APIs, mentor junior engineers, and own our on-call rotation.
  Requires 5+ years of backend experience with Node.js and PostgreSQL.
  Nice to have: Kubernetes experience. We offer health insurance and a
  generous PTO policy.
`;

function validResponse(overrides: Record<string, unknown> = {}) {
  return {
    summary: 'A senior backend role owning APIs and mentoring on a platform team.',
    responsibilities: ['Design and ship APIs', 'Mentor junior engineers', 'Own on-call rotation'],
    requirements: ['5+ years backend experience', 'Node.js', 'PostgreSQL'],
    niceToHave: ['Kubernetes'],
    benefits: ['Health insurance', 'Generous PTO'],
    roleFunction: 'backend',
    yearsExperienceMin: 5,
    ...overrides,
  };
}

describe('validateSummary', () => {
  it('passes through a well-formed, grounded response', () => {
    const result = validateSummary(validResponse(), SOURCE);
    expect(result).not.toBeNull();
    expect(result!.roleFunction).toBe('backend');
    expect(result!.yearsExperienceMin).toBe(5);
    expect(result!.responsibilities).toHaveLength(3);
  });

  it('returns null when required fields are missing', () => {
    expect(validateSummary({ summary: 'x' }, SOURCE)).toBeNull(); // missing roleFunction
    expect(validateSummary({ roleFunction: 'backend' }, SOURCE)).toBeNull(); // missing summary
    expect(validateSummary(null, SOURCE)).toBeNull();
    expect(validateSummary('not an object', SOURCE)).toBeNull();
  });

  it('defaults missing array fields to empty arrays rather than rejecting', () => {
    const result = validateSummary({ summary: 'A minimal role summary.', roleFunction: 'backend' }, SOURCE);
    expect(result).not.toBeNull();
    expect(result!.responsibilities).toEqual([]);
  });

  it('returns null for an empty summary', () => {
    const result = validateSummary(validResponse({ summary: '   ' }), SOURCE);
    expect(result).toBeNull();
  });

  it('rejects a summary that just echoes the start of the source text', () => {
    const echoed = SOURCE.trim().slice(0, 80);
    const result = validateSummary(validResponse({ summary: echoed }), SOURCE);
    expect(result).toBeNull();
  });

  it('accepts a real summary even when it opens the same way the posting naturally does', () => {
    // Regression: job postings routinely open with "We are hiring a X to
    // join our Y team" — a genuine, synthesized summary sharing that
    // opening phrase is not an echo, and must not be rejected just because
    // its first ~30 characters overlap with the source's first ~30.
    const realSummary =
      "We are hiring a Senior Backend Engineer to join our platform team. " +
      'This role involves designing and shipping APIs while also owning the ' +
      'on-call rotation and mentoring junior engineers.';
    const result = validateSummary(validResponse({ summary: realSummary }), SOURCE);
    expect(result).not.toBeNull();
    expect(result!.summary).toBe(realSummary);
  });

  it('coerces an off-taxonomy roleFunction to "other" rather than dropping the whole result', () => {
    const result = validateSummary(validResponse({ roleFunction: 'astronaut' }), SOURCE);
    expect(result).not.toBeNull();
    expect(result!.roleFunction).toBe('other');
  });

  it('drops yearsExperienceMin when the number is not grounded in the source text', () => {
    const result = validateSummary(validResponse({ yearsExperienceMin: 12 }), SOURCE);
    expect(result!.yearsExperienceMin).toBeNull();
  });

  it('keeps yearsExperienceMin when it is grounded in the source text', () => {
    const result = validateSummary(validResponse({ yearsExperienceMin: 5 }), SOURCE);
    expect(result!.yearsExperienceMin).toBe(5);
  });

  it('drops out-of-range yearsExperienceMin without even checking the text', () => {
    const weirdSource = SOURCE + ' 99+ years of experience required.';
    const result = validateSummary(validResponse({ yearsExperienceMin: 99 }), weirdSource);
    expect(result!.yearsExperienceMin).toBeNull();
  });

  it('caps array length to 8 items', () => {
    const many = Array.from({ length: 20 }, (_, i) => `item ${i}`);
    const result = validateSummary(validResponse({ responsibilities: many }), SOURCE);
    expect(result!.responsibilities).toHaveLength(8);
  });

  it('caps each item to 240 characters', () => {
    const long = 'x'.repeat(500);
    const result = validateSummary(validResponse({ requirements: [long] }), SOURCE);
    expect(result!.requirements[0]).toHaveLength(240);
  });

  it('filters out empty items after trimming', () => {
    const result = validateSummary(validResponse({ benefits: ['  ', 'Health insurance', ''] }), SOURCE);
    expect(result!.benefits).toEqual(['Health insurance']);
  });

  it('truncates an oversized summary to 400 characters', () => {
    const long = 'A '.repeat(300);
    const result = validateSummary(validResponse({ summary: long }), SOURCE);
    expect(result!.summary.length).toBeLessThanOrEqual(400);
  });
});
