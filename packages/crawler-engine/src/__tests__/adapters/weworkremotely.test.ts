import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RawJob } from '@waypoint/shared';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../../adapter.js';
import { parseFeedXml, weWorkRemotelyAdapter, WWR_FEED_URLS } from '../../adapters/weworkremotely.js';

const fixturePath = fileURLToPath(new URL('../../__fixtures__/wwr.rss', import.meta.url));
const fixtureXml = readFileSync(fixturePath, 'utf8');
const fetchedAt = new Date('2026-07-11T00:00:00Z');

describe('parseFeedXml', () => {
  it('splits "Company: Job Title" into separate fields', () => {
    const { jobs } = parseFeedXml(fixtureXml, fetchedAt);
    const wonderdog = jobs.find((j) => j.company === 'Wonderdog');
    expect(wonderdog?.title).toBe('Full-Stack Product Engineer - Agentic First');
  });

  it('maps guid, link, description, pubDate, and region', () => {
    const { jobs } = parseFeedXml(fixtureXml, fetchedAt);
    const retr = jobs.find((j) => j.company === 'RETR');
    expect(retr).toMatchObject({
      externalId: 'https://weworkremotely.com/remote-jobs/retr-senior-software-engineer',
      url: 'https://weworkremotely.com/remote-jobs/retr-senior-software-engineer',
      location: 'Anywhere in the World',
    });
    expect(retr?.descriptionHtml).toContain('Rails and React');
    expect(retr?.postedAt).toBeInstanceOf(Date);
  });

  it('parses 3 well-formed jobs from the fixture', () => {
    const { jobs } = parseFeedXml(fixtureXml, fetchedAt);
    expect(jobs).toHaveLength(3);
  });

  it('skips the malformed item (no guid/link) and reports why, without aborting the rest', () => {
    const { jobs, errors } = parseFeedXml(fixtureXml, fetchedAt);
    expect(jobs.some((j) => j.title === 'Untitled Remote Opportunity')).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Untitled Remote Opportunity');
  });

  it('emits only Zod-valid RawJob objects', () => {
    const { jobs } = parseFeedXml(fixtureXml, fetchedAt);
    for (const job of jobs) {
      expect(() => RawJob.parse(job)).not.toThrow();
    }
  });
});

describe('weWorkRemotelyAdapter.discover', () => {
  it('fetches both category feeds and dedupes jobs appearing in both', async () => {
    const ctx: AdapterContext = {
      fetchText: vi.fn().mockResolvedValue(fixtureXml),
      fetchJson: vi.fn(),
      log: vi.fn(),
    };

    const discovered = await weWorkRemotelyAdapter.discover(ctx);

    expect(ctx.fetchText).toHaveBeenCalledTimes(2);
    for (const url of WWR_FEED_URLS) {
      expect(ctx.fetchText).toHaveBeenCalledWith(url);
    }
    // Same fixture returned for both feeds, so the 3 valid jobs should be
    // deduped down to 3 (not 6) by externalId.
    expect(discovered).toHaveLength(3);
  });

  it('logs an error for the malformed item via ctx.log', async () => {
    const log = vi.fn();
    const ctx: AdapterContext = {
      fetchText: vi.fn().mockResolvedValue(fixtureXml),
      fetchJson: vi.fn(),
      log,
    };

    await weWorkRemotelyAdapter.discover(ctx);

    expect(log).toHaveBeenCalled();
    expect(log.mock.calls.some(([msg]) => String(msg).includes('Untitled Remote Opportunity'))).toBe(
      true,
    );
  });
});
