import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ExtractController } from './extract.controller';
import { EXTRACT_QUEUE, ExtractProcessor } from './extract.processor';
import { ExtractService } from './extract.service';

@Module({
  imports: [BullModule.registerQueue({ name: EXTRACT_QUEUE })],
  controllers: [ExtractController],
  providers: [ExtractService, ExtractProcessor],
  exports: [ExtractService],
})
export class ExtractModule {}
