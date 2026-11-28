import type { TrialResult } from "./tasks/engine";

/** Quote a CSV field; also neutralise spreadsheet formula injection (=, +, -, @ prefixes) in strings. */
export function csvField(value: string | number | boolean | null): string {
  if (value === null) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEADER = [
  "trial",
  "condition",
  "stimulus",
  "response",
  "correct",
  "rt_ms",
  "timed_out",
] as const;

/**
 * Serialise trial results to CSV (RFC 4180, CRLF line ends). `describe` maps a
 * stimulus to its condition label and a short stimulus description.
 */
export function trialsToCsv<S, R extends string>(
  results: readonly TrialResult<S, R>[],
  describe: (s: S) => { condition: string; stimulus: string },
): string {
  const lines = [CSV_HEADER.join(",")];
  for (const r of results) {
    const d = describe(r.stimulus);
    lines.push(
      [
        r.index + 1,
        d.condition,
        d.stimulus,
        r.response,
        r.correct,
        r.rt === null ? null : Math.round(r.rt * 1000),
        r.timedOut,
      ]
        .map(csvField)
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
