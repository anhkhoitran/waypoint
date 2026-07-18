import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SummarizeController } from './summarize.controller';
import { SUMMARIZE_QUEUE, SummarizeProcessor } from './summarize.processor';
import { SummarizeService } from './summarize.service';

@Module({
  imports: [BullModule.registerQueue({ name: SUMMARIZE_QUEUE })],
  controllers: [SummarizeController],
  providers: [SummarizeService, SummarizeProcessor],
  exports: [SummarizeService],
})
export class SummarizeModule {}
