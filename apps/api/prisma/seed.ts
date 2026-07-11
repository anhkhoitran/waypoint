import { PrismaClient } from '@prisma/client';
import { JobSource } from '@waypoint/shared';

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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
