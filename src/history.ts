/** Local-only run history. Nothing is sent anywhere; it lives in localStorage. */

export const HISTORY_KEY = "driftlab-history";
export const MAX_RUNS = 50;

export interface RunRecord {
  /** Epoch ms when the run finished. */
  at: number;
  task: string;
  trials: number;
  /** Proportion correct among valid trials, or null if unavailable. */
  accuracy: number | null;
  /** Mean RT of correct trials in seconds, or null. */
  meanRt: number | null;
  /** One-line headline shown in the history list. */
  summary: string;
}

/** The subset of the Storage interface we use (lets tests inject a fake). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const isNumOrNull = (x: unknown): x is number | null =>
  x === null || (typeof x === "number" && Number.isFinite(x));

function isRecord(x: unknown): x is RunRecord {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.at === "number" &&
    Number.isFinite(r.at) &&
    typeof r.task === "string" &&
    typeof r.trials === "number" &&
    typeof r.summary === "string" &&
    isNumOrNull(r.accuracy) &&
    isNumOrNull(r.meanRt)
  );
}

/** Load history, newest first. Corrupt or foreign data is dropped, never thrown. */
export function loadHistory(store: KeyValueStore): RunRecord[] {
  try {
    const raw = store.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord).sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

/** Add a run (newest first, capped at MAX_RUNS). Returns the new list; storage failures are swallowed. */
export function saveRun(store: KeyValueStore, run: RunRecord): RunRecord[] {
  const next = [run, ...loadHistory(store)]
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_RUNS);
  try {
    store.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* quota exceeded or storage disabled: history is best-effort */
  }
  return next;
}

export function clearHistory(store: KeyValueStore): void {
  try {
    store.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}
