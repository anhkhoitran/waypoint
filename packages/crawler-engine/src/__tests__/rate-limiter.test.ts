import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimiter } from '../rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('spaces two requests to the same host by at least minIntervalMs', async () => {
    const limiter = new RateLimiter(1000, 10);
    const timestamps: number[] = [];

    const first = limiter.acquire('https://example.com/a').then(() => {
      timestamps.push(Date.now());
      limiter.release();
    });
    await vi.runAllTimersAsync();
    await first;

    const second = limiter.acquire('https://example.com/b').then(() => {
      timestamps.push(Date.now());
      limiter.release();
    });
    await vi.runAllTimersAsync();
    await second;

    expect(timestamps).toHaveLength(2);
    expect(timestamps[1]! - timestamps[0]!).toBeGreaterThanOrEqual(1000);
  });

  it('does not delay requests to different hosts', async () => {
    const limiter = new RateLimiter(1000, 10);
    const timestamps: number[] = [];

    const a = limiter.acquire('https://example.com/a').then(() => {
      timestamps.push(Date.now());
      limiter.release();
    });
    const b = limiter.acquire('https://other.com/a').then(() => {
      timestamps.push(Date.now());
      limiter.release();
    });

    await vi.runAllTimersAsync();
    await Promise.all([a, b]);

    expect(timestamps).toHaveLength(2);
    expect(timestamps[1]! - timestamps[0]!).toBeLessThan(1000);
  });

  it('respects the concurrency cap, queuing extra requests', async () => {
    const limiter = new RateLimiter(0, 1);
    const order: string[] = [];

    let releaseFirst!: () => void;
    const firstDone = new Promise<void>((resolve) => (releaseFirst = resolve));

    const first = limiter.acquire('https://example.com/a').then(() => {
      order.push('first-acquired');
      return firstDone.then(() => limiter.release());
    });

    // second should not acquire until first releases, since maxConcurrent=1
    const second = limiter.acquire('https://example.com/b').then(() => {
      order.push('second-acquired');
      limiter.release();
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(order).toEqual(['first-acquired']);

    releaseFirst();
    await vi.runAllTimersAsync();
    await Promise.all([first, second]);

    expect(order).toEqual(['first-acquired', 'second-acquired']);
  });
});
