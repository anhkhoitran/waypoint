import { z } from 'zod';
import { isKnownSkill } from './taxonomy.js';

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
 * What kind of role this is, per the Phase 5 LLM job summary. Fixed and
 * enum-constrained (the model literally cannot emit an off-list value — see
 * packages/job-summarizer's JSON schema) specifically so this is safe to
 * aggregate in Insights, unlike free-form summary text.
 */
export const RoleFunction = z.enum([
  'frontend',
  'backend',
  'fullstack',
  'mobile',
  'data',
  'ml',
  'devops',
  'security',
  'qa',
  'pm',
  'design',
  'other',
]);
export type RoleFunction = z.infer<typeof RoleFunction>;

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

/**
 * A Phase 5 LLM-generated structured analysis of a job posting, as returned
 * nested on JobRecord. `summary`/`responsibilities`/etc. are display-only —
 * never fed into Insights aggregates. `roleFunction` is the one field safe
 * to aggregate (fixed enum); `yearsExperienceMin` is safe only because the
 * summarizer ground-checks it against the source text before persisting it.
 */
export const JobSummary = z.object({
  summary: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(z.string()),
  niceToHave: z.array(z.string()),
  benefits: z.array(z.string()),
  roleFunction: RoleFunction,
  yearsExperienceMin: z.number().int().nonnegative().nullable(),
  model: z.string(),
  generatedAt: z.coerce.date(),
});
export type JobSummary = z.infer<typeof JobSummary>;

/** A persisted job as returned by the Jobs API — a NormalizedJob plus DB-assigned fields. */
export const JobRecord = NormalizedJob.extend({
  id: z.string(),
  saved: z.boolean(),
  hidden: z.boolean(),
  /** Computed per-request against the profile; null when the job has no extracted skills yet. */
  matchScore: z
    .object({
      score: z.number(),
      matched: z.array(z.string()),
      missing: z.array(z.string()),
    })
    .nullable()
    .optional(),
  /** Null until the background summarizer (Phase 5) has processed this job. */
  summary: JobSummary.nullable().optional(),
});
export type JobRecord = z.infer<typeof JobRecord>;

/** Parses a comma-separated query param into an array of the given enum. */
function csv<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v),
    z.array(schema),
  );
}

/** GET /jobs query params. */
export const JobSort = z.enum(['newest', 'match', 'salary']);
export type JobSort = z.infer<typeof JobSort>;

export const JobSalaryBucket = z.enum(['any', 'has', '100', '150']);
export type JobSalaryBucket = z.infer<typeof JobSalaryBucket>;

export const JobPostedBucket = z.enum(['any', '24h', 'week']);
export type JobPostedBucket = z.infer<typeof JobPostedBucket>;

export const JobMatchBucket = z.enum(['any', '40', '70']);
export type JobMatchBucket = z.infer<typeof JobMatchBucket>;

export const JobQuery = z.object({
  q: z.string().min(1).optional(),
  /** Comma-separated list of sources/work modes/seniorities — multi-select facets. */
  source: csv(JobSource).optional(),
  workMode: csv(WorkMode).optional(),
  seniority: csv(SeniorityLevel).optional(),
  salary: JobSalaryBucket.optional(),
  posted: JobPostedBucket.optional(),
  match: JobMatchBucket.optional(),
  saved: z.coerce.boolean().optional(),
  postedWithinDays: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  /**
   * Job listing filters/sorts entirely in application code against the full
   * (small, personal-scale) job set — see JobsService.list. That's what
   * makes "salary" a true global sort and multi-select facets possible with
   * live counts; there's no cursor pagination to preserve.
   */
  sort: JobSort.optional(),
});
export type JobQuery = z.infer<typeof JobQuery>;

export const FacetOption = z.object({
  value: z.string(),
  count: z.number().int().nonnegative(),
});
export type FacetOption = z.infer<typeof FacetOption>;

/** Counts per candidate value for each facet dimension, given the query's *other* active filters. */
export const JobFacets = z.object({
  sources: z.array(FacetOption),
  workModes: z.array(FacetOption),
  seniorities: z.array(FacetOption),
  salary: z.array(FacetOption),
  posted: z.array(FacetOption),
  match: z.array(FacetOption),
});
export type JobFacets = z.infer<typeof JobFacets>;

