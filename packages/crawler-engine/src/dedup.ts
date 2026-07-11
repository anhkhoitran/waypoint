import { createHash } from 'node:crypto';

/**
 * Cross-source dedup key: same role at the same company in the same place
 * should collapse even when found on two boards. Normalization strips
 * punctuation, casing, and common title noise ("(remote)", "- urgent", etc.).
 */
export function makeDedupKey(company: string, title: string, location: string | null): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\(.*?\)|\[.*?\]/g, ' ')
      .replace(/[^a-z0-9À-ỹ\s]/g, ' ') // keep Vietnamese diacritics
      .replace(/\s+/g, ' ')
      .trim();

  const material = [normalize(company), normalize(title), normalize(location ?? '')].join('|');
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}
