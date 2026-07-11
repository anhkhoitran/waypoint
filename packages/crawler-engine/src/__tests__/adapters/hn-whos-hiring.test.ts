import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RawJob } from '@waypoint/shared';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../../adapter.js';
import {
  findLatestThreadId,
  HN_MAX_COMMENTS,
  hnWhosHiringAdapter,
  parseComment,
} from '../../adapters/hn-whos-hiring.js';

function loadFixture(name: string) {
  const path = fileURLToPath(new URL(`../../__fixtures__/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8'));
}

const searchFixture = loadFixture('hn-search.json');
const threadFixture = loadFixture('hn-items.json');

describe('findLatestThreadId', () => {
  it('picks the newest "Ask HN: Who is hiring?" thread, ignoring near-duplicate titles', () => {
    // Fixture deliberately has a *newer* "Who wants to be hired?" hit ranked
    // first — the filter must reject it and pick the actual hiring thread.
    const id = findLatestThreadId(searchFixture.hits);
    expect(id).toBe('48747976');
  });

  it('returns undefined when no hit matches the expected title prefix', () => {
    const id = findLatestThreadId([
      { objectID: '1', title: 'Ask HN: Who wants to be hired? (July 2026)', created_at: '2026-07-01T00:00:00Z' },
    ]);
    expect(id).toBeUndefined();
  });
});

describe('parseComment', () => {
  it('parses the pipe convention "Company | Role | Location | …"', () => {
    const { company, title } = parseComment(
      'CaseLight Systems Inc. | Founding Systems Engineer | Remote (US Only)<p>Building a desktop app.',
    );
    expect(company).toBe('CaseLight Systems Inc.');
    expect(title).toBe('Founding Systems Engineer');
  });

  it('decodes HTML entities in the pipe-split fields', () => {
    const { company, title } = parseComment(
      'We The Flywheel | AI-Native Engineers &amp; Operators | REMOTE<p>body',
    );
    expect(company).toBe('We The Flywheel');
    expect(title).toBe('AI-Native Engineers & Operators');
  });

  it('falls back to a truncated plain-text title when there is no pipe convention', () => {
    const { company, title } = parseComment(
      'PrairieLearn (Remote US) &#x2014; Full-Stack Software Engineer &#x2014; TypeScript &#x2F; Postgres &#x2F; React &#x2F; AI<p>body text here',
    );
    expect(company).toBeUndefined();
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title).toContain('PrairieLearn');
  });
});

describe('hnWhosHiringAdapter.discover', () => {
  it('fetches the search endpoint, then the thread, and maps top-level comments', async () => {
    const ctx: AdapterContext = {
      fetchText: vi.fn(),
      fetchJson: vi
        .fn()
        .mockResolvedValueOnce(searchFixture)
        .mockResolvedValueOnce(threadFixture),
      log: vi.fn(),
    };

    const discovered = await hnWhosHiringAdapter.discover(ctx);

    // 5 children in fixture, 1 is dead (text: null) -> 4 valid jobs.
    expect(discovered).toHaveLength(4);
    const first = discovered.find((d) => d.externalId === '48747987');
    // Real HN comments don't reliably lead with company — this one leads with
    // the poster's location ("Blaine, WA"), which the "Company | Role | …"
    // heuristic has no way to distinguish from a company name. Documented
    // limitation of crowd-sourced free text, not a parsing bug.
    expect(first?.raw).toMatchObject({
      source: 'hn_whos_hiring',
      company: 'Blaine, WA',
      title: 'CaseLight Systems Inc. (CSI)',
      url: 'https://news.ycombinator.com/item?id=48747987',
    });
  });

  it('skips dead/deleted comments (text: null) and logs why', async () => {
    const log = vi.fn();
    const ctx: AdapterContext = {
      fetchText: vi.fn(),
      fetchJson: vi
        .fn()
        .mockResolvedValueOnce(searchFixture)
        .mockResolvedValueOnce(threadFixture),
      log,
    };

    const discovered = await hnWhosHiringAdapter.discover(ctx);
    expect(discovered.some((d) => d.externalId === '48748099')).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('48748099'));
  });

  it('emits only Zod-valid RawJob objects', async () => {
    const ctx: AdapterContext = {
      fetchText: vi.fn(),
      fetchJson: vi
        .fn()
        .mockResolvedValueOnce(searchFixture)
        .mockResolvedValueOnce(threadFixture),
      log: vi.fn(),
    };

    const discovered = await hnWhosHiringAdapter.discover(ctx);
    for (const d of discovered) {
      expect(() => RawJob.parse(d.raw)).not.toThrow();
    }
  });

  it('caps the number of comments processed per run', async () => {
    const manyChildren = Array.from({ length: HN_MAX_COMMENTS + 50 }, (_, i) => ({
      id: 10_000 + i,
      created_at: '2026-07-01T15:00:00.000Z',
      text: `Company ${i} | Engineer | Remote<p>body`,
    }));
    const ctx: AdapterContext = {
      fetchText: vi.fn(),
      fetchJson: vi
        .fn()
        .mockResolvedValueOnce(searchFixture)
        .mockResolvedValueOnce({ id: 1, children: manyChildren }),
      log: vi.fn(),
    };

    const discovered = await hnWhosHiringAdapter.discover(ctx);
    expect(discovered).toHaveLength(HN_MAX_COMMENTS);
  });
});
