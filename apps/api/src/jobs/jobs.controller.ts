import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { JobPatch, JobQuery } from '@waypoint/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(JobQuery)) query: JobQuery) {
    return this.jobsService.list(query);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body(new ZodValidationPipe(JobPatch)) body: JobPatch) {
    return this.jobsService.patch(id, body);
  }
}
