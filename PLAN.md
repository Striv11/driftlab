# Plan

Seven-day arc. Every milestone has acceptance criteria that can be checked by a test or a command.

| Day | Milestone                       | Acceptance criteria                                                                                                                                                    | Status                                        |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | Scaffold + diffusion core       | `bash check.sh` passes; seeded RNG; simulator; EZ-diffusion reproduces the published worked example and recovers simulated params within tolerance                     | [x]                                           |
| 2   | Task engine + Stroop            | Trial scheduler with timing via `performance.now`; Stroop generator (congruent/incongruent, balanced, seeded); unit tests with a fake clock; keyboard response mapping | [x]                                           |
| 3   | UI shell + Pages                | Responsive app with landing section, empty state, light/dark design tokens, Stroop playable end-to-end; `pages.yml` deploys; live link in README                       | [~] UI done; Pages deploy unverified          |
| 4   | n-back and visual search        | Both tasks playable; n-back scoring (hits/FAs, d′) tested; visual-search set-size slopes computed                                                                      | [~] Playable UI + tests; not browser-verified |
| 5   | Simulated-quantile fit          | Fit v, a, Ter (+ bias z) by minimising quantile distance against simulations; recovery tests beat EZ on biased data; runs in a Web Worker without blocking UI          | [ ]                                           |
| 6   | Results explainer + persistence | Plain-language interpretation, RT histograms with model overlay, local-only history (localStorage), CSV export; error/loading states                                   | [ ]                                           |
| 7   | Quality pass                    | Playwright e2e for the core flows; benchmark with perf budget (fit < 1 s for 500 trials); screenshots in README; docs finalized                                        | [ ]                                           |

## Stretch

- Between-condition parameter comparison (does incongruence lower drift or raise caution?)
- Speed/accuracy instruction manipulation to show `a` shifting
