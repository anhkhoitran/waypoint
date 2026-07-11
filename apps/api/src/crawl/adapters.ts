import {
  hnWhosHiringAdapter,
  itviecAdapter,
  remoteOkAdapter,
  weWorkRemotelyAdapter,
  type SourceAdapter,
} from '@waypoint/crawler-engine';
import type { JobSource } from '@waypoint/shared';

/** Sources with a real adapter today. TopDev/VietnamWorks are seeded but not yet implemented. */
export const REGISTERED_ADAPTERS: Partial<Record<JobSource, SourceAdapter>> = {
  remoteok: remoteOkAdapter,
  weworkremotely: weWorkRemotelyAdapter,
  hn_whos_hiring: hnWhosHiringAdapter,
  itviec: itviecAdapter,
};
