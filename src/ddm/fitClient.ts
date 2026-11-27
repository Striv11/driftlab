import type { FitOptions, FitResult } from "./fit";
import type { FitRequest, FitResponse } from "./fit.worker";
import type { Trial } from "./types";

/** Run the quantile fit in a Web Worker so the UI thread never blocks. */
export function fitInWorker(
  trials: Trial[],
  options?: FitOptions,
): Promise<FitResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./fit.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<FitResponse>) => {
      worker.terminate();
      if (e.data.ok) resolve(e.data.result);
      else reject(new Error(e.data.error));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "fit worker failed"));
    };
    const req: FitRequest = { trials, options };
    worker.postMessage(req);
  });
}
