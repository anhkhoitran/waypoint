import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RawJob } from '@waypoint/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../../adapter.js';
import { remoteOkAdapter } from '../../adapters/remoteok.js';

const fixturePath = fileURLToPath(new URL('../../__fixtures__/remoteok.json', import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

function makeContext(): AdapterContext {
  return {
    fetchText: vi.fn(),
    fetchJson: vi.fn().mockResolvedValue(fixture),
    log: vi.fn(),
  };
}

describe('remoteOkAdapter.discover', () => {
  let ctx: AdapterContext;

  beforeEach(() => {
    ctx = makeContext();
  });

  it('skips the legal-notice element (index 0)', async () => {
    const discovered = await remoteOkAdapter.discover(ctx);
    // Fixture has 4 dev-tagged jobs (9001001, 9001002, 9001003) out of 5 total
    // job entries + 1 legal notice; none of the discovered ids should be the
    // legal notice, which has no id field at all.
    expect(discovered.every((d) => d.externalId !== undefined)).toBe(true);
  });

  it('keeps jobs whose tags intersect the dev keep-list, drops the rest', async () => {
    const discovered = await remoteOkAdapter.discover(ctx);
    const ids = discovered.map((d) => d.externalId).sort();
    // 9001001 (react/node), 9001002 (python/backend), and 9001003 (marketing
    // role with a stray "dev" tag — accepted false positive) are kept;
    // 9001004 (HR, no dev tags) is dropped.
    expect(ids).toEqual(['9001001', '9001002', '9001003']);
  });

  it('maps fields correctly and attaches a fully-formed raw job', async () => {
    const discovered = await remoteOkAdapter.discover(ctx);
    const fullstack = discovered.find((d) => d.externalId === '9001001');
    expect(fullstack?.raw).toMatchObject({
      source: 'remoteok',
      externalId: '9001001',
      title: 'Fullstack Engineer (React / Node)',
      company: 'Mekong Labs',
      location: 'Worldwide',
      tags: ['react', 'node', 'typescript', 'postgresql', 'full stack'],
    });
    expect(fullstack?.raw?.postedAt).toBeInstanceOf(Date);
  });

  it('builds a salaryText range from salary_min/salary_max when present', async () => {
    const discovered = await remoteOkAdapter.discover(ctx);
    const backend = discovered.find((d) => d.externalId === '9001002');
    expect(backend?.raw?.salaryText).toBe('$60,000 – $85,000');

    const fullstack = discovered.find((d) => d.externalId === '9001001');
    expect(fullstack?.raw?.salaryText).toBeUndefined();
  });

  it('emits only Zod-valid RawJob objects', async () => {
    const discovered = await remoteOkAdapter.discover(ctx);
    for (const d of discovered) {
      expect(() => RawJob.parse(d.raw)).not.toThrow();
    }
  });

  it('fetches the RemoteOK API endpoint', async () => {
    await remoteOkAdapter.discover(ctx);
    expect(ctx.fetchJson).toHaveBeenCalledWith('https://remoteok.com/api');
  });
});
