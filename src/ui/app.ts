import {
  analyzeStroop,
  MIN_VALID_RT,
  type ConditionStats,
  type StroopAnalysis,
  type StroopResult,
} from "../analysis";
import { trialsToCsv } from "../export";
import { loadHistory, saveRun, clearHistory, type RunRecord } from "../history";
import { makeEdges, modelHistogram, rtHistogram } from "../histogram";
import { histogramChart } from "./histogramChart";
import { TrialScheduler } from "../tasks/engine";
import {
  COLORS,
  generateStroopTrials,
  keyToColor,
  type StroopColor,
  type StroopStimulus,
} from "../tasks/stroop";
import { el } from "./dom";
import { NBACK_BLURB, SEARCH_BLURB, runNBack, runSearch } from "./tasks";

const TRIALS = 40;
const KEY_FOR: Record<StroopColor, string> = {
  red: "R",
  green: "G",
  blue: "B",
  yellow: "Y",
};

function themeToggle(): HTMLButtonElement {
  const root = document.documentElement;
  const stored = localStorage.getItem("driftlab-theme");
  if (stored === "light" || stored === "dark") root.dataset.theme = stored;
  const btn = el("button", { text: "Toggle theme" });
  btn.addEventListener("click", () => {
    const dark =
      root.dataset.theme === "dark" ||
      (!root.dataset.theme &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = dark ? "light" : "dark";
    try {
      localStorage.setItem("driftlab-theme", root.dataset.theme);
    } catch {
      /* storage may be unavailable (private mode); theme still applies */
    }
  });
  return btn;
}

export function mount(root: HTMLElement): void {
  const main = el("main");
  const header = el("header", { class: "top" }, [
    el("h1", { text: "driftlab" }),
    themeToggle(),
  ]);
  const content = el("div");
  main.append(header, content);
  root.replaceChildren(main);
  showIntro(content);
}

function showIntro(content: HTMLElement): void {
  const start = el("button", {
    class: "primary",
    text: `Start Stroop (${TRIALS} trials)`,
  });
  start.addEventListener("click", () => runStroop(content));
  const home = (): void => showIntro(content);
  const taskCard = (
    title: string,
    blurb: string,
    label: string,
    run: () => void,
  ): HTMLElement => {
    const b = el("button", { text: label });
    b.addEventListener("click", run);
    return el("section", { class: "card" }, [
      el("h2", { text: title }),
      el("p", { text: blurb }),
      b,
    ]);
  };
  content.replaceChildren(
    el("p", {
      class: "lede",
      text: "A cognitive-psychology lab in your browser. Do a task, then see your reaction times decomposed by a drift-diffusion model into speed of thinking, caution and motor delay. Nothing leaves your device.",
    }),
    el("section", { class: "card" }, [
      el("h2", { text: "Stroop task" }),
      el("p", {
        text: "Words name a colour but are printed in an ink colour. Respond to the INK colour, ignoring the word. Use the keyboard (R, G, B, Y) or the on-screen buttons.",
      }),
      el("p", {
        class: "muted",
        text: "No results yet. Takes about two minutes.",
      }),
      start,
    ]),
    taskCard("2-back", NBACK_BLURB, "Start 2-back", () =>
      runNBack(content, home),
    ),
    taskCard("Feature search", SEARCH_BLURB, "Start feature search", () =>
      runSearch(content, "feature", home),
    ),
    taskCard(
      "Conjunction search",
      "Same target (red circle), but distractors are red squares and green circles, so you must combine colour and shape.",
      "Start conjunction search",
      () => runSearch(content, "conjunction", home),
    ),
  );
  content.append(historyCard(content));
  start.focus();
}

const store = (): Storage | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};

function historyCard(content: HTMLElement): HTMLElement {
  const s = store();
  const runs = s ? loadHistory(s) : [];
  const card = el("section", { class: "card" }, [
    el("h2", { text: "History" }),
  ]);
  if (!runs.length) {
    card.append(
      el("p", {
        class: "muted",
        text: "No saved runs yet. Finished Stroop runs are stored only in this browser.",
      }),
    );
    return card;
  }
  card.append(
    el(
      "ul",
      {},
      runs.slice(0, 10).map((r) =>
        el("li", {
          text: `${new Date(r.at).toLocaleString()} · ${r.task} · ${r.summary}`,
        }),
      ),
    ),
  );
  const clear = el("button", { text: "Clear history" });
  clear.addEventListener("click", () => {
    if (s) clearHistory(s);
    showIntro(content);
  });
  card.append(el("p", {}, [clear]));
  return card;
}

