import { createHash } from 'node:crypto';

/** Cheap fingerprint of a job's description text, used to detect when a
 * posting changed since it was last summarized (re-crawl updated the text). */
export function hashDescription(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
