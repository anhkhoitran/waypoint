import type { RawJob } from '@waypoint/shared';
import type { AdapterContext, DiscoveredJob, SourceAdapter } from '../adapter.js';

interface RemoteOkLegalNotice {
  legal: string;
}

interface RemoteOkJob {
  id: string;
  slug: string;
  date: string;
  company: string;
  position: string;
  tags: string[];
  description: string;
  location?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  url: string;
}

type RemoteOkEntry = RemoteOkLegalNotice | RemoteOkJob;

function isLegalNotice(entry: RemoteOkEntry): entry is RemoteOkLegalNotice {
  return 'legal' in entry;
}

/**
 * Tags that mark a RemoteOK listing as a software engineering role worth
 * keeping. RemoteOK's own tagging is noisy (broad tag lists on non-dev
 * listings), so this is a best-effort intersection filter, not a guarantee —
 * tune freely as false positives/negatives show up.
 */
export const REMOTEOK_DEV_TAGS = [
  'dev',
  'engineer',
  'engineering',
  'javascript',
  'typescript',
  'react',
  'node',
  'python',
  'golang',
  'java',
  'backend',
  'frontend',
  'full stack',
  'fullstack',
  'software',
  'devops',
];

function isDevRole(tags: string[]): boolean {
  const lower = tags.map((t) => t.toLowerCase());
  return REMOTEOK_DEV_TAGS.some((keep) => lower.includes(keep));
}

function formatSalary(min?: number | null, max?: number | null): string | undefined {
  if (!min && !max) return undefined;
  const fmt = (n: number) => `$${n.toLocaleString('en-US')}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt((min ?? max)!);
}

function toRawJob(job: RemoteOkJob, fetchedAt: Date): RawJob {
  const postedAt = job.date && !Number.isNaN(Date.parse(job.date)) ? new Date(job.date) : undefined;
  return {
    source: 'remoteok',
    externalId: job.id,
    url: job.url,
    title: job.position,
    company: job.company,
    location: job.location,
    salaryText: formatSalary(job.salary_min, job.salary_max),
    descriptionHtml: job.description,
    tags: job.tags,
    postedAt,
    fetchedAt,
  };
}

export const remoteOkAdapter: SourceAdapter = {
  source: 'remoteok',
  displayName: 'RemoteOK',

  async discover(ctx: AdapterContext): Promise<DiscoveredJob[]> {
    const entries = await ctx.fetchJson<RemoteOkEntry[]>('https://remoteok.com/api');
    const fetchedAt = new Date();
    const jobs = entries.filter((entry): entry is RemoteOkJob => !isLegalNotice(entry));
    const devJobs = jobs.filter((job) => isDevRole(job.tags));
    return devJobs.map((job) => ({
      externalId: job.id,
      url: job.url,
      raw: toRawJob(job, fetchedAt),
    }));
  },

  async extract(): Promise<RawJob> {
    throw new Error(
      'remoteok adapter attaches raw jobs at discover() time — extract() should not be called',
    );
  },
};
