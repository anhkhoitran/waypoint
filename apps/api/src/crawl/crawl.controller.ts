import { BadRequestException, Controller, Get, Post, Query } from '@nestjs/common';
import { JobSource } from '@waypoint/shared';
import { CrawlService } from './crawl.service';

@Controller('crawl')
export class CrawlController {
  constructor(private readonly crawlService: CrawlService) {}

  @Post('run')
  async run(@Query('source') source?: string) {
    let parsed: JobSource | undefined;
    if (source !== undefined) {
      const result = JobSource.safeParse(source);
      if (!result.success) {
        throw new BadRequestException(`invalid source "${source}"`);
      }
      parsed = result.data;
    }
    const enqueued = await this.crawlService.enqueue(parsed);
    return { enqueued };
  }

  @Get('runs')
  async runs(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 20;
    return this.crawlService.latestRuns(Number.isFinite(parsedLimit) ? parsedLimit : 20);
  }
}
