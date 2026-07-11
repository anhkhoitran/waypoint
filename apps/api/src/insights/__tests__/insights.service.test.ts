import type { SkillDemandItem } from '@waypoint/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InsightsService } from '../insights.service';

function makePrisma() {
  return {
    job: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    jobSkill: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    skill: {
      findMany: vi.fn(),
    },
    profile: {
      findUnique: vi.fn(),
    },
    crawlRun: {
      findFirst: vi.fn(),
    },
  };
}

describe('InsightsService.skillDemand', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: InsightsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new InsightsService(prisma as never);
  });

  it('computes jobCount and share against the total matching jobs', async () => {
    prisma.job.findMany.mockResolvedValue([{ id: 'j1' }, { id: 'j2' }, { id: 'j3' }]);
    prisma.jobSkill.groupBy.mockResolvedValue([
      { skillId: 's1', _count: { jobId: 2 } },
      { skillId: 's2', _count: { jobId: 2 } },
    ]);
    prisma.skill.findMany.mockResolvedValue([
      { id: 's1', name: 'react', category: 'frontend' },
      { id: 's2', name: 'kubernetes', category: 'devops' },
    ]);

    const result = await service.skillDemand({});

    expect(result).toEqual(
      expect.arrayContaining([
        { skill: 'react', category: 'frontend', jobCount: 2, share: 2 / 3 },
        { skill: 'kubernetes', category: 'devops', jobCount: 2, share: 2 / 3 },
      ]),
    );
    expect(result).toHaveLength(2);
  });

  it('sorts by jobCount descending', async () => {
    prisma.job.findMany.mockResolvedValue([{ id: 'j1' }, { id: 'j2' }]);
    prisma.jobSkill.groupBy.mockResolvedValue([
      { skillId: 's1', _count: { jobId: 1 } },
      { skillId: 's2', _count: { jobId: 2 } },
    ]);
    prisma.skill.findMany.mockResolvedValue([
      { id: 's1', name: 'rust', category: 'language' },
      { id: 's2', name: 'react', category: 'frontend' },
    ]);

    const result = await service.skillDemand({});
    expect(result.map((r) => r.skill)).toEqual(['react', 'rust']);
  });

  it('returns [] when no jobs match the filters', async () => {
    prisma.job.findMany.mockResolvedValue([]);
    const result = await service.skillDemand({});
    expect(result).toEqual([]);
    expect(prisma.jobSkill.groupBy).not.toHaveBeenCalled();
  });

  it('returns [] when jobs exist but none have extracted skills', async () => {
    prisma.job.findMany.mockResolvedValue([{ id: 'j1' }]);
    prisma.jobSkill.groupBy.mockResolvedValue([]);
    const result = await service.skillDemand({});
    expect(result).toEqual([]);
  });
});

describe('InsightsService.gap', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: InsightsService;

  const fakeDemand: SkillDemandItem[] = [
    { skill: 'react', category: 'frontend', jobCount: 10, share: 1 },
    { skill: 'kubernetes', category: 'devops', jobCount: 8, share: 0.8 },
    { skill: 'docker', category: 'devops', jobCount: 5, share: 0.5 },
  ];

  beforeEach(() => {
    prisma = makePrisma();
    service = new InsightsService(prisma as never);
    vi.spyOn(service, 'skillDemand').mockResolvedValue(fakeDemand);
  });

  it('filters out skills already in the profile', async () => {
    prisma.profile.findUnique.mockResolvedValue({ skills: ['react'] });
    const result = await service.gap();
    expect(result.map((r) => r.skill)).toEqual(['kubernetes', 'docker']);
  });

  it('treats a missing profile as having no skills', async () => {
    prisma.profile.findUnique.mockResolvedValue(null);
    const result = await service.gap();
    expect(result.map((r) => r.skill)).toEqual(['react', 'kubernetes', 'docker']);
  });

  it('caps results at the gap limit (15)', async () => {
    const bigDemand: SkillDemandItem[] = Array.from({ length: 20 }, (_, i) => ({
      skill: `skill-${i}`,
      category: 'practice',
      jobCount: 20 - i,
      share: 1,
    }));
    vi.spyOn(service, 'skillDemand').mockResolvedValue(bigDemand);
    prisma.profile.findUnique.mockResolvedValue({ skills: [] });

    const result = await service.gap();
    expect(result).toHaveLength(15);
    expect(result[0]!.skill).toBe('skill-0');
  });
});

