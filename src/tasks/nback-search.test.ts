import { describe, expect, it } from "vitest";
import {
  generateNBack,
  isNBackCorrect,
  keyToNBack,
  normInv,
  scoreNBack,
} from "./nback";
import {
  generateSearchTrials,
  isSearchCorrect,
  keyToSearch,
  linearFit,
  searchSlopes,
} from "./search";

describe("n-back generator", () => {
  it("is deterministic and has correct target structure", () => {
    const a = generateNBack(60, 2, 7);
    expect(a).toEqual(generateNBack(60, 2, 7));
    expect(a).not.toEqual(generateNBack(60, 2, 8));
    a.forEach((s, i) => {
      if (i < 2) expect(s.isTarget).toBe(false);
      else expect(s.isTarget).toBe(s.letter === a[i - 2]?.letter);
    });
    expect(a.filter((s) => s.isTarget).length).toBe(Math.round(0.3 * 58));
  });
  it("validates arguments", () => {
    expect(() => generateNBack(10, 0, 1)).toThrow(RangeError);
    expect(() => generateNBack(-1, 1, 1)).toThrow(RangeError);
    expect(() => generateNBack(10, 1, 1, 2)).toThrow(RangeError);
    expect(generateNBack(3, 5, 1).every((s) => !s.isTarget)).toBe(true);
  });
  it("maps keys and correctness", () => {
    expect(keyToNBack("J")).toBe("match");
    expect(keyToNBack("constructor")).toBeNull();
    expect(isNBackCorrect({ letter: "B", isTarget: true }, "match")).toBe(true);
    expect(isNBackCorrect({ letter: "B", isTarget: true }, "nomatch")).toBe(
      false,
    );
  });
});

describe("normInv", () => {
  it("matches known quantiles", () => {
    expect(normInv(0.5)).toBeCloseTo(0, 9);
    expect(normInv(0.975)).toBeCloseTo(1.959964, 5);
    expect(normInv(0.001)).toBeCloseTo(-3.090232, 5);
    expect(normInv(0.2)).toBeCloseTo(-normInv(0.8), 9);
  });
  it("rejects 0 and 1", () => {
    expect(() => normInv(0)).toThrow(RangeError);
    expect(() => normInv(1)).toThrow(RangeError);
  });
});

describe("scoreNBack", () => {
  const T = { letter: "B", isTarget: true };
  const N = { letter: "C", isTarget: false };
  it("counts cells, treating timeouts as no-match", () => {
    const s = scoreNBack([
      { stimulus: T, response: "match" },
      { stimulus: T, response: null },
      { stimulus: N, response: "match" },
      { stimulus: N, response: "nomatch" },
      { stimulus: N, response: null },
    ]);
    expect([s.hits, s.misses, s.falseAlarms, s.correctRejections]).toEqual([
      1, 1, 1, 2,
    ]);
    expect(s.hitRate).toBe(0.5);
    expect(s.falseAlarmRate).toBeCloseTo(1 / 3);
  });
  it("computes log-linear d' by hand", () => {
    // 8 hits/2 misses, 1 FA/9 CR: z(8.5/11) - z(1.5/11)
    const trials = [
      ...Array(8).fill({ stimulus: T, response: "match" }),
      ...Array(2).fill({ stimulus: T, response: "nomatch" }),
      ...Array(1).fill({ stimulus: N, response: "match" }),
      ...Array(9).fill({ stimulus: N, response: "nomatch" }),
    ];
    expect(scoreNBack(trials).dPrime).toBeCloseTo(
      normInv(8.5 / 11) - normInv(1.5 / 11),
      9,
    );
  });
  it("stays finite for perfect performance and zero for chance", () => {
    const perfect = scoreNBack([
      ...Array(10).fill({ stimulus: T, response: "match" }),
      ...Array(10).fill({ stimulus: N, response: "nomatch" }),
    ]);
    expect(Number.isFinite(perfect.dPrime)).toBe(true);
    expect(perfect.dPrime).toBeGreaterThan(2);
    const chance = scoreNBack([
      ...Array(5).fill({ stimulus: T, response: "match" }),
      ...Array(5).fill({ stimulus: T, response: "nomatch" }),
      ...Array(5).fill({ stimulus: N, response: "match" }),
      ...Array(5).fill({ stimulus: N, response: "nomatch" }),
    ]);
    expect(chance.dPrime).toBeCloseTo(0, 9);
  });
  it("is NaN when a trial class is missing", () => {
    expect(scoreNBack([{ stimulus: T, response: "match" }]).dPrime).toBeNaN();
  });
});

