import { CURRENT_SUMMARY_MODEL, SUMMARY_PROMPT_VERSION, summarizeWithFallback } from '@waypoint/job-summarizer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashDescription } from '../hash';
import { SummarizeProcessor } from '../summarize.processor';

vi.mock('@waypoint/job-summarizer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waypoint/job-summarizer')>();
  return { ...actual, summarizeWithFallback: vi.fn() };
});

function makePrisma() {
  return {
    job: { findUnique: vi.fn() },
    jobSummary: { findUnique: vi.fn(), upsert: vi.fn() },
  };
}

function fakeJobRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'j1',
    title: 'Senior Backend Engineer',
    descriptionText: 'We need a backend engineer with 5+ years of experience.',
    tags: [],
    ...overrides,
  };
}

const summarizeMock = vi.mocked(summarizeWithFallback);

describe('SummarizeProcessor.process', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let processor: SummarizeProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = makePrisma();
    processor = new SummarizeProcessor(prisma as never);
  });

  it('skips jobs that no longer exist', async () => {
    prisma.job.findUnique.mockResolvedValue(null);
    await processor.process({ data: { jobId: 'gone' } } as never);
    expect(prisma.jobSummary.findUnique).not.toHaveBeenCalled();
    expect(summarizeMock).not.toHaveBeenCalled();
  });

  it('skips a non-SWE/IT job without touching the summary table or the LLM', async () => {
    prisma.job.findUnique.mockResolvedValue(
      fakeJobRow({
        title: 'Virtual Executive Assistant',
        descriptionText: 'Provide administrative support: calendar, travel, and email triage.',
      }),
    );

    await processor.process({ data: { jobId: 'j1' } } as never);

    expect(prisma.jobSummary.findUnique).not.toHaveBeenCalled();
    expect(summarizeMock).not.toHaveBeenCalled();
    expect(prisma.jobSummary.upsert).not.toHaveBeenCalled();
  });

  it('skips re-summarizing when an existing summary already matches model + promptVersion + sourceHash', async () => {
    const row = fakeJobRow();
    prisma.job.findUnique.mockResolvedValue(row);
    prisma.jobSummary.findUnique.mockResolvedValue({
      model: CURRENT_SUMMARY_MODEL,
      promptVersion: SUMMARY_PROMPT_VERSION,
      sourceHash: hashDescription(row.descriptionText),
    });

    await processor.process({ data: { jobId: 'j1' } } as never);

    expect(summarizeMock).not.toHaveBeenCalled();
    expect(prisma.jobSummary.upsert).not.toHaveBeenCalled();
  });

  it('re-summarizes when the existing summary is stale', async () => {
    const row = fakeJobRow();
    prisma.job.findUnique.mockResolvedValue(row);
    prisma.jobSummary.findUnique.mockResolvedValue({
      model: CURRENT_SUMMARY_MODEL,
      promptVersion: SUMMARY_PROMPT_VERSION - 1, // stale
      sourceHash: hashDescription(row.descriptionText),
    });
    summarizeMock.mockResolvedValue({
      summary: 'A backend role.',
      responsibilities: [],
      requirements: [],
      niceToHave: [],
      benefits: [],
      roleFunction: 'backend',
      yearsExperienceMin: 5,
      model: CURRENT_SUMMARY_MODEL,
    });

    await processor.process({ data: { jobId: 'j1' } } as never);

    expect(summarizeMock).toHaveBeenCalledWith(row.descriptionText, row.title);
    expect(prisma.jobSummary.upsert).toHaveBeenCalledTimes(1);
  });

  it('upserts a fresh summary for a job with none yet', async () => {
    const row = fakeJobRow();
    prisma.job.findUnique.mockResolvedValue(row);
    prisma.jobSummary.findUnique.mockResolvedValue(null);
    summarizeMock.mockResolvedValue({
      summary: 'A backend role.',
      responsibilities: ['Ship APIs'],
      requirements: ['5+ years experience'],
      niceToHave: [],
      benefits: [],
      roleFunction: 'backend',
      yearsExperienceMin: 5,
      model: CURRENT_SUMMARY_MODEL,
    });

    await processor.process({ data: { jobId: 'j1' } } as never);

    expect(prisma.jobSummary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobId: 'j1' },
        create: expect.objectContaining({
          jobId: 'j1',
          summary: 'A backend role.',
          roleFunction: 'backend',
          promptVersion: SUMMARY_PROMPT_VERSION,
        }),
      }),
    );
  });

  it('leaves any prior summary untouched when summarization is unavailable this run', async () => {
    const row = fakeJobRow();
    prisma.job.findUnique.mockResolvedValue(row);
    prisma.jobSummary.findUnique.mockResolvedValue(null);
    summarizeMock.mockResolvedValue(null); // Ollama down / invalid output

    await processor.process({ data: { jobId: 'j1' } } as never);

    expect(prisma.jobSummary.upsert).not.toHaveBeenCalled();
  });
});
