import { CURRENT_SUMMARY_MODEL, SUMMARY_PROMPT_VERSION } from '@waypoint/job-summarizer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashDescription } from '../hash';
import { SummarizeService } from '../summarize.service';

describe('SummarizeService', () => {
  let queue: { add: ReturnType<typeof vi.fn> };
  let prisma: { job: { findMany: ReturnType<typeof vi.fn> } };
  let service: SummarizeService;

  beforeEach(() => {
    queue = { add: vi.fn() };
    prisma = { job: { findMany: vi.fn() } };
    service = new SummarizeService(queue as never, prisma as never);
  });

  describe('enqueue', () => {
    it('adds one queue job per id, with a jobId that dedupes retries', async () => {
      await service.enqueue(['a', 'b']);
      expect(queue.add).toHaveBeenCalledTimes(2);
      expect(queue.add).toHaveBeenCalledWith(
        'summarize',
        { jobId: 'a' },
        { jobId: 'summarize-a', removeOnComplete: true, removeOnFail: 50 },
      );
    });

    it('does nothing for an empty list', async () => {
      await service.enqueue([]);
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('backfill', () => {
    it('enqueues jobs with no summary at all', async () => {
      prisma.job.findMany.mockResolvedValue([
        { id: '1', descriptionText: 'text', summary: null },
        { id: '2', descriptionText: 'text', summary: null },
      ]);

      const result = await service.backfill();

      expect(queue.add).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ enqueued: 2 });
    });

    it('skips a job whose summary already matches model + promptVersion + sourceHash', async () => {
      prisma.job.findMany.mockResolvedValue([
        {
          id: '1',
          descriptionText: 'stable text',
          summary: {
            model: CURRENT_SUMMARY_MODEL,
            promptVersion: SUMMARY_PROMPT_VERSION,
            sourceHash: hashDescription('stable text'),
          },
        },
      ]);

      const result = await service.backfill();

      expect(queue.add).not.toHaveBeenCalled();
      expect(result).toEqual({ enqueued: 0 });
    });

    it('re-enqueues a job whose promptVersion is stale', async () => {
      prisma.job.findMany.mockResolvedValue([
        {
          id: '1',
          descriptionText: 'stable text',
          summary: {
            model: CURRENT_SUMMARY_MODEL,
            promptVersion: SUMMARY_PROMPT_VERSION - 1,
            sourceHash: hashDescription('stable text'),
          },
        },
      ]);

      const result = await service.backfill();

      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ enqueued: 1 });
    });

    it('re-enqueues a job whose posting text changed since it was summarized', async () => {
      prisma.job.findMany.mockResolvedValue([
        {
          id: '1',
          descriptionText: 'updated text',
          summary: {
            model: CURRENT_SUMMARY_MODEL,
            promptVersion: SUMMARY_PROMPT_VERSION,
            sourceHash: hashDescription('old text'),
          },
        },
      ]);

      const result = await service.backfill();

      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ enqueued: 1 });
    });

    it('re-enqueues a job summarized by a different model', async () => {
      prisma.job.findMany.mockResolvedValue([
        {
          id: '1',
          descriptionText: 'stable text',
          summary: {
            model: 'some-other-model',
            promptVersion: SUMMARY_PROMPT_VERSION,
            sourceHash: hashDescription('stable text'),
          },
        },
      ]);

      const result = await service.backfill();

      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ enqueued: 1 });
    });

    it('only queries non-hidden, SWE/IT-relevant jobs', async () => {
      prisma.job.findMany.mockResolvedValue([]);
      await service.backfill();
      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { hidden: false, relevant: true } }),
      );
    });
  });
});
