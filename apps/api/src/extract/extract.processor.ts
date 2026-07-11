import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { extractWithFallback } from '@waypoint/skill-extractor';
import type { Prisma } from '@prisma/client';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

export const EXTRACT_QUEUE = 'extract';

export interface ExtractJobData {
  jobId: string;
}

@Processor(EXTRACT_QUEUE)
export class ExtractProcessor extends WorkerHost {
  private readonly logger = new Logger(ExtractProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ExtractJobData>): Promise<void> {
    const { jobId } = job.data;
    const record = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!record) {
      this.logger.warn(`job ${jobId} no longer exists, skipping extraction`);
      return;
    }

    const result = await extractWithFallback(record.descriptionText, record.title);

    const skillRows =
      result.skills.length > 0
        ? await this.prisma.skill.findMany({
            where: { name: { in: result.skills.map((s) => s.skill) } },
          })
        : [];
    const idByName = new Map(skillRows.map((s) => [s.name, s.id]));
    const jobSkillData = result.skills
      .filter((s) => idByName.has(s.skill))
      .map((s) => ({
        jobId,
        skillId: idByName.get(s.skill)!,
        confidence: s.confidence,
        extractor: result.extractor,
      }));

    // Idempotent re-extraction: wipe this job's existing skills and write the
    // fresh set atomically, so a re-run never leaves stale + new rows mixed.
    await this.prisma.$transaction([
      this.prisma.jobSkill.deleteMany({ where: { jobId } }),
      ...(jobSkillData.length > 0 ? [this.prisma.jobSkill.createMany({ data: jobSkillData })] : []),
    ]);

    const updates: Prisma.JobUpdateInput = {};
    if (record.seniority === 'unknown' && result.seniority !== 'unknown') {
      updates.seniority = result.seniority;
    }
    if (!record.salaryText && result.salaryText) {
      updates.salaryText = result.salaryText;
    }
    if (Object.keys(updates).length > 0) {
      await this.prisma.job.update({ where: { id: jobId }, data: updates });
    }

    this.logger.log(
      `extracted job ${jobId}: ${jobSkillData.length} skills via ${result.extractor}`,
    );
  }
}
