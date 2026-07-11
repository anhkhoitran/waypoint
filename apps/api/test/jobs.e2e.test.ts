import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// All seeded rows use this externalId prefix so cleanup is a single scoped delete.
const PREFIX = 'e2e-jobs-test-';

describe('Jobs API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reactEngineerId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.job.createMany({
      data: [
        {
          sourceId: 'remoteok',
          externalId: `${PREFIX}1`,
          url: 'https://example.com/e2e-1',
          title: 'E2E React Engineer',
          company: 'E2E Corp',
          location: 'Remote',
          workMode: 'remote',
          seniority: 'senior',
          descriptionText: 'react job',
          tags: ['react'],
          postedAt: new Date(Date.now() - 1 * 86_400_000), // 1 day ago
          fetchedAt: new Date(Date.now() - 1000),
          dedupKey: `${PREFIX}key-1`,
        },
        {
          sourceId: 'weworkremotely',
          externalId: `${PREFIX}2`,
          url: 'https://example.com/e2e-2',
          title: 'E2E Backend Engineer',
          company: 'E2E Corp',
          location: null,
          workMode: 'onsite',
          seniority: 'mid',
          descriptionText: 'backend job',
          tags: ['node'],
          postedAt: new Date(Date.now() - 40 * 86_400_000), // 40 days ago — outside a 30-day window
          fetchedAt: new Date(Date.now() - 2000),
          dedupKey: `${PREFIX}key-2`,
        },
        {
          sourceId: 'hn_whos_hiring',
          externalId: `${PREFIX}3`,
          url: 'https://example.com/e2e-3',
          title: 'E2E Hidden Job',
          company: 'E2E Corp',
          location: null,
          workMode: 'unknown',
          seniority: 'unknown',
          descriptionText: 'hidden job',
          tags: [],
          postedAt: null,
          fetchedAt: new Date(Date.now() - 3000),
          dedupKey: `${PREFIX}key-3`,
          hidden: true,
        },
      ],
    });

    const reactEngineer = await prisma.job.findFirstOrThrow({
      where: { externalId: `${PREFIX}1` },
    });
    reactEngineerId = reactEngineer.id;
  });

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { externalId: { startsWith: PREFIX } } });
    await app.close();
  });

  it('excludes hidden jobs by default', async () => {
    const res = await request(app.getHttpServer()).get('/jobs').query({ q: 'E2E' });
    expect(res.status).toBe(200);
    const titles = res.body.items.map((j: { title: string }) => j.title);
    expect(titles).not.toContain('E2E Hidden Job');
  });

  it('filters by q across title and company', async () => {
    const res = await request(app.getHttpServer()).get('/jobs').query({ q: 'React Engineer' });
    expect(res.status).toBe(200);
    expect(res.body.items.some((j: { title: string }) => j.title === 'E2E React Engineer')).toBe(true);
  });

  it('filters by source', async () => {
    const res = await request(app.getHttpServer())
      .get('/jobs')
      .query({ q: 'E2E', source: 'weworkremotely' });
    expect(res.status).toBe(200);
    expect(
      res.body.items.every((j: { source: string }) => j.source === 'weworkremotely'),
    ).toBe(true);
  });

  it('filters by postedWithinDays', async () => {
    const res = await request(app.getHttpServer())
      .get('/jobs')
      .query({ q: 'E2E', postedWithinDays: 30 });
    const titles = res.body.items.map((j: { title: string }) => j.title);
    expect(titles).toContain('E2E React Engineer');
    expect(titles).not.toContain('E2E Backend Engineer');
  });

  it('paginates with a cursor, returning distinct pages in stable order', async () => {
    const page1 = await request(app.getHttpServer()).get('/jobs').query({ q: 'E2E', limit: 1 });
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(1);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2 = await request(app.getHttpServer())
      .get('/jobs')
      .query({ q: 'E2E', limit: 1, cursor: page1.body.nextCursor });
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.items[0].id).not.toBe(page1.body.items[0].id);
  });

  it('rejects an invalid query param with 400', async () => {
    const res = await request(app.getHttpServer()).get('/jobs').query({ workMode: 'not-a-mode' });
    expect(res.status).toBe(400);
  });

  it('updates saved/hidden via PATCH /jobs/:id', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/jobs/${reactEngineerId}`)
      .send({ saved: true });
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(true);

    const verify = await request(app.getHttpServer()).get('/jobs').query({ q: 'E2E', saved: true });
    expect(verify.body.items.some((j: { id: string }) => j.id === reactEngineerId)).toBe(true);
  });

  it('rejects an empty PATCH body with 400', async () => {
    const res = await request(app.getHttpServer()).patch(`/jobs/${reactEngineerId}`).send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when patching a job that does not exist', async () => {
    const res = await request(app.getHttpServer()).patch('/jobs/does-not-exist').send({ saved: true });
    expect(res.status).toBe(404);
  });
});
