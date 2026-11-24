import { ezDiffusion } from "./ddm/ez";
import { summarize } from "./ddm/stats";
import type { DdmParams, Trial } from "./ddm/types";
import type { TrialResult } from "./tasks/engine";
import type { StroopColor, StroopStimulus } from "./tasks/stroop";

export type StroopResult = TrialResult<StroopStimulus, StroopColor>;

/** Responses faster than this (s) are treated as anticipations/guesses. */
export const MIN_VALID_RT = 0.15;
/** Fewest valid trials in a condition before we attempt a model fit. */
export const MIN_TRIALS_FOR_FIT = 10;

export interface ConditionStats {
  /** Trials presented in this condition. */
  presented: number;
  /** Trials with a response inside the valid RT window (timeouts and anticipations dropped). */
  valid: number;
  /** Proportion correct among valid trials; NaN if none. */
  accuracy: number;
  /** Mean RT (s) of correct valid trials; NaN if none. */
  meanRt: number;
  /** EZ-diffusion estimate, or null if there was too little data or it was degenerate. */
  fit: DdmParams | null;
}

export interface StroopAnalysis {
  congruent: ConditionStats;
  incongruent: ConditionStats;
  overall: ConditionStats;
  /** Incongruent minus congruent mean RT (s); null if either is unavailable. */
  stroopEffect: number | null;
  /** Human-readable sentences describing the result. */
  interpretation: string[];
}

function conditionStats(results: readonly StroopResult[]): ConditionStats {
  const trials: Trial[] = [];
  for (const r of results) {
    if (r.rt !== null && r.rt >= MIN_VALID_RT)
      trials.push({ correct: r.correct, rt: r.rt });
  }
  const correct = trials.filter((t) => t.correct);
  const meanRt = correct.length
    ? correct.reduce((s, t) => s + t.rt, 0) / correct.length
    : NaN;
  let fit: DdmParams | null = null;
  if (trials.length >= MIN_TRIALS_FOR_FIT) {
    try {
      const f = ezDiffusion(summarize(trials));
      if ([f.v, f.a, f.ter].every(Number.isFinite) && f.v > 0 && f.a > 0)
        fit = f;
    } catch {
      fit = null; // too few correct trials or zero variance
    }
  }
  return {
    presented: results.length,
    valid: trials.length,
    accuracy: trials.length ? correct.length / trials.length : NaN,
    meanRt,
    fit,
  };
}

export function analyzeStroop(
  results: readonly StroopResult[],
): StroopAnalysis {
  const con = results.filter((r) => r.stimulus.condition === "congruent");
  const inc = results.filter((r) => r.stimulus.condition === "incongruent");
  const congruent = conditionStats(con);
  const incongruent = conditionStats(inc);
  const overall = conditionStats(results);
  const stroopEffect =
    Number.isFinite(congruent.meanRt) && Number.isFinite(incongruent.meanRt)
      ? incongruent.meanRt - congruent.meanRt
      : null;
  return {
    congruent,
    incongruent,
    overall,
    stroopEffect,
    interpretation: interpret(overall, stroopEffect, congruent, incongruent),
  };
}

const ms = (s: number): string => `${Math.round(s * 1000)} ms`;

function interpret(
  overall: ConditionStats,
  effect: number | null,
  congruent: ConditionStats,
  incongruent: ConditionStats,
): string[] {
  const out: string[] = [];
  if (overall.valid === 0) {
    return [
      "No valid responses were recorded, so there is nothing to analyse.",
    ];
  }
  if (effect !== null) {
    if (effect > 0.02)
      out.push(
        `Conflicting words slowed you by ${ms(effect)}: the classic Stroop effect.`,
      );
    else if (effect < -0.02)
      out.push(
        `You were ${ms(-effect)} faster on conflicting trials, which is unusual; with few trials this is often noise.`,
      );
    else out.push("Congruent and incongruent trials took about equally long.");
  }
  const dAcc = congruent.accuracy - incongruent.accuracy;
  if (Number.isFinite(dAcc) && dAcc > 0.05)
    out.push(
      `You made more errors on incongruent trials (${Math.round(incongruent.accuracy * 100)}% vs ${Math.round(congruent.accuracy * 100)}% correct).`,
    );
  const f = overall.fit;
  if (f) {
    out.push(
      `Model fit (EZ-diffusion): drift ${f.v.toFixed(3)} (speed of evidence accumulation), boundary ${f.a.toFixed(3)} (caution), non-decision time ${ms(f.ter)} (perception + keypress).`,
    );
    const fc = congruent.fit;
    const fi = incongruent.fit;
    if (fc && fi && fi.v < fc.v * 0.95)
      out.push(
        "Per condition, drift was lower for incongruent trials: the conflict slowed evidence accumulation rather than just adding delay.",
      );
  } else {
    out.push(
      `Too few valid trials (${overall.valid}) for a stable model fit; at least ${MIN_TRIALS_FOR_FIT} are needed.`,
    );
  }
  return out;
}
