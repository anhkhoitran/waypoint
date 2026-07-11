import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoadmapService } from '../roadmap.service';

interface FakeTopic {
  id: string;
  trackId: string;
  slug: string;
  name: string;
  order: number;
  difficulty: number;
  skills: string[];
  resources: { id: string; title: string; url: string; kind: string; note: string | null; estMinutes: number }[];
}

function makeTopic(overrides: Partial<FakeTopic> & { id: string; estMinutes: number }): FakeTopic {
  return {
    trackId: 'dsa',
    slug: overrides.id,
    name: overrides.id,
    order: 1,
    difficulty: 1,
    skills: [],
    ...overrides,
    resources: [
      {
        id: `${overrides.id}-r1`,
        title: 'r1',
        url: 'https://example.com',
        kind: 'article',
        note: null,
        estMinutes: overrides.estMinutes,
      },
    ],
  };
}

function makeHarness(topics: FakeTopic[], committedRows: { topicId: string; status: string }[] = []) {
  const prisma = {
    topic: { findMany: vi.fn().mockResolvedValue(topics) },
    roadmapItem: {
      findMany: vi.fn().mockResolvedValue(committedRows),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn(),
    },
  };
  const profileService = {
    get: vi.fn().mockResolvedValue({
      id: 'default',
      skills: ['react'],
      yearsOfExperience: 3,
      targetSeniority: 'mid',
      targetWorkModes: ['remote'],
      locations: [],
      hoursPerWeek: 2, // 120 minutes/week budget
    }),
  };
  const insightsService = {
    skillDemand: vi.fn().mockResolvedValue([
      { skill: 'react', category: 'frontend', jobCount: 90, share: 0.9 },
      { skill: 'aws', category: 'cloud', jobCount: 50, share: 0.5 },
    ]),
  };

  const service = new RoadmapService(prisma as never, profileService as never, insightsService as never);
  return { service, prisma, profileService, insightsService };
}

