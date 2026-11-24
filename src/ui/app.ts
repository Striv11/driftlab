import {
  analyzeStroop,
  type ConditionStats,
  type StroopAnalysis,
  type StroopResult,
} from "../analysis";
import { TrialScheduler } from "../tasks/engine";
import {
  COLORS,
  generateStroopTrials,
  keyToColor,
  type StroopColor,
  type StroopStimulus,
} from "../tasks/stroop";

const TRIALS = 40;
const KEY_FOR: Record<StroopColor, string> = {
  red: "R",
  green: "G",
  blue: "B",
  yellow: "Y",
};

/** Build an element with text content (never innerHTML, so nothing is parsed as markup). */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { class?: string; text?: string; attrs?: Record<string, string> } = {},
  children: Node[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {}))
    node.setAttribute(k, v);
  node.append(...children);
  return node;
}

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
  );
  start.focus();
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
      el("p", {
        class: "muted",
        text: "Parameters are EZ-diffusion estimates (noise fixed at 0.1); with ~20 trials per condition they are rough.",
      }),
      el("p", {}, [again, document.createTextNode(" "), home]),
    ]),
  );
  again.focus();
}
