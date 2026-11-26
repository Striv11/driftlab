import { describe, expect, it } from "vitest";
import { type Clock, TrialScheduler } from "./engine";
import {
  COLORS,
  generateStroopTrials,
  keyToColor,
  type StroopColor,
} from "./stroop";

/** Manual clock: time only moves via advance(). */
class FakeClock implements Clock {
  t = 0;
  private nextId = 1;
  private timers = new Map<number, { at: number; cb: () => void }>();
  now(): number {
    return this.t;
  }
  setTimeout(cb: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.timers.set(id, { at: this.t + ms, cb });
    return id;
  }
  clearTimeout(h: unknown): void {
    this.timers.delete(h as number);
  }
  advance(ms: number): void {
    const end = this.t + ms;
    for (;;) {
      let best: [number, { at: number; cb: () => void }] | null = null;
      for (const e of this.timers)
        if (e[1].at <= end && (!best || e[1].at < best[1].at)) best = e;
      if (!best) break;
      this.timers.delete(best[0]);
      this.t = best[1].at;
      best[1].cb();
    }
    this.t = end;
  }
}

const timing = { fixationMs: 500, timeoutMs: 2000, itiMs: 300 };

describe("generateStroopTrials", () => {
  it("is deterministic per seed and differs across seeds", () => {
    expect(generateStroopTrials(40, 3)).toEqual(generateStroopTrials(40, 3));
    expect(generateStroopTrials(40, 3)).not.toEqual(
      generateStroopTrials(40, 4),
    );
  });

  it("balances conditions and colours", () => {
    const trials = generateStroopTrials(96, 11);
    expect(trials).toHaveLength(96);
    const cong = trials.filter((t) => t.condition === "congruent");
    expect(cong).toHaveLength(48);
    for (const c of COLORS) {
      expect(cong.filter((t) => t.ink === c)).toHaveLength(12);
      expect(
        trials.filter((t) => t.condition === "incongruent" && t.ink === c),
      ).toHaveLength(12);
    }
  });

  it("makes word and ink match iff congruent", () => {
    for (const t of generateStroopTrials(60, 5)) {
      expect(t.word === t.ink).toBe(t.condition === "congruent");
    }
  });

  it("never repeats an ink colour three times in a row", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const t = generateStroopTrials(48, seed);
      for (let i = 2; i < t.length; i++) {
        expect(t[i]!.ink === t[i - 1]!.ink && t[i]!.ink === t[i - 2]!.ink).toBe(
          false,
        );
      }
    }
  });

  it("handles odd, zero and invalid counts", () => {
    expect(generateStroopTrials(0, 1)).toEqual([]);
    expect(generateStroopTrials(7, 1)).toHaveLength(7);
    expect(() => generateStroopTrials(-1, 1)).toThrow(RangeError);
    expect(() => generateStroopTrials(2.5, 1)).toThrow(RangeError);
  });
});

describe("keyToColor", () => {
  it("maps keys case-insensitively and rejects others", () => {
    expect(keyToColor("r")).toBe("red");
    expect(keyToColor("G")).toBe("green");
    expect(keyToColor("x")).toBeNull();
    expect(keyToColor("toString")).toBeNull();
    expect(keyToColor("constructor")).toBeNull();
    expect(keyToColor("__proto__")).toBeNull();
  });
});

describe("TrialScheduler", () => {
  const stimuli: StroopColor[] = ["red", "blue", "green"];
  const make = (clock: FakeClock, hooks = {}) =>
    new TrialScheduler<StroopColor, StroopColor>(
      stimuli,
      (s, r) => s === r,
      clock,
      timing,
      hooks,
    );

  it("measures RT from stimulus onset, not trial start", () => {
    const clock = new FakeClock();
    const s = make(clock);
    s.start();
    clock.advance(500); // fixation ends, stimulus on
    expect(s.state).toBe("stimulus");
    clock.advance(437);
    expect(s.respond("red")).toBe(true);
    expect(s.results[0]).toMatchObject({ correct: true, timedOut: false });
    expect(s.results[0]!.rt).toBeCloseTo(0.437, 6);
  });

  it("scores wrong answers as incorrect", () => {
    const clock = new FakeClock();
    const s = make(clock);
    s.start();
    clock.advance(600);
    s.respond("blue");
    expect(s.results[0]).toMatchObject({ correct: false, response: "blue" });
  });

  it("ignores responses during fixation, ITI and after finish", () => {
    const clock = new FakeClock();
    const s = make(clock);
    s.start();
    clock.advance(100);
    expect(s.respond("red")).toBe(false); // anticipation
    clock.advance(500);
    expect(s.respond("red")).toBe(true);
    expect(s.respond("red")).toBe(false); // double press in ITI
    expect(s.results).toHaveLength(1);
  });

  it("records a timeout when no response arrives", () => {
    const clock = new FakeClock();
    const s = make(clock);
    s.start();
    clock.advance(500 + 2000);
    expect(s.results[0]).toMatchObject({
      response: null,
      rt: null,
      correct: false,
      timedOut: true,
    });
    expect(s.state).toBe("iti");
  });

  it("runs all trials in order, fires hooks and finishes", () => {
    const clock = new FakeClock();
    const events: string[] = [];
    const s = make(clock, {
      onStimulus: (st: string, i: number) => events.push(`s${i}:${st}`),
      onFinish: () => events.push("done"),
    });
    s.start();
    for (const answer of stimuli) {
      clock.advance(500);
      s.respond(answer);
      clock.advance(300);
    }
    expect(s.state).toBe("done");
    expect(s.results.map((r) => r.index)).toEqual([0, 1, 2]);
    expect(s.results.every((r) => r.correct)).toBe(true);
    expect(events).toEqual(["s0:red", "s1:blue", "s2:green", "done"]);
  });

  it("abort stops further trials and cannot start twice", () => {
    const clock = new FakeClock();
    const s = make(clock);
    s.start();
    expect(() => s.start()).toThrow();
    clock.advance(500);
    s.abort();
    clock.advance(10000);
    expect(s.results).toHaveLength(0);
    expect(s.respond("red")).toBe(false);
  });
});
