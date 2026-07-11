import { Injectable, NotFoundException } from '@nestjs/common';
import type { Profile as ProfileRow } from '@prisma/client';
import type { Profile, ProfileInput } from '@waypoint/shared';
import { PrismaService } from '../prisma/prisma.service';

const PROFILE_ID = 'default';

function toProfile(record: ProfileRow): Profile {
  return {
    id: record.id,
    skills: record.skills,
    yearsOfExperience: record.yearsOfExperience,
    targetSeniority: record.targetSeniority as Profile['targetSeniority'],
    targetWorkModes: record.targetWorkModes as Profile['targetWorkModes'],
    locations: record.locations,
  };
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<Profile> {
    const record = await this.prisma.profile.findUnique({ where: { id: PROFILE_ID } });
    if (!record) {
      throw new NotFoundException('profile has not been seeded yet');
    }
    return toProfile(record);
  }

  async update(input: ProfileInput): Promise<Profile> {
    const record = await this.prisma.profile.upsert({
      where: { id: PROFILE_ID },
      update: input,
      create: { id: PROFILE_ID, ...input },
    });
    return toProfile(record);
  }
}
