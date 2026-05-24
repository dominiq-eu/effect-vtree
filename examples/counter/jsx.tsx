/** @jsxImportSource effect-vtree/dom */
// JSX is only an authoring layer here. The runtime still returns VTreeNode
// values that are rendered and patched by DomReconciler.
import { Effect } from "effect"
import type { VTreeNode } from "effect-vtree"
import { DomReconciler } from "effect-vtree/dom"

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
  return (
    <section class="flex min-h-screen items-center justify-center px-6 py-12 font-sans">
      <div class="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl shadow-slate-950/50">
        <p class="text-sm font-medium tracking-[0.3em] text-cyan-300 uppercase">
          effect-vtree
        </p>
        <h1 class="mt-3 text-3xl font-semibold tracking-tight text-white">
          Counter
        </h1>
        <output class="mt-8 block rounded-2xl bg-slate-950 px-6 py-5 text-6xl font-bold text-cyan-200 tabular-nums">
          {value}
        </output>
        <div class="mt-8 grid grid-cols-3 gap-3">
          <button
            class="rounded-xl bg-slate-800 px-4 py-3 text-lg font-semibold text-white transition hover:bg-slate-700"
            onClick={function decrement() {
              setCount(count - 1)
            }}
          >
            −
          </button>
          <button
            class="rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold tracking-wide text-slate-200 uppercase transition hover:bg-slate-700"
            onClick={function reset() {
              setCount(0)
            }}
          >
            Reset
          </button>
          <button
            class="rounded-xl bg-cyan-400 px-4 py-3 text-lg font-semibold text-slate-950 transition hover:bg-cyan-300"
            onClick={function increment() {
              setCount(count + 1)
            }}
          >
            +
          </button>
        </div>
      </div>
    </section>
  )
}
