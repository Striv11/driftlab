import { ezDiffusion } from "./ez";
import { simulateTrials } from "./simulate";
import { summarize } from "./stats";
import type { DdmParams, Trial } from "./types";

/** Quantile probabilities used to cut RT distributions into 6 bins (.1/.2/.2/.2/.2/.1). */
export const QUANTILES = [0.1, 0.3, 0.5, 0.7, 0.9] as const;
/** Fewer trials than this on one side collapse its RT distribution to a single bin. */
const MIN_FOR_QUANTILES = 5;

export interface FitOptions {
  /** Simulated trials per objective evaluation (more = smoother, slower). */
  nSim?: number;
  /** Euler step for the fit simulations (s). */
  dt?: number;
  /** Seed of the common random numbers reused by every evaluation. */
  seed?: number;
  /** Nelder-Mead iteration cap. */
  maxIter?: number;
  /** Estimate starting-point bias z; otherwise z is fixed at 0.5. */
  freeZ?: boolean;
}

export interface FitResult {
  params: Required<DdmParams>;
  /** Final value of the chi-square quantile distance. */
  loss: number;
  iterations: number;
}

/** Linear-interpolated quantile of a sorted array. */
export function quantile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new RangeError("empty sample");
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (h - lo);
}

interface Cuts {
  /** Bin edges for correct and error RTs (empty = single bin). */
  correct: number[];
  error: number[];
}

function sortedRts(trials: readonly Trial[], correct: boolean): number[] {
  return trials
    .filter((t) => t.correct === correct)
    .map((t) => t.rt)
    .sort((x, y) => x - y);
}

function cutsFor(rts: number[]): number[] {
  return rts.length >= MIN_FOR_QUANTILES
    ? QUANTILES.map((p) => quantile(rts, p))
    : [];
}

/** Counts of trials in each bin of one response side, given the observed cut points. */
function binCounts(rts: readonly number[], cuts: readonly number[]): number[] {
  const counts = new Array<number>(cuts.length + 1).fill(0);
  for (const rt of rts) {
    let i = 0;
    while (i < cuts.length && rt > cuts[i]!) i++;
    counts[i]!++;
  }
  return counts;
}

/**
 * Chi-square distance between observed and simulated bin proportions
 * (quantile-probability style): the data's own quantiles define bins, and the
 * model must put the right mass in each, for correct and error RTs.
 */
function distance(
  obs: readonly Trial[],
  cuts: Cuts,
  sim: readonly Trial[],
): number {
  const n = obs.length;
  let chi = 0;
  for (const side of [true, false] as const) {
    const edges = side ? cuts.correct : cuts.error;
    const o = binCounts(sortedRts(obs, side), edges);
    const s = binCounts(sortedRts(sim, side), edges);
    for (let i = 0; i < o.length; i++) {
      const e = Math.max(s[i]! / sim.length, 1e-3) * n;
      chi += (o[i]! - e) ** 2 / e;
    }
  }
  return chi;
}

/** Minimal Nelder-Mead simplex minimiser. */
export function nelderMead(
  f: (x: number[]) => number,
  x0: number[],
  step: number[],
  maxIter: number,
  tol = 1e-6,
): { x: number[]; fx: number; iterations: number } {
  const n = x0.length;
  let pts = [
    x0,
    ...x0.map((_, i) => x0.map((v, j) => (i === j ? v + step[i]! : v))),
  ];
  let vals = pts.map(f);
  let it = 0;
  for (; it < maxIter; it++) {
    const order = vals.map((_, i) => i).sort((i, j) => vals[i]! - vals[j]!);
    pts = order.map((i) => pts[i]!);
    vals = order.map((i) => vals[i]!);
    if (Math.abs(vals[n]! - vals[0]!) < tol) break;
    const centroid = x0.map(
      (_, j) => pts.slice(0, n).reduce((s, p) => s + p[j]!, 0) / n,
    );
    const along = (k: number) =>
      centroid.map((c, j) => c + k * (pts[n]![j]! - c));
    const xr = along(-1);
    const fr = f(xr);
    if (fr < vals[0]!) {
      const xe = along(-2);
      const fe = f(xe);
      if (fe < fr) [pts[n], vals[n]] = [xe, fe];
      else [pts[n], vals[n]] = [xr, fr];
    } else if (fr < vals[n - 1]!) {
      [pts[n], vals[n]] = [xr, fr];
    } else {
      const xc = along(fr < vals[n]! ? -0.5 : 0.5);
      const fc = f(xc);
      if (fc < Math.min(fr, vals[n]!)) [pts[n], vals[n]] = [xc, fc];
      else {
        for (let i = 1; i <= n; i++) {
          pts[i] = pts[i]!.map((v, j) => pts[0]![j]! + 0.5 * (v - pts[0]![j]!));
          vals[i] = f(pts[i]!);
        }
      }
    }
  }
  let best = 0;
  for (let i = 1; i <= n; i++) if (vals[i]! < vals[best]!) best = i;
  return { x: pts[best]!, fx: vals[best]!, iterations: it };
}

const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));

/** Starting point from EZ-diffusion, falling back to typical values on degenerate data. */
function initial(trials: readonly Trial[]): DdmParams {
  try {
    const e = ezDiffusion(summarize(trials));
    if ([e.v, e.a, e.ter].every(Number.isFinite) && e.v > 0 && e.a > 0)
      return e;
  } catch {
    /* fall through to defaults */
  }
  const minRt = Math.min(...trials.map((t) => t.rt));
  return { v: 0.15, a: 0.12, ter: Math.max(0.05, minRt * 0.7) };
}

/**
 * Likelihood-free fit of v, a, Ter (and optionally starting point z) by
 * minimising the quantile-bin chi-square between the data and simulations.
 * Simulations reuse one seed (common random numbers) so the objective is
 * deterministic and smooth enough for simplex search.
 */
export function fitQuantiles(
  trials: readonly Trial[],
  opts: FitOptions = {},
): FitResult {
  if (trials.length < 20) throw new RangeError("need at least 20 trials");
  const {
    nSim = 1000,
    dt = 0.002,
    seed = 12345,
    maxIter = 150,
    freeZ = false,
  } = opts;
  const cuts: Cuts = {
    correct: cutsFor(sortedRts(trials, true)),
    error: cutsFor(sortedRts(trials, false)),
  };
  const minRt = Math.min(...trials.map((t) => t.rt));
  const start = initial(trials);

  const toParams = (x: number[]): Required<DdmParams> => ({
    v: clamp(x[0]!, 0.005, 1),
    a: clamp(x[1]!, 0.02, 0.6),
    ter: clamp(x[2]!, 0, minRt),
    z: freeZ ? clamp(x[3]!, 0.1, 0.9) : 0.5,
  });
  const objective = (x: number[]): number => {
    const p = toParams(x);
    const clamped = [p.v, p.a, p.ter, p.z];
    // Penalise leaving the feasible box so the simplex is pulled back inside.
    const out = x.reduce((s, v, i) => s + (v - clamped[i]!) ** 2, 0);
    return (
      distance(trials, cuts, simulateTrials(p, nSim, seed, dt)) + 1e4 * out
    );
  };

  const k = freeZ ? 4 : 3;
  const x0 = [
    clamp(start.v, 0.01, 1),
    start.a,
    clamp(start.ter, 0, minRt),
    0.5,
  ];
  const step = [0.2 * x0[0]!, 0.2 * x0[1]!, 0.03, 0.08];
  const r = nelderMead(objective, x0.slice(0, k), step.slice(0, k), maxIter);
  return { params: toParams(r.x), loss: r.fx, iterations: r.iterations };
}
