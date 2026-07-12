import { sm2, type Sm2Grade } from '@waypoint/shared';
import { InsightsService } from '../src/insights/insights.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProfileService } from '../src/profile/profile.service';
import { RoadmapService } from '../src/roadmap/roadmap.service';
import { seedContent } from './seed';

// Services are constructed directly (not via Nest's DI container) because
// this script runs under tsx/esbuild, which doesn't emit the decorator
// metadata Nest's constructor injection relies on — only swc (used by the
// vitest e2e suite) does. Each of these services takes plain constructor
// args, so wiring them by hand works identically to how Nest would.
const prisma = new PrismaService();
const DEMO_MARKER = 'demo-';
const NOW = new Date();

function daysAgo(d: number): Date {
  return new Date(NOW.getTime() - d * 86_400_000);
}

// --- Demo job generation ---------------------------------------------------

interface Archetype {
  titles: string[];
  skills: string[];
  seniorities: Array<'junior' | 'mid' | 'senior' | 'lead'>;
}

const ARCHETYPES: Archetype[] = [
  {
    titles: ['Frontend Engineer', 'React Developer', 'UI Engineer'],
    skills: ['javascript', 'typescript', 'react', 'redux', 'css', 'html'],
    seniorities: ['junior', 'mid', 'mid', 'senior'],
  },
  {
    titles: ['Backend Engineer', 'Node.js Developer', 'API Engineer'],
    skills: ['node', 'express', 'postgresql', 'docker', 'rest', 'typescript'],
    seniorities: ['mid', 'mid', 'senior', 'senior'],
  },
  {
    titles: ['Full-Stack Engineer', 'Software Engineer'],
    skills: ['react', 'node', 'typescript', 'postgresql', 'graphql', 'docker'],
    seniorities: ['junior', 'mid', 'mid', 'senior', 'lead'],
  },
  {
    titles: ['DevOps Engineer', 'Platform Engineer', 'Site Reliability Engineer'],
    skills: ['docker', 'kubernetes', 'terraform', 'aws', 'ci/cd', 'linux'],
    seniorities: ['mid', 'senior', 'senior'],
  },
  {
    titles: ['Data Engineer', 'Backend Engineer (Data)'],
    skills: ['python', 'sql', 'postgresql', 'kafka', 'aws'],
    seniorities: ['mid', 'senior'],
  },
  {
    titles: ['QA Engineer', 'SDET', 'Test Automation Engineer'],
    skills: ['jest', 'cypress', 'playwright', 'unit testing', 'integration testing'],
    seniorities: ['junior', 'mid'],
  },
  {
    titles: ['Engineering Manager', 'Tech Lead', 'Staff Engineer'],
    skills: ['system design', 'design patterns', 'agile', 'code review', 'oop'],
    seniorities: ['senior', 'lead'],
  },
];

const COMPANIES = [
  'Northlane Systems',
  'Bluefin Labs',
  'Cedarwood Digital',
  'Parallax Technologies',
  'Ridgeline Software',
  'Anchorpoint Inc',
  'Solace Data',
  'Cobalt Robotics Group',
  'Fernbridge Analytics',
  'Vantage Cloud',
  'Meridian Works',
  'Harborlight Tech',
];

const REMOTE_SOURCES = ['remoteok', 'weworkremotely', 'hn_whos_hiring'] as const;
const VIETNAM_LOCATIONS = ['Ho Chi Minh City', 'Ha Noi', 'Da Nang'];
const US_LOCATIONS = ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Remote (US)'];

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]!;
}

