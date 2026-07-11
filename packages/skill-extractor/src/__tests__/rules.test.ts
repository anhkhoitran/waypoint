import { describe, expect, it } from 'vitest';
import { extractSalary, extractSeniority, extractSkills } from '../rules.js';

describe('extractSkills', () => {
  it('extracts skills from a simple mention', () => {
    const result = extractSkills('experience with React.js and Node');
    const names = result.map((r) => r.skill);
    expect(names).toContain('react');
    expect(names).toContain('node');
  });

  it('extracts an aliased skill and its canonical form together', () => {
    const result = extractSkills('k8s on AWS (EKS)');
    const names = result.map((r) => r.skill);
    expect(names).toContain('kubernetes');
    expect(names).toContain('aws');
  });

  it('does NOT match "java" inside "javascript"', () => {
    const result = extractSkills('We use JavaScript extensively');
    const names = result.map((r) => r.skill);
    expect(names).toContain('javascript');
    expect(names).not.toContain('java');
  });

  it('does NOT match "go" inside unrelated words like "good" or "mongo"', () => {
    const result = extractSkills('We have a good team using MongoDB');
    const names = result.map((r) => r.skill);
    expect(names).not.toContain('go');
    expect(names).toContain('mongodb');
  });

  it('gives a canonical-name hit confidence 1.0', () => {
    const result = extractSkills('We use React daily.');
    const react = result.find((r) => r.skill === 'react');
    expect(react?.confidence).toBe(1.0);
  });

  it('gives an alias-only hit confidence 0.9', () => {
    const result = extractSkills('Experience with k8s required.');
    const k8s = result.find((r) => r.skill === 'kubernetes');
    expect(k8s?.confidence).toBe(0.9);
  });

  it('caps confidence at 1.0 once a skill is mentioned 3+ times', () => {
    const result = extractSkills('k8s, k8s, and more k8s experience needed.');
    const k8s = result.find((r) => r.skill === 'kubernetes');
    expect(k8s?.confidence).toBe(1.0);
  });

  it('captures the first matching line as evidence, trimmed to 120 chars', () => {
    const text = 'Some intro line.\nYou will work with React and TypeScript daily.\nMore text.';
    const result = extractSkills(text);
    const react = result.find((r) => r.skill === 'react');
    expect(react?.evidence).toBe('You will work with React and TypeScript daily.');
  });

  it('handles special-character skill names like c++, c#, and .net', () => {
    const result = extractSkills('Looking for a C++ developer with C# and .NET experience');
    const names = result.map((r) => r.skill);
    expect(names).toContain('c++');
    expect(names).toContain('c#');
    expect(names).toContain('dotnet');
  });

  it('returns an empty array for text with no known skills', () => {
    expect(extractSkills('We like long walks on the beach.')).toEqual([]);
  });
});

describe('extractSeniority', () => {
  it('reads seniority from the title first', () => {
    expect(extractSeniority('Senior Backend Engineer', '')).toBe('senior');
    expect(extractSeniority('Junior Developer', '')).toBe('junior');
    expect(extractSeniority('Engineering Intern', '')).toBe('intern');
    expect(extractSeniority('Staff Software Engineer', '')).toBe('lead');
  });

  it('falls back to the body text when the title has no signal', () => {
    const text = 'We are looking for a senior candidate to join our team.';
    expect(extractSeniority('Software Engineer', text)).toBe('senior');
  });

  it('returns unknown when neither title nor text has a signal', () => {
    expect(extractSeniority('Software Engineer', 'Join our team and build great things.')).toBe(
      'unknown',
    );
  });
});

describe('extractSalary', () => {
  it('parses a VND range ("25 - 40 triệu")', () => {
    expect(extractSalary('Salary: 25 - 40 triệu, negotiable')).toBe('25–40 triệu VND');
  });

  it('parses a USD k-range ("$60k–$85k")', () => {
    expect(extractSalary('Compensation: $60k–$85k depending on experience')).toBe(
      '$60k – $85k',
    );
  });

  it('parses a USD monthly figure ("$1,800/month")', () => {
    expect(extractSalary('Pay is $1,800/month')).toBe('$1,800/month');
  });

  it('parses a full USD annual range ("$60,000 - $85,000")', () => {
    expect(extractSalary('Base salary $60,000 - $85,000 per year')).toBe('$60,000 – $85,000');
  });

  it('returns undefined when no salary is mentioned', () => {
    expect(extractSalary('We offer great benefits and a flexible schedule.')).toBeUndefined();
  });
});
