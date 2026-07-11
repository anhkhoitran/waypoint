import { Body, Controller, Get, Put } from '@nestjs/common';
import { ProfileInput } from '@waypoint/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  get() {
    return this.profileService.get();
  }

  @Put()
  update(@Body(new ZodValidationPipe(ProfileInput)) body: ProfileInput) {
    return this.profileService.update(body);
  }
}
