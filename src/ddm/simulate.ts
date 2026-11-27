import { createRng } from "./rng";
import { NOISE_S, type DdmParams, type Trial } from "./types";

/**
 * Simulate a two-boundary diffusion process (Euler-Maruyama).
 * Evidence starts at a*z (z defaults to 0.5, unbiased); hitting `a` is a correct response, hitting 0 an error.
 */
export function simulateTrials(
  p: DdmParams,
  n: number,
  seed: number,
  dt = 0.001,
): Trial[] {
  if (p.a <= 0 || dt <= 0) throw new RangeError("a and dt must be positive");
  const z = p.z ?? 0.5;
  if (!(z > 0 && z < 1)) throw new RangeError("z must be in (0, 1)");
  const rng = createRng(seed);
  const sd = NOISE_S * Math.sqrt(dt);
  const out: Trial[] = [];
  for (let i = 0; i < n; i++) {
    let x = p.a * z;
    let t = 0;
    while (x > 0 && x < p.a) {
      x += p.v * dt + sd * rng.normal();
      t += dt;
    }
    out.push({ correct: x >= p.a, rt: t + p.ter });
  }
  return out;
}
