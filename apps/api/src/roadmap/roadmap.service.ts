import { Injectable } from '@nestjs/common';
import type { Resource, RoadmapItem, Topic } from '@prisma/client';
import type {
  RoadmapGenerateResponse,
  RoadmapItemRecord,
  RoadmapItemStatus,
  TrackId,
} from '@waypoint/shared';
import { InsightsService } from '../insights/insights.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from '../profile/profile.service';

const WEEKS = 6;
const MAX_OTHER_TOPICS_PER_WEEK = 2;
const MARKET_WEIGHT = 0.5;
const GAP_WEIGHT = 0.3;
const PREREQ_WEIGHT = 0.2;

type TopicWithResources = Topic & { resources: Resource[] };

function totalMinutes(topic: TopicWithResources): number {
  return topic.resources.reduce((sum, r) => sum + r.estMinutes, 0);
}

function toRoadmapItemRecord(row: RoadmapItem & { topic: TopicWithResources }): RoadmapItemRecord {
  return {
    id: row.id,
    topicId: row.topicId,
    topic: {
      id: row.topic.id,
      trackId: row.topic.trackId as TrackId,
      slug: row.topic.slug,
      name: row.topic.name,
      order: row.topic.order,
      difficulty: row.topic.difficulty,
      skills: row.topic.skills,
      resources: row.topic.resources.map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        kind: r.kind as RoadmapItemRecord['topic']['resources'][number]['kind'],
        note: r.note,
        estMinutes: r.estMinutes,
      })),
    },
    weekIndex: row.weekIndex,
    status: row.status as RoadmapItemStatus,
    reason: row.reason,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

