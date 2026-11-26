import { createRng } from "../ddm/rng";

export const COLORS = ["red", "green", "blue", "yellow"] as const;
export type StroopColor = (typeof COLORS)[number];
export type StroopCondition = "congruent" | "incongruent";

export interface StroopStimulus {
  /** The word that is displayed. */
  word: StroopColor;
  /** The ink colour it is displayed in (the correct answer). */
  ink: StroopColor;
  condition: StroopCondition;
}

/** Keyboard mapping: respond with the ink colour. */
export const STROOP_KEYS: Readonly<Record<string, StroopColor>> = {
  r: "red",
  g: "green",
  b: "blue",
  y: "yellow",
};

/** Map a KeyboardEvent.key to a colour response, or null if the key is not mapped. */
export function keyToColor(key: string): StroopColor | null {
  const k = key.toLowerCase();
  return Object.hasOwn(STROOP_KEYS, k) ? (STROOP_KEYS[k] ?? null) : null;
}

/** Fisher-Yates shuffle driven by the seeded RNG; returns a new array. */
export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * Generate a seeded Stroop trial list. Conditions are balanced (half/half, odd
 * trial counts give the extra trial to incongruent), colours are balanced
 * within each condition as far as the count allows, and no stimulus repeats
 * the same ink colour more than twice in a row.
 */
export function generateStroopTrials(
  count: number,
  seed: number,
): StroopStimulus[] {
  if (!Number.isInteger(count) || count < 0)
    throw new RangeError("count must be a non-negative integer");
  const rng = createRng(seed);
  const nCongruent = Math.floor(count / 2);
  const nIncongruent = count - nCongruent;

  const congruent = (n: number): StroopStimulus[] =>
    cycle(n, rng.next).map((c) => ({
      word: c,
      ink: c,
      condition: "congruent",
    }));
  const incongruent = (n: number): StroopStimulus[] =>
    cycle(n, rng.next).map((ink) => {
      const others = COLORS.filter((c) => c !== ink);
      const word = others[
        Math.floor(rng.next() * others.length)
      ] as StroopColor;
      return { word, ink, condition: "incongruent" };
    });

  const all = [...congruent(nCongruent), ...incongruent(nIncongruent)];
  // Reshuffle until no ink colour occurs three times in a row (bounded retries).
  let order = shuffle(all, rng.next);
  for (let attempt = 0; attempt < 50 && hasTriple(order); attempt++)
    order = shuffle(all, rng.next);
  return order;
}

/** n colours, each used floor(n/4) times, remainder drawn from a shuffled colour order. */
function cycle(n: number, rand: () => number): StroopColor[] {
  const out: StroopColor[] = [];
  while (out.length < n) {
    const block = shuffle(COLORS, rand);
    out.push(...block.slice(0, Math.min(block.length, n - out.length)));
  }
  return out;
}

function hasTriple(list: readonly StroopStimulus[]): boolean {
  for (let i = 2; i < list.length; i++) {
    if (list[i]?.ink === list[i - 1]?.ink && list[i]?.ink === list[i - 2]?.ink)
      return true;
  }
  return false;
}
