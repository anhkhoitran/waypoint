import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module';
import { ProfileModule } from '../profile/profile.module';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';

@Module({
  imports: [ProfileModule, InsightsModule],
  controllers: [RoadmapController],
  providers: [RoadmapService],
})
export class RoadmapModule {}
