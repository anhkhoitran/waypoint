import { Injectable, NotFoundException } from '@nestjs/common';
import type { Application, ApplicationEvent, Job } from '@prisma/client';
import {
  matchScore,
  type ApplicationBoard,
  type ApplicationCreateInput,
  type ApplicationEventInput,
  type ApplicationEventRecord,
  type ApplicationRecord,
  type ApplicationStage,
  type ApplicationStats,
  type ApplicationUpdateInput,
  type MatchProfile,
} from '@waypoint/shared';
import { PrismaService } from '../prisma/prisma.service';

const STAGES: ApplicationStage[] = [
  'saved',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
];
const TERMINAL_STAGES: ApplicationStage[] = ['rejected', 'withdrawn'];
const RESPONDED_STAGES: ApplicationStage[] = ['screening', 'interviewing', 'offer', 'rejected'];

type JobWithSkills = Job & { skills: Array<{ confidence: number; skill: { name: string } }> };

function toEventRecord(row: ApplicationEvent): ApplicationEventRecord {
  return {
    id: row.id,
    applicationId: row.applicationId,
    kind: row.kind as ApplicationEventRecord['kind'],
    body: row.body,
    interviewKind: row.interviewKind as ApplicationEventRecord['interviewKind'],
    occurredAt: row.occurredAt,
  };
}

