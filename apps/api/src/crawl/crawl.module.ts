import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CrawlController } from './crawl.controller';
import { CRAWL_QUEUE, CrawlProcessor } from './crawl.processor';
import { CrawlService } from './crawl.service';
import { PlaywrightBrowserProvider } from './playwright-browser-provider';
import { PrismaJobStore } from './prisma-job-store';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: () => {
        const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6380');
        return {
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port) || 6379,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: CRAWL_QUEUE }),
  ],
  controllers: [CrawlController],
  providers: [CrawlService, CrawlProcessor, PrismaJobStore, PlaywrightBrowserProvider],
})
export class CrawlModule {}
