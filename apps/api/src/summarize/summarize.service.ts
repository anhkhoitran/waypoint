import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { CURRENT_SUMMARY_MODEL, SUMMARY_PROMPT_VERSION } from '@waypoint/job-summarizer';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { hashDescription } from './hash';
import { SUMMARIZE_QUEUE, type SummarizeJobData } from './summarize.processor';

@Injectable()
export class SummarizeService {
  private readonly logger = new Logger(SummarizeService.name);

  constructor(
    @InjectQueue(SUMMARIZE_QUEUE) private readonly queue: Queue<SummarizeJobData>,
    private readonly prisma: PrismaService,
  ) {}

  async enqueue(jobIds: string[]): Promise<void> {
    for (const jobId of jobIds) {
      await this.queue.add(
        'summarize',
        { jobId },
        {
          jobId: `summarize-${jobId}`,
          // Same reasoning as ExtractService: without removeOnComplete, a
          // job id that already ran once (in any state, including
          // "completed") can never be re-enqueued via BullMQ's add()
          // no-op-on-existing-id behavior — which would break backfill
          // re-runs after a promptVersion bump.
          removeOnComplete: true,
          removeOnFail: 50,
        },
      );
    }
    if (jobIds.length > 0) {
      this.logger.log(`enqueued summarization for ${jobIds.length} job(s)`);
    }
  }

  /**
   * Enqueues every non-hidden job whose summary is missing or stale
   * (model/promptVersion changed since, or the posting text itself changed
   * on re-crawl). Personal-scale dataset, so a full scan + in-process
   * staleness check is simpler and fine — same reasoning already applied to
   * JobsService's in-memory filtering.
   */
  async backfill(): Promise<{ enqueued: number }> {
    const jobs = await this.prisma.job.findMany({
      // Only relevant jobs get summarized — the processor also guards against
      // non-relevant jobs, but filtering here avoids queuing them at all.
      where: { hidden: false, relevant: true },
      select: {
        id: true,
        descriptionText: true,
        summary: { select: { model: true, promptVersion: true, sourceHash: true } },
      },
    });

    const stale = jobs.filter((job) => {
      if (!job.summary) return true;
      return (
        job.summary.model !== CURRENT_SUMMARY_MODEL ||
        job.summary.promptVersion !== SUMMARY_PROMPT_VERSION ||
        job.summary.sourceHash !== hashDescription(job.descriptionText)
      );
    });

    await this.enqueue(stale.map((job) => job.id));
    return { enqueued: stale.length };
  }
}