export const JobListResponse = z.object({
  items: z.array(JobRecord),
  facets: JobFacets,
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

/** The project owner's profile, used for match scoring and roadmap generation. */
export const Profile = z.object({
  id: z.string(),
  skills: z.array(z.string()),
  yearsOfExperience: z.number().int().nonnegative(),
  targetSeniority: SeniorityLevel,
  targetWorkModes: z.array(WorkMode),
  locations: z.array(z.string()),
  hoursPerWeek: z.number().int().positive(),
});
export type Profile = z.infer<typeof Profile>;

/** GET/PUT /profile body — every skill must exist in the taxonomy. */
export const ProfileInput = z.object({
  skills: z.array(z.string()).refine((skills) => skills.every(isKnownSkill), {
    message: 'skills must all be known taxonomy skill names',
  }),
  yearsOfExperience: z.number().int().nonnegative(),
  targetSeniority: SeniorityLevel,
  targetWorkModes: z.array(WorkMode),
  locations: z.array(z.string()),
  hoursPerWeek: z.number().int().positive().max(80).default(8),
});
export type ProfileInput = z.infer<typeof ProfileInput>;

export {
  matchScore,
  type MatchResult,
  type MatchProfile,
  type JobSkillInput,
} from './match.js';

/** Phase 3 prep tracks. */
export const TrackId = z.enum(['dsa', 'system_design', 'cloud', 'web']);
export type TrackId = z.infer<typeof TrackId>;

export { sm2, type Sm2Grade, type Sm2Result, type Sm2State } from './sm2.js';

/** GET /insights/skill-demand and /insights/gap query params. */
export const InsightsSkillDemandQuery = z.object({
  window: z.string().optional(),
  seniority: SeniorityLevel.optional(),
  source: JobSource.optional(),
});
export type InsightsSkillDemandQuery = z.infer<typeof InsightsSkillDemandQuery>;

/** GET /insights/work-mode-split and /insights/salary-by-seniority query params. */
export const InsightsWindowQuery = z.object({
  window: z.string().optional(),
});
export type InsightsWindowQuery = z.infer<typeof InsightsWindowQuery>;

export const SkillDemandItem = z.object({
  skill: z.string(),
  category: z.string(),
  jobCount: z.number().int().nonnegative(),
  share: z.number(),
});
export type SkillDemandItem = z.infer<typeof SkillDemandItem>;

/** GET /insights/skill-trend query params. */
export const InsightsSkillTrendQuery = z.object({
  skills: z.string().min(1),
  window: z.string().optional(),
  bucket: z.enum(['day', 'week']).optional(),
});
export type InsightsSkillTrendQuery = z.infer<typeof InsightsSkillTrendQuery>;

export const SkillTrendResponse = z.object({
  buckets: z.array(z.string()),
  series: z.record(z.string(), z.array(z.number())),
});
export type SkillTrendResponse = z.infer<typeof SkillTrendResponse>;

/** GET /insights/summary response — stat tiles. */
export const InsightsSummary = z.object({
  jobsInWindow: z.number().int().nonnegative(),
  sourcesHealthy: z.number().int().nonnegative(),
  sourcesTotal: z.number().int().nonnegative(),
  /** Formatted (e.g. "$72k"); null when no salaryText in the window was parseable. */
  medianSalary: z.string().nullable(),
  topGapSkills: z.array(z.string()),
});
export type InsightsSummary = z.infer<typeof InsightsSummary>;

/** GET /insights/work-mode-split response. */
export const WorkModeSplitItem = z.object({
  workMode: WorkMode,
  count: z.number().int().nonnegative(),
});
export type WorkModeSplitItem = z.infer<typeof WorkModeSplitItem>;

/**
 * GET /insights/role-functions response (Phase 5). Only counts jobs that
 * already have a JobSummary — jobs the background summarizer hasn't reached
 * yet are simply absent, not bucketed into a fabricated "unknown".
 */
export const RoleFunctionSplitItem = z.object({
  roleFunction: RoleFunction,
  count: z.number().int().nonnegative(),
});
export type RoleFunctionSplitItem = z.infer<typeof RoleFunctionSplitItem>;

/**
 * GET /insights/salary-by-seniority response. min/median/max are computed
 * across parsed per-job salary midpoints within that seniority bucket (not a
 * single job's own range) — see parseUsdMidpoint in the API's insights.utils.
 */
export const SalaryBySeniorityItem = z.object({
  seniority: SeniorityLevel,
  min: z.number(),
  median: z.number(),
  max: z.number(),
  count: z.number().int().nonnegative(),
});
export type SalaryBySeniorityItem = z.infer<typeof SalaryBySeniorityItem>;

/** GET /insights/volume-by-source query params. */
export const InsightsVolumeQuery = z.object({
  weeks: z.coerce.number().int().positive().max(52).optional(),
});
export type InsightsVolumeQuery = z.infer<typeof InsightsVolumeQuery>;

/** GET /insights/volume-by-source response — weekly new-job counts per source. */
export const VolumeBySourceResponse = z.object({
  buckets: z.array(z.string()),
  series: z.record(z.string(), z.array(z.number())),
});
export type VolumeBySourceResponse = z.infer<typeof VolumeBySourceResponse>;

/** GET /insights/top-companies query params. */
export const InsightsTopCompaniesQuery = z.object({
  window: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});
export type InsightsTopCompaniesQuery = z.infer<typeof InsightsTopCompaniesQuery>;

export const TopCompanyItem = z.object({
  company: z.string(),
  count: z.number().int().nonnegative(),
});
export type TopCompanyItem = z.infer<typeof TopCompanyItem>;

/** A track's curated topic content, as returned by GET /roadmap (nested under each item). */
export const ResourceKind = z.enum(['article', 'video', 'course', 'problem_set', 'book_chapter']);
export type ResourceKind = z.infer<typeof ResourceKind>;

export const ResourceRecord = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  kind: ResourceKind,
  note: z.string().nullable(),
  estMinutes: z.number().int(),
});
export type ResourceRecord = z.infer<typeof ResourceRecord>;

