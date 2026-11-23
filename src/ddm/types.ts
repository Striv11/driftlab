/** Drift-diffusion parameters, in seconds and evidence units. Noise s is fixed at 0.1. */
export interface DdmParams {
  /** Drift rate: speed of evidence accumulation. */
  v: number;
  /** Boundary separation: how much evidence is required (speed/accuracy trade-off). */
  a: number;
  /** Non-decision time (perception + motor), seconds. */
  ter: number;
}

export interface Trial {
  correct: boolean;
  /** Response time in seconds. */
  rt: number;
}

/** Sufficient statistics for the EZ-diffusion model. */
export interface Summary {
  n: number;
  /** Proportion correct. */
  pc: number;
  /** Mean RT of correct trials (s). */
  mrt: number;
  /** Variance of RT of correct trials (s^2). */
  vrt: number;
}

export const NOISE_S = 0.1;
