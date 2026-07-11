import type { BadgeTone } from '@waypoint/ui';
import type { WorkMode } from '@waypoint/shared';

export const workModeTone: Record<WorkMode, BadgeTone> = {
  remote: 'success',
  hybrid: 'info',
  onsite: 'warning',
  unknown: 'neutral',
};

export function scoreTone(score: number): BadgeTone {
  if (score >= 70) return 'success';
  if (score >= 40) return 'warning';
  return 'neutral';
}
