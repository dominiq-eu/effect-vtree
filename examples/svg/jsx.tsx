/** @jsxImportSource effect-vtree/dom */
// JSX is only an authoring layer here. The rendered value is still a VTreeNode
// tree that contains SVG elements and attributes.
import { Effect } from "effect"
import type { VTreeNode } from "effect-vtree"
import { DomReconciler } from "effect-vtree/dom"

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
  // SVG attributes use their DOM/SVG names. In this package, examples prefer
  // `class` over React-style `className`.
  return (
    <section class="flex min-h-screen items-center justify-center px-6 py-12 font-sans">
      <div class="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/50">
        <p class="text-sm font-medium tracking-[0.3em] text-cyan-300 uppercase">
          effect-vtree
        </p>
        <h1 class="mt-3 text-3xl font-semibold tracking-tight text-white">
          SVG
        </h1>
        <svg
          class="mt-8 h-auto w-full rounded-2xl bg-slate-950"
          viewBox="0 0 320 180"
        >
          <rect
            x="24"
            y="24"
            width="272"
            height="132"
            rx="24"
            fill="#0f172a"
            stroke="#334155"
            stroke-width="4"
          />
          <circle cx="92" cy="90" r="42" fill="#22d3ee" />
          <circle cx="154" cy="90" r="42" fill="#a78bfa" fill-opacity="0.82" />
          <path
            d="M198 126 L242 50 L286 126 Z"
            fill="#facc15"
            stroke="#fde68a"
            stroke-width="3"
            stroke-linejoin="round"
          />
          <text
            x="160"
            y="162"
            text-anchor="middle"
            fill="#e2e8f0"
            font-size="14"
            font-family="ui-sans-serif, system-ui"
          >
            SVG VTree nodes
          </text>
        </svg>
      </div>
    </section>
  )
}
