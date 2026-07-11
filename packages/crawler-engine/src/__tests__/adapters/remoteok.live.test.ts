import { RawJob } from '@waypoint/shared';
import { describe, expect, it } from 'vitest';
import type { AdapterContext } from '../../adapter.js';
import { remoteOkAdapter } from '../../adapters/remoteok.js';

// Hits the real RemoteOK API. Skipped unless LIVE=1 is set, so normal test
// runs (and CI) never depend on network access or RemoteOK's uptime.
// Run manually with: LIVE=1 pnpm --filter @waypoint/crawler-engine test -- remoteok.live
describe.runIf(process.env.LIVE === '1')('remoteOkAdapter (live)', () => {
  it('discovers real jobs from the live API and emits valid RawJob objects', async () => {
    const ctx: AdapterContext = {
      fetchText: async (url) => {
        const res = await fetch(url, { headers: { 'user-agent': 'WaypointBot/0.1 (live test)' } });
        return res.text();
      },
      fetchJson: async <T,>(url: string): Promise<T> => {
        const res = await fetch(url, { headers: { 'user-agent': 'WaypointBot/0.1 (live test)' } });
        return res.json() as Promise<T>;
      },
      log: console.log,
    };

    const discovered = await remoteOkAdapter.discover(ctx);
    expect(discovered.length).toBeGreaterThan(0);
    for (const d of discovered) {
      expect(() => RawJob.parse(d.raw)).not.toThrow();
    }
  }, 20_000);
});
