import { Effect } from "effect"
import type { VTreeNode, VTreeNodeKey, VTreeNodeProps } from "effect-vtree"
import { DomReconciler } from "effect-vtree/dom"

// Reordering demonstrates why keys matter: when a row keeps the same key across
// renders, the DOM reconciler can move the existing node instead of replacing it.
type Item = Readonly<{
  id: string
  label: string
  rank: number
  accent: string
}>

const initialItems: readonly Item[] = [
  { id: "elm", label: "Elm", rank: 3, accent: "bg-emerald-400" },
  { id: "tea", label: "TEA", rank: 1, accent: "bg-cyan-400" },
  { id: "vdom", label: "Virtual DOM", rank: 4, accent: "bg-violet-400" },
  { id: "keys", label: "Stable keys", rank: 2, accent: "bg-amber-300" },
]

const text = (value: string | number): VTreeNode => ({
  _tag: "Text",
  text: String(value),
})

const el = (
  nodeType: string,
  props: VTreeNodeProps,
  children: readonly VTreeNode[] = [],
  // The optional key is separate from props because reconciliation identity is
  // part of the virtual tree model, not a DOM attribute.
  key?: VTreeNodeKey,
): VTreeNode => ({
  _tag: "Element",
  nodeType,
  props,
  children,
  ...(key !== undefined ? { key } : {}),
})

const host = document.querySelector<HTMLElement>("#app")
if (!host) {
  throw new Error("Missing #app host element")
}

const reconciler = DomReconciler.make(host)
let items = [...initialItems]
let current = view(items)

Effect.runSync(reconciler.render(current))

function setItems(nextItems: readonly Item[]): void {
  items = [...nextItems]

  // Build the desired order from state, patch from the current tree, then make
  // the desired tree current for the next interaction.
  const desired = view(items)
  Effect.runSync(reconciler.patch({ current, desired }))
  current = desired
}

function itemView(item: Item): VTreeNode {
  // Passing `item.id` as the VTree key lets the reconciler track this row even
  // when its array position changes.
  return el(
    "li",
    {
      class:
        "flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 p-4",
      "data-key": item.id,
    },
    [
      el("div", { class: "flex items-center gap-3" }, [
        el("span", { class: `h-4 w-4 rounded-full ${item.accent}` }),
        el("span", { class: "font-medium text-white" }, [text(item.label)]),
      ]),
      el(
        "code",
        {
          class:
            "rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-cyan-200",
        },
        [text(`key: ${item.id}`)],
      ),
    ],
    item.id,
  )
}

function view(currentItems: readonly Item[]): VTreeNode {
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
            [text("Keyed reorder")],
          ),
          el("p", { class: "mt-3 text-sm leading-6 text-slate-300" }, [
            text(
              "Each row has a stable key. Click a control to patch the new order.",
            ),
          ]),
          el("div", { class: "mt-6 grid grid-cols-3 gap-3" }, [
            el(
              "button",
              {
                class:
                  "rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700",
                onClick: function reverseItems() {
                  setItems([...items].reverse())
                },
              },
              [text("Reverse")],
            ),
            el(
              "button",
              {
                class:
                  "rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700",
                onClick: function sortByRank() {
                  setItems(
                    [...items].sort((left, right) => left.rank - right.rank),
                  )
                },
              },
              [text("Sort rank")],
            ),
            el(
              "button",
              {
                class:
                  "rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300",
                onClick: function resetItems() {
                  setItems(initialItems)
                },
              },
              [text("Reset")],
            ),
          ]),
          el("ul", { class: "mt-6 space-y-3" }, currentItems.map(itemView)),
        ],
      ),
    ],
  )
}