function toApplicationRecord(
  row: Application,
  matchResult: ApplicationRecord['matchScore'] = null,
  events?: ApplicationEvent[],
): ApplicationRecord {
  return {
    id: row.id,
    jobId: row.jobId,
    company: row.company,
    title: row.title,
    url: row.url,
    stage: row.stage as ApplicationStage,
    appliedAt: row.appliedAt,
    nextActionAt: row.nextActionAt,
    nextActionNote: row.nextActionNote,
    salaryExpectation: row.salaryExpectation,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    matchScore: matchResult,
    events: events?.map(toEventRecord),
  };
}

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Match scores for a set of linked jobs, computed once against the current profile. */
  private async matchScoresForJobs(jobIds: string[]): Promise<Map<string, ApplicationRecord['matchScore']>> {
    const result = new Map<string, ApplicationRecord['matchScore']>();
    if (jobIds.length === 0) return result;

    const profile = await this.prisma.profile.findUnique({ where: { id: 'default' } });
    const matchProfile: MatchProfile | null = profile
      ? {
          skills: profile.skills,
          targetSeniority: profile.targetSeniority as MatchProfile['targetSeniority'],
          targetWorkModes: profile.targetWorkModes as MatchProfile['targetWorkModes'],
        }
      : null;
    if (!matchProfile) return result;

    const jobs = (await this.prisma.job.findMany({
      where: { id: { in: jobIds } },
      include: { skills: { include: { skill: true } } },
    })) as JobWithSkills[];

    for (const job of jobs) {
      const score = matchScore(
        matchProfile,
        job.skills.map((js) => ({ skill: js.skill.name, confidence: js.confidence })),
        job.seniority as never,
        job.workMode as never,
      );
      result.set(job.id, score);
    }
    return result;
  }

  async board(): Promise<ApplicationBoard> {
    const rows = await this.prisma.application.findMany({ orderBy: { updatedAt: 'desc' } });
    const jobIds = rows.map((r) => r.jobId).filter((id): id is string => id !== null);
    const scores = await this.matchScoresForJobs(jobIds);

    const empty = Object.fromEntries(
      STAGES.map((s) => [s, [] as ApplicationRecord[]]),
    ) as unknown as ApplicationBoard;
    for (const row of rows) {
      const record = toApplicationRecord(row, row.jobId ? (scores.get(row.jobId) ?? null) : null);
      empty[record.stage].push(record);
    }
    return empty;
  }

  async byStage(stage: ApplicationStage): Promise<ApplicationRecord[]> {
    const rows = await this.prisma.application.findMany({
      where: { stage },
      orderBy: { updatedAt: 'desc' },
    });
    const jobIds = rows.map((r) => r.jobId).filter((id): id is string => id !== null);
    const scores = await this.matchScoresForJobs(jobIds);
    return rows.map((row) => toApplicationRecord(row, row.jobId ? (scores.get(row.jobId) ?? null) : null));
  }

  async getOne(id: string): Promise<ApplicationRecord> {
    const row = await this.prisma.application.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`application ${id} not found`);
    const events = await this.prisma.applicationEvent.findMany({
      where: { applicationId: id },
      orderBy: { occurredAt: 'desc' },
    });
    const scores = row.jobId ? await this.matchScoresForJobs([row.jobId]) : new Map();
    return toApplicationRecord(row, row.jobId ? (scores.get(row.jobId) ?? null) : null, events);
  }

  /** Creates a manual entry, or (jobId given) an idempotent "track this job" action. */
  async create(input: ApplicationCreateInput): Promise<ApplicationRecord> {
    if (input.jobId) {
      const existing = await this.prisma.application.findUnique({ where: { jobId: input.jobId } });
      if (existing) return this.getOne(existing.id);

      const job = await this.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new NotFoundException(`job ${input.jobId} not found`);

      const row = await this.prisma.application.create({
        data: {
          jobId: job.id,
          company: job.company,
          title: job.title,
          url: job.url,
          salaryExpectation: input.salaryExpectation,
        },
      });
      return this.getOne(row.id);
    }

    const row = await this.prisma.application.create({
      data: {
        company: input.company!,
        title: input.title!,
        url: input.url!,
        salaryExpectation: input.salaryExpectation,
      },
    });
    return this.getOne(row.id);
  }

  async update(id: string, input: ApplicationUpdateInput): Promise<ApplicationRecord> {
    await this.ensureExists(id);
    await this.prisma.application.update({ where: { id }, data: input });
    return this.getOne(id);
  }

  async updateStage(id: string, stage: ApplicationStage): Promise<ApplicationRecord> {
    const current = await this.ensureExists(id);

    await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id },
        data: {
          stage,
          appliedAt: current.appliedAt === null && stage !== 'saved' ? new Date() : undefined,
        },
      }),
      this.prisma.applicationEvent.create({
        data: {
          applicationId: id,
          kind: 'stage_change',
          body: `Moved from ${current.stage} to ${stage}`,
        },
      }),
    ]);

    return this.getOne(id);
  }

  async addEvent(id: string, input: ApplicationEventInput): Promise<ApplicationEventRecord> {
    await this.ensureExists(id);
    const row = await this.prisma.applicationEvent.create({
      data: {
        applicationId: id,
        kind: input.kind,
        body: input.body,
        interviewKind: input.interviewKind,
      },
    });
    return toEventRecord(row);
  }

  async stats(): Promise<ApplicationStats> {
    const funnelGroups = await this.prisma.application.groupBy({ by: ['stage'], _count: { _all: true } });
    const funnelCounts = new Map(funnelGroups.map((g) => [g.stage, g._count._all]));
    const funnel = Object.fromEntries(STAGES.map((s) => [s, funnelCounts.get(s) ?? 0])) as ApplicationStats['funnel'];

    const appliedOrFurther = STAGES.filter((s) => s !== 'saved').reduce((n, s) => n + (funnelCounts.get(s) ?? 0), 0);
    const responded = RESPONDED_STAGES.reduce((n, s) => n + (funnelCounts.get(s) ?? 0), 0);
    const responseRate = appliedOrFurther > 0 ? responded / appliedOrFurther : null;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const interviewsThisWeek = await this.prisma.applicationEvent.count({
      where: { kind: 'interview', occurredAt: { gte: weekAgo } },
    });

    const active = await this.prisma.application.findMany({
      where: { stage: { notIn: TERMINAL_STAGES } },
      select: { id: true, createdAt: true },
    });
    let avgDaysInStage: number | null = null;
    if (active.length > 0) {
      const lastStageChanges = await this.prisma.applicationEvent.findMany({
        where: { applicationId: { in: active.map((a) => a.id) }, kind: 'stage_change' },
        orderBy: { occurredAt: 'desc' },
      });
      const latestByApp = new Map<string, Date>();
      for (const event of lastStageChanges) {
        if (!latestByApp.has(event.applicationId)) latestByApp.set(event.applicationId, event.occurredAt);
      }
      const now = Date.now();
      const daysList = active.map((a) => {
        const since = latestByApp.get(a.id) ?? a.createdAt;
        return (now - since.getTime()) / 86_400_000;
      });
      avgDaysInStage = daysList.reduce((sum, d) => sum + d, 0) / daysList.length;
    }

    return { funnel, responseRate, interviewsThisWeek, avgDaysInStage };
  }

  private async ensureExists(id: string): Promise<Application> {
    const row = await this.prisma.application.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`application ${id} not found`);
    return row;
  }
}
