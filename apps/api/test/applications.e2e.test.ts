import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { checkE2eServicesAvailable } from './e2e-helpers';

const servicesAvailable = await checkE2eServicesAvailable();

describe.skipIf(!servicesAvailable)('Applications API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const applicationIds: string[] = [];
  let testJobId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const job = await prisma.job.create({
      data: {
        sourceId: 'remoteok',
        externalId: `e2e-app-test-${Date.now()}`,
        url: 'https://example.com/e2e-app-job',
        title: 'e2e Test Engineer',
        company: 'e2e Test Co',
        workMode: 'remote',
        seniority: 'mid',
        descriptionText: 'test job for applications e2e',
        tags: [],
        fetchedAt: new Date(),
        dedupKey: `e2e-app-test-dedupkey-${Date.now()}`,
      },
    });
    testJobId = job.id;
  });

  afterAll(async () => {
    await prisma.applicationEvent.deleteMany({ where: { applicationId: { in: applicationIds } } });
    await prisma.application.deleteMany({ where: { id: { in: applicationIds } } });
    await prisma.job.delete({ where: { id: testJobId } });
    await app.close();
  });

  describe('POST /applications', () => {
    it('creates a manual application at stage "saved"', async () => {
      const res = await request(app.getHttpServer())
        .post('/applications')
        .send({ company: 'Manual Co', title: 'Manual Role', url: 'https://example.com/manual' });

      expect(res.status).toBe(201);
      expect(res.body.stage).toBe('saved');
      expect(res.body.jobId).toBeNull();
      applicationIds.push(res.body.id);
    });

    it('rejects a body with neither jobId nor company/title/url', async () => {
      const res = await request(app.getHttpServer()).post('/applications').send({});
      expect(res.status).toBe(400);
    });

    it('creates from a job, prefilling company/title/url', async () => {
      const res = await request(app.getHttpServer()).post('/applications').send({ jobId: testJobId });
      expect(res.status).toBe(201);
      expect(res.body.jobId).toBe(testJobId);
      expect(res.body.company).toBe('e2e Test Co');
      expect(res.body.title).toBe('e2e Test Engineer');
      applicationIds.push(res.body.id);
    });

    it('is idempotent: tracking the same job twice returns the same application', async () => {
      const first = await request(app.getHttpServer()).post('/applications').send({ jobId: testJobId });
      const second = await request(app.getHttpServer()).post('/applications').send({ jobId: testJobId });
      expect(first.body.id).toBe(second.body.id);
    });
  });

  describe('PATCH /applications/:id/stage', () => {
    it('transitions stage and writes a stage_change event atomically', async () => {
      const created = await request(app.getHttpServer())
        .post('/applications')
        .send({ company: 'Stage Co', title: 'Stage Role', url: 'https://example.com/stage' });
      const id = created.body.id;
      applicationIds.push(id);

      const res = await request(app.getHttpServer()).patch(`/applications/${id}/stage`).send({ stage: 'applied' });
      expect(res.status).toBe(200);
      expect(res.body.stage).toBe('applied');
      expect(res.body.appliedAt).not.toBeNull();

      const detail = await request(app.getHttpServer()).get(`/applications/${id}`);
      const stageChangeEvents = detail.body.events.filter((e: { kind: string }) => e.kind === 'stage_change');
      expect(stageChangeEvents).toHaveLength(1);
      expect(stageChangeEvents[0].body).toContain('saved');
      expect(stageChangeEvents[0].body).toContain('applied');
    });

    it('only sets appliedAt on the first transition out of saved, not subsequent ones', async () => {
      const created = await request(app.getHttpServer())
        .post('/applications')
        .send({ company: 'Stage2 Co', title: 'Stage2 Role', url: 'https://example.com/stage2' });
      const id = created.body.id;
      applicationIds.push(id);

      const afterApplied = await request(app.getHttpServer()).patch(`/applications/${id}/stage`).send({ stage: 'applied' });
      const firstAppliedAt = afterApplied.body.appliedAt;

      const afterScreening = await request(app.getHttpServer())
        .patch(`/applications/${id}/stage`)
        .send({ stage: 'screening' });
      expect(afterScreening.body.appliedAt).toBe(firstAppliedAt);
    });

    it('404s for an unknown application id', async () => {
      const res = await request(app.getHttpServer()).patch('/applications/does-not-exist/stage').send({ stage: 'applied' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /applications/:id/events', () => {
    it('adds a note event and it appears newest-first in the detail view', async () => {
      const created = await request(app.getHttpServer())
        .post('/applications')
        .send({ company: 'Notes Co', title: 'Notes Role', url: 'https://example.com/notes' });
      const id = created.body.id;
      applicationIds.push(id);

      await request(app.getHttpServer()).post(`/applications/${id}/events`).send({ kind: 'note', body: 'first note' });
      await new Promise((r) => setTimeout(r, 5));
      await request(app.getHttpServer())
        .post(`/applications/${id}/events`)
        .send({ kind: 'interview', body: 'phone screen', interviewKind: 'phone' });

      const detail = await request(app.getHttpServer()).get(`/applications/${id}`);
      expect(detail.body.events[0].body).toBe('phone screen');
      expect(detail.body.events[0].interviewKind).toBe('phone');
      expect(detail.body.events[1].body).toBe('first note');
    });
  });

  describe('GET /applications', () => {
    it('board groups applications into all 7 stage columns', async () => {
      const res = await request(app.getHttpServer()).get('/applications');
      expect(res.status).toBe(200);
      for (const stage of ['saved', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn']) {
        expect(Array.isArray(res.body[stage])).toBe(true);
      }
    });

    it('?stage= filters to just that column', async () => {
      const res = await request(app.getHttpServer()).get('/applications?stage=saved');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const app_ of res.body) expect(app_.stage).toBe('saved');
    });
  });

  describe('GET /applications/stats', () => {
    it('funnel counts move by exactly the fixture delta (robust to other real applications)', async () => {
      const before = await request(app.getHttpServer()).get('/applications/stats');

      const savedRes = await request(app.getHttpServer())
        .post('/applications')
        .send({ company: 'Stats A', title: 'A', url: 'https://example.com/stats-a' });
      applicationIds.push(savedRes.body.id);

      const appliedRes = await request(app.getHttpServer())
        .post('/applications')
        .send({ company: 'Stats B', title: 'B', url: 'https://example.com/stats-b' });
      applicationIds.push(appliedRes.body.id);
      await request(app.getHttpServer()).patch(`/applications/${appliedRes.body.id}/stage`).send({ stage: 'applied' });

      const rejectedRes = await request(app.getHttpServer())
        .post('/applications')
        .send({ company: 'Stats C', title: 'C', url: 'https://example.com/stats-c' });
      applicationIds.push(rejectedRes.body.id);
      await request(app.getHttpServer()).patch(`/applications/${rejectedRes.body.id}/stage`).send({ stage: 'applied' });
      await request(app.getHttpServer()).patch(`/applications/${rejectedRes.body.id}/stage`).send({ stage: 'rejected' });

      const after = await request(app.getHttpServer()).get('/applications/stats');
      expect(after.status).toBe(200);

      const delta = (stage: string) => after.body.funnel[stage] - before.body.funnel[stage];
      expect(delta('saved')).toBe(1);
      expect(delta('applied')).toBe(1);
      expect(delta('rejected')).toBe(1);
      expect(delta('screening')).toBe(0);
      expect(delta('interviewing')).toBe(0);
      expect(delta('offer')).toBe(0);
      expect(delta('withdrawn')).toBe(0);
    });
  });
});
