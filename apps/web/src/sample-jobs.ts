import type { NormalizedJob } from '@waypoint/shared';

// Design-preview data so the Radar screen demonstrates the real card layout.
// Replaced by live crawler output in Phase 1.

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

export const sourceLabels: Record<NormalizedJob['source'], string> = {
  remoteok: 'RemoteOK',
  weworkremotely: 'WeWorkRemotely',
  hn_whos_hiring: 'HN Who’s Hiring',
  itviec: 'ITviec',
  topdev: 'TopDev',
  vietnamworks: 'VietnamWorks',
};

export const sampleJobs: NormalizedJob[] = [
  {
    source: 'itviec',
    externalId: 'sample-1',
    url: 'https://example.com/1',
    title: 'Fullstack Engineer (React / NestJS)',
    company: 'Mekong Labs',
    location: 'Ho Chi Minh City',
    workMode: 'hybrid',
    seniority: 'mid',
    salaryText: '$1,800 – $2,600',
    descriptionText: 'Build customer-facing dashboards and internal tooling…',
    tags: ['react', 'nestjs', 'postgresql', 'aws'],
    postedAt: daysAgo(1),
    fetchedAt: new Date(),
    dedupKey: 'sample-1',
  },
  {
    source: 'remoteok',
    externalId: 'sample-2',
    url: 'https://example.com/2',
    title: 'Senior Backend Engineer',
    company: 'Northwind (remote)',
    location: 'Remote — APAC friendly',
    workMode: 'remote',
    seniority: 'senior',
    salaryText: '$60k – $85k',
    descriptionText: 'Own services end to end in a TypeScript/Postgres stack…',
    tags: ['typescript', 'node', 'postgresql', 'docker', 'kubernetes'],
    postedAt: daysAgo(2),
    fetchedAt: new Date(),
    dedupKey: 'sample-2',
  },
  {
    source: 'topdev',
    externalId: 'sample-3',
    url: 'https://example.com/3',
    title: 'Software Engineer, Payments',
    company: 'Saola Fintech',
    location: 'Ha Noi',
    workMode: 'onsite',
    seniority: 'mid',
    salaryText: '25 – 40M VND',
    descriptionText: 'Design and harden payment flows on a NestJS microservice fleet…',
    tags: ['nestjs', 'mysql', 'redis', 'kafka'],
    postedAt: daysAgo(3),
    fetchedAt: new Date(),
    dedupKey: 'sample-3',
  },
  {
    source: 'weworkremotely',
    externalId: 'sample-4',
    url: 'https://example.com/4',
    title: 'Frontend Engineer',
    company: 'Driftwood',
    location: 'Remote — worldwide',
    workMode: 'remote',
    seniority: 'mid',
    salaryText: null,
    descriptionText: 'Ship polished product UI with React and a design system…',
    tags: ['react', 'vite', 'design systems'],
    postedAt: daysAgo(4),
    fetchedAt: new Date(),
    dedupKey: 'sample-4',
  },
  {
    source: 'hn_whos_hiring',
    externalId: 'sample-5',
    url: 'https://example.com/5',
    title: 'Product Engineer (fullstack)',
    company: 'Lantern (YC-backed)',
    location: 'Remote',
    workMode: 'remote',
    seniority: 'unknown',
    salaryText: '$70k – $110k + equity',
    descriptionText: 'Small team, big surface area: React, Node, Postgres, AWS…',
    tags: ['react', 'node', 'postgresql', 'aws'],
    postedAt: daysAgo(5),
    fetchedAt: new Date(),
    dedupKey: 'sample-5',
  },
];

export function timeAgo(date: Date | null): string {
  if (!date) return 'recently';
  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
