import { describe, expect, it } from "vitest";
import { analyzeStroop, type StroopResult } from "./analysis";
import { createRng } from "./ddm/rng";
import { simulateTrials } from "./ddm/simulate";
import type { StroopCondition } from "./tasks/stroop";

function mk(
  condition: StroopCondition,
  rt: number | null,
  correct = true,
): StroopResult {
  return {
    index: 0,
    stimulus: {
      word: condition === "congruent" ? "red" : "blue",
      ink: "red",
      condition,
    },
    response: rt === null ? null : "red",
    correct: rt !== null && correct,
    rt,
    timedOut: rt === null,
  };
}

function fromModel(
  condition: StroopCondition,
  p: { v: number; a: number; ter: number },
  n: number,
  seed: number,
): StroopResult[] {
  return simulateTrials(p, n, seed).map((t) => mk(condition, t.rt, t.correct));
}

describe("analyzeStroop", () => {
  it("handles an empty session", () => {
    const a = analyzeStroop([]);
    expect(a.overall.valid).toBe(0);
    expect(a.stroopEffect).toBeNull();
    expect(a.interpretation[0]).toMatch(/No valid responses/);
  });

  it("drops timeouts and anticipations from valid counts", () => {
    const rs = [
      mk("congruent", null),
      mk("congruent", 0.05),
      mk("congruent", 0.5),
      mk("congruent", 0.6, false),
    ];
    const c = analyzeStroop(rs).congruent;
    expect(c.presented).toBe(4);
    expect(c.valid).toBe(2);
    expect(c.accuracy).toBeCloseTo(0.5);
    expect(c.meanRt).toBeCloseTo(0.5);
    expect(c.fit).toBeNull(); // below MIN_TRIALS_FOR_FIT
  });

  it("computes the Stroop effect and detects lower drift for conflict", () => {
    const rs = [
      ...fromModel("congruent", { v: 0.3, a: 0.12, ter: 0.3 }, 300, 1),
      ...fromModel("incongruent", { v: 0.18, a: 0.12, ter: 0.3 }, 300, 2),
    ];
    const a = analyzeStroop(rs);
    expect(a.stroopEffect).toBeGreaterThan(0.02);
    expect(a.congruent.fit?.v).toBeGreaterThan(a.incongruent.fit?.v ?? 99);
    expect(a.interpretation.join(" ")).toMatch(/Stroop effect/);
    expect(a.interpretation.join(" ")).toMatch(/drift was lower/);
  });

  it("does not throw on perfectly constant RTs (zero variance)", () => {
    const rs = Array.from({ length: 20 }, () => mk("congruent", 0.5));
    expect(analyzeStroop(rs).congruent.fit).toBeNull();
  });

  it("copes with perfect accuracy via the edge correction", () => {
    const rng = createRng(5);
    const rs = Array.from({ length: 40 }, (_, i) =>
      mk(i % 2 ? "congruent" : "incongruent", 0.4 + 0.2 * rng.next()),
    );
    const a = analyzeStroop(rs);
    expect(a.overall.fit).not.toBeNull();
    expect(Number.isFinite(a.overall.fit?.ter)).toBe(true);
  });
});
