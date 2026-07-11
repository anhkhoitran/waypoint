/**
 * One-off data repair for jobs crawled before two descriptionText bugs were
 * fixed: (1) stripHtml never decoded HTML entities (&amp;/&nbsp;/etc. sat in
 * stored text as literal characters), and (2) the ITviec adapter's
 * description slice started at the `data-jobs--jd-scroll-target="jobContent"`
 * marker itself, leaking that attribute text and its orphaned `>` into the
 * front of the description. Safe to re-run: both cleanups are idempotent.
 *
 * Run once: `pnpm --filter @waypoint/api exec tsx scripts/repair-description-text.ts`
 */
import { PrismaClient } from '@prisma/client';
import { stripHtml } from '@waypoint/crawler-engine';

const prisma = new PrismaClient();

const ITVIEC_MARKER_PREFIX = /^data-jobs--jd-scroll-target="jobContent">\s*/;

async function main() {
  const jobs = await prisma.job.findMany({ select: { id: true, descriptionText: true } });
  let updated = 0;

  for (const job of jobs) {
    const withoutMarker = job.descriptionText.replace(ITVIEC_MARKER_PREFIX, '');
    const repaired = stripHtml(withoutMarker);
    if (repaired !== job.descriptionText) {
      await prisma.job.update({ where: { id: job.id }, data: { descriptionText: repaired } });
      updated++;
    }
  }

  console.log(`Repaired descriptionText for ${updated}/${jobs.length} job(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
