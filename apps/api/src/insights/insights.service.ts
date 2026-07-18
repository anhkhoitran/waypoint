import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  RoleFunction,
  SeniorityLevel,
  WorkMode,
  type InsightsSkillDemandQuery,
  type InsightsSummary,
  type RoleFunctionSplitItem,
  type SalaryBySeniorityItem,
  type SkillDemandItem,
  type SkillTrendResponse,
  type TopCompanyItem,
  type VolumeBySourceResponse,
  type WorkModeSplitItem,
} from '@waypoint/shared';
import { REGISTERED_ADAPTERS } from '../crawl/adapters';
import { PrismaService } from '../prisma/prisma.service';
import {
  bucketIndex,
  computeBuckets,
  formatUsd,
  max,
  median,
  min,
  parseUsdMidpoint,
  parseWindowDays,
} from './insights.utils';

const GAP_LIMIT = 15;
const REGISTERED_SOURCES = Object.keys(REGISTERED_ADAPTERS);

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async skillDemand(filters: InsightsSkillDemandQuery): Promise<SkillDemandItem[]> {
    const windowDays = parseWindowDays(filters.window, 30);
    const since = new Date(Date.now() - windowDays * 86_400_000);

    const jobWhere: Prisma.JobWhereInput = { hidden: false, relevant: true, fetchedAt: { gte: since } };
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
          job: { hidden: false, relevant: true, fetchedAt: { gte: since } },
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
      where: { hidden: false, relevant: true, fetchedAt: { gte: since } },
    });

    const latestRuns = await Promise.all(
      REGISTERED_SOURCES.map((source) =>
        this.prisma.crawlRun.findFirst({ where: { sourceId: source }, orderBy: { finishedAt: 'desc' } }),
      ),
    );
    const sourcesHealthy = latestRuns.filter((r) => r?.status === 'success').length;

    const salaryRows = await this.prisma.job.findMany({
      where: { hidden: false, relevant: true, fetchedAt: { gte: since }, salaryText: { not: null } },
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

  async workModeSplit(window?: string): Promise<WorkModeSplitItem[]> {
    const windowDays = parseWindowDays(window, 30);
    const since = new Date(Date.now() - windowDays * 86_400_000);

    const grouped = await this.prisma.job.groupBy({
      by: ['workMode'],
      where: { hidden: false, relevant: true, fetchedAt: { gte: since } },
      _count: { workMode: true },
    });

    return WorkMode.options
      .map((workMode) => ({
        workMode,
        count: grouped.find((g) => g.workMode === workMode)?._count.workMode ?? 0,
      }))
      .filter((item) => item.count > 0);
  }

  /**
   * Distribution of parsed per-job salary midpoints within each seniority
   * bucket (not a single job's own posted range) — see parseUsdMidpoint.
   * Seniorities with no parseable salaries in the window are omitted.
   */
  async salaryBySeniority(window?: string): Promise<SalaryBySeniorityItem[]> {
    const windowDays = parseWindowDays(window, 30);
    const since = new Date(Date.now() - windowDays * 86_400_000);

    const results: SalaryBySeniorityItem[] = [];
    for (const seniority of SeniorityLevel.options) {
      const rows = await this.prisma.job.findMany({
        where: { hidden: false, relevant: true, fetchedAt: { gte: since }, seniority, salaryText: { not: null } },
        select: { salaryText: true },
      });
      const midpoints = rows
        .map((r) => (r.salaryText ? parseUsdMidpoint(r.salaryText) : null))
        .filter((v): v is number => v !== null);

      const medianValue = median(midpoints);
      const minValue = min(midpoints);
      const maxValue = max(midpoints);
      if (medianValue === null || minValue === null || maxValue === null) continue;

      results.push({ seniority, min: minValue, median: medianValue, max: maxValue, count: midpoints.length });
    }
    return results;
  }

  async volumeBySource(weeks = 8): Promise<VolumeBySourceResponse> {
    const { since, bucketMs, bucketCount, labels } = computeBuckets(weeks * 7, 'week');

    const series: Record<string, number[]> = {};
    for (const source of REGISTERED_SOURCES) series[source] = new Array(bucketCount).fill(0);

    const rows = await this.prisma.job.findMany({
      where: { hidden: false, relevant: true, sourceId: { in: REGISTERED_SOURCES }, fetchedAt: { gte: since } },
      select: { sourceId: true, fetchedAt: true },
    });

    for (const row of rows) {
      const idx = bucketIndex(row.fetchedAt, since, bucketMs, bucketCount);
      series[row.sourceId]![idx]!++;
    }

    return { buckets: labels, series };
  }

  async topCompanies(window?: string, limit = 6): Promise<TopCompanyItem[]> {
    const windowDays = parseWindowDays(window, 30);
    const since = new Date(Date.now() - windowDays * 86_400_000);

    const grouped = await this.prisma.job.groupBy({
      by: ['company'],
      where: { hidden: false, relevant: true, fetchedAt: { gte: since } },
      _count: { company: true },
      orderBy: { _count: { company: 'desc' } },
      take: limit,
    });

    return grouped.map((g) => ({ company: g.company, count: g._count.company }));
  }

  /**
   * Phase 5: role-function mix from LLM job summaries. Only jobs the
   * background summarizer has already reached contribute here — no
   * fabricated "unknown" bucket for the rest, they're simply absent until
   * summarized.
   */
  async roleFunctions(window?: string): Promise<RoleFunctionSplitItem[]> {
    const windowDays = parseWindowDays(window, 30);
    const since = new Date(Date.now() - windowDays * 86_400_000);

    const grouped = await this.prisma.jobSummary.groupBy({
      by: ['roleFunction'],
      where: { job: { hidden: false, relevant: true, fetchedAt: { gte: since } } },
      _count: { roleFunction: true },
    });

    return RoleFunction.options
      .map((roleFunction) => ({
        roleFunction,
        count: grouped.find((g) => g.roleFunction === roleFunction)?._count.roleFunction ?? 0,
      }))
      .filter((item) => item.count > 0);
  }
}
