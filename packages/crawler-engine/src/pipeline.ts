import type { CrawlRunSummary, NormalizedJob, RawJob } from '@waypoint/shared';
import type { AdapterContext, BrowserContextProvider, SourceAdapter } from './adapter.js';
import { makeDedupKey } from './dedup.js';
import { RateLimiter } from './rate-limiter.js';

/** Persistence boundary — implemented by the API app (Prisma), in-memory in tests. */
export interface JobStore {
  /** Returns dedup keys among `keys` that already exist. */
  existingKeys(keys: string[]): Promise<Set<string>>;
  saveJobs(jobs: NormalizedJob[]): Promise<void>;
  saveRun(summary: CrawlRunSummary): Promise<void>;
}

export interface PipelineResult {
  summary: CrawlRunSummary;
  newJobs: NormalizedJob[];
}

/**
 * fetch → parse → normalize → dedup → persist, for one source per run.
 * Errors on individual jobs degrade the run to `partial` instead of failing it.
 */
export class CrawlPipeline {
  constructor(
    private readonly store: JobStore,
    private readonly limiter = new RateLimiter(),
    private readonly userAgent = 'WaypointBot/0.1 (personal job dashboard)',
    private readonly browser?: BrowserContextProvider,
  ) {}

  async run(adapter: SourceAdapter): Promise<PipelineResult> {
    const startedAt = new Date();
    const errors: string[] = [];
    const ctx = this.makeContext(adapter);

    let discovered: Awaited<ReturnType<SourceAdapter['discover']>> = [];
    try {
      discovered = await adapter.discover(ctx);
    } catch (err) {
      errors.push(`discover failed: ${(err as Error).message}`);
    }

    const raws: RawJob[] = [];
    for (const item of discovered) {
      try {
        raws.push(item.raw ?? (await adapter.extract(ctx, item)));
      } catch (err) {
        errors.push(`extract ${item.url}: ${(err as Error).message}`);
      }
    }

    const normalized = raws.map((raw) => this.normalize(raw));
    const existing = await this.store.existingKeys(normalized.map((j) => j.dedupKey));
    const seenInRun = new Set<string>();
    const newJobs = normalized.filter((job) => {
      if (existing.has(job.dedupKey) || seenInRun.has(job.dedupKey)) return false;
      seenInRun.add(job.dedupKey);
      return true;
    });

    await this.store.saveJobs(newJobs);

    const summary: CrawlRunSummary = {
      source: adapter.source,
      status: errors.length === 0 ? 'success' : newJobs.length > 0 ? 'partial' : 'failed',
      startedAt,
      finishedAt: new Date(),
      jobsFound: discovered.length,
      jobsNew: newJobs.length,
      jobsDuplicate: normalized.length - newJobs.length,
      errors,
    };
    await this.store.saveRun(summary);
    return { summary, newJobs };
  }

  private normalize(raw: RawJob): NormalizedJob {
    const company = raw.company?.trim() || 'Unknown company';
    const location = raw.location?.trim() || null;
    const descriptionText =
      raw.descriptionText?.trim() || stripHtml(raw.descriptionHtml ?? '') || '';
    return {
      source: raw.source,
      externalId: raw.externalId,
      url: raw.url,
      title: raw.title.trim(),
      company,
      location,
      workMode: guessWorkMode(raw),
      seniority: guessSeniority(raw.title),
      salaryText: raw.salaryText?.trim() || null,
      descriptionText,
      tags: raw.tags.map((t) => t.toLowerCase().trim()).filter(Boolean),
      postedAt: raw.postedAt ?? null,
      fetchedAt: raw.fetchedAt,
      dedupKey: makeDedupKey(company, raw.title, location),
    };
  }

  private makeContext(adapter: SourceAdapter): AdapterContext {
    const limiter = this.limiter;
    const userAgent = this.userAgent;
    const fetchText = async (url: string): Promise<string> => {
      await limiter.acquire(url);
      try {
        const res = await fetch(url, { headers: { 'user-agent': userAgent } });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return await res.text();
      } finally {
        limiter.release();
      }
    };
    return {
      fetchText,
      fetchJson: async <T>(url: string) => JSON.parse(await fetchText(url)) as T,
      log: (message) => console.log(`[${adapter.source}] ${message}`),
      browser: this.browser,
    };
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&');
}

export function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function guessWorkMode(raw: RawJob): NormalizedJob['workMode'] {
  const haystack = `${raw.title} ${raw.location ?? ''} ${raw.tags.join(' ')}`.toLowerCase();
  if (/remote/.test(haystack)) return 'remote';
  if (/hybrid/.test(haystack)) return 'hybrid';
  if (raw.location) return 'onsite';
  return 'unknown';
}

function guessSeniority(title: string): NormalizedJob['seniority'] {
  const t = title.toLowerCase();
  if (/intern/.test(t)) return 'intern';
  if (/junior|fresher|entry/.test(t)) return 'junior';
  if (/staff|principal|lead|architect|head/.test(t)) return 'lead';
  if (/senior|sr\.?\s/.test(t)) return 'senior';
  if (/mid|middle/.test(t)) return 'mid';
  return 'unknown';
}
