import { describe, expect, it } from "vitest";
import { csvField, trialsToCsv } from "./export";
import {
  HISTORY_KEY,
  MAX_RUNS,
  clearHistory,
  loadHistory,
  saveRun,
  type KeyValueStore,
  type RunRecord,
} from "./history";
import { makeEdges, modelHistogram, rtHistogram } from "./histogram";
import { simulateTrials } from "./ddm/simulate";

function fakeStore(
  initial: Record<string, string> = {},
): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
}
const run = (at: number): RunRecord => ({
  at,
  task: "stroop",
  trials: 40,
  accuracy: 0.9,
  meanRt: 0.6,
  summary: "s",
});

describe("history", () => {
  it("round-trips newest first", () => {
    const s = fakeStore();
    saveRun(s, run(1));
    saveRun(s, run(3));
    saveRun(s, run(2));
    expect(loadHistory(s).map((r) => r.at)).toEqual([3, 2, 1]);
  });
  it("caps the number of stored runs", () => {
    const s = fakeStore();
    for (let i = 0; i < MAX_RUNS + 5; i++) saveRun(s, run(i));
    const h = loadHistory(s);
    expect(h).toHaveLength(MAX_RUNS);
    expect(h[0]!.at).toBe(MAX_RUNS + 4);
  });
  it("survives corrupt, foreign and partial data", () => {
    expect(loadHistory(fakeStore({ [HISTORY_KEY]: "{not json" }))).toEqual([]);
    expect(loadHistory(fakeStore({ [HISTORY_KEY]: '{"a":1}' }))).toEqual([]);
    const mixed = JSON.stringify([run(5), { at: "x" }, null, 7]);
    expect(loadHistory(fakeStore({ [HISTORY_KEY]: mixed }))).toHaveLength(1);
  });
  it("tolerates a throwing store and clears", () => {
    const bad: KeyValueStore = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadHistory(bad)).toEqual([]);
    expect(saveRun(bad, run(1))).toHaveLength(1);
    expect(() => clearHistory(bad)).not.toThrow();
    const s = fakeStore();
    saveRun(s, run(1));
    clearHistory(s);
    expect(loadHistory(s)).toEqual([]);
  });
});

describe("csv export", () => {
  it("quotes and neutralises formulas", () => {
    expect(csvField('a,"b"')).toBe('"a,""b"""');
    expect(csvField("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvField(-5)).toBe("-5");
    expect(csvField(null)).toBe("");
    expect(csvField(true)).toBe("true");
  });
  it("serialises trials incl. timeouts", () => {
    const csv = trialsToCsv(
      [
        {
          index: 0,
          stimulus: "x",
          response: "r",
          correct: true,
          rt: 0.4567,
          timedOut: false,
        },
        {
          index: 1,
          stimulus: "y",
          response: null,
          correct: false,
          rt: null,
          timedOut: true,
        },
      ],
      (s) => ({ condition: "c", stimulus: s }),
    );
    expect(csv.split("\r\n")).toEqual([
      "trial,condition,stimulus,response,correct,rt_ms,timed_out",
      "1,c,x,r,true,457,false",
      "2,c,y,,false,,true",
      "",
    ]);
  });
});

describe("histogram", () => {
  it("bins correct/error densities and ignores out-of-range", () => {
    const h = rtHistogram(
      [
        { correct: true, rt: 0.1 },
        { correct: true, rt: 0.6 },
        { correct: false, rt: 0.7 },
        { correct: true, rt: 2 },
      ],
      makeEdges(0, 1, 2),
    );
    // 4 trials, width 0.5 -> each count contributes 1/4/0.5 = 0.5
    expect(h.correct).toEqual([0.5, 0.5]);
    expect(h.error).toEqual([0, 0.5]);
    expect(() => makeEdges(1, 1, 3)).toThrow(RangeError);
  });
  it("model histogram matches data simulated from the same parameters", () => {
    const p = { v: 0.25, a: 0.12, ter: 0.3 };
    const edges = makeEdges(0.2, 1.4, 12);
    const obs = rtHistogram(simulateTrials(p, 3000, 7, 0.002), edges);
    const mod = modelHistogram(p, edges, 3000, 99);
    const area = (h: number[]) => h.reduce((s, d) => s + d * 0.1, 0);
    expect(area(mod.correct)).toBeGreaterThan(0.8);
    const maxDiff = Math.max(
      ...obs.correct.map((d, i) => Math.abs(d - mod.correct[i]!)),
    );
    expect(maxDiff).toBeLessThan(0.25);
  });
});
