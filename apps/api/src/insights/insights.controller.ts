import { Controller, Get, Query } from '@nestjs/common';
import { InsightsSkillDemandQuery, InsightsSkillTrendQuery } from '@waypoint/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { InsightsService } from './insights.service';
import { parseWindowDays } from './insights.utils';

@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('skill-demand')
  skillDemand(@Query(new ZodValidationPipe(InsightsSkillDemandQuery)) query: InsightsSkillDemandQuery) {
    return this.insightsService.skillDemand(query);
  }

  @Get('skill-trend')
  skillTrend(@Query(new ZodValidationPipe(InsightsSkillTrendQuery)) query: InsightsSkillTrendQuery) {
    const skills = query.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const windowDays = parseWindowDays(query.window, 90);
    return this.insightsService.skillTrend(skills, windowDays, query.bucket ?? 'week');
  }

  @Get('gap')
  gap() {
    return this.insightsService.gap();
  }

  @Get('summary')
  summary() {
    return this.insightsService.summary();
  }
}
