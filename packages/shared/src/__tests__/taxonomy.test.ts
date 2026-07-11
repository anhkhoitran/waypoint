import { describe, expect, it } from 'vitest';
import { ALIAS_TO_SKILL, getSkillCategory, isKnownSkill, SKILL_TAXONOMY } from '../taxonomy.js';

const VALID_CATEGORIES = new Set([
  'language',
  'frontend',
  'backend',
  'database',
  'cloud',
  'devops',
  'practice',
]);

describe('SKILL_TAXONOMY invariants', () => {
  it('has a reasonable size (~120 skills)', () => {
    expect(SKILL_TAXONOMY.length).toBeGreaterThanOrEqual(100);
  });

  it('has unique canonical names', () => {
    const names = SKILL_TAXONOMY.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('only uses the seven allowed categories', () => {
    for (const skill of SKILL_TAXONOMY) {
      expect(VALID_CATEGORIES.has(skill.category)).toBe(true);
    }
  });

  it('never has an alias that collides with a different skill\'s canonical name', () => {
    const canonicalNames = new Set(SKILL_TAXONOMY.map((s) => s.name));
    for (const skill of SKILL_TAXONOMY) {
      for (const alias of skill.aliases) {
        if (canonicalNames.has(alias)) {
          expect(alias).toBe(skill.name);
        }
      }
    }
  });

  it('never has the same alias claimed by two different skills', () => {
    const aliasOwner = new Map<string, string>();
    for (const skill of SKILL_TAXONOMY) {
      for (const alias of skill.aliases) {
        const owner = aliasOwner.get(alias);
        if (owner) {
          expect(owner).toBe(skill.name);
        } else {
          aliasOwner.set(alias, skill.name);
        }
      }
    }
  });

  it('has no duplicate aliases within the same skill', () => {
    for (const skill of SKILL_TAXONOMY) {
      expect(new Set(skill.aliases).size).toBe(skill.aliases.length);
    }
  });
});

describe('ALIAS_TO_SKILL', () => {
  it('maps every canonical name to itself', () => {
    for (const skill of SKILL_TAXONOMY) {
      expect(ALIAS_TO_SKILL.get(skill.name)).toBe(skill.name);
    }
  });

  it('maps known aliases to their canonical skill', () => {
    expect(ALIAS_TO_SKILL.get('k8s')).toBe('kubernetes');
    expect(ALIAS_TO_SKILL.get('postgres')).toBe('postgresql');
    expect(ALIAS_TO_SKILL.get('reactjs')).toBe('react');
    expect(ALIAS_TO_SKILL.get('golang')).toBe('go');
  });
});

describe('isKnownSkill / getSkillCategory', () => {
  it('recognizes a canonical skill and its category', () => {
    expect(isKnownSkill('react')).toBe(true);
    expect(getSkillCategory('react')).toBe('frontend');
  });

  it('does not recognize an alias as a canonical skill', () => {
    expect(isKnownSkill('k8s')).toBe(false);
  });

  it('returns false/undefined for unknown skills', () => {
    expect(isKnownSkill('cobol')).toBe(false);
    expect(getSkillCategory('cobol')).toBeUndefined();
  });
});
