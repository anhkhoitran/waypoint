import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  InsightsSkillDemandQuery,
  InsightsSummary,
  SkillDemandItem,
  SkillTrendResponse,
} from '@waypoint/shared';
import { REGISTERED_ADAPTERS } from '../crawl/adapters';
import { PrismaService } from '../prisma/prisma.service';
import { bucketIndex, computeBuckets, formatUsd, median, parseUsdMidpoint, parseWindowDays } from './insights.utils';

const GAP_LIMIT = 15;
const REGISTERED_SOURCES = Object.keys(REGISTERED_ADAPTERS);

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async skillDemand(filters: InsightsSkillDemandQuery): Promise<SkillDemandItem[]> {
    const windowDays = parseWindowDays(filters.window, 30);
    const since = new Date(Date.now() - windowDays * 86_400_000);

    const jobWhere: Prisma.JobWhereInput = { hidden: false, fetchedAt: { gte: since } };
    if (filters.seniority) jobWhere.seniority = filters.seniority;
    if (filters.source) jobWhere.sourceId = filters.source;

    const jobs = await this.prisma.job.findMany({ where: jobWhere, select: { id: true } });
    const jobIds = jobs.map((j) => j.id);
    const totalJobs = jobIds.length;
    if (totalJobs === 0) return [];

    const grouped = await this.prisma.jobSkill.groupBy({
      by: ['skillId'],
      where: { jobId: { in: jobIds } },
      _count: { jobId: true },
    });
    if (grouped.length === 0) return [];

    const skillRows = await this.prisma.skill.findMany({
      where: { id: { in: grouped.map((g) => g.skillId) } },
    });
    const skillById = new Map(skillRows.map((s) => [s.id, s]));

    return grouped
      .map((g) => {
        const skill = skillById.get(g.skillId);
        if (!skill) return null;
        return {
          skill: skill.name,
          category: skill.category,
          jobCount: g._count.jobId,
          share: g._count.jobId / totalJobs,
        };
      })
      .filter((x): x is SkillDemandItem => x !== null)
      .sort((a, b) => b.jobCount - a.jobCount);
  }

  async skillTrend(
    skillNames: string[],
    windowDays: number,
    bucketSize: 'day' | 'week',
  ): Promise<SkillTrendResponse> {
    const { since, bucketMs, bucketCount, labels } = computeBuckets(windowDays, bucketSize);

    const series: Record<string, number[]> = {};
    for (const name of skillNames) series[name] = new Array(bucketCount).fill(0);

    const skillRows = await this.prisma.skill.findMany({ where: { name: { in: skillNames } } });
    if (skillRows.length > 0) {
      const skillIdToName = new Map(skillRows.map((s) => [s.id, s.name]));
      const rows = await this.prisma.jobSkill.findMany({
        where: {
          skillId: { in: skillRows.map((s) => s.id) },
          job: { hidden: false, fetchedAt: { gte: since } },
        },
        select: { skillId: true, job: { select: { fetchedAt: true } } },
      });

      for (const row of rows) {
        const name = skillIdToName.get(row.skillId);
        if (!name || !series[name]) continue;
        const idx = bucketIndex(row.job.fetchedAt, since, bucketMs, bucketCount);
        series[name][idx]!++;
      }
    }

    return { buckets: labels, series };
  }

  /**
   * Top demanded skills the profile lacks. Response shape feeds Phase 3's
   * roadmap generator — keep `skill`/`category`/`jobCount`/`share` stable.
   */
  async gap(): Promise<SkillDemandItem[]> {
    const profile = await this.prisma.profile.findUnique({ where: { id: 'default' } });
    const profileSkills = new Set(profile?.skills ?? []);
    const demand = await this.skillDemand({});
    return demand.filter((d) => !profileSkills.has(d.skill)).slice(0, GAP_LIMIT);
  }

  async summary(): Promise<InsightsSummary> {
    const windowDays = 30;
    const since = new Date(Date.now() - windowDays * 86_400_000);

    const jobsInWindow = await this.prisma.job.count({
      where: { hidden: false, fetchedAt: { gte: since } },
    });

    const latestRuns = await Promise.all(
      REGISTERED_SOURCES.map((source) =>
        this.prisma.crawlRun.findFirst({ where: { sourceId: source }, orderBy: { finishedAt: 'desc' } }),
      ),
    );
    const sourcesHealthy = latestRuns.filter((r) => r?.status === 'success').length;

    const salaryRows = await this.prisma.job.findMany({
      where: { hidden: false, fetchedAt: { gte: since }, salaryText: { not: null } },
      select: { salaryText: true },
    });
    const midpoints = salaryRows
      .map((r) => (r.salaryText ? parseUsdMidpoint(r.salaryText) : null))
      .filter((v): v is number => v !== null);
    const medianValue = median(midpoints);

    const gapSkills = await this.gap();

    return {
      jobsInWindow,
      sourcesHealthy,
      sourcesTotal: REGISTERED_SOURCES.length,
      medianSalary: medianValue !== null ? formatUsd(medianValue) : null,
      topGapSkills: gapSkills.slice(0, 3).map((g) => g.skill),
    };
  }
}