describe('InsightsService.summary', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: InsightsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new InsightsService(prisma as never);
    vi.spyOn(service, 'gap').mockResolvedValue([
      { skill: 'kubernetes', category: 'devops', jobCount: 8, share: 0.8 },
      { skill: 'docker', category: 'devops', jobCount: 5, share: 0.5 },
      { skill: 'terraform', category: 'devops', jobCount: 4, share: 0.4 },
      { skill: 'aws', category: 'cloud', jobCount: 3, share: 0.3 },
    ]);
  });

  it('combines jobsInWindow, source health, median salary, and top 3 gap skills', async () => {
    prisma.job.count.mockResolvedValue(42);
    // 4 registered sources (remoteok, weworkremotely, hn_whos_hiring, itviec):
    // 3 healthy, 1 not.
    prisma.crawlRun.findFirst
      .mockResolvedValueOnce({ status: 'success' })
      .mockResolvedValueOnce({ status: 'success' })
      .mockResolvedValueOnce({ status: 'failed' })
      .mockResolvedValueOnce({ status: 'success' });
    prisma.job.findMany.mockResolvedValue([
      { salaryText: '$60k - $80k' },
      { salaryText: '$70k - $90k' },
      { salaryText: '25-40 triệu VND' }, // excluded: not USD-parseable
    ]);

    const result = await service.summary();

    expect(result.jobsInWindow).toBe(42);
    expect(result.sourcesHealthy).toBe(3);
    expect(result.sourcesTotal).toBe(4);
    // midpoints: (60k+80k)/2=70k, (70k+90k)/2=80k -> median 75k
    expect(result.medianSalary).toBe('$75k');
    expect(result.topGapSkills).toEqual(['kubernetes', 'docker', 'terraform']);
  });

  it('returns medianSalary: null when no salary in the window is USD-parseable', async () => {
    prisma.job.count.mockResolvedValue(10);
    prisma.crawlRun.findFirst.mockResolvedValue({ status: 'success' });
    prisma.job.findMany.mockResolvedValue([{ salaryText: '25-40 triệu VND' }]);

    const result = await service.summary();
    expect(result.medianSalary).toBeNull();
  });
});

describe('InsightsService.skillTrend', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: InsightsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new InsightsService(prisma as never);
  });

  it('buckets job-skill mentions by week and returns aligned series', async () => {
    prisma.skill.findMany.mockResolvedValue([{ id: 's1', name: 'react' }]);

    const now = Date.now();
    const since = new Date(now - 14 * 86_400_000);
    prisma.jobSkill.findMany.mockResolvedValue([
      { skillId: 's1', job: { fetchedAt: since } }, // bucket 0
      { skillId: 's1', job: { fetchedAt: new Date(now) } }, // last bucket
      { skillId: 's1', job: { fetchedAt: new Date(now) } }, // last bucket again
    ]);

    const result = await service.skillTrend(['react'], 14, 'week');

    expect(result.buckets).toHaveLength(2);
    expect(result.series.react).toEqual([1, 2]);
  });

  it('returns a zero-filled series for a skill with no matching taxonomy row', async () => {
    prisma.skill.findMany.mockResolvedValue([]);
    const result = await service.skillTrend(['not-a-real-skill'], 7, 'day');
    expect(result.series['not-a-real-skill']).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(prisma.jobSkill.findMany).not.toHaveBeenCalled();
  });
});
