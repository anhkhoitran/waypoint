import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ProfileInput } from '@waypoint/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { checkE2eServicesAvailable } from './e2e-helpers';

const servicesAvailable = await checkE2eServicesAvailable();

describe.skipIf(!servicesAvailable)('Profile API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let originalProfile: ProfileInput;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    // Snapshot the real singleton profile so this suite can restore it —
    // there's only one row, and it's the same one the web app will use.
    const existing = await prisma.profile.findUniqueOrThrow({ where: { id: 'default' } });
    originalProfile = {
      skills: existing.skills,
      yearsOfExperience: existing.yearsOfExperience,
      targetSeniority: existing.targetSeniority as ProfileInput['targetSeniority'],
      targetWorkModes: existing.targetWorkModes as ProfileInput['targetWorkModes'],
      locations: existing.locations,
    };
  });

  afterAll(async () => {
    await prisma.profile.update({ where: { id: 'default' }, data: originalProfile });
    await app.close();
  });

  it('GET /profile returns the seeded profile', async () => {
    const res = await request(app.getHttpServer()).get('/profile');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('default');
    expect(Array.isArray(res.body.skills)).toBe(true);
  });

  it('PUT /profile updates and returns the new profile', async () => {
    const res = await request(app.getHttpServer())
      .put('/profile')
      .send({
        skills: ['react', 'aws'],
        yearsOfExperience: 5,
        targetSeniority: 'senior',
        targetWorkModes: ['remote'],
        locations: ['Remote'],
      });

    expect(res.status).toBe(200);
    expect(res.body.skills).toEqual(['react', 'aws']);
    expect(res.body.yearsOfExperience).toBe(5);
    expect(res.body.targetSeniority).toBe('senior');
  });

  it('rejects a skill that is not in the taxonomy with 400', async () => {
    const res = await request(app.getHttpServer())
      .put('/profile')
      .send({
        skills: ['react', 'cobol-mainframe-wizardry'],
        yearsOfExperience: 3,
        targetSeniority: 'mid',
        targetWorkModes: ['remote'],
        locations: [],
      });

    expect(res.status).toBe(400);
  });

  it('rejects an invalid targetSeniority with 400', async () => {
    const res = await request(app.getHttpServer())
      .put('/profile')
      .send({
        skills: ['react'],
        yearsOfExperience: 3,
        targetSeniority: 'godlike',
        targetWorkModes: ['remote'],
        locations: [],
      });

    expect(res.status).toBe(400);
  });
});
