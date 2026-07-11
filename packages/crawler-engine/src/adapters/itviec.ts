import { RawJob } from '@waypoint/shared';
import type { AdapterContext, DiscoveredJob, SourceAdapter } from '../adapter.js';

export const ITVIEC_LISTING_URL = 'https://itviec.com/it-jobs';
export const ITVIEC_LISTING_PAGES = 2;

/**
 * Selectors/markers this adapter depends on. ITviec is a client-rendered
 * SPA with no public API, so these are scraped from the rendered DOM and
 * WILL drift when the site changes layout — centralized here so a break is
 * a one-place fix instead of a hunt through the file.
 */
const selectors = {
  jobCardSlugAttr: /data-search--job-selection-job-slug-value="([^"]+)"/g,
  dataLayerAttr: /data-jobs--save-data-layer-value="([^"]*)"/,
  h1: /<h1[^>]*>([^<]*)<\/h1>/,
  employerName: /<div class="employer-name">([^<]*)<\/div>/,
  descriptionStartMarker: 'data-jobs--jd-scroll-target="jobContent"',
  descriptionEndMarker: 'More jobs for you',
};

export interface ItviecListingJob {
  slug: string;
  url: string;
}

/** Pure — extracts distinct job slugs/URLs from a rendered listing page. */
export function parseListing(html: string): ItviecListingJob[] {
  const slugs = [...html.matchAll(selectors.jobCardSlugAttr)].map((m) => m[1]!);
  const unique = [...new Set(slugs)];
  return unique.map((slug) => ({ slug, url: `${ITVIEC_LISTING_URL}/${slug}` }));
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

interface ItviecDataLayer {
  job_title?: string;
  job_by_company?: string;
  job_by_city?: string;
  job_required_skill?: string;
  salary_range?: string;
}

export interface ItviecDetail {
  title?: string;
  company?: string;
  location?: string;
  salaryText?: string;
  tags: string[];
  descriptionHtml?: string;
}

/**
 * Pure — extracts job fields from a rendered detail page. Prefers the
 * structured `data-jobs--save-data-layer-value` JSON attribute (title,
 * company, city, skills, salary all in one place); falls back to scraping
 * the h1/employer-name directly if that attribute is absent, so a partial
 * page still yields a usable (if thinner) job.
 */
export function parseDetail(html: string): ItviecDetail {
  let title: string | undefined;
  let company: string | undefined;
  let location: string | undefined;
  let salaryText: string | undefined;
  let tags: string[] = [];

  const dataLayerMatch = html.match(selectors.dataLayerAttr);
  if (dataLayerMatch?.[1]) {
    try {
      const data: ItviecDataLayer = JSON.parse(decodeHtmlEntities(dataLayerMatch[1]));
      title = data.job_title;
      company = data.job_by_company;
      location = data.job_by_city;
      salaryText = data.salary_range || undefined; // empty string means "sign in to view"
      tags = data.job_required_skill
        ? data.job_required_skill.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    } catch {
      // Malformed JSON in the attribute — fall through to DOM scraping below.
    }
  }

  if (!title) {
    title = html.match(selectors.h1)?.[1]?.trim();
  }
  if (!company) {
    company = html.match(selectors.employerName)?.[1]?.trim();
  }

  const startIdx = html.indexOf(selectors.descriptionStartMarker);
  let descriptionHtml: string | undefined;
  if (startIdx !== -1) {
    const endIdx = html.indexOf(selectors.descriptionEndMarker, startIdx);
    descriptionHtml = html.slice(startIdx, endIdx !== -1 ? endIdx : undefined);
  }

  return { title, company, location, salaryText, tags, descriptionHtml };
}

async function renderPage(ctx: AdapterContext, url: string): Promise<string> {
  if (!ctx.browser) {
    throw new Error('itviec adapter requires a browser (AdapterContext.browser is not set)');
  }
  const page = await ctx.browser.newPage();
  try {
    await page.goto(url);
    return await page.content();
  } finally {
    await page.close();
  }
}

export const itviecAdapter: SourceAdapter = {
  source: 'itviec',
  displayName: 'ITviec',

  async discover(ctx: AdapterContext): Promise<DiscoveredJob[]> {
    const seen = new Map<string, ItviecListingJob>();
    for (let page = 1; page <= ITVIEC_LISTING_PAGES; page++) {
      const url = page === 1 ? ITVIEC_LISTING_URL : `${ITVIEC_LISTING_URL}?page=${page}`;
      const html = await renderPage(ctx, url);
      for (const job of parseListing(html)) {
        seen.set(job.slug, job);
      }
    }

    if (seen.size === 0) {
      throw new Error('itviec listing yielded zero jobs — selectors likely drifted');
    }

    return [...seen.values()].map((job) => ({ externalId: job.slug, url: job.url }));
  },

  async extract(ctx: AdapterContext, job: DiscoveredJob): Promise<RawJob> {
    const html = await renderPage(ctx, job.url);
    const detail = parseDetail(html);

    if (!detail.title) {
      throw new Error(`itviec detail page for ${job.url} yielded no title — selectors likely drifted`);
    }

    return {
      source: 'itviec',
      externalId: job.externalId,
      url: job.url,
      title: detail.title,
      company: detail.company,
      location: detail.location,
      salaryText: detail.salaryText,
      descriptionHtml: detail.descriptionHtml,
      tags: detail.tags,
      fetchedAt: new Date(),
    };
  },
};