export const TopicRecord = z.object({
  id: z.string(),
  trackId: TrackId,
  slug: z.string(),
  name: z.string(),
  order: z.number().int(),
  difficulty: z.number().int(),
  skills: z.array(z.string()),
  resources: z.array(ResourceRecord),
});
export type TopicRecord = z.infer<typeof TopicRecord>;

export const RoadmapItemStatus = z.enum(['todo', 'in_progress', 'done']);
export type RoadmapItemStatus = z.infer<typeof RoadmapItemStatus>;

export const RoadmapItemRecord = z.object({
  id: z.string(),
  topicId: z.string(),
  topic: TopicRecord,
  weekIndex: z.number().int(),
  status: RoadmapItemStatus,
  reason: z.string(),
  createdAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
});
export type RoadmapItemRecord = z.infer<typeof RoadmapItemRecord>;

export const RoadmapGenerateResponse = z.object({
  itemsCreated: z.number().int(),
  weeksScheduled: z.number().int(),
});
export type RoadmapGenerateResponse = z.infer<typeof RoadmapGenerateResponse>;

/** PATCH /roadmap/items/:id body. */
export const RoadmapItemPatch = z.object({
  status: RoadmapItemStatus,
});
export type RoadmapItemPatch = z.infer<typeof RoadmapItemPatch>;

/** A review card as returned by GET /review/queue and POST /review/cards/:id/grade. */
export const ReviewCardRecord = z.object({
  id: z.string(),
  contentId: z.string(),
  trackId: TrackId,
  prompt: z.string(),
  answer: z.string(),
  topicSlug: z.string().nullable(),
  // SM-2 state, exposed so the client can preview each grade button's next
  // interval locally (via this package's `sm2()`) without an extra request.
  easiness: z.number(),
  intervalDays: z.number().int(),
  repetitions: z.number().int(),
  dueAt: z.coerce.date(),
  lapses: z.number().int(),
});
export type ReviewCardRecord = z.infer<typeof ReviewCardRecord>;

/** GET /review/queue query params. */
export const ReviewQueueQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});
export type ReviewQueueQuery = z.infer<typeof ReviewQueueQuery>;

/** POST /review/cards/:id/grade body. */
export const ReviewGradeInput = z.object({
  grade: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
});
export type ReviewGradeInput = z.infer<typeof ReviewGradeInput>;

export const ReviewTrackStat = z.object({
  trackId: TrackId,
  dueCount: z.number().int(),
});
export type ReviewTrackStat = z.infer<typeof ReviewTrackStat>;

export const ReviewHeatmapDay = z.object({
  date: z.string(),
  count: z.number().int(),
});
export type ReviewHeatmapDay = z.infer<typeof ReviewHeatmapDay>;

/** GET /review/stats response. */
export const ReviewStats = z.object({
  dueToday: z.number().int(),
  doneToday: z.number().int(),
  streak: z.number().int(),
  perTrack: z.array(ReviewTrackStat),
  /** Last 30 Asia/Ho_Chi_Minh calendar days, oldest first. */
  heatmap: z.array(ReviewHeatmapDay),
});
export type ReviewStats = z.infer<typeof ReviewStats>;

