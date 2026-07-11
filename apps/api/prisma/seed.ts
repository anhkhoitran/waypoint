import { PrismaClient } from '@prisma/client';
import { JobSource, SKILL_TAXONOMY } from '@waypoint/shared';

const prisma = new PrismaClient();

const displayNames: Record<JobSource, string> = {
  remoteok: 'RemoteOK',
  weworkremotely: 'WeWorkRemotely',
  hn_whos_hiring: 'HN Who’s Hiring',
  itviec: 'ITviec',
  topdev: 'TopDev',
  vietnamworks: 'VietnamWorks',
};

async function main() {
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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
