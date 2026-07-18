import { describe, expect, it } from 'vitest';
import { classifyRelevance } from '../relevance.js';

describe('classifyRelevance', () => {
  it('accepts clearly technical titles regardless of body text', () => {
    expect(classifyRelevance('Senior Backend Engineer', 'We build things.')).toBe(true);
    expect(classifyRelevance('Full-Stack Developer', '')).toBe(true);
    expect(classifyRelevance('DevOps / SRE', '')).toBe(true);
    expect(classifyRelevance('QA Automation Tester', '')).toBe(true);
    expect(classifyRelevance('Machine Learning Engineer', '')).toBe(true);
    expect(classifyRelevance('Embedded Firmware Engineer', '')).toBe(true);
    expect(classifyRelevance('Engineering Manager, Web', '')).toBe(true);
  });

  it('accepts a non-obvious title when the body is skill-dense', () => {
    const jd =
      'You will work with React, TypeScript, Node.js, PostgreSQL and Docker to ship our platform.';
    expect(classifyRelevance('Platform Specialist', jd)).toBe(true);
  });

  it('rejects clearly non-technical roles with no meaningful skill density', () => {
    expect(
      classifyRelevance(
        'Virtual Executive Assistant',
        'Provide high-level administrative support to executives: calendar management, travel booking, email triage, and meeting scheduling.',
      ),
    ).toBe(false);
    expect(
      classifyRelevance(
        'Social Content Lead',
        'Own our Instagram and TikTok presence, grow the community, and build a cult brand voice.',
      ),
    ).toBe(false);
    expect(
      classifyRelevance(
        'Health Navigator I',
        'Provide phone, email, and chat-based customer service to members regarding their benefits.',
      ),
    ).toBe(false);
  });

  it('does not treat an incidental single tech-brand mention as relevant', () => {
    // A marketing role that name-drops one cloud provider should still be filtered.
    expect(
      classifyRelevance(
        'Brand Marketing Manager',
        'Lead brand campaigns for our client, a company hosted on AWS. Own messaging and creative direction.',
      ),
    ).toBe(false);
  });

  it('admits a skill-dense role even if the title is marketing-ish (inclusive lean)', () => {
    // Threshold met via genuine multi-skill density — kept on purpose rather
    // than risk hiding a real technical role behind an odd title.
    const jd = 'Hands-on with AWS, Azure, GCP, Terraform, Kubernetes and Docker across our infra.';
    expect(classifyRelevance('Cloud Strategist', jd)).toBe(true);
  });

  it('uses tags as an additional skill signal', () => {
    expect(classifyRelevance('Specialist', 'Generic description.', ['react', 'node', 'postgresql'])).toBe(
      true,
    );
  });

  it('keeps a role that names a language in its title (strong low-noise signal)', () => {
    expect(classifyRelevance('Analyst & Optimization Specialist (Python/C++)', 'Generic body.')).toBe(true);
  });

  it('keeps security/infosec roles whose skills are not in the dev taxonomy', () => {
    expect(classifyRelevance('Security Specialist (EDR, IAM, Networking)', 'Protect the fleet.')).toBe(true);
    expect(classifyRelevance('Cybersecurity Analyst', '')).toBe(true);
  });
});
