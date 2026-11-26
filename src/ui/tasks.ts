import { TrialScheduler, type TrialResult } from "../tasks/engine";
import {
  generateNBack,
  isNBackCorrect,
  keyToNBack,
  scoreNBack,
  type NBackResponse,
  type NBackStimulus,
} from "../tasks/nback";
import {
  generateSearchTrials,
  isSearchCorrect,
  keyToSearch,
  searchSlopes,
  type SearchKind,
  type SearchResponse,
  type SearchStimulus,
} from "../tasks/search";
import { interpretNBack, interpretSearch } from "../tasks/summaries";
import { el } from "./dom";

const NBACK_N = 2;
const NBACK_TRIALS = 30;
const SEARCH_TRIALS = 36;
const GRID_COLS = 6;

export const NBACK_BLURB = `A stream of letters appears. Press J if the letter matches the one shown ${NBACK_N} before it, otherwise F. ${NBACK_TRIALS} trials.`;
export const SEARCH_BLURB = `Find the red circle among distractors. Press J if it is present, F if absent. ${SEARCH_TRIALS} trials per version. Colour is the cue in the feature version.`;

const seed = (): number => Date.now() % 2 ** 31;

/** Shared run shell: progress bar, status line, two response buttons, cancel. */
function runShell<S, R>(
  content: HTMLElement,
  opts: {
    stimuli: readonly S[];
    isCorrect: (s: S, r: R) => boolean;
    keyMap: (key: string) => R | null;
    buttons: { label: string; response: R }[];
    stage: HTMLElement;
    render: (s: S) => void;
    clear: () => void;
    onDone: (results: readonly TrialResult<S, R>[]) => void;
    onCancel: () => void;
  },
): void {
  const status = el("p", { class: "muted", attrs: { role: "status" } });
  const bar = el("div");
  const keys = el(
    "div",
    { class: "keys" },
    opts.buttons.map((b) => {
      const btn = el("button", { text: b.label });
      btn.addEventListener("click", () => scheduler.respond(b.response));
      return btn;
    }),
  );
  const cancel = el("button", { text: "Cancel" });
  content.replaceChildren(
    el("section", { class: "card" }, [
      el("div", { class: "progress" }, [bar]),
      opts.stage,
      status,
      keys,
      el("p", {}, [cancel]),
    ]),
  );
  const onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const r = opts.keyMap(e.key);
    if (r !== null) scheduler.respond(r);
  };
  const cleanup = (): void => document.removeEventListener("keydown", onKey);
  const total = opts.stimuli.length;
  const scheduler = new TrialScheduler<S, R>(
    opts.stimuli,
    opts.isCorrect,
    undefined,
    undefined,
    {
      onFixation: (i) => {
        opts.clear();
        status.textContent = `Trial ${i + 1} of ${total}`;
        bar.style.width = `${(i / total) * 100}%`;
      },
      onStimulus: (s) => opts.render(s),
      onTrialEnd: () => opts.clear(),
      onFinish: () => {
        cleanup();
        opts.onDone(scheduler.results);
      },
    },
  );
  cancel.addEventListener("click", () => {
    scheduler.abort();
    cleanup();
    opts.onCancel();
  });
  document.addEventListener("keydown", onKey);
  scheduler.start();
}

function resultCard(
  content: HTMLElement,
  title: string,
  lines: string[],
  note: string,
  again: () => void,
  home: () => void,
): void {
  const againBtn = el("button", { class: "primary", text: "Run again" });
  againBtn.addEventListener("click", again);
  const homeBtn = el("button", { text: "Back" });
  homeBtn.addEventListener("click", home);
  content.replaceChildren(
    el("section", { class: "card" }, [
      el("h2", { text: title }),
      ...lines.map((t) => el("p", { text: t })),
      el("p", { class: "muted", text: note }),
      el("p", {}, [againBtn, document.createTextNode(" "), homeBtn]),
    ]),
  );
  againBtn.focus();
}

export function runNBack(content: HTMLElement, home: () => void): void {
  const letter = el("div", { class: "stim" });
  const run = (): void =>
    runShell<NBackStimulus, NBackResponse>(content, {
      stimuli: generateNBack(NBACK_TRIALS, NBACK_N, seed()),
      isCorrect: isNBackCorrect,
      keyMap: keyToNBack,
      buttons: [
        { label: "No match (F)", response: "nomatch" },
        { label: "Match (J)", response: "match" },
      ],
      stage: el("div", { class: "stage" }, [letter]),
      render: (s) => {
        letter.textContent = s.letter;
      },
      clear: () => {
        letter.textContent = "+";
      },
      onCancel: home,
      onDone: (results) => {
        const score = scoreNBack(
          results.map((r) => ({ stimulus: r.stimulus, response: r.response })),
        );
        resultCard(
          content,
          `${NBACK_N}-back results`,
          interpretNBack(NBACK_N, score),
          "d′ uses a log-linear correction, so it stays finite for perfect runs. Unanswered trials count as “no match”.",
          run,
          home,
        );
      },
    });
  run();
}

function searchBoard(): {
  stage: HTMLElement;
  render: (s: SearchStimulus) => void;
  clear: () => void;
} {
  const grid = el("div", {
    class: "search-grid",
    attrs: {
      role: "img",
      "aria-label": "Search display",
      style: `--cols:${GRID_COLS}`,
    },
  });
  return {
    stage: el("div", { class: "stage" }, [grid]),
    render: (s) => {
      const cells = new Map(s.items.map((i) => [i.cell, i]));
      const nodes: HTMLElement[] = [];
      for (let c = 0; c < GRID_COLS * GRID_COLS; c++) {
        const item = cells.get(c);
        nodes.push(
          el("span", {
            class: item ? `item ${item.color} ${item.shape}` : "item",
          }),
        );
      }
      grid.replaceChildren(...nodes);
    },
    clear: () => {
      const fix = el("span", { class: "stim", text: "+" });
      grid.replaceChildren(fix);
    },
  };
}

export function runSearch(
  content: HTMLElement,
  kind: SearchKind,
  home: () => void,
): void {
  const run = (): void => {
    const board = searchBoard();
    runShell<SearchStimulus, SearchResponse>(content, {
      stimuli: generateSearchTrials(SEARCH_TRIALS, seed(), kind),
      isCorrect: isSearchCorrect,
      keyMap: keyToSearch,
      buttons: [
        { label: "Absent (F)", response: "absent" },
        { label: "Present (J)", response: "present" },
      ],
      ...board,
      onCancel: home,
      onDone: (results) => {
        const slopes = searchSlopes(
          results.map((r) => ({
            stimulus: r.stimulus,
            correct: r.correct,
            rt: r.rt,
          })),
        );
        const correct = results.filter((r) => r.correct).length;
        resultCard(
          content,
          `${kind === "feature" ? "Feature" : "Conjunction"} search results`,
          [
            `${correct} of ${results.length} correct.`,
            ...interpretSearch(kind, slopes),
          ],
          "Slopes come from mean correct RT at each set size (4, 8, 16); with ~6 trials per cell they are rough.",
          run,
          home,
        );
      },
    });
  };
  run();
}
