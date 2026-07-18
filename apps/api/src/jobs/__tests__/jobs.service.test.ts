import type { JobQuery } from '@waypoint/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobsService } from '../jobs.service';

function makePrisma() {
  return {
    job: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    jobSummary: {
      deleteMany: vi.fn(),
    },
    profile: {
      findUnique: vi.fn(),
    },
  };
}

function makeJob(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: overrides.id ?? 'j1',
    sourceId: 'remoteok',
    externalId: 'ext-1',
    url: 'https://example.com/1',
    title: 'Senior Frontend Engineer',
    company: 'Meridian Labs',
    location: 'Remote',
    workMode: 'remote',
    seniority: 'senior',
    salaryText: null,
    descriptionText: 'desc',
    tags: [],
    postedAt: new Date(),
    fetchedAt: new Date(),
    dedupKey: overrides.id ? `key-${overrides.id}` : 'key-1',
    saved: false,
    hidden: false,
    skills: [],
    ...overrides,
  };
}

describe('JobsService.list', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: JobsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new JobsService(prisma as never);
    prisma.profile.findUnique.mockResolvedValue(null);
  });

  it('multi-selects sources', async () => {
    prisma.job.findMany.mockResolvedValue([
      makeJob({ id: 'j1', sourceId: 'remoteok' }),
      makeJob({ id: 'j2', sourceId: 'weworkremotely' }),
      makeJob({ id: 'j3', sourceId: 'itviec' }),
    ]);

    const result = await service.list({ source: ['remoteok', 'weworkremotely'] } as JobQuery);
    expect(result.items.map((j) => j.id).sort()).toEqual(['j1', 'j2']);
  });

  it('filters by search across title, company, and tags', async () => {
    prisma.job.findMany.mockResolvedValue([
      makeJob({ id: 'j1', title: 'Backend Engineer', company: 'Acme', tags: [] }),
      makeJob({ id: 'j2', title: 'Something Else', company: 'Other Co', tags: ['kubernetes'] }),
    ]);

    const result = await service.list({ q: 'kubernetes' } as JobQuery);
    expect(result.items.map((j) => j.id)).toEqual(['j2']);
  });

  it('filters by salary bucket "150" using the parsed USD midpoint', async () => {
    prisma.job.findMany.mockResolvedValue([
      makeJob({ id: 'j1', salaryText: '$100k - $120k' }), // midpoint 110k
      makeJob({ id: 'j2', salaryText: '$160k - $190k' }), // midpoint 175k
      makeJob({ id: 'j3', salaryText: null }),
    ]);

    const result = await service.list({ salary: '150' } as JobQuery);
    expect(result.items.map((j) => j.id)).toEqual(['j2']);
  });

  it('sorts by salary descending with nulls last', async () => {
    prisma.job.findMany.mockResolvedValue([
      makeJob({ id: 'j1', salaryText: '$60k - $80k' }), // 70k
      makeJob({ id: 'j2', salaryText: null }),
      makeJob({ id: 'j3', salaryText: '$150k - $170k' }), // 160k
    ]);

    const result = await service.list({ sort: 'salary' } as JobQuery);
    expect(result.items.map((j) => j.id)).toEqual(['j3', 'j1', 'j2']);
  });

  it('respects limit while still returning facet counts over the full filtered set', async () => {
    prisma.job.findMany.mockResolvedValue([
      makeJob({ id: 'j1', sourceId: 'remoteok' }),
      makeJob({ id: 'j2', sourceId: 'remoteok' }),
      makeJob({ id: 'j3', sourceId: 'itviec' }),
    ]);

    const result = await service.list({ limit: 1 } as JobQuery);
    expect(result.items).toHaveLength(1);
    const remoteok = result.facets.sources.find((f) => f.value === 'remoteok');
    expect(remoteok?.count).toBe(2);
  });

  it('facet counts for one dimension ignore that dimension\'s own active filter (skip-self)', async () => {
    prisma.job.findMany.mockResolvedValue([
      makeJob({ id: 'j1', sourceId: 'remoteok', workMode: 'remote' }),
      makeJob({ id: 'j2', sourceId: 'itviec', workMode: 'onsite' }),
      makeJob({ id: 'j3', sourceId: 'itviec', workMode: 'remote' }),
    ]);

    const result = await service.list({ source: ['remoteok'] } as JobQuery);

    // Selecting only "remoteok" still shows itviec's true count (2), not 0 —
    // otherwise picking any single source would zero out every other option.
    const itviec = result.facets.sources.find((f) => f.value === 'itviec');
    expect(itviec?.count).toBe(2);

    // But dimensions that are NOT being counted (workMode) do respect the
    // active source filter: only j1 (remoteok) matches, and it's "remote".
    const remoteWorkMode = result.facets.workModes.find((f) => f.value === 'remote');
    expect(remoteWorkMode?.count).toBe(1);
  });

  it('filters by posted bucket "24h"', async () => {
    const now = Date.now();
    prisma.job.findMany.mockResolvedValue([
      makeJob({ id: 'j1', postedAt: new Date(now - 2 * 60 * 60 * 1000) }), // 2h ago
      makeJob({ id: 'j2', postedAt: new Date(now - 5 * 86_400_000) }), // 5 days ago
    ]);

    const result = await service.list({ posted: '24h' } as JobQuery);
    expect(result.items.map((j) => j.id)).toEqual(['j1']);
  });

  it('filters by saved', async () => {
    prisma.job.findMany.mockResolvedValue([
      makeJob({ id: 'j1', saved: true }),
      makeJob({ id: 'j2', saved: false }),
    ]);

    const result = await service.list({ saved: true } as JobQuery);
    expect(result.items.map((j) => j.id)).toEqual(['j1']);
  });
});

describe('JobsService.reclassifyRelevance', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: JobsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new JobsService(prisma as never);
  });

  it('flags tech roles relevant and non-tech roles not, then reports the split', async () => {
    prisma.job.findMany.mockResolvedValue([
      { id: 'j1', title: 'Senior Backend Engineer', descriptionText: 'React and Node.', tags: [] },
      { id: 'j2', title: 'Virtual Executive Assistant', descriptionText: 'Calendar and travel.', tags: [] },
      { id: 'j3', title: 'DevOps Engineer', descriptionText: 'Kubernetes.', tags: [] },
    ]);

    const result = await service.reclassifyRelevance();

    expect(prisma.job.update).toHaveBeenCalledWith({ where: { id: 'j1' }, data: { relevant: true } });
    expect(prisma.job.update).toHaveBeenCalledWith({ where: { id: 'j2' }, data: { relevant: false } });
    expect(prisma.job.update).toHaveBeenCalledWith({ where: { id: 'j3' }, data: { relevant: true } });
    expect(result).toEqual({ total: 3, relevant: 2, filtered: 1 });
  });

  it('drops summaries belonging to jobs that are now non-relevant', async () => {
    prisma.job.findMany.mockResolvedValue([]);
    await service.reclassifyRelevance();
    expect(prisma.jobSummary.deleteMany).toHaveBeenCalledWith({ where: { job: { relevant: false } } });
  });
});
