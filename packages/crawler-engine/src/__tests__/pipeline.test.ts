import type { CrawlRunSummary, NormalizedJob, RawJob } from '@waypoint/shared';
import { describe, expect, it } from 'vitest';
import type { DiscoveredJob, SourceAdapter } from '../adapter.js';
import { CrawlPipeline, stripHtml, type JobStore } from '../pipeline.js';

class InMemoryJobStore implements JobStore {
  saved: NormalizedJob[] = [];
  runs: CrawlRunSummary[] = [];
  private existing = new Set<string>();

  seedExisting(keys: string[]) {
    for (const k of keys) this.existing.add(k);
  }

  async existingKeys(keys: string[]): Promise<Set<string>> {
    return new Set(keys.filter((k) => this.existing.has(k)));
  }

  async saveJobs(jobs: NormalizedJob[]): Promise<void> {
    this.saved.push(...jobs);
  }

  async saveRun(summary: CrawlRunSummary): Promise<void> {
    this.runs.push(summary);
  }
}

function makeRaw(externalId: string, overrides: Partial<RawJob> = {}): RawJob {
  return {
    source: 'remoteok',
    externalId,
    url: `https://example.com/${externalId}`,
    title: `Engineer ${externalId}`,
    company: 'Acme',
    location: 'Remote',
    tags: [],
    fetchedAt: new Date(),
    ...overrides,
  };
}

describe('CrawlPipeline', () => {
  it('saves new jobs and records a success run', async () => {
    const store = new InMemoryJobStore();
    const pipeline = new CrawlPipeline(store);
    const discovered: DiscoveredJob[] = [
      { externalId: '1', url: 'https://example.com/1', raw: makeRaw('1') },
      { externalId: '2', url: 'https://example.com/2', raw: makeRaw('2') },
    ];
    const adapter: SourceAdapter = {
      source: 'remoteok',
      displayName: 'RemoteOK',
      discover: async () => discovered,
      extract: async () => {
        throw new Error('should not be called when raw is attached');
      },
    };

    const result = await pipeline.run(adapter);

    expect(result.summary.status).toBe('success');
    expect(result.summary.jobsFound).toBe(2);
    expect(result.summary.jobsNew).toBe(2);
    expect(result.summary.jobsDuplicate).toBe(0);
    expect(store.saved).toHaveLength(2);
    expect(store.runs).toHaveLength(1);
  });

  it('filters out jobs whose dedup key already exists in the store', async () => {
    const store = new InMemoryJobStore();
    const raw = makeRaw('1', { company: 'Acme', title: 'Engineer' });
    // Pre-seed the store with the dedup key this job will produce.
    const pipeline = new CrawlPipeline(store);
    const discovered: DiscoveredJob[] = [{ externalId: '1', url: raw.url, raw }];
    const adapter: SourceAdapter = {
      source: 'remoteok',
      displayName: 'RemoteOK',
      discover: async () => discovered,
      extract: async () => raw,
    };

    // First run establishes the key.
    const first = await pipeline.run(adapter);
    expect(first.summary.jobsNew).toBe(1);
    store.seedExisting(store.saved.map((j) => j.dedupKey));

    // Second run with the same job should be filtered as a duplicate.
    const second = await pipeline.run(adapter);
    expect(second.summary.jobsNew).toBe(0);
    expect(second.summary.jobsDuplicate).toBe(1);
    expect(store.saved).toHaveLength(1); // unchanged from the first run
  });

  it('filters duplicate dedup keys found within the same run', async () => {
    const store = new InMemoryJobStore();
    const pipeline = new CrawlPipeline(store);
    const rawA = makeRaw('a', { company: 'Acme', title: 'Engineer', location: 'Remote' });
    const rawB = makeRaw('b', { company: 'Acme', title: 'Engineer', location: 'Remote' });
    const discovered: DiscoveredJob[] = [
      { externalId: 'a', url: rawA.url, raw: rawA },
      { externalId: 'b', url: rawB.url, raw: rawB },
    ];
    const adapter: SourceAdapter = {
      source: 'remoteok',
      displayName: 'RemoteOK',
      discover: async () => discovered,
      extract: async () => rawA,
    };

    const result = await pipeline.run(adapter);
    expect(result.summary.jobsNew).toBe(1);
    expect(result.summary.jobsDuplicate).toBe(1);
  });

  it('degrades to a partial run when extract() throws for some jobs, keeping the rest', async () => {
    const store = new InMemoryJobStore();
    const pipeline = new CrawlPipeline(store);
    const discovered: DiscoveredJob[] = [
      { externalId: 'ok', url: 'https://example.com/ok' },
      { externalId: 'bad', url: 'https://example.com/bad' },
    ];
    const adapter: SourceAdapter = {
      source: 'remoteok',
      displayName: 'RemoteOK',
      discover: async () => discovered,
      extract: async (_ctx, job) => {
        if (job.externalId === 'bad') throw new Error('boom');
        return makeRaw(job.externalId);
      },
    };

    const result = await pipeline.run(adapter);
    expect(result.summary.status).toBe('partial');
    expect(result.summary.jobsNew).toBe(1);
    expect(result.summary.errors).toHaveLength(1);
    expect(result.summary.errors[0]).toContain('bad');
  });

  it('marks the run failed when discover() throws, and still persists the run summary', async () => {
    const store = new InMemoryJobStore();
    const pipeline = new CrawlPipeline(store);
    const adapter: SourceAdapter = {
      source: 'remoteok',
      displayName: 'RemoteOK',
      discover: async () => {
        throw new Error('network down');
      },
      extract: async () => {
        throw new Error('unreachable');
      },
    };

    const result = await pipeline.run(adapter);
    expect(result.summary.status).toBe('failed');
    expect(result.summary.jobsFound).toBe(0);
    expect(result.summary.errors[0]).toContain('network down');
    expect(store.runs).toHaveLength(1);
  });

  it('decodes HTML entities in descriptionText, not just literal tags', async () => {
    const store = new InMemoryJobStore();
    const pipeline = new CrawlPipeline(store);
    const discovered: DiscoveredJob[] = [
      {
        externalId: '1',
        url: 'https://example.com/1',
        raw: makeRaw('1', {
          descriptionHtml: '<p>Node.js &amp; TypeScript.&nbsp;Apply w/ &quot;résumé&quot;.</p>',
        }),
      },
    ];
    const adapter: SourceAdapter = {
      source: 'remoteok',
      displayName: 'RemoteOK',
      discover: async () => discovered,
      extract: async () => {
        throw new Error('should not be called when raw is attached');
      },
    };

    const result = await pipeline.run(adapter);
    expect(result.newJobs[0]!.descriptionText).toBe('Node.js & TypeScript. Apply w/ "résumé".');
  });
});

describe('stripHtml', () => {
  it('strips tags and decodes common entities', () => {
    expect(stripHtml('<div>a &amp; b</div>')).toBe('a & b');
    expect(stripHtml('one&nbsp;two')).toBe('one two');
    expect(stripHtml('&lt;script&gt;')).toBe('<script>');
    expect(stripHtml("it&#39;s")).toBe("it's");
  });

  it('collapses whitespace left over after tag stripping', () => {
    expect(stripHtml('<p>a</p>\n\n<p>b</p>')).toBe('a b');
  });

  it('decodes numeric character references, hex and decimal', () => {
    expect(stripHtml('C&#x2F;C++')).toBe('C/C++');
    expect(stripHtml('caf&#233;')).toBe('café');
  });
});
