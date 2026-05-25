import { Effect } from "effect"
import type { VTreeNode, VTreeNodeKey, VTreeNodeProps } from "effect-vtree"
import { DomReconciler } from "effect-vtree/dom"

// This example patches SVG attributes only. The animation comes from browser CSS
// transitions on the existing DOM nodes, not from an effect-vtree transition API.
type Slide = Readonly<{
  id: string
  label: string
  x: number
  y: number
  radius: number
  color: string
}>

const slides: readonly Slide[] = [
  { id: "cyan", label: "Cyan", x: 110, y: 130, radius: 48, color: "#22d3ee" },
  {
    id: "violet",
    label: "Violet",
    x: 220,
    y: 82,
    radius: 36,
    color: "#a78bfa",
  },
  { id: "amber", label: "Amber", x: 315, y: 150, radius: 28, color: "#fcd34d" },
  {
    id: "emerald",
    label: "Emerald",
    x: 210,
    y: 218,
    radius: 22,
    color: "#34d399",
  },
]

const text = (value: string | number): VTreeNode => ({
  _tag: "Text",
  text: String(value),
})

const el = (
  nodeType: string,
  props: VTreeNodeProps,
  children: readonly VTreeNode[] = [],
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
let offset = 0
let current = view(offset)

Effect.runSync(reconciler.render(current))

function rotateSlides(): void {
  offset = (offset + 1) % slides.length

  // Patching changes cx/cy/r/opacity on keyed SVG groups. CSS transitions then
  // interpolate those DOM attribute changes in the browser.
  const desired = view(offset)
  Effect.runSync(reconciler.patch({ current, desired }))
  current = desired
}

function positionedSlides(currentOffset: number): readonly Slide[] {
  // Keep each slide's identity/color stable, but rotate through the positions
  // and radii. Stable keys make this an update, not replacement.
  return slides.map((slide, index) => ({
    ...slide,
    ...slides[(index + currentOffset) % slides.length],
    id: slide.id,
    label: slide.label,
    color: slide.color,
  }))
}

function slideView(slide: Slide): VTreeNode {
  // The key belongs to the `<g>` so each labeled shape keeps its DOM identity
  // while its SVG attributes change.
  return el(
    "g",
    {
      class: "cursor-pointer transition-all duration-700 ease-in-out",
      onClick: rotateSlides,
    },
    [
      el("circle", {
        class: "transition-all duration-700 ease-in-out",
        cx: slide.x,
        cy: slide.y,
        r: slide.radius,
        fill: slide.color,
        opacity: slide.radius >= 40 ? "1" : "0.72",
      }),
      el(
        "text",
        {
          class:
            "pointer-events-none select-none text-sm font-bold transition-all duration-700 ease-in-out",
          x: slide.x,
          y: slide.y + 5,
          "text-anchor": "middle",
          fill: "#020617",
        },
        [text(slide.label)],
      ),
    ],
    slide.id,
  )
}

function view(currentOffset: number): VTreeNode {
  const currentSlides = positionedSlides(currentOffset)

  return el(
    "section",
    {
      class:
        "flex min-h-screen items-center justify-center px-6 py-12 font-sans",
    },
    [
      el(
        "div",
        {
          class:
            "w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/50",
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
            { class: "mt-3 text-3xl font-semibold tracking-tight text-white" },
            [text("SVG transitions")],
          ),
          el("p", { class: "mt-3 text-sm leading-6 text-slate-300" }, [
            text(
              "Click the graphic to patch new SVG attributes. Browser CSS transitions animate the reconciled DOM.",
            ),
          ]),
          el(
            "button",
            {
              class:
                "mt-6 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300",
              onClick: rotateSlides,
            },
            [text("Rotate")],
          ),
          el(
            "svg",
            {
              class: "mt-6 w-full rounded-2xl bg-slate-950",
              viewBox: "0 0 420 300",
            },
            currentSlides.map(slideView),
          ),
        ],
      ),
    ],
  )
}
