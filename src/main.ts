import { simulateTrials } from "./ddm/simulate";
import { ezDiffusion } from "./ddm/ez";
import { summarize } from "./ddm/stats";

// Day 1 placeholder: proves the model pipeline runs in the browser.
// The real lab UI arrives on day 3 (see PLAN.md).
const truth = { v: 0.2, a: 0.12, ter: 0.3 };
const trials = simulateTrials(truth, 500, 1);
const fit = ezDiffusion(summarize(trials));
const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  app.textContent = `driftlab: simulated 500 trials, recovered ${JSON.stringify(fit)}`;
}
