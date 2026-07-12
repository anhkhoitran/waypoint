import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApplicationCreateInput,
  ApplicationEventInput,
  ApplicationStage,
  ApplicationStagePatch,
  ApplicationUpdateInput,
} from '@waypoint/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ApplicationsService } from './applications.service';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  list(@Query('stage') stage?: string) {
    if (stage) {
      return this.applicationsService.byStage(ApplicationStage.parse(stage));
    }
    return this.applicationsService.board();
  }

  @Get('stats')
  stats() {
    return this.applicationsService.stats();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.applicationsService.getOne(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(ApplicationCreateInput)) body: ApplicationCreateInput) {
    return this.applicationsService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(ApplicationUpdateInput)) body: ApplicationUpdateInput) {
    return this.applicationsService.update(id, body);
  }

  @Patch(':id/stage')
  updateStage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ApplicationStagePatch)) body: ApplicationStagePatch,
  ) {
    return this.applicationsService.updateStage(id, body.stage);
  }

  @Post(':id/events')
  addEvent(@Param('id') id: string, @Body(new ZodValidationPipe(ApplicationEventInput)) body: ApplicationEventInput) {
    return this.applicationsService.addEvent(id, body);
  }
}
