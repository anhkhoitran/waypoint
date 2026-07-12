import type { BadgeTone } from '@waypoint/ui';
import type { ApplicationStage } from '@waypoint/shared';

// Active pipeline columns, left to right. Rejected/withdrawn render in a
// separate de-emphasized rail rather than as full board columns.
export const ACTIVE_STAGES: ApplicationStage[] = [
  'saved',
  'applied',
  'screening',
  'interviewing',
  'offer',
];
export const CLOSED_STAGES: ApplicationStage[] = ['rejected', 'withdrawn'];

export const STAGE_TONE: Record<ApplicationStage, BadgeTone> = {
  saved: 'neutral',
  applied: 'info',
  screening: 'warning',
  interviewing: 'accent',
  offer: 'success',
  rejected: 'neutral',
  withdrawn: 'neutral',
};
