import { Controller, Post } from '@nestjs/common';
import { SummarizeService } from './summarize.service';

@Controller('summarize')
export class SummarizeController {
  constructor(private readonly summarizeService: SummarizeService) {}

  @Post('backfill')
  backfill() {
    return this.summarizeService.backfill();
  }
}
