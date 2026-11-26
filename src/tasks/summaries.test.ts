import { describe, expect, it } from "vitest";
import { interpretNBack, interpretSearch } from "./summaries";
import type { NBackScore } from "./nback";

const score = (o: Partial<NBackScore>): NBackScore => ({
  hits: 8,
  misses: 1,
  falseAlarms: 1,
  correctRejections: 20,
  hitRate: 8 / 9,
  falseAlarmRate: 1 / 21,
  dPrime: 2.8,
  ...o,
});
const slope = (m: number) => ({
  slopeMsPerItem: m,
  interceptMs: 450,
  r2: 0.98,
  points: 3,
});

describe("interpretNBack", () => {
  it("grades d' and reports counts", () => {
    const t = interpretNBack(2, score({})).join(" ");
    expect(t).toContain("2-back");
    expect(t).toContain("excellent");
    expect(t).toContain("8 of 9 matches");
    expect(t).toContain("1 false alarm ");
  });
  it("handles chance and undefined d'", () => {
    expect(interpretNBack(2, score({ dPrime: 0.1 })).join(" ")).toContain(
      "close to chance",
    );
    expect(interpretNBack(2, score({ dPrime: NaN }))[0]).toContain(
      "Not enough",
    );
  });
  it("flags a liberal response bias", () => {
    const t = interpretNBack(
      2,
      score({
        hits: 9,
        misses: 0,
        falseAlarms: 8,
        correctRejections: 13,
        hitRate: 1,
        falseAlarmRate: 8 / 21,
        dPrime: 1.2,
      }),
    ).join(" ");
    expect(t).toContain("liberal");
  });
});

describe("interpretSearch", () => {
  it("calls a flat slope pop-out for feature search", () => {
    const t = interpretSearch("feature", {
      present: slope(2),
      absent: slope(3),
    }).join(" ");
    expect(t).toContain("popped out");
  });
  it("describes serial search and the 2:1-ish absent ratio", () => {
    const t = interpretSearch("conjunction", {
      present: slope(25),
      absent: slope(50),
    }).join(" ");
    expect(t).toContain("one after another");
    expect(t).toContain("absent slope is steeper");
  });
  it("degrades gracefully with missing slopes", () => {
    const t = interpretSearch("feature", { present: null, absent: null });
    expect(t).toHaveLength(2);
    expect(t[0]).toContain("not enough");
  });
});
