import { Module } from '@nestjs/common';
import { CrawlModule } from './crawl/crawl.module';
import { HealthController } from './health.controller';
import { JobsModule } from './jobs/jobs.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [PrismaModule, CrawlModule, JobsModule, ProfileModule],
  controllers: [HealthController],
})
export class AppModule {}
