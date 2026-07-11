import { Injectable, NotFoundException } from '@nestjs/common';
import type { Job, Prisma } from '@prisma/client';
import type { JobListResponse, JobPatch, JobQuery, JobRecord } from '@waypoint/shared';
import { PrismaService } from '../prisma/prisma.service';
import { decodeCursor, encodeCursor } from './cursor';

const DEFAULT_LIMIT = 20;

function toJobRecord(row: Job): JobRecord {
  return {
    id: row.id,
    source: row.sourceId as JobRecord['source'],
    externalId: row.externalId,
    url: row.url,
    title: row.title,
    company: row.company,
    location: row.location,
    workMode: row.workMode as JobRecord['workMode'],
    seniority: row.seniority as JobRecord['seniority'],
    salaryText: row.salaryText,
    descriptionText: row.descriptionText,
    tags: row.tags,
    postedAt: row.postedAt,
    fetchedAt: row.fetchedAt,
    dedupKey: row.dedupKey,
    saved: row.saved,
    hidden: row.hidden,
  };
}

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: JobQuery): Promise<JobListResponse> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const conditions: Prisma.JobWhereInput[] = [{ hidden: false }];

    if (query.q) {
      conditions.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { company: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }
    if (query.source) conditions.push({ sourceId: query.source });
    if (query.workMode) conditions.push({ workMode: query.workMode });
    if (query.seniority) conditions.push({ seniority: query.seniority });
    if (query.saved !== undefined) conditions.push({ saved: query.saved });
    if (query.postedWithinDays) {
      conditions.push({
        postedAt: { gte: new Date(Date.now() - query.postedWithinDays * 86_400_000) },
      });
    }
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      conditions.push({
        OR: [
          { fetchedAt: { lt: cursor.fetchedAt } },
          { AND: [{ fetchedAt: cursor.fetchedAt }, { id: { lt: cursor.id } }] },
        ],
      });
    }

    const rows = await this.prisma.job.findMany({
      where: { AND: conditions },
      orderBy: [{ fetchedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last) : null;

    return { items: page.map(toJobRecord), nextCursor };
  }

  async patch(id: string, body: JobPatch): Promise<JobRecord> {
    try {
      const updated = await this.prisma.job.update({ where: { id }, data: body });
      return toJobRecord(updated);
    } catch {
      throw new NotFoundException(`job ${id} not found`);
    }
  }
}
