import type { NBackScore } from "./nback";
import type { SearchSlope, SearchSlopes } from "./search";

const f1 = (x: number): string => x.toFixed(1);

/** Plain-language reading of an n-back score. */
export function interpretNBack(n: number, s: NBackScore): string[] {
  if (!Number.isFinite(s.dPrime))
    return ["Not enough trials to compute sensitivity (d′)."];
  const level =
    s.dPrime >= 2.5
      ? "excellent"
      : s.dPrime >= 1.5
        ? "good"
        : s.dPrime >= 0.5
          ? "modest"
          : "close to chance";
  const out = [
    `${n}-back sensitivity (d′) is ${f1(s.dPrime)}, which is ${level}. d′ separates how well you tell matches from non-matches from how willing you are to say "match".`,
    `You caught ${s.hits} of ${s.hits + s.misses} matches and made ${s.falseAlarms} false alarm${s.falseAlarms === 1 ? "" : "s"} on ${s.falseAlarms + s.correctRejections} non-matches.`,
  ];
  if (s.hitRate - s.falseAlarmRate > 0.2 && s.falseAlarms > s.misses)
    out.push("You leaned towards saying “match” (liberal responding).");
  else if (s.misses > s.falseAlarms + 1 && s.hitRate < 0.7)
    out.push("You leaned towards saying “no match” (conservative responding).");
  return out;
}

function describeSlope(label: string, s: SearchSlope | null): string {
  if (!s) return `${label}: not enough correct trials at different set sizes.`;
  const m = s.slopeMsPerItem;
  return `${label}: ${f1(m)} ms per extra item (baseline ${Math.round(s.interceptMs)} ms, R² ${s.r2.toFixed(2)}).`;
}

/**
 * Plain-language reading of set-size slopes. Conventional rule of thumb:
 * below ~10 ms/item looks "efficient" (parallel-like), above that "serial".
 */
export function interpretSearch(
  kind: "feature" | "conjunction",
  s: SearchSlopes,
): string[] {
  const out = [
    describeSlope("Target present", s.present),
    describeSlope("Target absent", s.absent),
  ];
  if (s.present) {
    out.push(
      s.present.slopeMsPerItem < 10
        ? `The target ${kind === "feature" ? "popped out" : "was found efficiently"}: extra distractors barely slowed you down.`
        : "Each extra distractor cost you time, which suggests you inspected items one after another.",
    );
  }
  if (
    s.present &&
    s.absent &&
    s.present.slopeMsPerItem > 10 &&
    s.absent.slopeMsPerItem > s.present.slopeMsPerItem * 1.5
  )
    out.push(
      "The absent slope is steeper than the present slope, as expected when you must check everything before concluding the target is missing.",
    );
  return out;
}
