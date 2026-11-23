import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
import { simulateTrials } from "./simulate";
import { summarize } from "./stats";
import { ezDiffusion } from "./ez";

describe("rng", () => {
  it("is deterministic per seed", () => {
    const a = createRng(7);
    const b = createRng(7);
    expect([a.next(), a.normal()]).toEqual([b.next(), b.normal()]);
    expect(createRng(8).next()).not.toBe(createRng(7).next());
  });

  it("produces roughly standard-normal samples", () => {
    const r = createRng(1);
    const xs = Array.from({ length: 20000 }, () => r.normal());
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(variance - 1)).toBeLessThan(0.05);
  });
});

describe("ezDiffusion", () => {
  it("reproduces the worked example from Wagenmakers et al. (2007)", () => {
    // Pc=.802, VRT=.112, MRT=.723 -> v=.0999, a=.1399, Ter=.300
    const fit = ezDiffusion({ n: 1000, pc: 0.802, mrt: 0.723, vrt: 0.112 });
    expect(fit.v).toBeCloseTo(0.0999, 3);
    expect(fit.a).toBeCloseTo(0.1399, 3);
    expect(fit.ter).toBeCloseTo(0.3, 2);
  });

  it("handles perfect accuracy via edge correction", () => {
    const fit = ezDiffusion({ n: 100, pc: 1, mrt: 0.5, vrt: 0.01 });
    expect(Number.isFinite(fit.v)).toBe(true);
    expect(fit.v).toBeGreaterThan(0);
  });

  it("rejects zero variance", () => {
    expect(() => ezDiffusion({ n: 10, pc: 0.9, mrt: 0.5, vrt: 0 })).toThrow();
  });
});

describe("simulate + recover", () => {
  const truth = { v: 0.15, a: 0.12, ter: 0.3 };
  const trials = simulateTrials(truth, 3000, 42);

  it("is reproducible", () => {
    expect(simulateTrials(truth, 20, 5)).toEqual(simulateTrials(truth, 20, 5));
  });

  it("never responds faster than non-decision time", () => {
    expect(Math.min(...trials.map((t) => t.rt))).toBeGreaterThan(truth.ter);
  });

  it("recovers generating parameters within tolerance", () => {
    const fit = ezDiffusion(summarize(trials));
    expect(Math.abs(fit.v - truth.v)).toBeLessThan(0.02);
    expect(Math.abs(fit.a - truth.a)).toBeLessThan(0.015);
    expect(Math.abs(fit.ter - truth.ter)).toBeLessThan(0.03);
  });

  it("higher drift gives higher accuracy", () => {
    const easy = summarize(simulateTrials({ ...truth, v: 0.3 }, 1500, 3));
    const hard = summarize(simulateTrials({ ...truth, v: 0.05 }, 1500, 3));
    expect(easy.pc).toBeGreaterThan(hard.pc);
  });
});
