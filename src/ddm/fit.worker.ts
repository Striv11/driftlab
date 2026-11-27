import { fitQuantiles, type FitOptions, type FitResult } from "./fit";
import type { Trial } from "./types";

/** Message protocol for running the quantile fit off the main thread. */
export interface FitRequest {
  trials: Trial[];
  options?: FitOptions;
}
export type FitResponse =
  { ok: true; result: FitResult } | { ok: false; error: string };

/** Pure handler, exported so the protocol is testable without a Worker. */
export function handleFit(req: FitRequest): FitResponse {
  try {
    return { ok: true, result: fitQuantiles(req.trials, req.options) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Only register in a dedicated worker scope (not under test or on the main thread).
if (typeof self !== "undefined" && "WorkerGlobalScope" in self) {
  const scope = self as unknown as {
    onmessage: ((e: MessageEvent<FitRequest>) => void) | null;
    postMessage(m: FitResponse): void;
  };
  scope.onmessage = (e) => scope.postMessage(handleFit(e.data));
}
