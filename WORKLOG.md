# Work log

Newest entries at the bottom. Each entry records what actually changed, what was learned, and what comes next.

## 2026-11-23, Day 1

- Chose a cognitive-psychology lab (TypeScript): differs from this week's other projects and from recent audio/meal-planning apps.
- Scaffolded Vite + TypeScript, Prettier, ESLint, Vitest; `check.sh` runs format, lint, typecheck, tests and build; CI and a Pages workflow are in place.
- Implemented the model core: seeded mulberry32 RNG with Box–Muller normals, Euler–Maruyama diffusion simulator, summary statistics, and EZ-diffusion fitting with edge correction.
- Tests: the published Wagenmakers et al. (2007) worked example is reproduced, and simulated data recover v, a and Ter within tolerance.
- Learned: with s = 0.1 and dt = 1 ms, 3000 trials is enough for tight recovery; the Euler discretisation slightly biases RTs, which is something to keep an eye on in the day-5 fit.
- Next: Stroop task engine with a fake-clock tested scheduler.