/** Phase 4 — application tracker. */
export const ApplicationStage = z.enum([
  'saved',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
]);
export type ApplicationStage = z.infer<typeof ApplicationStage>;

export const ApplicationEventKind = z.enum(['note', 'stage_change', 'interview']);
export type ApplicationEventKind = z.infer<typeof ApplicationEventKind>;

export const InterviewKind = z.enum(['phone', 'technical', 'system_design', 'behavioral', 'final']);
export type InterviewKind = z.infer<typeof InterviewKind>;

export const ApplicationEventRecord = z.object({
  id: z.string(),
  applicationId: z.string(),
  kind: ApplicationEventKind,
  body: z.string(),
  interviewKind: InterviewKind.nullable(),
  occurredAt: z.coerce.date(),
});
export type ApplicationEventRecord = z.infer<typeof ApplicationEventRecord>;

export const ApplicationRecord = z.object({
  id: z.string(),
  jobId: z.string().nullable(),
  company: z.string(),
  title: z.string(),
  url: z.string(),
  stage: ApplicationStage,
  appliedAt: z.coerce.date().nullable(),
  nextActionAt: z.coerce.date().nullable(),
  nextActionNote: z.string().nullable(),
  salaryExpectation: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  /** Days since entering the current stage (latest stage_change event, or createdAt if none yet). */
  daysInStage: z.number(),
  /** Populated only when jobId is set and the job still has a computed match score. */
  matchScore: z
    .object({ score: z.number(), matched: z.array(z.string()), missing: z.array(z.string()) })
    .nullable()
    .optional(),
  /** Populated only on the single-application detail fetch, newest first. */
  events: z.array(ApplicationEventRecord).optional(),
});
export type ApplicationRecord = z.infer<typeof ApplicationRecord>;

const applicationArrayByStage = {
  saved: z.array(ApplicationRecord),
  applied: z.array(ApplicationRecord),
  screening: z.array(ApplicationRecord),
  interviewing: z.array(ApplicationRecord),
  offer: z.array(ApplicationRecord),
  rejected: z.array(ApplicationRecord),
  withdrawn: z.array(ApplicationRecord),
};

/** GET /applications (no `stage` filter) response — one array per column. */
export const ApplicationBoard = z.object(applicationArrayByStage);
export type ApplicationBoard = z.infer<typeof ApplicationBoard>;

/** POST /applications body — either jobId (prefills + dedupes) or a manual entry. */
export const ApplicationCreateInput = z
  .object({
    jobId: z.string().optional(),
    company: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    url: z.string().url().optional(),
    salaryExpectation: z.string().optional(),
  })
  .refine((body) => body.jobId || (body.company && body.title && body.url), {
    message: 'either jobId, or company+title+url, must be provided',
  });
export type ApplicationCreateInput = z.infer<typeof ApplicationCreateInput>;

/** PATCH /applications/:id body — editable fields. */
export const ApplicationUpdateInput = z.object({
  company: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  url: z.string().url().optional(),
  nextActionAt: z.coerce.date().nullable().optional(),
  nextActionNote: z.string().nullable().optional(),
  salaryExpectation: z.string().nullable().optional(),
});
export type ApplicationUpdateInput = z.infer<typeof ApplicationUpdateInput>;

/** PATCH /applications/:id/stage body. */
export const ApplicationStagePatch = z.object({ stage: ApplicationStage });
export type ApplicationStagePatch = z.infer<typeof ApplicationStagePatch>;

/** POST /applications/:id/events body — stage_change events are server-generated only. */
export const ApplicationEventInput = z.object({
  kind: z.enum(['note', 'interview']),
  body: z.string().min(1),
  interviewKind: InterviewKind.optional(),
});
export type ApplicationEventInput = z.infer<typeof ApplicationEventInput>;

export const ApplicationFunnel = z.object({
  saved: z.number().int(),
  applied: z.number().int(),
  screening: z.number().int(),
  interviewing: z.number().int(),
  offer: z.number().int(),
  rejected: z.number().int(),
  withdrawn: z.number().int(),
});
export type ApplicationFunnel = z.infer<typeof ApplicationFunnel>;

/** GET /applications/stats response. */
export const ApplicationStats = z.object({
  funnel: ApplicationFunnel,
  /** Share of applied-or-further applications that got any response (screening+). Null if none applied yet. */
  responseRate: z.number().nullable(),
  interviewsThisWeek: z.number().int(),
  /** Average days since entering the current stage, across non-terminal applications. Null if none active. */
  avgDaysInStage: z.number().nullable(),
});
export type ApplicationStats = z.infer<typeof ApplicationStats>;
