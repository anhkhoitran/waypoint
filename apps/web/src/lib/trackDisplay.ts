import type { BadgeTone } from '@waypoint/ui';
import type { ResourceKind, TrackId } from '@waypoint/shared';
import type { IconName } from '../components/Icon';

export const TRACK_LABELS: Record<TrackId, string> = {
  dsa: 'DSA',
  system_design: 'System Design',
  cloud: 'Cloud',
  web: 'Web',
};

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
