import { createRng } from "../ddm/rng";
import { shuffle } from "./stroop";

export type SearchResponse = "present" | "absent";
export type SearchKind = "feature" | "conjunction";

export interface SearchItem {
  /** Grid cell index. */
  cell: number;
  color: "red" | "green";
  shape: "square" | "circle";
  isTarget: boolean;
}

export interface SearchStimulus {
  setSize: number;
  targetPresent: boolean;
  kind: SearchKind;
  items: SearchItem[];
}

export const SEARCH_KEYS: Readonly<Record<string, SearchResponse>> = {
  j: "present",
  f: "absent",
};

export function keyToSearch(key: string): SearchResponse | null {
  const k = key.toLowerCase();
  return Object.hasOwn(SEARCH_KEYS, k) ? (SEARCH_KEYS[k] ?? null) : null;
}

export const GRID_CELLS = 36;

/**
 * Seeded visual-search trials. Target: red circle. Feature search uses green
 * circle distractors (colour alone distinguishes the target); conjunction
 * search mixes red squares and green circles. Set sizes and presence are
 * fully crossed and balanced, then shuffled.
 */
export function generateSearchTrials(
  count: number,
  seed: number,
  kind: SearchKind,
  setSizes: readonly number[] = [4, 8, 16],
): SearchStimulus[] {
  if (!Number.isInteger(count) || count < 0)
    throw new RangeError("count must be a non-negative integer");
  if (
    setSizes.length === 0 ||
    setSizes.some((s) => !Number.isInteger(s) || s < 1 || s > GRID_CELLS)
  )
    throw new RangeError(`set sizes must be integers in [1, ${GRID_CELLS}]`);
  const rng = createRng(seed);
  const cells = Array.from({ length: GRID_CELLS }, (_, i) => i);
  const cond = setSizes.flatMap((s) => [
    { s, present: true },
    { s, present: false },
  ]);
  const plan = Array.from(
    { length: count },
    (_, i) => cond[i % cond.length] as (typeof cond)[number],
  );
  return shuffle(plan, rng.next).map(({ s, present }) => {
    const pos = shuffle(cells, rng.next).slice(0, s);
    const items: SearchItem[] = pos.map((cell, i) => {
      if (present && i === 0)
        return { cell, color: "red", shape: "circle", isTarget: true };
      if (kind === "feature")
        return { cell, color: "green", shape: "circle", isTarget: false };
      return rng.next() < 0.5
        ? { cell, color: "red", shape: "square", isTarget: false }
        : { cell, color: "green", shape: "circle", isTarget: false };
    });
    return {
      setSize: s,
      targetPresent: present,
      kind,
      items: shuffle(items, rng.next),
    };
  });
}

export function isSearchCorrect(
  stimulus: SearchStimulus,
  response: SearchResponse,
): boolean {
  return (response === "present") === stimulus.targetPresent;
}

export interface SearchSlope {
  /** ms per additional item. */
  slopeMsPerItem: number;
  /** ms at set size 0. */
  interceptMs: number;
  r2: number;
  /** Number of distinct set sizes used. */
  points: number;
}

export interface SearchSlopes {
  present: SearchSlope | null;
  absent: SearchSlope | null;
}

/** Ordinary least squares; null with fewer than two distinct x values. */
export function linearFit(
  xs: readonly number[],
  ys: readonly number[],
): SearchSlope | null {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0,
    sxy = 0,
    syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - mx;
    const dy = (ys[i] as number) - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return {
    slopeMsPerItem: slope,
    interceptMs: my - slope * mx,
    r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy),
    points: new Set(xs).size,
  };
}

/**
 * RT-by-set-size slopes (ms/item), separately for target-present and
 * target-absent trials. Only correct trials with a recorded RT (seconds) count;
 * per-set-size means are regressed on set size.
 */
export function searchSlopes(
  trials: readonly {
    stimulus: SearchStimulus;
    correct: boolean;
    rt: number | null;
  }[],
): SearchSlopes {
  const fit = (present: boolean): SearchSlope | null => {
    const bySize = new Map<number, number[]>();
    for (const t of trials) {
      if (t.stimulus.targetPresent !== present || !t.correct || t.rt === null)
        continue;
      const list = bySize.get(t.stimulus.setSize) ?? [];
      list.push(t.rt * 1000);
      bySize.set(t.stimulus.setSize, list);
    }
    const sizes = [...bySize.keys()].sort((a, b) => a - b);
    const means = sizes.map((s) => {
      const l = bySize.get(s) as number[];
      return l.reduce((a, b) => a + b, 0) / l.length;
    });
    return linearFit(sizes, means);
  };
  return { present: fit(true), absent: fit(false) };
}
