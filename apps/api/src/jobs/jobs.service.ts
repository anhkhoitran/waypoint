import { Injectable, NotFoundException } from '@nestjs/common';
import type { Job, JobSummary as PrismaJobSummary } from '@prisma/client';
import {
  JobSource,
  SeniorityLevel,
  WorkMode,
  matchScore,
  type FacetOption,
  type JobFacets,
  type JobListResponse,
  type JobPatch,
  type JobQuery,
  type JobRecord,
  type JobSummary,
  type MatchProfile,
} from '@waypoint/shared';
import { classifyRelevance } from '@waypoint/skill-extractor';
import { parseUsdMidpoint } from '../insights/insights.utils';
import { PrismaService } from '../prisma/prisma.service';

// Job listing filters/sorts entirely in application code against the full job
// set (see list() below) — this cap is just a sanity ceiling, not a real page
// size, at the scale a personal crawler produces.
const RESULT_CAP = 500;

type JobWithRelations = Job & {
  skills: Array<{ confidence: number; skill: { name: string } }>;
  summary: PrismaJobSummary | null;
};

type FacetGroup = 'source' | 'workMode' | 'seniority' | 'salary' | 'posted' | 'match';

function toSummaryRecord(row: PrismaJobSummary): JobSummary {
  return {
    summary: row.summary,
    responsibilities: row.responsibilities,
    requirements: row.requirements,
    niceToHave: row.niceToHave,
    benefits: row.benefits,
    roleFunction: row.roleFunction as JobSummary['roleFunction'],
    yearsExperienceMin: row.yearsExperienceMin,
    model: row.model,
    generatedAt: row.generatedAt,
  };
}

function toJobRecord(
  row: Job,
  matchResult?: JobRecord['matchScore'],
  summary?: PrismaJobSummary | null,
): JobRecord {
  return {
    id: row.id,
    source: row.sourceId as JobRecord['source'],
    externalId: row.externalId,
    url: row.url,
    title: row.title,
    company: row.company,
    location: row.location,
    workMode: row.workMode as JobRecord['workMode'],
    seniority: row.seniority as JobRecord['seniority'],
    salaryText: row.salaryText,
    descriptionText: row.descriptionText,
    tags: row.tags,
    postedAt: row.postedAt,
    fetchedAt: row.fetchedAt,
    dedupKey: row.dedupKey,
    saved: row.saved,
    hidden: row.hidden,
    matchScore: matchResult ?? null,
    summary: summary ? toSummaryRecord(summary) : null,
  };
}

function minutesAgo(postedAt: Date | null): number {
  return postedAt ? (Date.now() - postedAt.getTime()) / 60_000 : Infinity;
}

