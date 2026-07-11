import { isKnownSkill, TrackId } from '@waypoint/shared';
import { z } from 'zod';

export const ContentTrack = z.object({
  id: TrackId,
  name: z.string().min(1),
  description: z.string().min(1),
});
export type ContentTrack = z.infer<typeof ContentTrack>;

export const ResourceKind = z.enum(['article', 'video', 'course', 'problem_set', 'book_chapter']);

export const ContentResource = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  kind: ResourceKind,
  note: z.string().optional(),
  estMinutes: z.number().int().positive(),
});
export type ContentResource = z.infer<typeof ContentResource>;

export const ContentTopic = z.object({
  slug: z.string().min(1),
  trackId: TrackId,
  name: z.string().min(1),
  order: z.number().int().positive(),
  difficulty: z.number().int().min(1).max(3),
  skills: z.array(z.string()).refine((skills) => skills.every(isKnownSkill), {
    message: 'topic skills must all be known taxonomy skill names',
  }),
  resources: z.array(ContentResource).min(1),
});
export type ContentTopic = z.infer<typeof ContentTopic>;

export const ContentCard = z.object({
  contentId: z.string().min(1),
  topicSlug: z.string().optional(),
  prompt: z.string().min(1),
  answer: z.string().min(1),
});
export type ContentCard = z.infer<typeof ContentCard>;

export interface ValidatedContent {
  tracks: ContentTrack[];
  topics: ContentTopic[];
  cardsByTrack: Record<string, ContentCard[]>;
}

/**
 * Validates the seed content JSON as a whole — schema-level checks via Zod,
 * plus cross-reference checks (topic.trackId exists, card.topicSlug exists,
 * card contentIds are globally unique) that a per-file Zod parse can't catch
 * alone. Throws on the first violation; used by both the seed script and its
 * unit test so malformed content fails CI, not runtime.
 */
export function validateContent(input: {
  tracks: unknown[];
  topics: unknown[];
  cardsByTrack: Record<string, unknown[]>;
}): ValidatedContent {
  const tracks = input.tracks.map((t) => ContentTrack.parse(t));
  const topics = input.topics.map((t) => ContentTopic.parse(t));

  const trackIds = new Set(tracks.map((t) => t.id));
  for (const topic of topics) {
    if (!trackIds.has(topic.trackId)) {
      throw new Error(`topic "${topic.slug}" references unknown track "${topic.trackId}"`);
    }
  }

  const topicSlugs = new Set(topics.map((t) => t.slug));
  const seenContentIds = new Set<string>();
  const cardsByTrack: Record<string, ContentCard[]> = {};

  for (const [trackId, rawCards] of Object.entries(input.cardsByTrack)) {
    if (!trackIds.has(trackId as TrackId)) {
      throw new Error(`card file "${trackId}" references unknown track`);
    }
    cardsByTrack[trackId] = rawCards.map((raw) => {
      const card = ContentCard.parse(raw);
      if (seenContentIds.has(card.contentId)) {
        throw new Error(`duplicate card contentId: "${card.contentId}"`);
      }
      seenContentIds.add(card.contentId);
      if (card.topicSlug && !topicSlugs.has(card.topicSlug)) {
        throw new Error(`card "${card.contentId}" references unknown topic slug "${card.topicSlug}"`);
      }
      return card;
    });
  }

  return { tracks, topics, cardsByTrack };
}
