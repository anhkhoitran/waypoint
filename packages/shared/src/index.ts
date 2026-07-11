import { z } from 'zod';

/** Job sources Waypoint knows how to crawl. */
export const JobSource = z.enum([
  'remoteok',
  'weworkremotely',
  'hn_whos_hiring',
  'itviec',
  'topdev',
  'vietnamworks',
]);
export type JobSource = z.infer<typeof JobSource>;

/** Human-readable display name per source, for badges and the source health panel. */
export const SOURCE_LABELS: Record<JobSource, string> = {
  remoteok: 'RemoteOK',
  weworkremotely: 'WeWorkRemotely',
  hn_whos_hiring: 'HN Who’s Hiring',
  itviec: 'ITviec',
  topdev: 'TopDev',
  vietnamworks: 'VietnamWorks',
};

export const WorkMode = z.enum(['remote', 'hybrid', 'onsite', 'unknown']);
export type WorkMode = z.infer<typeof WorkMode>;

export const SeniorityLevel = z.enum([
  'intern',
  'junior',
  'mid',
  'senior',
  'lead',
  'unknown',
]);
export type SeniorityLevel = z.infer<typeof SeniorityLevel>;

/**
 * What a source adapter emits straight from the wire — minimally processed,
 * before normalization. Everything optional except identity fields.
 */
export const RawJob = z.object({
  source: JobSource,
  /** Stable id within the source (listing id, guid, or canonical URL). */
  externalId: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  company: z.string().optional(),
  location: z.string().optional(),
  salaryText: z.string().optional(),
  descriptionHtml: z.string().optional(),
  descriptionText: z.string().optional(),
  tags: z.array(z.string()).default([]),
  postedAt: z.coerce.date().optional(),
  fetchedAt: z.coerce.date(),
});
export type RawJob = z.infer<typeof RawJob>;

/** A job after the normalize stage of the pipeline — what gets persisted. */
export const NormalizedJob = z.object({
  source: JobSource,
  externalId: z.string(),
  url: z.string().url(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  workMode: WorkMode,
  seniority: SeniorityLevel,
  salaryText: z.string().nullable(),
  descriptionText: z.string(),
  tags: z.array(z.string()),
  postedAt: z.date().nullable(),
  fetchedAt: z.date(),
  /** Hash of normalized company+title+location, used for cross-source dedup. */
  dedupKey: z.string(),
});
export type NormalizedJob = z.infer<typeof NormalizedJob>;

/** Outcome of one crawl run against one source — surfaced as source health in the UI. */
export const CrawlRunStatus = z.enum(['success', 'partial', 'failed']);
export type CrawlRunStatus = z.infer<typeof CrawlRunStatus>;

export const CrawlRunSummary = z.object({
  source: JobSource,
  status: CrawlRunStatus,
  startedAt: z.date(),
  finishedAt: z.date(),
  jobsFound: z.number().int().nonnegative(),
  jobsNew: z.number().int().nonnegative(),
  jobsDuplicate: z.number().int().nonnegative(),
  errors: z.array(z.string()),
});
export type CrawlRunSummary = z.infer<typeof CrawlRunSummary>;

/** A persisted CrawlRun as returned by GET /crawl/runs. */
export const CrawlRunRecord = z.object({
  id: z.string(),
  sourceId: JobSource,
  status: CrawlRunStatus,
  startedAt: z.coerce.date(),
  finishedAt: z.coerce.date(),
  jobsFound: z.number().int(),
  jobsNew: z.number().int(),
  jobsDuplicate: z.number().int(),
  errors: z.array(z.string()),
});
export type CrawlRunRecord = z.infer<typeof CrawlRunRecord>;

/** A persisted job as returned by the Jobs API — a NormalizedJob plus DB-assigned fields. */
export const JobRecord = NormalizedJob.extend({
  id: z.string(),
  saved: z.boolean(),
  hidden: z.boolean(),
});
export type JobRecord = z.infer<typeof JobRecord>;

/** GET /jobs query params. */
export const JobQuery = z.object({
  q: z.string().min(1).optional(),
  source: JobSource.optional(),
  workMode: WorkMode.optional(),
  seniority: SeniorityLevel.optional(),
  saved: z.coerce.boolean().optional(),
  postedWithinDays: z.coerce.number().int().positive().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
export type JobQuery = z.infer<typeof JobQuery>;

export const JobListResponse = z.object({
  items: z.array(JobRecord),
  nextCursor: z.string().nullable(),
});
export type JobListResponse = z.infer<typeof JobListResponse>;

/** PATCH /jobs/:id body. */
export const JobPatch = z
  .object({
    saved: z.boolean().optional(),
    hidden: z.boolean().optional(),
  })
  .refine((body) => body.saved !== undefined || body.hidden !== undefined, {
    message: 'at least one of saved/hidden must be provided',
  });
export type JobPatch = z.infer<typeof JobPatch>;

export {
  SKILL_TAXONOMY,
  ALIAS_TO_SKILL,
  isKnownSkill,
  getSkillCategory,
  type SkillCategory,
  type SkillDefinition,
} from './taxonomy.js';
