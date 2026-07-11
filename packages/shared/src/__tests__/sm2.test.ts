import { describe, expect, it } from 'vitest';
import { sm2, type Sm2State } from '../sm2.js';

const initial: Sm2State = { easiness: 2.5, intervalDays: 0, repetitions: 0 };

describe('sm2', () => {
  it('produces the canonical all-5s sequence: intervals 1, 6, 16, 45', () => {
    let state = initial;

    state = sm2(state, 5);
    expect(state.intervalDays).toBe(1);
    expect(state.repetitions).toBe(1);
    expect(state.easiness).toBeCloseTo(2.6, 5);

    state = sm2(state, 5);
    expect(state.intervalDays).toBe(6);
    expect(state.repetitions).toBe(2);
    expect(state.easiness).toBeCloseTo(2.7, 5);

    state = sm2(state, 5);
    expect(state.intervalDays).toBe(16);
    expect(state.repetitions).toBe(3);
    expect(state.easiness).toBeCloseTo(2.8, 5);

    state = sm2(state, 5);
    expect(state.intervalDays).toBe(45);
    expect(state.repetitions).toBe(4);
    expect(state.easiness).toBeCloseTo(2.9, 5);
  });

  it('a grade below 3 (lapse) resets repetitions and interval to 1, even mid-chain', () => {
    let state = initial;
    state = sm2(state, 5);
    state = sm2(state, 5);
    state = sm2(state, 5); // repetitions: 3, intervalDays: 16

    const lapsed = sm2(state, 2);
    expect(lapsed.repetitions).toBe(0);
    expect(lapsed.intervalDays).toBe(1);
    expect(lapsed.dueInDays).toBe(1);
    expect(lapsed.lapsed).toBe(true);
  });

  it('a successful review is not marked lapsed', () => {
    const result = sm2(initial, 3);
    expect(result.lapsed).toBe(false);
  });

  it('easiness floors at 1.3 and never goes lower, even under repeated failing grades', () => {
    let state = initial;
    for (let i = 0; i < 10; i++) {
      state = sm2(state, 0);
    }
    expect(state.easiness).toBe(1.3);
  });

  it('easiness never exceeds a sane ceiling under repeated perfect grades either direction', () => {
    let state = initial;
    for (let i = 0; i < 5; i++) {
      state = sm2(state, 5);
    }
    // easiness grows by a flat +0.1 per grade-5 review — no runaway growth.
    expect(state.easiness).toBeCloseTo(3.0, 5);
  });

  it('property: intervalDays is always >= 1, for every grade', () => {
    for (let grade = 0 as const; grade <= 5; grade++) {
      const result = sm2(initial, grade as 0 | 1 | 2 | 3 | 4 | 5);
      expect(result.intervalDays).toBeGreaterThanOrEqual(1);
      expect(result.dueInDays).toBeGreaterThanOrEqual(1);
    }
  });

  it('property: intervalDays is always >= 1 across a long random-ish chain', () => {
    let state = initial;
    const grades: (0 | 1 | 2 | 3 | 4 | 5)[] = [5, 4, 3, 0, 5, 5, 2, 4, 5, 1, 5, 5, 5];
    for (const grade of grades) {
      state = sm2(state, grade);
      expect(state.intervalDays).toBeGreaterThanOrEqual(1);
    }
  });
});