function downloadCsv(results: readonly StroopResult[]): void {
  const csv = trialsToCsv(results, (st) => ({
    condition: st.condition,
    stimulus: `${st.word}/${st.ink}`,
  }));
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = el("a", { attrs: { href: url, download: "driftlab-stroop.csv" } });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function runStroop(content: HTMLElement): void {
  const stimuli = generateStroopTrials(TRIALS, Date.now() % 2 ** 31);
  const word = el("div", {
    class: "stim",
    attrs: { "aria-live": "off" },
  });
  const status = el("p", { class: "muted", attrs: { role: "status" } });
  const bar = el("div");
  const stage = el("div", { class: "stage" }, [word]);
  const keys = el(
    "div",
    { class: "keys" },
    COLORS.map((c) => {
      const b = el("button", { text: `${c} (${KEY_FOR[c]})` });
      b.addEventListener("click", () => scheduler.respond(c));
      return b;
    }),
  );
  const cancel = el("button", { text: "Cancel" });
  content.replaceChildren(
    el("section", { class: "card" }, [
      el("div", { class: "progress" }, [bar]),
      stage,
      status,
      keys,
      el("p", {}, [cancel]),
    ]),
  );

  const onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const c = keyToColor(e.key);
    if (c) scheduler.respond(c);
  };
  const cleanup = (): void => document.removeEventListener("keydown", onKey);

  const scheduler = new TrialScheduler<StroopStimulus, StroopColor>(
    stimuli,
    (s, r) => s.ink === r,
    undefined,
    undefined,
    {
      onFixation: (i) => {
        word.textContent = "+";
        word.className = "stim";
        status.textContent = `Trial ${i + 1} of ${TRIALS}`;
        bar.style.width = `${(i / TRIALS) * 100}%`;
      },
      onStimulus: (s) => {
        word.textContent = s.word;
        word.className = `stim ${s.ink}`;
      },
      onTrialEnd: () => {
        word.textContent = "";
        word.className = "stim";
      },
      onFinish: () => {
        cleanup();
        showResults(content, scheduler.results);
      },
    },
  );
  cancel.addEventListener("click", () => {
    scheduler.abort();
    cleanup();
    showIntro(content);
  });
  document.addEventListener("keydown", onKey);
  scheduler.start();
}

const pct = (x: number): string =>
  Number.isFinite(x) ? `${Math.round(x * 100)}%` : "–";
const msText = (x: number): string =>
  Number.isFinite(x) ? `${Math.round(x * 1000)} ms` : "–";

function row(label: string, c: ConditionStats): HTMLTableRowElement {
  return el("tr", {}, [
    el("th", { text: label, attrs: { scope: "row" } }),
    el("td", { text: `${c.valid}/${c.presented}` }),
    el("td", { text: pct(c.accuracy) }),
    el("td", { text: msText(c.meanRt) }),
    el("td", { text: c.fit ? c.fit.v.toFixed(3) : "–" }),
    el("td", { text: c.fit ? c.fit.a.toFixed(3) : "–" }),
    el("td", { text: c.fit ? msText(c.fit.ter) : "–" }),
  ]);
}

function showResults(
  content: HTMLElement,
  results: readonly StroopResult[],
): void {
  const analysis: StroopAnalysis = analyzeStroop(results);
  const o = analysis.overall;
  const s = store();
  if (s && o.valid > 0) {
    const rec: RunRecord = {
      at: Date.now(),
      task: "stroop",
      trials: results.length,
      accuracy: Number.isFinite(o.accuracy) ? o.accuracy : null,
      meanRt: Number.isFinite(o.meanRt) ? o.meanRt : null,
      summary: `${pct(o.accuracy)} correct, mean ${msText(o.meanRt)}`,
    };
    saveRun(s, rec);
  }
  const validTrials = results.flatMap((r) =>
    r.rt !== null && r.rt >= MIN_VALID_RT
      ? [{ correct: r.correct, rt: r.rt }]
      : [],
  );
  const chart =
    validTrials.length >= 5
      ? histogramChart(
          rtHistogram(validTrials, makeEdges(0.15, 1.5, 15)),
          o.fit ? modelHistogram(o.fit, makeEdges(0.15, 1.5, 15), 2000) : null,
        )
      : null;
  const csvBtn = el("button", { text: "Download CSV" });
  csvBtn.addEventListener("click", () => downloadCsv(results));
  const head = el("tr", {}, [
    ...[
      "Condition",
      "Valid",
      "Correct",
      "Mean RT",
      "Drift v",
      "Boundary a",
      "Ter",
    ].map((t) => el("th", { text: t, attrs: { scope: "col" } })),
  ]);
  const again = el("button", { class: "primary", text: "Run again" });
  again.addEventListener("click", () => runStroop(content));
  const home = el("button", { text: "Back" });
  home.addEventListener("click", () => showIntro(content));
  content.replaceChildren(
    el("section", { class: "card" }, [
      el("h2", { text: "Your results" }),
      ...analysis.interpretation.map((t) => el("p", { text: t })),
      el("div", { attrs: { style: "overflow-x:auto" } }, [
        el("table", {}, [
          el("thead", {}, [head]),
          el("tbody", {}, [
            row("Congruent", analysis.congruent),
            row("Incongruent", analysis.incongruent),
            row("All", analysis.overall),
          ]),
        ]),
      ]),
      ...(chart
        ? [
            el("h3", { text: "Correct response times" }),
            chart,
            el("p", {
              class: "muted",
              text: o.fit
                ? "Bars: your correct RTs. Line: what the fitted model predicts."
                : "Bars: your correct RTs.",
            }),
          ]
        : []),
      el("p", {
        class: "muted",
        text: "Parameters are EZ-diffusion estimates (noise fixed at 0.1); with ~20 trials per condition they are rough.",
      }),
      el("p", {}, [
        again,
        document.createTextNode(" "),
        csvBtn,
        document.createTextNode(" "),
        home,
      ]),
    ]),
  );
  again.focus();
}
