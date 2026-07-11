import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CrawlPipeline } from '@waypoint/crawler-engine';
import type { JobSource } from '@waypoint/shared';
import type { Job } from 'bullmq';
import { ExtractService } from '../extract/extract.service';
import { PrismaService } from '../prisma/prisma.service';
import { REGISTERED_ADAPTERS } from './adapters';
import { PlaywrightBrowserProvider } from './playwright-browser-provider';
import { PrismaJobStore } from './prisma-job-store';

export const CRAWL_QUEUE = 'crawl';

export interface CrawlJobData {
  source: JobSource;
}

@Processor(CRAWL_QUEUE)
export class CrawlProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlProcessor.name);

  constructor(
    private readonly jobStore: PrismaJobStore,
    private readonly browserProvider: PlaywrightBrowserProvider,
    private readonly prisma: PrismaService,
    private readonly extractService: ExtractService,
  ) {
    super();
  }

  async process(job: Job<CrawlJobData>): Promise<void> {
    const { source } = job.data;
    const adapter = REGISTERED_ADAPTERS[source];
    if (!adapter) {
      throw new Error(`no adapter registered for source "${source}"`);
    }

    const pipeline = new CrawlPipeline(this.jobStore, undefined, undefined, this.browserProvider);
    this.logger.log(`starting crawl for ${source}`);
    const result = await pipeline.run(adapter);
    this.logger.log(
      `finished crawl for ${source}: ${result.summary.status}, ` +
        `${result.summary.jobsNew} new, ${result.summary.jobsDuplicate} duplicate, ` +
        `${result.summary.errors.length} errors`,
    );

    if (result.newJobs.length > 0) {
      const rows = await this.prisma.job.findMany({
        where: { dedupKey: { in: result.newJobs.map((j) => j.dedupKey) } },
        select: { id: true },
      });
      await this.extractService.enqueue(rows.map((r) => r.id));
    }
  }
}
