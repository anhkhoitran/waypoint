import type { BadgeTone } from '@waypoint/ui';
import type { ResourceKind, TrackId } from '@waypoint/shared';
import type { IconName } from '../components/Icon';

// Track display names are translated — see the `track.*` keys in
// src/i18n/locales/{en,vi}.json — use `t(\`track.${trackId}\`)` at call sites.

export const TRACK_TONE: Record<TrackId, BadgeTone> = {
  dsa: 'accent',
  system_design: 'info',
  cloud: 'warning',
  web: 'success',
};

export const RESOURCE_KIND_ICON: Record<ResourceKind, IconName> = {
  article: 'article',
  video: 'play-circle',
  course: 'graduation-cap',
  problem_set: 'list-checks',
  book_chapter: 'book',
};
