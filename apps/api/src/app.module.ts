import { Module } from '@nestjs/common';
import { CrawlModule } from './crawl/crawl.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, CrawlModule],
  controllers: [HealthController],
})
export class AppModule {}
