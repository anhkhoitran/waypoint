import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext, PageLike } from '../../adapter.js';
import { itviecAdapter, parseDetail, parseListing } from '../../adapters/itviec.js';

function loadFixture(name: string): string {
  const path = fileURLToPath(new URL(`../../__fixtures__/${name}`, import.meta.url));
  return readFileSync(path, 'utf8');
}

const listingHtml = loadFixture('itviec-listing.html');
const detailHtml = loadFixture('itviec-detail.html');
const detailFallbackHtml = loadFixture('itviec-detail-fallback.html');

describe('parseListing', () => {
  it('extracts job slugs and builds canonical URLs', () => {
    const jobs = parseListing(listingHtml);
    expect(jobs).toContainEqual({
      slug: 'middle-senior-soc-platform-engineer-f88-2517',
      url: 'https://itviec.com/it-jobs/middle-senior-soc-platform-engineer-f88-2517',
    });
  });

  it('dedupes a slug that appears in multiple cards (e.g. a pinned repeat)', () => {
    const jobs = parseListing(listingHtml);
    const slugs = jobs.map((j) => j.slug);
    expect(slugs.filter((s) => s === 'enterprise-solution-architect-expert-hdbank-2207')).toHaveLength(
      1,
    );
  });

  it('returns an empty array (not a throw) when no cards are present', () => {
    expect(parseListing('<html><body>no jobs here</body></html>')).toEqual([]);
  });
});

describe('parseDetail', () => {
  it('prefers the structured data-layer attribute for title/company/location/skills', () => {
    const detail = parseDetail(detailHtml);
    expect(detail.title).toBe('Enterprise / Solution Architect Expert');
    expect(detail.company).toBe('HDBank');
    expect(detail.location).toBe('Ho Chi Minh');
    expect(detail.tags).toEqual([
      'Enterprise Architecture',
      'English',
      'Stakeholder management',
      'Cloud',
      'Solution Architecture',
    ]);
  });

  it('leaves salary undefined when salary_range is empty ("sign in to view")', () => {
    const detail = parseDetail(detailHtml);
    expect(detail.salaryText).toBeUndefined();
  });

  it('extracts descriptionHtml between the jobContent marker and "More jobs for you"', () => {
    const detail = parseDetail(detailHtml);
    expect(detail.descriptionHtml).toContain('Job description');
    expect(detail.descriptionHtml).toContain('Your skills and experience');
    expect(detail.descriptionHtml).not.toContain('unrelated recommended jobs section');
  });

  it('does not leak the marker attribute itself into descriptionHtml', () => {
    const detail = parseDetail(detailHtml);
    expect(detail.descriptionHtml).not.toContain('data-jobs--jd-scroll-target');
    // The container's opening tag closes with a lone `>` right at the marker —
    // regression check that this orphaned character doesn't survive either.
    expect(detail.descriptionHtml?.trimStart()).not.toMatch(/^>/);
  });

  it('falls back to scraping h1/employer-name when the data-layer attribute is absent', () => {
    const detail = parseDetail(detailFallbackHtml);
    expect(detail.title).toBe('Backend Engineer (Java/Spring)');
    expect(detail.company).toBe('Saigon Technology');
    expect(detail.tags).toEqual([]);
    expect(detail.descriptionHtml).toBeUndefined();
  });
});

function makeMockBrowser(pages: Record<string, string>) {
  const newPage = vi.fn(async (): Promise<PageLike> => {
    let lastUrl = '';
    return {
      goto: vi.fn(async (url: string) => {
        lastUrl = url;
      }),
      content: vi.fn(async () => {
        const key = Object.keys(pages).find((k) => lastUrl.startsWith(k));
        if (!key) throw new Error(`no mock page registered for ${lastUrl}`);
        return pages[key]!;
      }),
      close: vi.fn(async () => {}),
    };
  });
  return { newPage };
}

describe('itviecAdapter.discover', () => {
  it('collects job references across listing pages via the browser provider', async () => {
    const ctx: AdapterContext = {
      fetchText: vi.fn(),
      fetchJson: vi.fn(),
      log: vi.fn(),
      browser: makeMockBrowser({
        'https://itviec.com/it-jobs': listingHtml,
      }),
    };

    const discovered = await itviecAdapter.discover(ctx);
    expect(discovered.length).toBeGreaterThan(0);
    expect(discovered.some((d) => d.externalId === 'middle-senior-soc-platform-engineer-f88-2517')).toBe(
      true,
    );
  });

  it('throws a descriptive error when ctx.browser is not supplied', async () => {
    const ctx: AdapterContext = { fetchText: vi.fn(), fetchJson: vi.fn(), log: vi.fn() };
    await expect(itviecAdapter.discover(ctx)).rejects.toThrow(/requires a browser/);
  });

  it('throws when the listing renders zero jobs, so the run is recorded as failed', async () => {
    const ctx: AdapterContext = {
      fetchText: vi.fn(),
      fetchJson: vi.fn(),
      log: vi.fn(),
      browser: makeMockBrowser({
        'https://itviec.com/it-jobs': '<html><body>empty</body></html>',
      }),
    };
    await expect(itviecAdapter.discover(ctx)).rejects.toThrow(/zero jobs/);
  });
});

describe('itviecAdapter.extract', () => {
  it('renders the detail page and maps it to a RawJob', async () => {
    const ctx: AdapterContext = {
      fetchText: vi.fn(),
      fetchJson: vi.fn(),
      log: vi.fn(),
      browser: makeMockBrowser({
        'https://itviec.com/it-jobs/enterprise-solution-architect-expert-hdbank-2207': detailHtml,
      }),
    };

    const raw = await itviecAdapter.extract(ctx, {
      externalId: 'enterprise-solution-architect-expert-hdbank-2207',
      url: 'https://itviec.com/it-jobs/enterprise-solution-architect-expert-hdbank-2207',
    });

    expect(raw).toMatchObject({
      source: 'itviec',
      title: 'Enterprise / Solution Architect Expert',
      company: 'HDBank',
      location: 'Ho Chi Minh',
    });
  });
});
