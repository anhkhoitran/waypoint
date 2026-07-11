import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtractService } from '../extract.service';

describe('ExtractService', () => {
  let queue: { add: ReturnType<typeof vi.fn> };
  let prisma: { job: { findMany: ReturnType<typeof vi.fn> } };
  let service: ExtractService;

  beforeEach(() => {
    queue = { add: vi.fn() };
    prisma = { job: { findMany: vi.fn() } };
    service = new ExtractService(queue as never, prisma as never);
  });

  describe('enqueue', () => {
    it('adds one queue job per id, with a jobId that dedupes retries', async () => {
      await service.enqueue(['a', 'b']);
      expect(queue.add).toHaveBeenCalledTimes(2);
      expect(queue.add).toHaveBeenCalledWith('extract', { jobId: 'a' }, { jobId: 'extract-a' });
      expect(queue.add).toHaveBeenCalledWith('extract', { jobId: 'b' }, { jobId: 'extract-b' });
    });

    it('does nothing for an empty list', async () => {
      await service.enqueue([]);
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('backfill', () => {
    it('queries for jobs with zero JobSkill rows and enqueues all of them', async () => {
      prisma.job.findMany.mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }]);

      const result = await service.backfill();

      expect(prisma.job.findMany).toHaveBeenCalledWith({
        where: { skills: { none: {} } },
        select: { id: true },
      });
      expect(queue.add).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ enqueued: 3 });
    });

    it('returns enqueued: 0 when every job already has skills', async () => {
      prisma.job.findMany.mockResolvedValue([]);
      const result = await service.backfill();
      expect(queue.add).not.toHaveBeenCalled();
      expect(result).toEqual({ enqueued: 0 });
    });
  });
});
