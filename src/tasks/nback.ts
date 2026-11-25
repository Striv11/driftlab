import { createRng } from "../ddm/rng";

export type NBackResponse = "match" | "nomatch";

export interface NBackStimulus {
  letter: string;
  /** True when this letter equals the one n positions earlier. */
  isTarget: boolean;
}

export const NBACK_KEYS: Readonly<Record<string, NBackResponse>> = {
  j: "match",
  f: "nomatch",
};

export function keyToNBack(key: string): NBackResponse | null {
  const k = key.toLowerCase();
  return Object.hasOwn(NBACK_KEYS, k) ? (NBACK_KEYS[k] ?? null) : null;
}

const LETTERS = "BCDFGHKLMNPQRSTVWXZ".split("");

/**
 * Seeded n-back sequence. The first n trials can never be targets. After
 * that each trial is a target with probability `targetRate` (exactly
 * round(rate * eligible) targets, placed at random positions); non-targets are
 * guaranteed to differ from the letter n back.
 */
export function generateNBack(
  count: number,
  n: number,
  seed: number,
  targetRate = 0.3,
): NBackStimulus[] {
  if (!Number.isInteger(count) || count < 0)
    throw new RangeError("count must be a non-negative integer");
  if (!Number.isInteger(n) || n < 1) throw new RangeError("n must be >= 1");
  if (targetRate < 0 || targetRate > 1)
    throw new RangeError("targetRate must be in [0, 1]");
  const rng = createRng(seed);
  const eligible = Math.max(0, count - n);
  const nTargets = Math.round(targetRate * eligible);

  // Choose target positions by partial Fisher-Yates over eligible indices.
  const idx = Array.from({ length: eligible }, (_, i) => i + n);
  for (let i = 0; i < nTargets; i++) {
    const j = i + Math.floor(rng.next() * (idx.length - i));
    [idx[i], idx[j]] = [idx[j] as number, idx[i] as number];
  }
  const targets = new Set(idx.slice(0, nTargets));

  const out: NBackStimulus[] = [];
  for (let i = 0; i < count; i++) {
    const back = i >= n ? (out[i - n] as NBackStimulus).letter : null;
    if (targets.has(i)) {
      out.push({ letter: back as string, isTarget: true });
    } else {
      const pool = LETTERS.filter((l) => l !== back);
      out.push({
        letter: pool[Math.floor(rng.next() * pool.length)] as string,
        isTarget: false,
      });
    }
  }
  return out;
}

export function isNBackCorrect(
  stimulus: NBackStimulus,
  response: NBackResponse,
): boolean {
  return (response === "match") === stimulus.isTarget;
}

export interface NBackScore {
  hits: number;
  misses: number;
  falseAlarms: number;
  correctRejections: number;
  hitRate: number;
  falseAlarmRate: number;
  /** Signal-detection sensitivity with the log-linear correction. */
  dPrime: number;
}

/** Inverse standard normal CDF (Acklam's rational approximation, |err| < 1.2e-9). */
export function normInv(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError("p must be in (0, 1)");
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const lo = 0.02425;
  const poly = (k: number[], x: number): number =>
    k.reduce((acc, v) => acc * x + v, 0);
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return poly(c, q) / (poly(d, q) * q + 1);
  }
  if (p > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -poly(c, q) / (poly(d, q) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (poly(a, r) * q) / (poly(b, r) * r + 1);
}

/**
 * Score responses. `null` responses (timeouts) count as "nomatch": a missed
 * target is a miss, and a non-target with no response is a correct rejection.
 * d' uses the log-linear correction (add 0.5 to each cell, 1 to each total),
 * which stays finite for perfect hit or false-alarm rates.
 */
export function scoreNBack(
  trials: readonly {
    stimulus: NBackStimulus;
    response: NBackResponse | null;
  }[],
): NBackScore {
  let hits = 0,
    misses = 0,
    falseAlarms = 0,
    correctRejections = 0;
  for (const t of trials) {
    const said = t.response === "match";
    if (t.stimulus.isTarget) {
      if (said) hits++;
      else misses++;
    } else if (said) falseAlarms++;
    else correctRejections++;
  }
  const nT = hits + misses;
  const nN = falseAlarms + correctRejections;
  const hitRate = nT ? hits / nT : NaN;
  const falseAlarmRate = nN ? falseAlarms / nN : NaN;
  const dPrime =
    nT && nN
      ? normInv((hits + 0.5) / (nT + 1)) -
        normInv((falseAlarms + 0.5) / (nN + 1))
      : NaN;
  return {
    hits,
    misses,
    falseAlarms,
    correctRejections,
    hitRate,
    falseAlarmRate,
    dPrime,
  };
}
