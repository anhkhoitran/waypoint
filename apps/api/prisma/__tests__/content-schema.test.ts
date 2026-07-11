import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TrackId } from '@waypoint/shared';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../content-schema';

const CONTENT_DIR = join(__dirname, '..', 'content');

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(CONTENT_DIR, relativePath), 'utf8'));
}

function loadRealContent() {
  return {
    tracks: readJson('tracks.json') as unknown[],
    topics: readJson('topics.json') as unknown[],
    cardsByTrack: Object.fromEntries(
      TrackId.options.map((id) => [id, readJson(`cards/${id}.json`) as unknown[]]),
    ),
  };
}

describe('validateContent — real seed content', () => {
  it('validates without throwing and meets the Phase 3 exit-criteria minimums', () => {
    const content = validateContent(loadRealContent());

    expect(content.tracks).toHaveLength(4);
    expect(content.topics.length).toBeGreaterThanOrEqual(40);

    const totalResources = content.topics.reduce((n, t) => n + t.resources.length, 0);
    expect(totalResources).toBeGreaterThanOrEqual(80);

    const totalCards = Object.values(content.cardsByTrack).reduce((n, cards) => n + cards.length, 0);
    expect(totalCards).toBeGreaterThanOrEqual(100);
  });

  it('every topic belongs to one of the 4 tracks', () => {
    const content = validateContent(loadRealContent());
    const trackIds = new Set(content.tracks.map((t) => t.id));
    for (const topic of content.topics) {
      expect(trackIds.has(topic.trackId)).toBe(true);
    }
  });
});

describe('validateContent — malformed content is rejected', () => {
  const validTracks = [{ id: 'dsa', name: 'DSA', description: 'desc' }];
  const validTopic = {
    slug: 'arrays',
    trackId: 'dsa',
    name: 'Arrays',
    order: 1,
    difficulty: 1,
    skills: [],
    resources: [{ title: 'x', url: 'https://example.com', kind: 'article', estMinutes: 10 }],
  };

  it('rejects a topic referencing an unknown track', () => {
    const badTopic = { ...validTopic, trackId: 'quantum_computing' };
    expect(() =>
      validateContent({ tracks: validTracks, topics: [badTopic], cardsByTrack: {} }),
    ).toThrow();
  });

  it('rejects a topic with an unknown taxonomy skill', () => {
    const badTopic = { ...validTopic, skills: ['not-a-real-skill'] };
    expect(() =>
      validateContent({ tracks: validTracks, topics: [badTopic], cardsByTrack: {} }),
    ).toThrow();
  });

  it('rejects duplicate card contentIds across track files', () => {
    const card = { contentId: 'dup-1', prompt: 'p', answer: 'a' };
    expect(() =>
      validateContent({
        tracks: validTracks,
        topics: [validTopic],
        cardsByTrack: { dsa: [card, card] },
      }),
    ).toThrow();
  });

  it('rejects a card referencing an unknown topic slug', () => {
    const card = { contentId: 'c-1', topicSlug: 'does-not-exist', prompt: 'p', answer: 'a' };
    expect(() =>
      validateContent({
        tracks: validTracks,
        topics: [validTopic],
        cardsByTrack: { dsa: [card] },
      }),
    ).toThrow();
  });

  it('rejects a resource with a non-URL string', () => {
    const badTopic = {
      ...validTopic,
      resources: [{ title: 'x', url: 'not-a-url', kind: 'article', estMinutes: 10 }],
    };
    expect(() =>
      validateContent({ tracks: validTracks, topics: [badTopic], cardsByTrack: {} }),
    ).toThrow();
  });
});
