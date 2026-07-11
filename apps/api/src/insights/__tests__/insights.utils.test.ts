import { describe, expect, it } from 'vitest';
import {
  bucketIndex,
  computeBuckets,
  formatUsd,
  median,
  parseUsdMidpoint,
  parseWindowDays,
} from '../insights.utils';

describe('parseWindowDays', () => {
  it('parses "30d" style strings', () => {
    expect(parseWindowDays('30d', 7)).toBe(30);
    expect(parseWindowDays('7d', 30)).toBe(7);
    expect(parseWindowDays('90d', 30)).toBe(90);
  });

  it('falls back on undefined or malformed input', () => {
    expect(parseWindowDays(undefined, 30)).toBe(30);
    expect(parseWindowDays('abc', 30)).toBe(30);
    expect(parseWindowDays('30', 30)).toBe(30);
  });
});

describe('parseUsdMidpoint', () => {
  it('parses a k-range', () => {
    expect(parseUsdMidpoint('$60k – $85k')).toBe(72500);
    expect(parseUsdMidpoint('$60k-$85k')).toBe(72500);
  });

  it('parses a full annual range', () => {
    expect(parseUsdMidpoint('$60,000 - $85,000')).toBe(72500);
  });

  it('parses and annualizes a monthly figure', () => {
    expect(parseUsdMidpoint('$1,800/month')).toBe(21600);
  });

  it('returns null for VND text — never mixes currencies', () => {
    expect(parseUsdMidpoint('25–40 triệu VND')).toBeNull();
  });

  it('returns null for unparseable text', () => {
    expect(parseUsdMidpoint('Competitive salary')).toBeNull();
  });
});

describe('formatUsd', () => {
  it('formats amounts >= 1000 as "$Xk"', () => {
    expect(formatUsd(72500)).toBe('$73k');
    expect(formatUsd(60000)).toBe('$60k');
  });

  it('formats amounts < 1000 as a plain dollar figure', () => {
    expect(formatUsd(900)).toBe('$900');
  });
});

describe('median', () => {
  it('returns null for an empty array', () => {
    expect(median([])).toBeNull();
  });

  it('returns the middle value for an odd-length array', () => {
    expect(median([1, 3, 2])).toBe(2);
  });

  it('averages the two middle values for an even-length array', () => {
    expect(median([70000, 80000])).toBe(75000);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('computeBuckets / bucketIndex', () => {
  it('computes weekly buckets covering the window', () => {
    const plan = computeBuckets(21, 'week');
    expect(plan.bucketCount).toBe(3);
    expect(plan.labels).toHaveLength(3);
  });

  it('computes daily buckets covering the window', () => {
    const plan = computeBuckets(5, 'day');
    expect(plan.bucketCount).toBe(5);
  });

  it('places a date at the start of the window in bucket 0', () => {
    const plan = computeBuckets(21, 'week');
    const idx = bucketIndex(plan.since, plan.since, plan.bucketMs, plan.bucketCount);
    expect(idx).toBe(0);
  });

  it('places a date at the end of the window in the last bucket', () => {
    const plan = computeBuckets(21, 'week');
    const idx = bucketIndex(new Date(), plan.since, plan.bucketMs, plan.bucketCount);
    expect(idx).toBe(plan.bucketCount - 1);
  });

  it('clamps out-of-range dates into the nearest valid bucket', () => {
    const plan = computeBuckets(21, 'week');
    const beforeWindow = new Date(plan.since.getTime() - 86_400_000);
    expect(bucketIndex(beforeWindow, plan.since, plan.bucketMs, plan.bucketCount)).toBe(0);
  });
});
