import { Effect } from "effect"
import type { VTreeNode, VTreeNodeProps } from "effect-vtree"
import { DomReconciler } from "effect-vtree/dom"

// This example renders static SVG to show that raw VTreeNode elements are not
// limited to HTML. The DOM target creates SVG descendants in the SVG namespace.
const text = (value: string | number): VTreeNode => ({
  _tag: "Text",
  text: String(value),
})

const el = (
  nodeType: string,
  props: VTreeNodeProps,
  children: readonly VTreeNode[] = [],
): VTreeNode => ({
  _tag: "Element",
  nodeType,
  props,
  children,
})

const host = document.querySelector<HTMLElement>("#app")
if (!host) {
  throw new Error("Missing #app host element")
}

const reconciler = DomReconciler.make(host)
const tree = view()

// No patch loop is needed for this static example; render mounts the initial
// desired tree into the host element.
Effect.runSync(reconciler.render(tree))

function view(): VTreeNode {
  // SVG attributes are written as normal VTree props. Dashed SVG names stay
  // dashed, e.g. `stroke-width` and `text-anchor`.
  return el(
    "section",
    {
      class:
        "min-h-screen flex items-center justify-center px-6 py-12 font-sans",
    },
    [
      el(
        "div",
        {
          class:
            "w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/50",
        },
        [
          el(
            "p",
            {
              class:
                "text-sm font-medium uppercase tracking-[0.3em] text-cyan-300",
            },
            [text("effect-vtree")],
          ),
          el(
            "h1",
            {
              class: "mt-3 text-3xl font-semibold tracking-tight text-white",
            },
            [text("SVG")],
          ),
          el(
            "svg",
            {
              class: "mt-8 h-auto w-full rounded-2xl bg-slate-950",
              viewBox: "0 0 320 180",
            },
            [
              el("rect", {
                x: 24,
                y: 24,
                width: 272,
                height: 132,
                rx: 24,
                fill: "#0f172a",
                stroke: "#334155",
                "stroke-width": 4,
              }),
              el("circle", {
                cx: 92,
                cy: 90,
                r: 42,
                fill: "#22d3ee",
              }),
              el("circle", {
                cx: 154,
                cy: 90,
                r: 42,
                fill: "#a78bfa",
                "fill-opacity": 0.82,
              }),
              el("path", {
                d: "M198 126 L242 50 L286 126 Z",
                fill: "#facc15",
                stroke: "#fde68a",
                "stroke-width": 3,
                "stroke-linejoin": "round",
              }),
              el(
                "text",
                {
                  x: 160,
                  y: 162,
                  "text-anchor": "middle",
                  fill: "#e2e8f0",
                  "font-size": 14,
                  "font-family": "ui-sans-serif, system-ui",
                },
                [text("SVG VTree nodes")],
              ),
            ],
          ),
        ],
      ),
    ],
  )
}