@Injectable()
export class RoadmapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
    private readonly insightsService: InsightsService,
  ) {}

  async list(): Promise<RoadmapItemRecord[]> {
    const rows = await this.prisma.roadmapItem.findMany({
      include: { topic: { include: { resources: true } } },
      orderBy: [{ weekIndex: 'asc' }, { topic: { order: 'asc' } }],
    });
    return rows.map(toRoadmapItemRecord);
  }

  async patchItem(id: string, status: RoadmapItemStatus): Promise<RoadmapItemRecord> {
    const row = await this.prisma.roadmapItem.update({
      where: { id },
      data: { status, completedAt: status === 'done' ? new Date() : null },
      include: { topic: { include: { resources: true } } },
    });
    return toRoadmapItemRecord(row);
  }

  /**
   * Idempotent: wipes existing `todo` items and regenerates a fresh 6-week
   * plan. Topics already `in_progress`/`done` keep their RoadmapItem (and
   * are excluded from the new candidate pool, so they aren't rescheduled).
   */
  async generate(): Promise<RoadmapGenerateResponse> {
    const profile = await this.profileService.get();
    const profileSkills = new Set(profile.skills);
    const demand = await this.insightsService.skillDemand({});
    const demandBySkill = new Map(demand.map((d) => [d.skill, d.share]));

    const allTopics = await this.prisma.topic.findMany({ include: { resources: true } });

    const committedTopicIds = new Set(
      (
        await this.prisma.roadmapItem.findMany({
          where: { status: { in: ['in_progress', 'done'] } },
          select: { topicId: true },
        })
      ).map((r) => r.topicId),
    );

    await this.prisma.roadmapItem.deleteMany({ where: { status: 'todo' } });

    const candidates = allTopics.filter((t) => !committedTopicIds.has(t.id));

    const maxOrderByTrack = new Map<string, number>();
    for (const t of allTopics) {
      maxOrderByTrack.set(t.trackId, Math.max(maxOrderByTrack.get(t.trackId) ?? 0, t.order));
    }

    const dsaQueue = candidates
      .filter((t) => t.trackId === 'dsa')
      .sort((a, b) => a.order - b.order);

    const scored = candidates
      .filter((t) => t.trackId !== 'dsa')
      .map((topic) => ({
        topic,
        score: this.score(topic, demandBySkill, profileSkills, maxOrderByTrack.get(topic.trackId) ?? 1),
      }))
      .sort((a, b) => b.score - a.score);
    const otherQueue = scored.map((s) => s.topic);

    const budgetMinutes = profile.hoursPerWeek * 60;
    const toCreate: { topicId: string; weekIndex: number; reason: string }[] = [];

    const dsaTrackSize = maxOrderByTrack.get('dsa') ?? 0;
    let dsaIdx = 0;
    for (let week = 1; week <= WEEKS; week++) {
      let weekMinutes = 0;

      if (dsaIdx < dsaQueue.length) {
        const topic = dsaQueue[dsaIdx]!;
        dsaIdx++;
        weekMinutes += totalMinutes(topic);
        toCreate.push({
          topicId: topic.id,
          weekIndex: week,
          reason: `Next in the DSA pattern ladder (topic ${topic.order} of ${dsaTrackSize}).`,
        });
      }

      let addedOthers = 0;
      while (addedOthers < MAX_OTHER_TOPICS_PER_WEEK && otherQueue.length > 0) {
        const topic = otherQueue[0]!;
        const cost = totalMinutes(topic);
        const fits = weekMinutes + cost <= budgetMinutes;
        if (!fits && addedOthers >= 1) break;

        otherQueue.shift();
        weekMinutes += cost;
        toCreate.push({
          topicId: topic.id,
          weekIndex: week,
          reason: this.reasonFor(topic, demandBySkill, profileSkills),
        });
        addedOthers++;
        if (!fits) break;
      }
    }

    if (toCreate.length > 0) {
      await this.prisma.roadmapItem.createMany({
        data: toCreate.map((c) => ({ ...c, status: 'todo' })),
      });
    }

    const weeksScheduled = new Set(toCreate.map((c) => c.weekIndex)).size;
    return { itemsCreated: toCreate.length, weeksScheduled };
  }

  private score(
    topic: Topic,
    demandBySkill: Map<string, number>,
    profileSkills: Set<string>,
    maxOrderInTrack: number,
  ): number {
    const marketWeight = Math.max(0, ...topic.skills.map((s) => demandBySkill.get(s) ?? 0));
    const gapSkillShares = topic.skills
      .filter((s) => !profileSkills.has(s))
      .map((s) => demandBySkill.get(s) ?? 0);
    const gapWeight = gapSkillShares.length > 0 ? Math.max(0, ...gapSkillShares) : 0;
    const prereqWeight = maxOrderInTrack <= 1 ? 1 : 1 - (topic.order - 1) / (maxOrderInTrack - 1);

    return marketWeight * MARKET_WEIGHT + gapWeight * GAP_WEIGHT + prereqWeight * PREREQ_WEIGHT;
  }

  private reasonFor(
    topic: Topic,
    demandBySkill: Map<string, number>,
    profileSkills: Set<string>,
  ): string {
    const gapSkills = topic.skills
      .filter((s) => !profileSkills.has(s) && demandBySkill.has(s))
      .sort((a, b) => (demandBySkill.get(b) ?? 0) - (demandBySkill.get(a) ?? 0));

    if (gapSkills.length > 0) {
      const skill = gapSkills[0]!;
      const pct = Math.round((demandBySkill.get(skill) ?? 0) * 100);
      return `${skill} appears in ${pct}% of tracked jobs you can't yet cover.`;
    }

    const knownSkills = topic.skills
      .filter((s) => demandBySkill.has(s))
      .sort((a, b) => (demandBySkill.get(b) ?? 0) - (demandBySkill.get(a) ?? 0));

    if (knownSkills.length > 0) {
      const skill = knownSkills[0]!;
      const pct = Math.round((demandBySkill.get(skill) ?? 0) * 100);
      return `${skill} appears in ${pct}% of tracked jobs — worth reinforcing.`;
    }

    return `Foundational topic in the ${topic.trackId.replace('_', ' ')} track, scheduled by prerequisite order.`;
  }
}
