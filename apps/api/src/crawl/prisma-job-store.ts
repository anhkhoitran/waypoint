import { Injectable } from '@nestjs/common';
import type { JobStore } from '@waypoint/crawler-engine';
import type { CrawlRunSummary, NormalizedJob } from '@waypoint/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaJobStore implements JobStore {
  constructor(private readonly prisma: PrismaService) {}

  async existingKeys(keys: string[]): Promise<Set<string>> {
    if (keys.length === 0) return new Set();
    const rows = await this.prisma.job.findMany({
      where: { dedupKey: { in: keys } },
      select: { dedupKey: true },
    });
    return new Set(rows.map((r) => r.dedupKey));
  }

  async saveJobs(jobs: NormalizedJob[]): Promise<void> {
    if (jobs.length === 0) return;
    await this.prisma.job.createMany({
      data: jobs.map((job) => ({
        sourceId: job.source,
        externalId: job.externalId,
        url: job.url,
        title: job.title,
        company: job.company,
        location: job.location,
        workMode: job.workMode,
        seniority: job.seniority,
        salaryText: job.salaryText,
        descriptionText: job.descriptionText,
        tags: job.tags,
        postedAt: job.postedAt,
        fetchedAt: job.fetchedAt,
        dedupKey: job.dedupKey,
      })),
      skipDuplicates: true,
    });
  }

  async saveRun(summary: CrawlRunSummary): Promise<void> {
    await this.prisma.crawlRun.create({
      data: {
        sourceId: summary.source,
        status: summary.status,
        startedAt: summary.startedAt,
        finishedAt: summary.finishedAt,
        jobsFound: summary.jobsFound,
        jobsNew: summary.jobsNew,
        jobsDuplicate: summary.jobsDuplicate,
        errors: summary.errors,
      },
    });
  }
}