async function seedDemoJobs(): Promise<string[]> {
  const jobIds: string[] = [];
  let index = 0;

  for (const archetype of ARCHETYPES) {
    for (let n = 0; n < 9; n++) {
      const source = pick(['remoteok', 'weworkremotely', 'hn_whos_hiring', 'itviec'] as const, index);
      const isRemote = REMOTE_SOURCES.includes(source as (typeof REMOTE_SOURCES)[number]);
      const title = pick(archetype.titles, index + n);
      const company = pick(COMPANIES, index * 3 + n);
      const seniority = pick(archetype.seniorities, n);
      const location = source === 'itviec' ? pick(VIETNAM_LOCATIONS, n) : isRemote ? pick(US_LOCATIONS, n) : pick(US_LOCATIONS, n);
      const workMode = source === 'itviec' ? (n % 3 === 0 ? 'hybrid' : 'onsite') : 'remote';
      const postedAt = daysAgo(1 + ((index * 2) % 28));
      const salaryText =
        source === 'itviec'
          ? n % 4 === 0
            ? undefined
            : `$${1200 + (n % 5) * 300} - $${2200 + (n % 5) * 300}`
          : n % 5 === 0
            ? undefined
            : `$${90 + (n % 6) * 15}k - $${130 + (n % 6) * 20}k`;

      const extraSkills = ['git', 'agile', 'rest'].filter((s) => !archetype.skills.includes(s));
      const tags = [...archetype.skills, ...extraSkills.slice(0, (index + n) % 2)];

      const job = await prisma.job.create({
        data: {
          sourceId: source,
          externalId: `${DEMO_MARKER}${index}`,
          url: `https://example.com/demo/jobs/${index}`,
          title,
          company,
          location,
          workMode,
          seniority,
          salaryText,
          descriptionText: `${company} is hiring a ${title.toLowerCase()} to help build and scale our core platform. You'll work closely with product and design, own features end to end, and help raise the bar on code quality and testing.`,
          tags,
          postedAt,
          fetchedAt: postedAt,
          dedupKey: `${DEMO_MARKER}${source}-${index}`,
        },
      });
      jobIds.push(job.id);

      for (const skillName of archetype.skills) {
        const skill = await prisma.skill.findUnique({ where: { name: skillName } });
        if (!skill) continue;
        await prisma.jobSkill.create({
          data: { jobId: job.id, skillId: skill.id, confidence: 1, extractor: 'rules' },
        });
      }

      index++;
    }
  }

  console.log(`Seeded ${jobIds.length} demo jobs with extracted skills.`);
  return jobIds;
}

async function seedCrawlRuns() {
  const sources: Array<{ id: string; jobsNew: number }> = [
    { id: 'remoteok', jobsNew: 15 },
    { id: 'weworkremotely', jobsNew: 14 },
    { id: 'hn_whos_hiring', jobsNew: 13 },
    { id: 'itviec', jobsNew: 21 },
  ];
  for (const { id, jobsNew } of sources) {
    const finishedAt = daysAgo(0);
    await prisma.crawlRun.create({
      data: {
        sourceId: id,
        status: 'success',
        startedAt: new Date(finishedAt.getTime() - 45_000),
        finishedAt,
        jobsFound: jobsNew,
        jobsNew,
        jobsDuplicate: 0,
        errors: [],
      },
    });
  }
  console.log(`Seeded ${sources.length} crawl runs (all healthy).`);
}

async function seedRoadmap() {
  const profileService = new ProfileService(prisma);
  const insightsService = new InsightsService(prisma);
  const roadmapService = new RoadmapService(prisma, profileService, insightsService);

  await roadmapService.generate();
  const items = await roadmapService.list();

  // Mark the first half of weeks 1-3 as done, one item in progress, the rest todo —
  // so the roadmap page opens on a plan that's visibly already underway.
  const early = items.filter((i) => i.weekIndex <= 3);
  const doneCount = Math.floor(early.length / 2);
  for (let i = 0; i < early.length; i++) {
    if (i < doneCount) await roadmapService.patchItem(early[i]!.id, 'done');
    else if (i === doneCount) await roadmapService.patchItem(early[i]!.id, 'in_progress');
  }
  console.log(`Generated roadmap: ${items.length} items, ${doneCount} marked done.`);
}

