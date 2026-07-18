import type {
  JobMatchBucket,
  JobPostedBucket,
  JobQuery,
  JobSalaryBucket,
  JobSource,
  SeniorityLevel,
  WorkMode,
} from '@waypoint/shared';

export interface RadarFilters {
  sources: JobSource[];
  workModes: WorkMode[];
  seniorities: SeniorityLevel[];
  salary: JobSalaryBucket;
  posted: JobPostedBucket;
  match: JobMatchBucket;
  savedOnly: boolean;
}

export const EMPTY_FILTERS: RadarFilters = {
  sources: [],
  workModes: [],
  seniorities: [],
  salary: 'any',
  posted: 'any',
  match: 'any',
  savedOnly: false,
};

export function toggleArrayValue<T extends string>(current: T[], value: T): T[] {
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

export function activeFilterCount(filters: RadarFilters): number {
  return (
    filters.sources.length +
    filters.workModes.length +
    filters.seniorities.length +
    (filters.salary !== 'any' ? 1 : 0) +
    (filters.posted !== 'any' ? 1 : 0) +
    (filters.match !== 'any' ? 1 : 0) +
    (filters.savedOnly ? 1 : 0)
  );
}

export function filtersToQuery(filters: RadarFilters): Partial<JobQuery> {
  return {
    source: filters.sources.length ? filters.sources : undefined,
    workMode: filters.workModes.length ? filters.workModes : undefined,
    seniority: filters.seniorities.length ? filters.seniorities : undefined,
    salary: filters.salary !== 'any' ? filters.salary : undefined,
    posted: filters.posted !== 'any' ? filters.posted : undefined,
    match: filters.match !== 'any' ? filters.match : undefined,
    saved: filters.savedOnly ? true : undefined,
  };
}

// "Vietnam" maps to itviec specifically — the only Vietnam-focused source
// with a working adapter today (topdev/vietnamworks are seeded but not yet
// crawled; see docs/plans/phase-1-crawler-and-job-feed.md).
export const RADAR_PRESETS: Array<{ labelKey: string; patch: Partial<RadarFilters> }> = [
  {
    labelKey: 'radar.presets.remoteSenior',
    patch: { workModes: ['remote'], seniorities: ['senior', 'lead'], salary: '150' },
  },
  { labelKey: 'radar.presets.vietnamOnsite', patch: { sources: ['itviec'], workModes: ['onsite'] } },
  { labelKey: 'radar.presets.highMatch', patch: { match: '70' } },
];
