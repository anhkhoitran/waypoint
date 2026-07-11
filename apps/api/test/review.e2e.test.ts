import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// A fixed, known instant so day-boundary math (streak/heatmap) is
// deterministic regardless of when the test actually runs.
// 2026-03-10T10:00:00+07:00 (Asia/Ho_Chi_Minh) = 2026-03-10T03:00:00Z.
const NOW = new Date('2026-03-10T03:00:00.000Z');

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000);
}

function daysAgo(d: number): Date {
  return new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);
}

describe('Review API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testCardIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    if (testCardIds.length > 0) {
      await prisma.reviewLog.deleteMany({ where: { cardId: { in: testCardIds } } });
      await prisma.reviewCard.deleteMany({ where: { id: { in: testCardIds } } });
    }
    await app.close();
  });

  async function makeCard(overrides: {
    contentId: string;
    repetitions?: number;
    intervalDays?: number;
    easiness?: number;
    dueAt?: Date;
    lapses?: number;
  }) {
    const row = await prisma.reviewCard.create({
      data: {
        contentId: overrides.contentId,
        trackId: 'dsa',
        prompt: `e2e prompt ${overrides.contentId}`,
        answer: `e2e answer ${overrides.contentId}`,
        easiness: overrides.easiness ?? 2.5,
        intervalDays: overrides.intervalDays ?? 0,
        repetitions: overrides.repetitions ?? 0,
        dueAt: overrides.dueAt ?? NOW,
        lapses: overrides.lapses ?? 0,
      },
    });
    testCardIds.push(row.id);
    return row;
  }

  describe('POST /review/cards/:id/grade', () => {
    it('applies SM-2 and updates dueAt using the frozen clock', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);

      const card = await makeCard({ contentId: 'e2e-grade-card', repetitions: 0, intervalDays: 0 });

      const res = await request(app.getHttpServer()).post(`/review/cards/${card.id}/grade`).send({ grade: 5 });

      expect(res.status).toBe(201);
      expect(res.body.repetitions).toBe(1);
      expect(res.body.intervalDays).toBe(1);
      expect(new Date(res.body.dueAt).getTime()).toBe(NOW.getTime() + 24 * 60 * 60 * 1000);

      const log = await prisma.reviewLog.findFirst({ where: { cardId: card.id } });
      expect(log).not.toBeNull();
      expect(log!.previousInterval).toBe(0);
      expect(log!.nextInterval).toBe(1);
    });

    it('a lapse (grade < 3) resets repetitions/interval to the 1-day default and increments lapses', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);

      const card = await makeCard({
        contentId: 'e2e-lapse-card',
        repetitions: 3,
        intervalDays: 16,
        easiness: 2.8,
        lapses: 0,
      });

      const res = await request(app.getHttpServer()).post(`/review/cards/${card.id}/grade`).send({ grade: 1 });

      expect(res.status).toBe(201);
      expect(res.body.repetitions).toBe(0);
      expect(res.body.intervalDays).toBe(1);
      expect(res.body.lapses).toBe(1);
    });

    it('404s for an unknown card id', async () => {
      const res = await request(app.getHttpServer())
        .post('/review/cards/does-not-exist/grade')
        .send({ grade: 4 });
      expect(res.status).toBe(404);
    });

    it('400s for an out-of-range grade', async () => {
      const card = await makeCard({ contentId: 'e2e-badgrade-card' });
      const res = await request(app.getHttpServer()).post(`/review/cards/${card.id}/grade`).send({ grade: 9 });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /review/queue', () => {
    it('only returns cards already due, ordered by dueAt', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);

      const due = await makeCard({ contentId: 'e2e-queue-due', repetitions: 1, dueAt: hoursAgo(1) });
      const notDue = await makeCard({
        contentId: 'e2e-queue-not-due',
        repetitions: 1,
        dueAt: new Date(NOW.getTime() + 60 * 60 * 1000),
      });

      const res = await request(app.getHttpServer()).get('/review/queue?limit=100');
      expect(res.status).toBe(200);
      const ids = (res.body as { id: string }[]).map((c) => c.id);
      expect(ids).toContain(due.id);
      expect(ids).not.toContain(notDue.id);
    });

    it('throttles brand-new (repetitions=0) cards to the daily cap, but never throttles in-progress cards', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);

      // 12 new cards (repetitions=0) + 1 in-progress card, all due now.
      const newCards = await Promise.all(
        Array.from({ length: 12 }, (_, i) => makeCard({ contentId: `e2e-newcap-${i}`, repetitions: 0, dueAt: hoursAgo(1) })),
      );
      const inProgress = await makeCard({ contentId: 'e2e-newcap-inprogress', repetitions: 2, dueAt: hoursAgo(1) });

      const res = await request(app.getHttpServer()).get('/review/queue?limit=100');
      expect(res.status).toBe(200);
      const ids = (res.body as { id: string }[]).map((c) => c.id);

      expect(ids).toContain(inProgress.id);
      const newCardIdsInQueue = newCards.filter((c) => ids.includes(c.id));
      expect(newCardIdsInQueue.length).toBeLessThanOrEqual(10);
    });
  });

  describe('GET /review/stats — streak across day boundaries', () => {
    // Streak/stats read ALL ReviewLog rows globally (by design — it's a
    // single-user app), so each test must start from a clean log slate
    // rather than relying on prior tests' (or this suite's grade tests')
    // leftover rows at "today"/"yesterday".
    beforeAll(async () => {
      await prisma.reviewLog.deleteMany({ where: { cardId: { in: testCardIds } } });
    });

    afterEach(async () => {
      await prisma.reviewLog.deleteMany({ where: { cardId: { in: testCardIds } } });
    });

    it('counts a streak of consecutive Asia/Ho_Chi_Minh calendar days with >=1 review, stopping at the first gap', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);

      const streakCard = await makeCard({ contentId: 'e2e-streak-card' });

      // Reviewed today, yesterday, and the day before — a 3-day streak —
      // then a 4-day-old review with a gap on day 3, which must NOT extend it.
      await prisma.reviewLog.createMany({
        data: [
          { cardId: streakCard.id, grade: 4, reviewedAt: NOW, previousInterval: 0, nextInterval: 1 },
          { cardId: streakCard.id, grade: 4, reviewedAt: daysAgo(1), previousInterval: 0, nextInterval: 1 },
          { cardId: streakCard.id, grade: 4, reviewedAt: daysAgo(2), previousInterval: 0, nextInterval: 1 },
          // gap at daysAgo(3)
          { cardId: streakCard.id, grade: 4, reviewedAt: daysAgo(4), previousInterval: 0, nextInterval: 1 },
        ],
      });

      const res = await request(app.getHttpServer()).get('/review/stats');
      expect(res.status).toBe(200);
      expect(res.body.streak).toBe(3);
      expect(res.body.doneToday).toBeGreaterThanOrEqual(1);
    });

    it("an active streak isn't broken by not having reviewed yet today", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);

      const streakCard = await makeCard({ contentId: 'e2e-streak-noyet-card' });
      await prisma.reviewLog.createMany({
        data: [
          { cardId: streakCard.id, grade: 4, reviewedAt: daysAgo(1), previousInterval: 0, nextInterval: 1 },
          { cardId: streakCard.id, grade: 4, reviewedAt: daysAgo(2), previousInterval: 0, nextInterval: 1 },
        ],
      });

      const res = await request(app.getHttpServer()).get('/review/stats');
      expect(res.status).toBe(200);
      expect(res.body.streak).toBe(2);
    });

    it('reports 0 streak when the most recent review is more than a day old', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);

      const staleCard = await makeCard({ contentId: 'e2e-streak-stale-card' });
      await prisma.reviewLog.create({
        data: { cardId: staleCard.id, grade: 4, reviewedAt: daysAgo(5), previousInterval: 0, nextInterval: 1 },
      });

      const res = await request(app.getHttpServer()).get('/review/stats');
      expect(res.status).toBe(200);
      expect(res.body.streak).toBe(0);
    });
  });
});
