import { NOISE_S, type DdmParams, type Summary } from "./types";

/**
 * EZ-diffusion (Wagenmakers, van der Maas & Grasman, 2007): closed-form
 * recovery of v, a and Ter from accuracy and correct-RT mean/variance.
 *
 * Proportions of exactly 0, 0.5 or 1 make the equations degenerate, so we
 * apply the standard edge correction (move by 1/(2n)).
 */
export function ezDiffusion(s: Summary): DdmParams {
  if (s.vrt <= 0) throw new RangeError("RT variance must be positive");
  const s2 = NOISE_S ** 2;
  let pc = s.pc;
  if (pc >= 1) pc = 1 - 1 / (2 * s.n);
  else if (pc <= 0) pc = 1 / (2 * s.n);
  else if (pc === 0.5) pc = 0.5 + 1 / (2 * s.n);

  const L = Math.log(pc / (1 - pc));
  const x = (L * (pc * pc * L - pc * L + pc - 0.5)) / s.vrt;
  const v = Math.sign(pc - 0.5) * NOISE_S * x ** 0.25;
  const a = (s2 * L) / v;
  const y = (-v * a) / s2;
  const mdt = (a / (2 * v)) * ((1 - Math.exp(y)) / (1 + Math.exp(y)));
  return { v, a, ter: s.mrt - mdt };
}
