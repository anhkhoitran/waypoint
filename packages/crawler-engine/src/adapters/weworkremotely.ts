import { XMLParser } from 'fast-xml-parser';
import { RawJob } from '@waypoint/shared';
import type { AdapterContext, DiscoveredJob, SourceAdapter } from '../adapter.js';

export const WWR_FEED_URLS = [
  'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss',
];

interface WwrItem {
  title?: unknown;
  region?: unknown;
  description?: unknown;
  pubDate?: unknown;
  guid?: unknown;
  link?: unknown;
}

const parser = new XMLParser({ ignoreAttributes: true });

/** WWR item titles are "Company: Job Title" — split on the first ": ". */
function splitCompanyTitle(raw: string): { company?: string; title: string } {
  const idx = raw.indexOf(': ');
  if (idx === -1) return { title: raw.trim() };
  return {
    company: raw.slice(0, idx).trim(),
    title: raw.slice(idx + 2).trim(),
  };
}

/**
 * Pure parsing function — takes raw RSS XML, returns valid jobs plus a
 * description of anything skipped. Each item is validated independently so
 * one malformed entry never aborts the rest of the feed.
 */
export function parseFeedXml(xml: string, fetchedAt: Date): { jobs: RawJob[]; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch (err) {
    return { jobs: [], errors: [`xml parse failed: ${(err as Error).message}`] };
  }

  const channel = (parsed as { rss?: { channel?: { item?: unknown } } })?.rss?.channel;
  const rawItems = channel?.item;
  const items: WwrItem[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems as WwrItem] : [];

  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const item of items) {
    const titleRaw = String(item.title ?? '');
    const { company, title } = splitCompanyTitle(titleRaw);
    const pubDate = item.pubDate ? String(item.pubDate) : '';
    const postedAt = pubDate && !Number.isNaN(Date.parse(pubDate)) ? new Date(pubDate) : undefined;

    const candidate = {
      source: 'weworkremotely' as const,
      externalId: String(item.guid ?? ''),
      url: String(item.link ?? ''),
      title,
      company,
      location: item.region ? String(item.region) : undefined,
      descriptionHtml: item.description ? String(item.description) : undefined,
      tags: [],
      postedAt,
      fetchedAt,
    };

    const result = RawJob.safeParse(candidate);
    if (result.success) {
      jobs.push(result.data);
    } else {
      const reason = result.error.issues[0]?.message ?? 'validation failed';
      errors.push(`skipped malformed item "${titleRaw || '(no title)'}": ${reason}`);
    }
  }

  return { jobs, errors };
}

export const weWorkRemotelyAdapter: SourceAdapter = {
  source: 'weworkremotely',
  displayName: 'WeWorkRemotely',

  async discover(ctx: AdapterContext): Promise<DiscoveredJob[]> {
    const fetchedAt = new Date();
    const discovered: DiscoveredJob[] = [];

    for (const feedUrl of WWR_FEED_URLS) {
      const xml = await ctx.fetchText(feedUrl);
      const { jobs, errors } = parseFeedXml(xml, fetchedAt);
      for (const err of errors) ctx.log(err);
      for (const job of jobs) {
        discovered.push({ externalId: job.externalId, url: job.url, raw: job });
      }
    }

    // A job can appear in both feeds (e.g. tagged both full-stack and backend).
    const seen = new Set<string>();
    return discovered.filter((d) => {
      if (seen.has(d.externalId)) return false;
      seen.add(d.externalId);
      return true;
    });
  },

  async extract(): Promise<RawJob> {
    throw new Error(
      'weworkremotely adapter attaches raw jobs at discover() time — extract() should not be called',
    );
  },
};
