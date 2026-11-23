import type { Summary, Trial } from "./types";

/** Reduce trials to the EZ sufficient statistics (correct-trial RT mean and variance). */
export function summarize(trials: readonly Trial[]): Summary {
  const n = trials.length;
  const correct = trials.filter((t) => t.correct);
  if (n === 0 || correct.length < 2) {
    throw new RangeError("need at least 2 correct trials");
  }
  const mrt = correct.reduce((s, t) => s + t.rt, 0) / correct.length;
  const vrt =
    correct.reduce((s, t) => s + (t.rt - mrt) ** 2, 0) / (correct.length - 1);
  return { n, pc: correct.length / n, mrt, vrt };
}
