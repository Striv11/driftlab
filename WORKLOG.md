# Work log

Newest entries at the bottom. Each entry records what actually changed, what was learned, and what comes next.

## 2026-11-23, Day 1

- Chose a cognitive-psychology lab (TypeScript): differs from this week's other projects and from recent audio/meal-planning apps.
- Scaffolded Vite + TypeScript, Prettier, ESLint, Vitest; `check.sh` runs format, lint, typecheck, tests and build; CI and a Pages workflow are in place.
- Implemented the model core: seeded mulberry32 RNG with Box–Muller normals, Euler–Maruyama diffusion simulator, summary statistics, and EZ-diffusion fitting with edge correction.
- Tests: the published Wagenmakers et al. (2007) worked example is reproduced, and simulated data recover v, a and Ter within tolerance.
- Learned: with s = 0.1 and dt = 1 ms, 3000 trials is enough for tight recovery; the Euler discretisation slightly biases RTs, which is something to keep an eye on in the day-5 fit.
- Next: Stroop task engine with a fake-clock tested scheduler.

## 2026-11-23, Day 2

- Added `src/tasks/engine.ts`: `TrialScheduler` (fixation → stimulus → response/timeout → ITI) with an injectable `Clock`; RT is measured from stimulus onset in seconds, matching the model core. Anticipations and double presses are ignored; timeouts are recorded as incorrect with `rt: null`.
- Added `src/tasks/stroop.ts`: seeded, condition- and colour-balanced Stroop generator with no triple ink repeats, and a case-insensitive key map (r/g/b/y).
- Tests use a fake clock to check RT arithmetic, timeouts, ignored input and hook ordering; generator tests check balance, determinism and edge counts.
- Learned: keeping the scheduler free of DOM/timer globals makes timing logic trivially testable; key lookup needed a guard against prototype keys like `toString`.
- Next (day 3): UI shell with design tokens, make Stroop playable end-to-end, wire results into the EZ fit, deploy via Pages.

## 2026-11-24, Day 3

- Added `src/analysis.ts`: per-condition Stroop analysis (valid-trial filtering of timeouts and <150 ms anticipations, accuracy, correct mean RT, EZ fit guarded against degenerate data) plus a plain-language interpretation, with unit tests including zero-variance and perfect-accuracy cases.
- Added the UI shell (`src/ui/app.ts`, `style.css`): intro/empty state, keyboard + on-screen Stroop, progress, results table, light/dark tokens with a persisted toggle, visible focus styles. DOM is built without innerHTML.
- Learned: `types: []` in tsconfig needs an explicit `vite/client` reference for CSS imports. EZ fit on ~20 trials per condition is noisy, so the UI says so.
- Not done: I could not run a browser here, so the UI is typechecked and built but not manually played; the Pages deploy is unconfirmed, so PLAN day 3 is marked partial.
- Next: verify deploy, then n-back (d') and visual search (set-size slopes).
