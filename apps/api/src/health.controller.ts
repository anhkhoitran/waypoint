import { Controller, Get } from '@nestjs/common';
import { JobSource } from '@waypoint/shared';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      phase: 0,
      knownSources: JobSource.options,
    };
  }
}
