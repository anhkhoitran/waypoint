interface Cursor {
  fetchedAt: string;
  id: string;
}

/** Opaque cursor encoding the (fetchedAt, id) tiebreaker for stable pagination. */
export function encodeCursor(job: { fetchedAt: Date; id: string }): string {
  const payload: Cursor = { fetchedAt: job.fetchedAt.toISOString(), id: job.id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): { fetchedAt: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Cursor;
    return { fetchedAt: new Date(parsed.fetchedAt), id: parsed.id };
  } catch {
    throw new Error('malformed cursor');
  }
}
