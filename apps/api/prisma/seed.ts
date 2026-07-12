import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { JobSource, SKILL_TAXONOMY, TrackId } from '@waypoint/shared';
import { validateContent } from './content-schema';

const CONTENT_DIR = join(__dirname, 'content');

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(CONTENT_DIR, relativePath), 'utf8'));
}

const displayNames: Record<JobSource, string> = {
  remoteok: 'RemoteOK',
  weworkremotely: 'WeWorkRemotely',
  hn_whos_hiring: 'HN Who’s Hiring',
  itviec: 'ITviec',
  topdev: 'TopDev',
  vietnamworks: 'VietnamWorks',
};

// Reference/content data only — sources, skills, default profile, tracks,
// topics, resources, review cards. Shared by `db:seed` and `demo:seed` so
// both start from the same idempotent baseline.
export async function seedContent(prisma: PrismaClient) {
  for (const id of JobSource.options) {
    await prisma.source.upsert({
      where: { id },
      update: { name: displayNames[id] },
      create: { id, name: displayNames[id] },
    });
  }
  console.log(`Seeded ${JobSource.options.length} sources.`);

  for (const skill of SKILL_TAXONOMY) {
    await prisma.skill.upsert({
      where: { name: skill.name },
      update: { category: skill.category },
      create: { name: skill.name, category: skill.category },
    });
  }
  console.log(`Seeded ${SKILL_TAXONOMY.length} skills.`);

  // Only create the profile if it doesn't exist yet — re-seeding must never
  // clobber edits made via the Profile page.
  const existingProfile = await prisma.profile.findUnique({ where: { id: 'default' } });
  if (!existingProfile) {
    await prisma.profile.create({
      data: {
        id: 'default',
        skills: ['react', 'nestjs', 'typescript', 'node', 'postgresql', 'mysql'],
        yearsOfExperience: 3,
        targetSeniority: 'mid',
        targetWorkModes: ['remote', 'hybrid'],
        locations: ['Ho Chi Minh City'],
      },
    });
    console.log('Seeded default profile.');
  } else {
    console.log('Profile already exists, left untouched.');
  }

  const content = validateContent({
    tracks: readJson('tracks.json') as unknown[],
    topics: readJson('topics.json') as unknown[],
    cardsByTrack: Object.fromEntries(
      TrackId.options.map((id) => [id, readJson(`cards/${id}.json`) as unknown[]]),
    ),
  });

  for (const track of content.tracks) {
    await prisma.track.upsert({
      where: { id: track.id },
      update: { name: track.name, description: track.description },
      create: track,
    });
  }
  console.log(`Seeded ${content.tracks.length} tracks.`);

  let resourceCount = 0;
  for (const topic of content.topics) {
    const { resources, ...topicData } = topic;
    const topicRow = await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: topicData,
      create: topicData,
    });
    for (const resource of resources) {
      await prisma.resource.upsert({
        where: { topicId_url: { topicId: topicRow.id, url: resource.url } },
        update: resource,
        create: { ...resource, topicId: topicRow.id },
      });
      resourceCount++;
    }
  }
  console.log(`Seeded ${content.topics.length} topics and ${resourceCount} resources.`);

  let cardCount = 0;
  for (const [trackId, cards] of Object.entries(content.cardsByTrack)) {
    for (const card of cards) {
      await prisma.reviewCard.upsert({
        where: { contentId: card.contentId },
        // Only content fields are updated on re-seed — SM-2 review state
        // (easiness/intervalDays/dueAt/etc.) must never be reset by reseeding.
        update: {
          prompt: card.prompt,
          answer: card.answer,
          topicSlug: card.topicSlug,
        },
        create: { ...card, trackId },
      });
      cardCount++;
    }
  }
  console.log(`Seeded ${cardCount} review cards.`);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedContent(prisma)
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