describe('RoadmapService.generate', () => {
  it('interleaves >=1 DSA topic per week (ladder order), respects the weekly budget, and populates reasons', async () => {
    const topics: FakeTopic[] = [
      makeTopic({ id: 'dsa-1', trackId: 'dsa', order: 1, estMinutes: 60 }),
      makeTopic({ id: 'dsa-2', trackId: 'dsa', order: 2, estMinutes: 60 }),
      makeTopic({ id: 'dsa-3', trackId: 'dsa', order: 3, estMinutes: 60 }),
      makeTopic({ id: 'web-a', trackId: 'web', order: 1, skills: ['react'], estMinutes: 60 }),
      makeTopic({ id: 'cloud-b', trackId: 'cloud', order: 1, skills: ['aws'], estMinutes: 60 }),
      makeTopic({ id: 'sd-c', trackId: 'system_design', order: 1, skills: [], estMinutes: 60 }),
    ];
    const { service, prisma } = makeHarness(topics);

    const result = await service.generate();

    expect(prisma.roadmapItem.deleteMany).toHaveBeenCalledWith({ where: { status: 'todo' } });
    expect(prisma.roadmapItem.createMany).toHaveBeenCalledTimes(1);
    const created = (prisma.roadmapItem.createMany.mock.calls[0]![0] as { data: Array<{ topicId: string; weekIndex: number; reason: string; status: string }> }).data;

    // Deterministic by construction: react (owned, high demand) beats aws
    // (gap, lower demand) beats the zero-skill topic, so weeks fill
    // DSA-then-best-scored-other, one each, hitting the 120min budget exactly.
    expect(result).toEqual({ itemsCreated: 6, weeksScheduled: 3 });

    const byWeek = (n: number) => created.filter((c) => c.weekIndex === n);
    expect(byWeek(1).map((c) => c.topicId).sort()).toEqual(['dsa-1', 'web-a'].sort());
    expect(byWeek(2).map((c) => c.topicId).sort()).toEqual(['dsa-2', 'cloud-b'].sort());
    expect(byWeek(3).map((c) => c.topicId).sort()).toEqual(['dsa-3', 'sd-c'].sort());
    expect(byWeek(4)).toHaveLength(0);

    for (const item of created) {
      expect(item.status).toBe('todo');
      expect(item.reason.length).toBeGreaterThan(0);
    }

    const dsaItem = created.find((c) => c.topicId === 'dsa-1')!;
    expect(dsaItem.reason).toContain('DSA pattern ladder');
    const gapItem = created.find((c) => c.topicId === 'cloud-b')!;
    expect(gapItem.reason).toContain('aws');
    expect(gapItem.reason).toContain("can't yet cover");
  });

  it('always schedules at least one other-track topic per week even if it alone exceeds the budget', async () => {
    const topics: FakeTopic[] = [
      makeTopic({ id: 'dsa-1', trackId: 'dsa', order: 1, estMinutes: 60 }),
      makeTopic({ id: 'web-big', trackId: 'web', order: 1, estMinutes: 500 }), // way over the 120min budget alone
    ];
    const { service, prisma } = makeHarness(topics);

    await service.generate();
    const created = (prisma.roadmapItem.createMany.mock.calls[0]![0] as { data: Array<{ topicId: string; weekIndex: number }> }).data;

    expect(created.map((c) => c.topicId)).toContain('web-big');
    const week1 = created.filter((c) => c.weekIndex === 1);
    expect(week1.map((c) => c.topicId).sort()).toEqual(['dsa-1', 'web-big'].sort());
  });

  it('fills weeks with other-track topics alone once the DSA ladder is exhausted', async () => {
    // Only 1 DSA topic but 3 web topics that don't all fit alongside it in
    // week 1 (budget 120min: dsa-1 + web-a = 90, web-b would push to 150) —
    // so web-b/web-c should carry over into week 2, DSA-free.
    const topics: FakeTopic[] = [
      makeTopic({ id: 'dsa-1', trackId: 'dsa', order: 1, estMinutes: 30 }),
      makeTopic({ id: 'web-a', trackId: 'web', order: 1, estMinutes: 60 }),
      makeTopic({ id: 'web-b', trackId: 'web', order: 2, estMinutes: 60 }),
      makeTopic({ id: 'web-c', trackId: 'web', order: 3, estMinutes: 60 }),
    ];
    const { service, prisma } = makeHarness(topics);

    await service.generate();
    const created = (prisma.roadmapItem.createMany.mock.calls[0]![0] as { data: Array<{ topicId: string; weekIndex: number }> }).data;

    const week2 = created.filter((c) => c.weekIndex === 2);
    expect(week2.some((c) => c.topicId === 'dsa-1')).toBe(false);
    expect(week2.map((c) => c.topicId).sort()).toEqual(['web-b', 'web-c'].sort());
  });

  it('regeneration excludes topics already in_progress/done and never wipes them', async () => {
    const topics: FakeTopic[] = [
      makeTopic({ id: 'dsa-1', trackId: 'dsa', order: 1, estMinutes: 30 }),
      makeTopic({ id: 'dsa-2', trackId: 'dsa', order: 2, estMinutes: 30 }),
    ];
    const { service, prisma } = makeHarness(topics, [{ topicId: 'dsa-1', status: 'done' }]);

    await service.generate();

    expect(prisma.roadmapItem.deleteMany).toHaveBeenCalledWith({ where: { status: 'todo' } });
    const created = (prisma.roadmapItem.createMany.mock.calls[0]![0] as { data: Array<{ topicId: string }> }).data;
    expect(created.map((c) => c.topicId)).not.toContain('dsa-1');
    expect(created.map((c) => c.topicId)).toContain('dsa-2');
  });

  it('does not call createMany when there is nothing to schedule', async () => {
    const { service, prisma } = makeHarness([]);
    const result = await service.generate();
    expect(result).toEqual({ itemsCreated: 0, weeksScheduled: 0 });
    expect(prisma.roadmapItem.createMany).not.toHaveBeenCalled();
  });
});
