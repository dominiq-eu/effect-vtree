import { Effect } from "effect"
import type { VTreeNode, VTreeNodeProps } from "effect-vtree"
import { DomReconciler } from "effect-vtree/dom"

// Plain examples build VTreeNode data directly. These helpers are intentionally
// tiny so the shape consumed by DomReconciler stays visible.
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
let count = 0

// Keep the previously rendered tree. Patches compare this with the next desired
// tree, similar to Snabbdom's `vnode = patch(vnode, newVnode)` pattern.
let current = view(count)

Effect.runSync(reconciler.render(current))

function setCount(nextCount: number): void {
  count = nextCount

  // Event handlers stay plain functions. Effect is only run at the DOM patching
  // boundary.
  const desired = view(count)
  Effect.runSync(reconciler.patch({ current, desired }))
  current = desired
}

function view(value: number): VTreeNode {
  // `view` is pure: the same count always produces the same desired tree.
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
            "w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl shadow-slate-950/50",
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
            [text("Counter")],
          ),
          el(
            "output",
            {
              class:
                "mt-8 block rounded-2xl bg-slate-950 px-6 py-5 text-6xl font-bold tabular-nums text-cyan-200",
            },
            [text(value)],
          ),
          el("div", { class: "mt-8 grid grid-cols-3 gap-3" }, [
            el(
              "button",
              {
                class:
                  "rounded-xl bg-slate-800 px-4 py-3 text-lg font-semibold text-white transition hover:bg-slate-700",
                onClick: function decrement() {
                  setCount(count - 1)
                },
              },
              [text("−")],
            ),
            el(
              "button",
              {
                class:
                  "rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-slate-700",
                onClick: function reset() {
                  setCount(0)
                },
              },
              [text("Reset")],
            ),
            el(
              "button",
              {
                class:
                  "rounded-xl bg-cyan-400 px-4 py-3 text-lg font-semibold text-slate-950 transition hover:bg-cyan-300",
                onClick: function increment() {
                  setCount(count + 1)
                },
              },
              [text("+")],
            ),
          ]),
        ],
      ),
    ],
  )
}
