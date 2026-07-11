import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EXTRACT_QUEUE, type ExtractJobData } from './extract.processor';

@Injectable()
export class ExtractService {
  private readonly logger = new Logger(ExtractService.name);

  constructor(
    @InjectQueue(EXTRACT_QUEUE) private readonly queue: Queue<ExtractJobData>,
    private readonly prisma: PrismaService,
  ) {}

  async enqueue(jobIds: string[]): Promise<void> {
    for (const jobId of jobIds) {
      await this.queue.add(
        'extract',
        { jobId },
        {
          jobId: `extract-${jobId}`,
          // BullMQ treats add() as a no-op when a job with this id already
          // exists in Redis, in ANY state — including "completed". Without
          // removeOnComplete, a job that already ran once can never be
          // re-enqueued (backfill retry, manual re-extraction after a
          // taxonomy change), even after its Postgres JobSkill rows are
          // deleted. Clean up completed jobs immediately; keep a handful of
          // failures around for debugging.
          removeOnComplete: true,
          removeOnFail: 50,
        },
      );
    }
    if (jobIds.length > 0) {
      this.logger.log(`enqueued extraction for ${jobIds.length} job(s)`);
    }
  }

  /** Enqueues every job that has zero JobSkill rows — used for backfilling Phase 1 data. */
  async backfill(): Promise<{ enqueued: number }> {
    const jobs = await this.prisma.job.findMany({
      where: { skills: { none: {} } },
      select: { id: true },
    });
    await this.enqueue(jobs.map((j) => j.id));
    return { enqueued: jobs.length };
  }
}
