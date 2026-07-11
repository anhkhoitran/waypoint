import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { JobSource } from '@waypoint/shared';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { REGISTERED_ADAPTERS } from './adapters';
import { CRAWL_QUEUE, type CrawlJobData } from './crawl.processor';

const ALL_REGISTERED_SOURCES = Object.keys(REGISTERED_ADAPTERS) as JobSource[];
const CRON_SCHEDULE = '0 */6 * * *';

@Injectable()
export class CrawlService implements OnModuleInit {
  private readonly logger = new Logger(CrawlService.name);

  constructor(
    @InjectQueue(CRAWL_QUEUE) private readonly queue: Queue<CrawlJobData>,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.logger.log(
      `scheduled crawl registered: "${CRON_SCHEDULE}" (every 6h) for sources: ${ALL_REGISTERED_SOURCES.join(', ')}`,
    );
  }

  /** Enqueues one crawl job per enabled, adapter-registered source. Returns what was enqueued. */
  async enqueue(source?: JobSource): Promise<JobSource[]> {
    const candidates = source ? [source] : ALL_REGISTERED_SOURCES;

    const enabled = await this.prisma.source.findMany({
      where: { id: { in: candidates }, enabled: true },
      select: { id: true },
    });
    const enabledIds = new Set(enabled.map((s) => s.id));

    const toEnqueue = candidates.filter((s) => enabledIds.has(s) && REGISTERED_ADAPTERS[s]);
    for (const s of toEnqueue) {
      await this.queue.add('crawl', { source: s }, { jobId: `${s}-${Date.now()}` });
    }
    this.logger.log(`enqueued crawl for: ${toEnqueue.join(', ') || '(none)'}`);
    return toEnqueue;
  }

  @Cron(CRON_SCHEDULE)
  async scheduledCrawl(): Promise<void> {
    this.logger.log('running scheduled crawl (every 6h)');
    await this.enqueue();
  }

  /** Most recent CrawlRun per registered source, for the source health panel. */
  async latestRuns(limit = 20) {
    const runs = await Promise.all(
      ALL_REGISTERED_SOURCES.map((source) =>
        this.prisma.crawlRun.findFirst({
          where: { sourceId: source },
          orderBy: { finishedAt: 'desc' },
        }),
      ),
    );
    return runs.filter((r): r is NonNullable<typeof r> => r !== null).slice(0, limit);
  }
}
