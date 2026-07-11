import { describe, expect, it } from 'vitest';
import { makeDedupKey } from '../dedup.js';

describe('makeDedupKey', () => {
  it('produces the same key for identical inputs', () => {
    const a = makeDedupKey('Acme Corp', 'Senior Engineer', 'Remote');
    const b = makeDedupKey('Acme Corp', 'Senior Engineer', 'Remote');
    expect(a).toBe(b);
  });

  it('ignores case, punctuation, and parenthetical noise', () => {
    const a = makeDedupKey('Acme Corp', 'Senior Engineer', 'Remote');
    const b = makeDedupKey('ACME CORP!', 'Senior Engineer (Remote)', 'Remote');
    expect(a).toBe(b);
  });

  it('produces a different key for a different company', () => {
    const a = makeDedupKey('Acme Corp', 'Senior Engineer', 'Remote');
    const b = makeDedupKey('Widgets Inc', 'Senior Engineer', 'Remote');
    expect(a).not.toBe(b);
  });

  it('produces a different key for a different title', () => {
    const a = makeDedupKey('Acme Corp', 'Senior Engineer', 'Remote');
    const b = makeDedupKey('Acme Corp', 'Junior Engineer', 'Remote');
    expect(a).not.toBe(b);
  });

  it('treats null location as empty string, distinct from a named location', () => {
    const withLocation = makeDedupKey('Acme Corp', 'Senior Engineer', 'Remote');
    const withoutLocation = makeDedupKey('Acme Corp', 'Senior Engineer', null);
    expect(withLocation).not.toBe(withoutLocation);
  });

  it('does NOT fold Vietnamese diacritics — "Ha Noi" and "Hà Nội" are distinct keys', () => {
    // Documented current behavior: normalization strips punctuation/case but keeps
    // diacritics, so ASCII-transliterated and native-script locations don't dedupe
    // against each other. This is a known limitation, not a bug.
    const diacritic = makeDedupKey('Acme Corp', 'Senior Engineer', 'Hà Nội');
    const ascii = makeDedupKey('Acme Corp', 'Senior Engineer', 'Ha Noi');
    expect(diacritic).not.toBe(ascii);
  });
});
