import { RawJob } from '@waypoint/shared';
import type { AdapterContext, DiscoveredJob, SourceAdapter } from '../adapter.js';

const SEARCH_URL =
  'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=hiring';
const itemUrl = (id: number | string) => `https://hn.algolia.com/api/v1/items/${id}`;
export const commentUrl = (id: number | string) => `https://news.ycombinator.com/item?id=${id}`;

/** Cap per run so a single crawl can't balloon into hundreds of extract calls. */
export const HN_MAX_COMMENTS = 150;

interface SearchHit {
  objectID: string;
  title: string;
  created_at: string;
}

interface HnComment {
  id: number;
  created_at: string;
  text: string | null;
}

interface HnThread {
  id: number;
  children: HnComment[];
}

/**
 * Pick the newest "Ask HN: Who is hiring?" thread from search results. The
 * query also matches near-duplicates like "Who wants to be hired?", so we
 * filter on title rather than trusting hit order alone.
 */
export function findLatestThreadId(hits: SearchHit[]): string | undefined {
  const candidates = hits
    .filter((h) => h.title.startsWith('Ask HN: Who is hiring?'))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return candidates[0]?.objectID;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#x27': "'",
  '#39': "'",
  '#x2F': '/',
  '#x2013': '–',
  '#x2014': '—',
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&([a-zA-Z0-9#]+);/g, (match, code) => ENTITIES[code] ?? match);
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
}

/**
 * HN hiring-thread convention (crowd-sourced, so inconsistent in practice):
 * "Company | Role | Location | …" on the first line. When a comment doesn't
 * follow the convention (no pipes at all — free-text or em-dash separated),
 * fall back to a truncated plain-text title with no inferred company.
 */
export function parseComment(text: string): { company?: string; title: string } {
  const firstLine = decodeEntities(text.split(/<p>/i)[0] ?? '').trim();
  const parts = firstLine
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return { company: parts[0], title: parts[1]! };
  }

  const plain = stripHtml(text);
  return { title: plain.slice(0, 80) || 'Untitled listing' };
}

function toRawJob(comment: HnComment, fetchedAt: Date): RawJob | undefined {
  if (!comment.text) return undefined; // dead/deleted comment
  const { company, title } = parseComment(comment.text);
  const postedAt = comment.created_at ? new Date(comment.created_at) : undefined;

  const candidate = {
    source: 'hn_whos_hiring' as const,
    externalId: String(comment.id),
    url: commentUrl(comment.id),
    title,
    company,
    descriptionHtml: comment.text,
    tags: [],
    postedAt,
    fetchedAt,
  };

  const result = RawJob.safeParse(candidate);
  return result.success ? result.data : undefined;
}

export const hnWhosHiringAdapter: SourceAdapter = {
  source: 'hn_whos_hiring',
  displayName: 'HN Who’s Hiring',

  async discover(ctx: AdapterContext): Promise<DiscoveredJob[]> {
    const search = await ctx.fetchJson<{ hits: SearchHit[] }>(SEARCH_URL);
    const threadId = findLatestThreadId(search.hits);
    if (!threadId) {
      throw new Error('no "Who is hiring?" thread found in HN search results');
    }

    const thread = await ctx.fetchJson<HnThread>(itemUrl(threadId));
    const fetchedAt = new Date();
    const comments = thread.children.slice(0, HN_MAX_COMMENTS);

    const discovered: DiscoveredJob[] = [];
    for (const comment of comments) {
      const raw = toRawJob(comment, fetchedAt);
      if (raw) {
        discovered.push({ externalId: raw.externalId, url: raw.url, raw });
      } else {
        ctx.log(`skipped comment ${comment.id}: dead/deleted or failed validation`);
      }
    }
    return discovered;
  },

  async extract(): Promise<RawJob> {
    throw new Error(
      'hn_whos_hiring adapter attaches raw jobs at discover() time — extract() should not be called',
    );
  },
};
