import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ReviewGradeInput, ReviewQueueQuery } from '@waypoint/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ReviewService } from './review.service';

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('queue')
  queue(@Query(new ZodValidationPipe(ReviewQueueQuery)) query: ReviewQueueQuery) {
    return this.reviewService.queue(query.limit);
  }

  @Post('cards/:id/grade')
  grade(@Param('id') id: string, @Body(new ZodValidationPipe(ReviewGradeInput)) body: ReviewGradeInput) {
    return this.reviewService.grade(id, body.grade);
  }

  @Get('stats')
  stats() {
    return this.reviewService.stats();
  }
}
