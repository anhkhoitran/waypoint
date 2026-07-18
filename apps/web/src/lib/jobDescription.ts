export interface DescriptionSections {
  intro: string | null;
  sections: Array<{ heading: string; items: string[] }>;
}

// Anchored to the whole line (not a substring match) so an ordinary sentence
// that happens to mention "requirements" never gets mistaken for a heading —
// a heading line is (almost) nothing but the phrase itself.
const HEADING_PATTERN =
  /^(key |your |the )?(responsibilities|requirements(?:\s*(?:and|&)\s*qualifications)?|qualifications|nice to have|preferred(?:\s*qualifications)?|benefits|perks|what you'll do|what you'll bring|what we're looking for)\s*:?$/i;

function cleanItem(line: string): string {
  return line
    .replace(/^[-•*–]\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .trim();
}

/**
 * Conservative heuristic: only recognizes a section when its heading line is
 * (almost) exactly one of a fixed set of job-posting heading phrases. Real
 * crawled descriptions vary wildly, so this deliberately favors returning
 * null (falling back to a single description block) over guessing wrong.
 * Requires at least 2 non-empty sections before it commits to structure.
 */
export function splitDescriptionSections(text: string): DescriptionSections | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim());

  const blocks: Array<{ heading: string; lines: string[] }> = [];
  const introLines: string[] = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (!line) continue;
    if (line.length <= 60 && HEADING_PATTERN.test(line)) {
      current = { heading: line.replace(/:$/, ''), lines: [] };
      blocks.push(current);
      continue;
    }
    if (current) {
      current.lines.push(line);
    } else {
      introLines.push(line);
    }
  }

  const sections = blocks
    .map((block) => ({ heading: block.heading, items: block.lines.map(cleanItem).filter(Boolean) }))
    .filter((section) => section.items.length > 0);

  if (sections.length < 2) return null;

  return { intro: introLines.length > 0 ? introLines.join(' ') : null, sections };
}
