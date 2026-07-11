import { Module } from '@nestjs/common';
import { CrawlModule } from './crawl/crawl.module';
import { HealthController } from './health.controller';
import { InsightsModule } from './insights/insights.module';
import { JobsModule } from './jobs/jobs.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { RoadmapModule } from './roadmap/roadmap.module';

@Module({
  imports: [PrismaModule, CrawlModule, JobsModule, ProfileModule, InsightsModule, RoadmapModule],
  controllers: [HealthController],
})
export class AppModule {}
