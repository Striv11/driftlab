import type { RtHistogram } from "../histogram";

const NS = "http://www.w3.org/2000/svg";
function svg(tag: string, attrs: Record<string, string | number>): SVGElement {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

/** Observed correct-RT bars with the model-predicted outline overlaid. Built with DOM APIs only. */
export function histogramChart(
  obs: RtHistogram,
  model: RtHistogram | null,
): SVGElement {
  const W = 480;
  const H = 180;
  const pad = { l: 8, r: 8, t: 8, b: 22 };
  const bins = obs.correct.length;
  const ymax = Math.max(1e-9, ...obs.correct, ...(model?.correct ?? []));
  const bw = (W - pad.l - pad.r) / bins;
  const y = (d: number): number => H - pad.b - (d / ymax) * (H - pad.t - pad.b);
  const root = svg("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    class: "hist",
  });
  root.append(
    Object.assign(svg("title", {}), {
      textContent: model
        ? "Histogram of your correct response times with the model's predicted distribution as a line"
        : "Histogram of your correct response times",
    }),
  );
  obs.correct.forEach((d, i) => {
    root.append(
      svg("rect", {
        x: pad.l + i * bw + 1,
        y: y(d),
        width: Math.max(1, bw - 2),
        height: H - pad.b - y(d),
        class: "bar",
      }),
    );
  });
  if (model) {
    const pts = model.correct
      .map((d, i) => `${pad.l + (i + 0.5) * bw},${y(d)}`)
      .join(" ");
    root.append(
      svg("polyline", { points: pts, class: "overlay", fill: "none" }),
    );
  }
  const lo = obs.edges[0]!;
  const hi = obs.edges[bins]!;
  for (const [x, v, anchor] of [
    [pad.l, lo, "start"],
    [W - pad.r, hi, "end"],
  ] as const) {
    const t = svg("text", {
      x,
      y: H - 6,
      "text-anchor": anchor,
      class: "axis",
    });
    t.textContent = `${Math.round(v * 1000)} ms`;
    root.append(t);
  }
  return root;
}
