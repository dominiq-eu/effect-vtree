// @vitest-environment jsdom
/**
 * @file Unit tests for prebuilt DOM reconciler API.
 * @responsibility Validate `DomReconciler.make(host)` lifecycle and patch
 * behavior for keyed and keyless virtual trees.
 * @boundary Effect-vtree DOM reconciler boundary only; no extension runtime
 * or browser service worker integration.
 * @testIntent Lock the public DOM reconciler API shape and deterministic patch
 * behavior.
 * @validatedBehavior `patch({ current, desired })` applies prop/text updates,
 * supports keyless trees via deterministic key synthesis, and is idempotent.
 * @why The DOM entrypoint should be directly usable without manual runtime
 * wiring or adapter-specific key management.
 */

import { it } from "@effect/vitest"
import { Effect } from "effect"
import type {
  VTreeElementNode,
  VTreeFragmentNode,
  VTreeNode,
  VTreeNodeKey,
  VTreeNodeProps,
  VTreeTextNode,
} from "effect-vtree"
import { DomReconciler } from "effect-vtree/dom"
import { describe, expect } from "vitest"

const el = (
  nodeType: string,
  children: readonly VTreeNode[],
  options?: { key?: VTreeNodeKey; props?: VTreeNodeProps },
): VTreeElementNode => ({
  _tag: "Element",
  nodeType,
  props: options?.props ?? {},
  children: [...children],
  ...(options?.key !== undefined ? { key: options.key } : {}),
})

const text = (value: string, key?: VTreeNodeKey): VTreeTextNode => ({
  _tag: "Text",
  text: value,
  ...(key !== undefined ? { key } : {}),
})

const frag = (
  children: readonly VTreeNode[],
  key?: VTreeNodeKey,
): VTreeFragmentNode => ({
  _tag: "Fragment",
  children: [...children],
  ...(key !== undefined ? { key } : {}),
})

describe("effect-vtree dom reconciler", () => {
  it.effect("patches keyed trees through prebuilt patch API", () =>
    Effect.gen(function* () {
      const host = document.createElement("div")
      const reconciler = DomReconciler.make(host)

      const current = frag([
        el("section", [text("alpha")], {
          key: "node:section",
          props: {
            id: "alpha",
          },
        }),
      ])
      const desired = frag([
        el("section", [text("beta")], {
          key: "node:section",
          props: {
            id: "beta",
            "data-state": "updated",
          },
        }),
      ])

      yield* reconciler.init()
      yield* reconciler.render(current)
      const report = yield* reconciler.patch({
        current,
        desired,
      })

      yield* Effect.sync(() => {
        expect(report.applied).toBe(2)
        expect(report.failed).toBe(0)
        const section = host.querySelector("section")
        expect(section?.getAttribute("id")).toBe("beta")
        expect(section?.getAttribute("data-state")).toBe("updated")
        expect(section?.textContent).toBe("beta")
      })
    }),
  )

  it.effect(
    "patches keyless trees deterministically and remains idempotent",
    () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const reconciler = DomReconciler.make(host)

        const current = frag([el("li", [text("A")]), el("li", [text("B")])])
        const desired = frag([el("li", [text("A")]), el("li", [text("C")])])

        yield* reconciler.init()
        yield* reconciler.render(current)

        const firstReport = yield* reconciler.patch({
          current,
          desired,
        })

        const secondReport = yield* reconciler.patch({
          current: desired,
          desired,
        })

        yield* Effect.sync(() => {
          expect(firstReport.applied).toBeGreaterThan(0)
          expect(host.textContent).toBe("AC")
          expect(secondReport.applied).toBe(0)
          expect(secondReport.failed).toBe(0)
        })
      }),
  )

  it.effect("moves keyed DOM nodes when sibling order changes", () =>
    Effect.gen(function* () {
      const host = document.createElement("div")
      const reconciler = DomReconciler.make(host)

      const current = el("ul", [
        el("li", [text("A")], { key: "a", props: { "data-key": "a" } }),
        el("li", [text("B")], { key: "b", props: { "data-key": "b" } }),
        el("li", [text("C")], { key: "c", props: { "data-key": "c" } }),
      ])
      const desired = el("ul", [
        el("li", [text("C")], { key: "c", props: { "data-key": "c" } }),
        el("li", [text("B")], { key: "b", props: { "data-key": "b" } }),
        el("li", [text("A")], { key: "a", props: { "data-key": "a" } }),
      ])

      yield* reconciler.render(current)
      const originalA = host.querySelector('[data-key="a"]')
      const originalB = host.querySelector('[data-key="b"]')
      const originalC = host.querySelector('[data-key="c"]')

      const report = yield* reconciler.patch({ current, desired })

      yield* Effect.sync(() => {
        const reordered = Array.from(host.querySelectorAll("li"))
        expect(report.failed).toBe(0)
        expect(reordered.map((node) => node.getAttribute("data-key"))).toEqual([
          "c",
          "b",
          "a",
        ])
        expect(reordered[0]).toBe(originalC)
        expect(reordered[1]).toBe(originalB)
        expect(reordered[2]).toBe(originalA)
      })
    }),
  )

  it.effect("renders svg descendants in the SVG namespace", () =>
    Effect.gen(function* () {
      const host = document.createElement("div")
      const reconciler = DomReconciler.make(host)

      yield* reconciler.render(
        el("svg", [el("circle", [], { props: { cx: 10, cy: 10, r: 5 } })], {
          props: { viewBox: "0 0 20 20" },
        }),
      )

      yield* Effect.sync(() => {
        const svg = host.querySelector("svg")
        const circle = host.querySelector("circle")

        expect(svg).toBeInstanceOf(SVGElement)
        expect(circle).toBeInstanceOf(SVGElement)
        expect(svg?.namespaceURI).toBe("http://www.w3.org/2000/svg")
        expect(circle?.namespaceURI).toBe("http://www.w3.org/2000/svg")
      })
    }),
  )
})