describe("visual search", () => {
  it("generates balanced, deterministic, valid trials", () => {
    const t = generateSearchTrials(48, 3, "conjunction");
    expect(t).toEqual(generateSearchTrials(48, 3, "conjunction"));
    for (const s of [4, 8, 16])
      for (const p of [true, false])
        expect(
          t.filter((x) => x.setSize === s && x.targetPresent === p).length,
        ).toBe(8);
    for (const x of t) {
      expect(x.items).toHaveLength(x.setSize);
      expect(new Set(x.items.map((i) => i.cell)).size).toBe(x.setSize);
      expect(x.items.filter((i) => i.isTarget).length).toBe(
        x.targetPresent ? 1 : 0,
      );
      // a distractor must never look like the target
      for (const i of x.items)
        if (!i.isTarget)
          expect(i.color === "red" && i.shape === "circle").toBe(false);
    }
  });
  it("feature search distractors share one look", () => {
    const t = generateSearchTrials(12, 1, "feature");
    for (const x of t)
      for (const i of x.items.filter((i) => !i.isTarget))
        expect([i.color, i.shape]).toEqual(["green", "circle"]);
  });
  it("validates and maps", () => {
    expect(() => generateSearchTrials(5, 1, "feature", [])).toThrow(RangeError);
    expect(() => generateSearchTrials(5, 1, "feature", [99])).toThrow(
      RangeError,
    );
    expect(keyToSearch("F")).toBe("absent");
    expect(keyToSearch("constructor")).toBeNull();
    const [s] = generateSearchTrials(1, 1, "feature");
    expect(isSearchCorrect(s!, s!.targetPresent ? "present" : "absent")).toBe(
      true,
    );
  });
  it("linearFit recovers an exact line and rejects degenerate input", () => {
    const f = linearFit([4, 8, 16], [500, 600, 800])!;
    expect(f.slopeMsPerItem).toBeCloseTo(25, 9);
    expect(f.interceptMs).toBeCloseTo(400, 9);
    expect(f.r2).toBeCloseTo(1, 9);
    expect(linearFit([4, 4], [1, 2])).toBeNull();
    expect(linearFit([4], [1])).toBeNull();
  });
  it("computes slopes from correct trials only, in ms", () => {
    const trials = generateSearchTrials(48, 5, "conjunction").map(
      (stimulus) => ({
        stimulus,
        correct: true,
        rt: (0.4 + 0.03 * stimulus.setSize) * (stimulus.targetPresent ? 1 : 2),
      }),
    );
    // add wrong/timeout trials that must be ignored
    const junk = generateSearchTrials(6, 9, "conjunction").flatMap(
      (stimulus) => [
        { stimulus, correct: false, rt: 5 },
        { stimulus, correct: true, rt: null },
      ],
    );
    const s = searchSlopes([...trials, ...junk]);
    expect(s.present?.slopeMsPerItem).toBeCloseTo(30, 6);
    expect(s.absent?.slopeMsPerItem).toBeCloseTo(60, 6);
    expect(s.present?.points).toBe(3);
  });
  it("returns null slopes without data", () => {
    expect(searchSlopes([])).toEqual({ present: null, absent: null });
  });
});
