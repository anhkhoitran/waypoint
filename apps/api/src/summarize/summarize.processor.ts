import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CURRENT_SUMMARY_MODEL, SUMMARY_PROMPT_VERSION, summarizeWithFallback } from '@waypoint/job-summarizer';
import { classifyRelevance } from '@waypoint/skill-extractor';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { hashDescription } from './hash';

export const SUMMARIZE_QUEUE = 'summarize';

export interface SummarizeJobData {
  jobId: string;
}

@Processor(SUMMARIZE_QUEUE, { concurrency: 1 })
export class SummarizeProcessor extends WorkerHost {
  private readonly logger = new Logger(SummarizeProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<SummarizeJobData>): Promise<void> {
    const { jobId } = job.data;
    const record = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!record) {
      this.logger.warn(`job ${jobId} no longer exists, skipping summarization`);
      return;
    }

    // Computed on the fly (not read from record.relevant) so this holds even
    // for jobs enqueued before the extract pipeline set their flag, and for
    // anything still sitting in the queue from before relevance filtering
    // existed. Cheap, deterministic, and the whole point of the pre-filter:
    // never spend an LLM call on a non-SWE/IT posting.
    if (!classifyRelevance(record.title, record.descriptionText, record.tags)) {
      this.logger.log(`job ${jobId} is not SWE/IT-relevant, skipping summarization`);
      return;
    }

    const sourceHash = hashDescription(record.descriptionText);
    const existing = await this.prisma.jobSummary.findUnique({ where: { jobId } });
    const isCurrent =
      existing?.model === CURRENT_SUMMARY_MODEL &&
      existing.promptVersion === SUMMARY_PROMPT_VERSION &&
      existing.sourceHash === sourceHash;
    if (isCurrent) {
      this.logger.log(`job ${jobId} already has a current summary, skipping`);
      return;
    }

    const result = await summarizeWithFallback(record.descriptionText, record.title);
    if (!result) {
      // Ollama down, timed out, or the output failed validation — leave any
      // prior summary in place and try again on the next crawl/backfill.
      this.logger.log(`job ${jobId}: summarization unavailable this run`);
      return;
    }

    await this.prisma.jobSummary.upsert({
      where: { jobId },
      create: {
        jobId,
        summary: result.summary,
        responsibilities: result.responsibilities,
        requirements: result.requirements,
        niceToHave: result.niceToHave,
        benefits: result.benefits,
        roleFunction: result.roleFunction,
        yearsExperienceMin: result.yearsExperienceMin,
        model: result.model,
        promptVersion: SUMMARY_PROMPT_VERSION,
        sourceHash,
      },
      update: {
        summary: result.summary,
        responsibilities: result.responsibilities,
        requirements: result.requirements,
        niceToHave: result.niceToHave,
        benefits: result.benefits,
        roleFunction: result.roleFunction,
        yearsExperienceMin: result.yearsExperienceMin,
        model: result.model,
        promptVersion: SUMMARY_PROMPT_VERSION,
        sourceHash,
        generatedAt: new Date(),
      },
    });

    this.logger.log(`summarized job ${jobId} via ${result.model}`);
  }
}
