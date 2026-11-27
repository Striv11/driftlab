import { describe, expect, it } from "vitest";
import { fitQuantiles, nelderMead, quantile } from "./fit";
import { simulateTrials } from "./simulate";
import { summarize } from "./stats";
import { ezDiffusion } from "./ez";

describe("quantile", () => {
  it("interpolates", () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([0, 10], 0.25)).toBe(2.5);
    expect(() => quantile([], 0.5)).toThrow();
  });
});

describe("nelderMead", () => {
  it("minimises a shifted quadratic", () => {
    const r = nelderMead(
      ([x, y]) => (x! - 1) ** 2 + 3 * (y! + 2) ** 2,
      [0, 0],
      [0.5, 0.5],
      300,
      1e-12,
    );
    expect(r.x[0]).toBeCloseTo(1, 2);
    expect(r.x[1]).toBeCloseTo(-2, 2);
  });
});

describe("simulateTrials with bias", () => {
  it("a start near the correct boundary raises accuracy and speeds it up", () => {
    const base = { v: 0.1, a: 0.12, ter: 0.3 };
    const neutral = simulateTrials(base, 1500, 3);
    const biased = simulateTrials({ ...base, z: 0.7 }, 1500, 3);
    expect(summarize(biased).pc).toBeGreaterThan(summarize(neutral).pc);
    expect(summarize(biased).mrt).toBeLessThan(summarize(neutral).mrt);
    expect(() => simulateTrials({ ...base, z: 1 }, 1, 1)).toThrow(RangeError);
  });
});

describe("fitQuantiles", () => {
  it("is deterministic and rejects tiny samples", () => {
    const t = simulateTrials({ v: 0.12, a: 0.11, ter: 0.3 }, 300, 5);
    const o = { nSim: 300, maxIter: 40 };
    expect(fitQuantiles(t, o)).toEqual(fitQuantiles(t, o));
    expect(() => fitQuantiles(t.slice(0, 5))).toThrow(RangeError);
  });

  it("recovers v, a and Ter from unbiased data", () => {
    const truth = { v: 0.15, a: 0.12, ter: 0.3 };
    const fit = fitQuantiles(simulateTrials(truth, 1500, 11, 0.001)).params;
    expect(Math.abs(fit.v - truth.v)).toBeLessThan(0.03);
    expect(Math.abs(fit.a - truth.a)).toBeLessThan(0.02);
    expect(Math.abs(fit.ter - truth.ter)).toBeLessThan(0.04);
  });

  it("recovers a starting-point bias that EZ cannot represent", () => {
    const truth = { v: 0.1, a: 0.14, ter: 0.3, z: 0.7 };
    const trials = simulateTrials(truth, 2000, 21, 0.001);
    const fit = fitQuantiles(trials, { freeZ: true, maxIter: 250 }).params;
    expect(fit.z).toBeGreaterThan(0.58);
    expect(fit.z).toBeLessThan(0.8);

    const ez = ezDiffusion(summarize(trials));
    const err = (p: { v: number; a: number; ter: number }) =>
      Math.abs(p.v / truth.v - 1) +
      Math.abs(p.a / truth.a - 1) +
      Math.abs(p.ter / truth.ter - 1);
    expect(err(fit)).toBeLessThan(err(ez));
  });
});

describe("handleFit", () => {
  it("returns results and converts errors to messages", async () => {
    const { handleFit } = await import("./fit.worker");
    const bad = handleFit({ trials: [] });
    expect(bad).toEqual({ ok: false, error: "need at least 20 trials" });
    const t = simulateTrials({ v: 0.12, a: 0.11, ter: 0.3 }, 200, 9);
    const ok = handleFit({ trials: t, options: { nSim: 200, maxIter: 20 } });
    expect(ok.ok).toBe(true);
  });
});
