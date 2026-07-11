export type Sm2Grade = 0 | 1 | 2 | 3 | 4 | 5;

export interface Sm2State {
  easiness: number;
  intervalDays: number;
  repetitions: number;
}

export interface Sm2Result {
  easiness: number;
  intervalDays: number;
  repetitions: number;
  dueInDays: number;
  lapsed: boolean;
}

/**
 * Standard SM-2 (SuperMemo 2) spaced-repetition scheduler. Pure function —
 * callers persist the returned state and compute `dueAt = now + dueInDays`.
 *
 * Interval growth uses the *previous* easiness (not the one just updated by
 * this grade) — matching the original algorithm's `I(n) := I(n-1) * EF`,
 * where EF is the factor already in effect going into this repetition.
 */
export function sm2(state: Sm2State, grade: Sm2Grade): Sm2Result {
  const easiness = Math.max(1.3, state.easiness + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));

  if (grade < 3) {
    return { easiness, intervalDays: 1, repetitions: 0, dueInDays: 1, lapsed: true };
  }

  const repetitions = state.repetitions + 1;
  const intervalDays =
    repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(state.intervalDays * state.easiness);

  return { easiness, intervalDays, repetitions, dueInDays: intervalDays, lapsed: false };
}
