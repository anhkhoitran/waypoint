import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RoadmapItemPatch } from '@waypoint/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RoadmapService } from './roadmap.service';

@Controller('roadmap')
export class RoadmapController {
  constructor(private readonly roadmapService: RoadmapService) {}

  @Get()
  list() {
    return this.roadmapService.list();
  }

  @Post('generate')
  generate() {
    return this.roadmapService.generate();
  }

  @Patch('items/:id')
  patchItem(@Param('id') id: string, @Body(new ZodValidationPipe(RoadmapItemPatch)) body: RoadmapItemPatch) {
    return this.roadmapService.patchItem(id, body.status);
  }
}
