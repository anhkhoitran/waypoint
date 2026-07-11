import type { CrawlRunSummary, NormalizedJob } from '@waypoint/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaJobStore } from '../prisma-job-store';

function makeJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    source: 'remoteok',
    externalId: '1',
    url: 'https://example.com/1',
    title: 'Engineer',
    company: 'Acme',
    location: 'Remote',
    workMode: 'remote',
    seniority: 'mid',
    salaryText: null,
    descriptionText: 'desc',
    tags: ['react'],
    postedAt: null,
    fetchedAt: new Date('2026-07-11T00:00:00Z'),
    dedupKey: 'key-1',
    ...overrides,
  };
}

describe('PrismaJobStore', () => {
  let prisma: {
    job: { findMany: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn> };
    crawlRun: { create: ReturnType<typeof vi.fn> };
  };
  let store: PrismaJobStore;

  beforeEach(() => {
    prisma = {
      job: { findMany: vi.fn(), createMany: vi.fn() },
      crawlRun: { create: vi.fn() },
    };
    store = new PrismaJobStore(prisma as never);
  });

  describe('existingKeys', () => {
    it('returns an empty set without querying when keys is empty', async () => {
      const result = await store.existingKeys([]);
      expect(result).toEqual(new Set());
      expect(prisma.job.findMany).not.toHaveBeenCalled();
    });

    it('queries by dedupKey and returns the matching keys as a Set', async () => {
      prisma.job.findMany.mockResolvedValue([{ dedupKey: 'a' }, { dedupKey: 'b' }]);
      const result = await store.existingKeys(['a', 'b', 'c']);
      expect(prisma.job.findMany).toHaveBeenCalledWith({
        where: { dedupKey: { in: ['a', 'b', 'c'] } },
        select: { dedupKey: true },
      });
      expect(result).toEqual(new Set(['a', 'b']));
    });
  });

  describe('saveJobs', () => {
    it('does nothing when given an empty array', async () => {
      await store.saveJobs([]);
      expect(prisma.job.createMany).not.toHaveBeenCalled();
    });

    it('maps NormalizedJob fields to Prisma create input with skipDuplicates', async () => {
      const job = makeJob();
      await store.saveJobs([job]);
      expect(prisma.job.createMany).toHaveBeenCalledWith({
        data: [
          {
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
          },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe('saveRun', () => {
    it('maps CrawlRunSummary fields to a CrawlRun create input', async () => {
      const summary: CrawlRunSummary = {
        source: 'remoteok',
        status: 'success',
        startedAt: new Date('2026-07-11T00:00:00Z'),
        finishedAt: new Date('2026-07-11T00:01:00Z'),
        jobsFound: 5,
        jobsNew: 5,
        jobsDuplicate: 0,
        errors: [],
      };
      await store.saveRun(summary);
      expect(prisma.crawlRun.create).toHaveBeenCalledWith({
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
    });
  });
});
