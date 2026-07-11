import { describe, expect, it } from 'vitest';
import { matchScore, type MatchProfile } from '../match.js';

const baseProfile: MatchProfile = {
  skills: ['react', 'node'],
  targetSeniority: 'mid',
  targetWorkModes: ['remote', 'hybrid'],
};

describe('matchScore', () => {
  it('returns null when the job has zero extracted skills', () => {
    expect(matchScore(baseProfile, [], 'mid', 'remote')).toBeNull();
  });

  it('scores 100 for a perfect match: full coverage, exact seniority, targeted work mode', () => {
    const result = matchScore(
      baseProfile,
      [
        { skill: 'react', confidence: 1.0 },
        { skill: 'node', confidence: 1.0 },
      ],
      'mid',
      'remote',
    );
    // coverage 1.0*0.7 + seniority 1.0*0.2 + workMode 1.0*0.1 = 1.0 -> 100
    expect(result).toEqual({ score: 100, matched: ['react', 'node'], missing: [] });
  });

  it('scores partial coverage correctly, weighted by confidence', () => {
    const result = matchScore(
      baseProfile,
      [
        { skill: 'react', confidence: 1.0 },
        { skill: 'kubernetes', confidence: 1.0 },
      ],
      'mid',
      'remote',
    );
    // coverage 0.5*0.7 + seniority 1.0*0.2 + workMode 1.0*0.1 = 0.35+0.2+0.1 = 0.65 -> 65
    expect(result?.score).toBe(65);
    expect(result?.matched).toEqual(['react']);
    expect(result?.missing).toEqual(['kubernetes']);
  });

  it('weights coverage by confidence, not by raw skill count', () => {
    const result = matchScore(
      baseProfile,
      [
        { skill: 'react', confidence: 1.0 },
        { skill: 'aws', confidence: 0.5 },
      ],
      'mid',
      'remote',
    );
    // coverage = 1.0 / 1.5 = 0.6667; score = 0.6667*0.7 + 1.0*0.2 + 1.0*0.1 = 0.7667 -> 77
    expect(result?.score).toBe(77);
  });

  it('gives 0.6 seniority credit for one rung of difference (mid target, senior job)', () => {
    const result = matchScore(
      baseProfile,
      [{ skill: 'react', confidence: 1.0 }],
      'senior',
      'remote',
    );
    // coverage 1.0*0.7 + seniority 0.6*0.2 + workMode 1.0*0.1 = 0.7+0.12+0.1 = 0.92 -> 92
    expect(result?.score).toBe(92);
  });

  it('gives 0.2 seniority credit for a far seniority gap (junior target, lead job)', () => {
    const juniorProfile: MatchProfile = { ...baseProfile, targetSeniority: 'junior' };
    const result = matchScore(juniorProfile, [{ skill: 'react', confidence: 1.0 }], 'lead', 'remote');
    // coverage 0.7 + seniority 0.2*0.2=0.04 + workMode 0.1 = 0.84 -> 84
    expect(result?.score).toBe(84);
  });

  it('gives 0.2 seniority credit when either side is unknown', () => {
    const result = matchScore(baseProfile, [{ skill: 'react', confidence: 1.0 }], 'unknown', 'remote');
    expect(result?.score).toBe(84); // same as the far-gap case: 0.7+0.04+0.1
  });

  it('gives 0.3 work-mode credit for a targeted-mode mismatch', () => {
    const result = matchScore(baseProfile, [{ skill: 'react', confidence: 1.0 }], 'mid', 'onsite');
    // coverage 0.7 + seniority 0.2 + workMode 0.3*0.1=0.03 = 0.93 -> 93
    expect(result?.score).toBe(93);
  });

  it('gives 0.7 (neutral) work-mode credit when the job work mode is unknown', () => {
    const result = matchScore(baseProfile, [{ skill: 'react', confidence: 1.0 }], 'mid', 'unknown');
    // coverage 0.7 + seniority 0.2 + workMode 0.7*0.1=0.07 = 0.97 -> 97
    expect(result?.score).toBe(97);
  });

  it('scores 0 coverage when none of the job skills are in the profile', () => {
    const result = matchScore(
      baseProfile,
      [{ skill: 'kubernetes', confidence: 1.0 }],
      'mid',
      'remote',
    );
    // coverage 0 + seniority 0.2 + workMode 0.1 = 0.3 -> 30
    expect(result?.score).toBe(30);
    expect(result?.matched).toEqual([]);
    expect(result?.missing).toEqual(['kubernetes']);
  });
});
