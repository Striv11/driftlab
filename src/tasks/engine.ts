/** Injectable time source so the scheduler can be tested deterministically. */
export interface Clock {
  /** Monotonic milliseconds (performance.now in the browser). */
  now(): number;
  setTimeout(cb: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const browserClock: Clock = {
  now: () => performance.now(),
  setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as number),
};

export interface TaskTiming {
  /** Blank/fixation before each stimulus (ms). */
  fixationMs: number;
  /** Max time allowed to respond after stimulus onset (ms). */
  timeoutMs: number;
  /** Pause after a response/timeout before the next fixation (ms). */
  itiMs: number;
}

export const DEFAULT_TIMING: TaskTiming = {
  fixationMs: 500,
  timeoutMs: 2000,
  itiMs: 300,
};

export interface TrialResult<S, R> {
  index: number;
  stimulus: S;
  /** Response given, or null on timeout. */
  response: R | null;
  correct: boolean;
  /** Response time in seconds from stimulus onset; null on timeout. */
  rt: number | null;
  timedOut: boolean;
}

export interface TaskHooks<S> {
  onFixation?(index: number): void;
  onStimulus?(stimulus: S, index: number): void;
  onTrialEnd?(index: number): void;
  onFinish?(): void;
}

type Phase = "idle" | "fixation" | "stimulus" | "iti" | "done";

/**
 * Runs a list of stimuli as fixation -> stimulus -> response/timeout -> ITI.
 * RT is measured from the moment onStimulus is invoked, using the clock.
 * Responses outside the stimulus phase (anticipations, double presses) are ignored.
 */
export class TrialScheduler<S, R> {
  readonly results: TrialResult<S, R>[] = [];
  private phase: Phase = "idle";
  private index = -1;
  private onset = 0;
  private timer: unknown = null;

  constructor(
    private readonly stimuli: readonly S[],
    private readonly isCorrect: (stimulus: S, response: R) => boolean,
    private readonly clock: Clock = browserClock,
    private readonly timing: TaskTiming = DEFAULT_TIMING,
    private readonly hooks: TaskHooks<S> = {},
  ) {}

  get state(): Phase {
    return this.phase;
  }

  start(): void {
    if (this.phase !== "idle") throw new Error("scheduler already started");
    this.nextTrial();
  }

  /** Submit a response. Returns true if it was accepted for the current trial. */
  respond(response: R): boolean {
    if (this.phase !== "stimulus") return false;
    const rt = (this.clock.now() - this.onset) / 1000;
    this.finishTrial(response, rt);
    return true;
  }

  /** Stop without producing further results. */
  abort(): void {
    this.clearTimer();
    this.phase = "done";
  }

  private nextTrial(): void {
    this.index++;
    if (this.index >= this.stimuli.length) {
      this.phase = "done";
      this.hooks.onFinish?.();
      return;
    }
    this.phase = "fixation";
    this.hooks.onFixation?.(this.index);
    this.timer = this.clock.setTimeout(
      () => this.showStimulus(),
      this.timing.fixationMs,
    );
  }

  private showStimulus(): void {
    const stimulus = this.stimuli[this.index] as S;
    this.phase = "stimulus";
    this.onset = this.clock.now();
    this.hooks.onStimulus?.(stimulus, this.index);
    this.timer = this.clock.setTimeout(
      () => this.finishTrial(null, null),
      this.timing.timeoutMs,
    );
  }

  private finishTrial(response: R | null, rt: number | null): void {
    this.clearTimer();
    const stimulus = this.stimuli[this.index] as S;
    this.results.push({
      index: this.index,
      stimulus,
      response,
      correct: response !== null && this.isCorrect(stimulus, response),
      rt,
      timedOut: response === null,
    });
    this.phase = "iti";
    this.hooks.onTrialEnd?.(this.index);
    this.timer = this.clock.setTimeout(
      () => this.nextTrial(),
      this.timing.itiMs,
    );
  }

  private clearTimer(): void {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }
}
