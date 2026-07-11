import { Injectable, NotFoundException } from '@nestjs/common';
import type { ReviewCard } from '@prisma/client';
import { sm2, type ReviewCardRecord, type ReviewStats, type TrackId } from '@waypoint/shared';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, dayKey, endOfDay, startOfDay } from './review.utils';

const NEW_CARD_DAILY_CAP = 10;
const HEATMAP_DAYS = 30;

function toReviewCardRecord(row: ReviewCard): ReviewCardRecord {
  return {
    id: row.id,
    contentId: row.contentId,
    trackId: row.trackId as TrackId,
    prompt: row.prompt,
    answer: row.answer,
    topicSlug: row.topicSlug,
    easiness: row.easiness,
    intervalDays: row.intervalDays,
    repetitions: row.repetitions,
    dueAt: row.dueAt,
    lapses: row.lapses,
  };
}

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Due cards (dueAt <= now), ordered by dueAt, with brand-new cards
   * (repetitions === 0) throttled to a daily cap so a fresh deck doesn't
   * dump hundreds of unseen cards into one session.
   */
  async queue(limit = 20): Promise<ReviewCardRecord[]> {
    const now = new Date();

    const newCardsGradedToday = await this.prisma.reviewLog.count({
      where: { previousInterval: 0, reviewedAt: { gte: startOfDay(now), lte: endOfDay(now) } },
    });
    const remainingNewBudget = Math.max(0, NEW_CARD_DAILY_CAP - newCardsGradedToday);

    const due = await this.prisma.reviewCard.findMany({
      where: { dueAt: { lte: now } },
      orderBy: { dueAt: 'asc' },
    });

    const inProgress = due.filter((c) => c.repetitions > 0);
    const fresh = due.filter((c) => c.repetitions === 0).slice(0, remainingNewBudget);

    const combined = [...inProgress, ...fresh]
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
      .slice(0, limit);

    return combined.map(toReviewCardRecord);
  }

  async grade(id: string, grade: 0 | 1 | 2 | 3 | 4 | 5): Promise<ReviewCardRecord> {
    const card = await this.prisma.reviewCard.findUnique({ where: { id } });
    if (!card) {
      throw new NotFoundException(`review card ${id} not found`);
    }

    const result = sm2(
      { easiness: card.easiness, intervalDays: card.intervalDays, repetitions: card.repetitions },
      grade,
    );
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.reviewCard.update({
        where: { id },
        data: {
          easiness: result.easiness,
          intervalDays: result.intervalDays,
          repetitions: result.repetitions,
          dueAt: addDays(now, result.dueInDays),
          lapses: result.lapsed ? card.lapses + 1 : card.lapses,
        },
      });
      await tx.reviewLog.create({
        data: {
          cardId: id,
          grade,
          reviewedAt: now,
          previousInterval: card.intervalDays,
          nextInterval: result.intervalDays,
        },
      });
      return row;
    });

    return toReviewCardRecord(updated);
  }

  async stats(): Promise<ReviewStats> {
    const now = new Date();

    const dueToday = await this.prisma.reviewCard.count({
      where: { dueAt: { lte: endOfDay(now) } },
    });

    const doneToday = await this.prisma.reviewLog.count({
      where: { reviewedAt: { gte: startOfDay(now), lte: endOfDay(now) } },
    });

    const streak = await this.computeStreak(now);

    const perTrackGroups = await this.prisma.reviewCard.groupBy({
      by: ['trackId'],
      where: { dueAt: { lte: endOfDay(now) } },
      _count: { _all: true },
    });
    const perTrack = perTrackGroups.map((g) => ({
      trackId: g.trackId as TrackId,
      dueCount: g._count._all,
    }));

    const heatmapStart = startOfDay(addDays(now, -(HEATMAP_DAYS - 1)));
    const logs = await this.prisma.reviewLog.findMany({
      where: { reviewedAt: { gte: heatmapStart } },
      select: { reviewedAt: true },
    });
    const countsByDay = new Map<string, number>();
    for (const log of logs) {
      const key = dayKey(log.reviewedAt);
      countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
    }
    const heatmap = Array.from({ length: HEATMAP_DAYS }, (_, i) => {
      const date = dayKey(addDays(now, -(HEATMAP_DAYS - 1 - i)));
      return { date, count: countsByDay.get(date) ?? 0 };
    });

    return { dueToday, doneToday, streak, perTrack, heatmap };
  }

  /**
   * Consecutive Asia/Ho_Chi_Minh calendar days with >=1 review, ending
   * today if there's already a review today, otherwise ending yesterday
   * (today just hasn't happened yet — it doesn't break the streak).
   */
  private async computeStreak(now: Date): Promise<number> {
    const todayCount = await this.countReviewsOnDay(now);
    let cursor = todayCount > 0 ? now : addDays(now, -1);

    let streak = 0;
    for (;;) {
      const count = await this.countReviewsOnDay(cursor);
      if (count === 0) break;
      streak++;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  private async countReviewsOnDay(date: Date): Promise<number> {
    return this.prisma.reviewLog.count({
      where: { reviewedAt: { gte: startOfDay(date), lte: endOfDay(date) } },
    });
  }
}
