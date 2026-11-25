# driftlab

**Live demo: https://striv11.github.io/driftlab/** _(built by `pages.yml` on push to main; first deploy not yet confirmed)_

> A cognitive-psychology lab in your browser: do Stroop, n-back and visual-search experiments, and watch a drift-diffusion model decompose your reaction times into _speed of thinking_, _caution_ and _motor delay_. Nothing leaves your device.

![CI](https://github.com/Striv11/driftlab/actions/workflows/ci.yml/badge.svg)

## Problem

Reaction-time tasks are the workhorse of cognitive science, but "your mean RT was 612 ms" says little. Mean RT mixes how fast you process evidence, how careful you are, and how fast you press a key. Research tools that separate these (diffusion models) live in R/Python packages that non-programmers never touch.

## Motivation

Build the whole stack from scratch: a seeded RNG, a Euler–Maruyama diffusion simulator, closed-form EZ-diffusion fitting, then a full likelihood-free fit (quantile-based simulated minimum distance) to compare against it, plus the experiment engines and a UI that explains the result in plain language. Engineering themes: numerical simulation, parameter recovery as a test strategy, precise timing in the browser (`performance.now`, rAF), and privacy-first local computation.

## Architecture

```
 experiments (Stroop / n-back / visual search)      src/tasks   (day 2-4)
   stroop.ts, nback.ts (d′, log-linear), search.ts (set-size slopes)
   UI shell: src/ui (DOM built with textContent only, light/dark tokens)
   TrialScheduler: fixation → stimulus → response/timeout → ITI,
   injectable Clock (performance.now in the browser, fake in tests)
        │ trials: {condition, correct, rt}
        ▼
 summarize() ── Pc, mean RT, var RT                  src/ddm/stats.ts
        ▼
 ezDiffusion()  closed form v, a, Ter               src/ddm/ez.ts
 quantile fit   simulate + minimise (day 5)         src/ddm/fit.ts
        ▼
 results UI: parameters, plain-language explanation, RT distributions
 simulateTrials() + createRng()  ← ground truth for tests, "what-if" sliders
```

Invariants: all randomness flows through the seeded `Rng`; noise scale is fixed at s = 0.1 (the standard scaling convention); RT is in seconds throughout.

## Setup

Requires Node 22+.

```
npm ci
npm run dev       # dev server
bash check.sh     # prettier, eslint, tsc, vitest, vite build
```

## Demo

The Stroop task is playable (`npm run dev`): 40 seeded trials, then per-condition accuracy, RT, EZ-diffusion v/a/Ter and a plain-language summary. The model core is also covered by tests: `npx vitest run` shows parameter recovery (simulate 3000 trials from known v/a/Ter, fit with EZ-diffusion, recover within tolerance).

## Design decisions & trade-offs

- EZ-diffusion first: closed form, fast, great for a few hundred trials, but assumes no starting-point bias or trial variability; the simulated fit later covers those.
- Tests check statistical recovery with fixed seeds rather than snapshotting numbers.

## Roadmap

See [PLAN.md](PLAN.md).

- [x] Seeded RNG, diffusion simulator, EZ-diffusion fit
- [x] Trial scheduler + seeded Stroop generator (day 2)
- [x] Stroop UI with results (day 3)
- [~] n-back, visual search (generators, d′ scoring, set-size slopes done; UI pending)
- [ ] Results explainer UI, light/dark, keyboard-first
- [ ] Simulated-quantile fit, Playwright e2e, perf budgets

## License

MIT. See [LICENSE](LICENSE).