function salaryMidpoint(job: JobRecord): number | null {
  return job.salaryText ? parseUsdMidpoint(job.salaryText) : null;
}

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadAll(): Promise<JobRecord[]> {
    const rows = await this.prisma.job.findMany({
      // relevant: true drops non-SWE/IT postings (executive assistant,
      // marketing, etc.) from the whole Radar; classified deterministically
      // by the extract pipeline. hidden is the separate user-hide.
      where: { hidden: false, relevant: true },
      orderBy: [{ fetchedAt: 'desc' }, { id: 'desc' }],
      include: { skills: { include: { skill: true } }, summary: true },
    });

    const profile = await this.prisma.profile.findUnique({ where: { id: 'default' } });
    const matchProfile: MatchProfile | null = profile
      ? {
          skills: profile.skills,
          targetSeniority: profile.targetSeniority as MatchProfile['targetSeniority'],
          targetWorkModes: profile.targetWorkModes as MatchProfile['targetWorkModes'],
        }
      : null;

    return rows.map((row: JobWithRelations) => {
      const matchResult = matchProfile
        ? matchScore(
            matchProfile,
            row.skills.map((js) => ({ skill: js.skill.name, confidence: js.confidence })),
            row.seniority as JobRecord['seniority'],
            row.workMode as JobRecord['workMode'],
          )
        : null;
      return toJobRecord(row, matchResult, row.summary);
    });
  }

  /**
   * True if `job` satisfies every filter in `query` except `skip` (if given).
   * Used both for the actual filtered list (skip = undefined) and for facet
   * counts, where each candidate value is counted against every filter
   * *except* its own dimension — otherwise picking a source would zero out
   * the counts for every other source.
   */
  private matches(job: JobRecord, query: JobQuery, search: string, skip?: FacetGroup): boolean {
    if (search) {
      const haystack = `${job.title} ${job.company} ${job.tags.join(' ')}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (skip !== 'source' && query.source?.length && !query.source.includes(job.source)) return false;
    if (skip !== 'workMode' && query.workMode?.length && !query.workMode.includes(job.workMode)) return false;
    if (skip !== 'seniority' && query.seniority?.length && !query.seniority.includes(job.seniority)) {
      return false;
    }
    if (skip !== 'salary' && query.salary && query.salary !== 'any') {
      if (query.salary === 'has' && !job.salaryText) return false;
      if (query.salary === '100' && (salaryMidpoint(job) ?? -1) < 100_000) return false;
      if (query.salary === '150' && (salaryMidpoint(job) ?? -1) < 150_000) return false;
    }
    if (skip !== 'posted' && query.posted && query.posted !== 'any') {
      const limit = { '24h': 1440, week: 10080 }[query.posted];
      if (minutesAgo(job.postedAt) > limit) return false;
    }
    if (skip !== 'match' && query.match && query.match !== 'any') {
      if ((job.matchScore?.score ?? -1) < Number(query.match)) return false;
    }
    if (query.postedWithinDays && minutesAgo(job.postedAt) > query.postedWithinDays * 1440) return false;
    if (query.saved !== undefined && job.saved !== query.saved) return false;
    return true;
  }

  private sort(items: JobRecord[], sort: JobQuery['sort']): JobRecord[] {
    const sorted = [...items];
    if (sort === 'match') {
      sorted.sort((a, b) => (b.matchScore?.score ?? -1) - (a.matchScore?.score ?? -1));
    } else if (sort === 'salary') {
      sorted.sort((a, b) => {
        const ma = salaryMidpoint(a);
        const mb = salaryMidpoint(b);
        if (ma === null && mb === null) return 0;
        if (ma === null) return 1;
        if (mb === null) return -1;
        return mb - ma;
      });
    }
    // "newest" (the default) is already the loadAll() fetch order.
    return sorted;
  }

  private facets(all: JobRecord[], query: JobQuery, search: string): JobFacets {
    const countWhere = (skip: FacetGroup, test: (job: JobRecord) => boolean): number =>
      all.filter((job) => this.matches(job, query, search, skip) && test(job)).length;

    const option = (value: string, count: number): FacetOption => ({ value, count });

    return {
      sources: JobSource.options.map((v) => option(v, countWhere('source', (j) => j.source === v))),
      workModes: WorkMode.options.map((v) => option(v, countWhere('workMode', (j) => j.workMode === v))),
      seniorities: SeniorityLevel.options.map((v) =>
        option(v, countWhere('seniority', (j) => j.seniority === v)),
      ),
      salary: [
        option('has', countWhere('salary', (j) => !!j.salaryText)),
        option('100', countWhere('salary', (j) => (salaryMidpoint(j) ?? -1) >= 100_000)),
        option('150', countWhere('salary', (j) => (salaryMidpoint(j) ?? -1) >= 150_000)),
      ],
      posted: [
        option('24h', countWhere('posted', (j) => minutesAgo(j.postedAt) <= 1440)),
        option('week', countWhere('posted', (j) => minutesAgo(j.postedAt) <= 10080)),
      ],
      match: [
        option('40', countWhere('match', (j) => (j.matchScore?.score ?? -1) >= 40)),
        option('70', countWhere('match', (j) => (j.matchScore?.score ?? -1) >= 70)),
      ],
    };
  }

  async list(query: JobQuery): Promise<JobListResponse> {
    const all = await this.loadAll();
    const search = (query.q ?? '').trim().toLowerCase();

    const filtered = all.filter((job) => this.matches(job, query, search));
    const sorted = this.sort(filtered, query.sort ?? 'newest');
    const limit = Math.min(query.limit ?? RESULT_CAP, RESULT_CAP);

    return {
      items: sorted.slice(0, limit),
      facets: this.facets(all, query, search),
    };
  }

  async patch(id: string, body: JobPatch): Promise<JobRecord> {
    try {
      const updated = await this.prisma.job.update({
        where: { id },
        data: body,
        include: { summary: true },
      });
      return toJobRecord(updated, undefined, updated.summary);
    } catch {
      throw new NotFoundException(`job ${id} not found`);
    }
  }

  /**
   * Re-runs the deterministic SWE/IT relevance classifier over every existing
   * job and updates the stored flag — used to backfill jobs crawled before
   * relevance filtering existed, or after the classifier is tuned. No LLM,
   * so it's cheap to run over the whole table. Also drops any AI summaries
   * belonging to jobs that are now non-relevant, so the role-function chart
   * and drawer never surface a summary for a filtered-out job.
   */
  async reclassifyRelevance(): Promise<{ total: number; relevant: number; filtered: number }> {
    const jobs = await this.prisma.job.findMany({
      select: { id: true, title: true, descriptionText: true, tags: true },
    });

    let relevant = 0;
    for (const job of jobs) {
      const isRelevant = classifyRelevance(job.title, job.descriptionText, job.tags);
      if (isRelevant) relevant++;
      await this.prisma.job.update({ where: { id: job.id }, data: { relevant: isRelevant } });
    }

    await this.prisma.jobSummary.deleteMany({ where: { job: { relevant: false } } });

    return { total: jobs.length, relevant, filtered: jobs.length - relevant };
  }
}
