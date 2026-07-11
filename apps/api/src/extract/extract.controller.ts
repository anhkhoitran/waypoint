import { Controller, Post } from '@nestjs/common';
import { ExtractService } from './extract.service';

@Controller('extract')
export class ExtractController {
  constructor(private readonly extractService: ExtractService) {}

  @Post('backfill')
  backfill() {
    return this.extractService.backfill();
  }
}
