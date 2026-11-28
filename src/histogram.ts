import { simulateTrials } from "./ddm/simulate";
import type { DdmParams, Trial } from "./ddm/types";

export interface RtHistogram {
  /** Bin edges in seconds, length bins + 1. */
  edges: number[];
  /** Density of correct responses per bin: share of ALL trials in the bin / bin width (1/s). */
  correct: number[];
  /** Same for error responses. */
  error: number[];
}

/** Evenly spaced edges covering [lo, hi]. */
export function makeEdges(lo: number, hi: number, bins: number): number[] {
  if (!(hi > lo) || bins < 1)
    throw new RangeError("need hi > lo and bins >= 1");
  return Array.from(
    { length: bins + 1 },
    (_, i) => lo + ((hi - lo) * i) / bins,
  );
}

/**
 * Bin RTs into correct/error densities. Both are normalised by the total trial
 * count (including out-of-range trials), so the areas sum to the in-range share
 * and observed and simulated histograms are directly comparable.
 */
export function rtHistogram(
  trials: readonly Trial[],
  edges: readonly number[],
): RtHistogram {
  const bins = edges.length - 1;
  const correct = new Array<number>(bins).fill(0);
  const error = new Array<number>(bins).fill(0);
  const lo = edges[0]!;
  const hi = edges[bins]!;
  const width = (hi - lo) / bins;
  for (const t of trials) {
    if (!(t.rt >= lo && t.rt < hi)) continue;
    const i = Math.min(bins - 1, Math.floor((t.rt - lo) / width));
    (t.correct ? correct : error)[i]!++;
  }
  const n = trials.length || 1;
  const scale = (c: number): number => c / n / width;
  return {
    edges: [...edges],
    correct: correct.map(scale),
    error: error.map(scale),
  };
}

/** Model-predicted histogram: simulate the fitted parameters and bin the result. */
export function modelHistogram(
  params: DdmParams,
  edges: readonly number[],
  n = 4000,
  seed = 1,
): RtHistogram {
  return rtHistogram(simulateTrials(params, n, seed, 0.002), edges);
}