async function seedReviewLogs() {
  const cards = await prisma.reviewCard.findMany({ take: 20, orderBy: { contentId: 'asc' } });
  let logCount = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]!;
    const grade = ([5, 4, 4, 3, 5, 0, 4, 3][i % 8] ?? 4) as Sm2Grade;
    const reviewedAt = daysAgo(14 - i);
    const previousInterval = card.intervalDays;
    const result = sm2({ easiness: card.easiness, intervalDays: card.intervalDays, repetitions: card.repetitions }, grade);
    const dueAt = new Date(reviewedAt.getTime() + result.dueInDays * 86_400_000);

    await prisma.reviewCard.update({
      where: { id: card.id },
      data: {
        easiness: result.easiness,
        intervalDays: result.intervalDays,
        repetitions: result.repetitions,
        lapses: result.lapsed ? { increment: 1 } : undefined,
        dueAt,
      },
    });
    await prisma.reviewLog.create({
      data: {
        cardId: card.id,
        grade,
        reviewedAt,
        previousInterval,
        nextInterval: result.intervalDays,
      },
    });
    logCount++;
  }
  console.log(`Seeded ${logCount} review logs.`);
}

async function seedApplications(jobIds: string[]) {
  // A spread of stages with a believable timeline, mixing job-linked and
  // manually-added applications the same way a real user's board would.
  const plan: Array<{ jobIndex?: number; manual?: { company: string; title: string }; stages: string[]; daysAgoStart: number }> = [
    { jobIndex: 2, stages: ['saved'], daysAgoStart: 2 },
    { jobIndex: 5, stages: ['saved', 'applied'], daysAgoStart: 9 },
    { jobIndex: 9, stages: ['saved', 'applied', 'screening'], daysAgoStart: 15 },
    { jobIndex: 14, stages: ['saved', 'applied', 'screening', 'interviewing'], daysAgoStart: 20 },
    { jobIndex: 20, stages: ['saved', 'applied', 'screening', 'interviewing', 'offer'], daysAgoStart: 26 },
    { jobIndex: 27, stages: ['saved', 'applied', 'rejected'], daysAgoStart: 18 },
    { manual: { company: 'Skyline Fintech', title: 'Senior Backend Engineer' }, stages: ['saved', 'applied'], daysAgoStart: 11 },
    { manual: { company: 'Palefire Studio', title: 'Full-Stack Engineer' }, stages: ['saved'], daysAgoStart: 4 },
  ];

  let count = 0;
  for (const entry of plan) {
    const job = entry.jobIndex !== undefined ? await prisma.job.findUnique({ where: { id: jobIds[entry.jobIndex] } }) : null;
    const company = job?.company ?? entry.manual!.company;
    const title = job?.title ?? entry.manual!.title;
    const createdAt = daysAgo(entry.daysAgoStart);
    const finalStage = entry.stages.at(-1)!;

    const application = await prisma.application.create({
      data: {
        jobId: job?.id,
        company,
        title,
        url: job?.url ?? `https://example.com/demo/manual/${count}`,
        stage: finalStage,
        appliedAt: entry.stages.includes('applied') ? daysAgo(entry.daysAgoStart - 1) : null,
        createdAt,
        updatedAt: daysAgo(Math.max(0, entry.daysAgoStart - entry.stages.length)),
        nextActionNote: finalStage === 'interviewing' ? 'Prep system design round' : null,
        nextActionAt: finalStage === 'interviewing' ? daysAgo(-3) : null,
      },
    });

    for (let i = 1; i < entry.stages.length; i++) {
      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          kind: 'stage_change',
          body: `Moved from ${entry.stages[i - 1]} to ${entry.stages[i]}`,
          occurredAt: daysAgo(entry.daysAgoStart - i),
        },
      });
    }
    count++;
  }
  console.log(`Seeded ${count} applications across the pipeline.`);
}

async function main() {
  const alreadySeeded = await prisma.job.findFirst({ where: { externalId: { startsWith: DEMO_MARKER } } });
  if (alreadySeeded) {
    console.log('Demo data already present — skipping (delete demo-* jobs first to reseed).');
    return;
  }

  await seedContent(prisma);
  const jobIds = await seedDemoJobs();
  await seedCrawlRuns();
  await seedApplications(jobIds);
  await seedReviewLogs();
  await seedRoadmap();

  console.log('\nDemo seed complete — the dashboard is ready to screenshot.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
