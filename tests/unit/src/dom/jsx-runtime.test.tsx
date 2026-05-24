// @vitest-environment jsdom
/**
 * @file Unit tests for effect-vtree JSX runtime entrypoint.
 * @responsibility Validate JSX factory exports (`jsx`, `jsxs`, `Fragment`) and
 * end-to-end DomReconciler interoperability from JSX-authored trees.
 * @boundary Effect-vtree JSX runtime + DOM reconciler boundary only; no
 * extension worker integration.
 * @testIntent Lock JSX-authored node shape semantics and prevent regressions in
 * JSX -> DomReconciler flow.
 * @validatedBehavior JSX emits VTreeNode contracts with fragment support and
 * JSX-authored trees reconcile through DomReconciler.
 * @why S10 requires a dedicated JSX authoring surface for effect-vtree nodes.
 */
/** @jsxImportSource effect-vtree/dom */

import { it } from "@effect/vitest"
import { Effect } from "effect"
import { DomReconciler } from "effect-vtree/dom"
import { describe, expect } from "vitest"

describe("effect-vtree jsx runtime", () => {
  it.effect(
    "emits VTreeNode contracts from jsx/jsxs/Fragment entrypoints",
    () =>
      Effect.sync(() => {
        const tree = (
          <>
            <section key="node:section" data-role="container">
              <span key="node:child">hello</span>
            </section>
          </>
        )

        expect(tree).toEqual({
          _tag: "Fragment",
          children: [
            {
              _tag: "Element",
              nodeType: "section",
              key: "node:section",
              props: {
                "data-role": "container",
              },
              children: [
                {
                  _tag: "Element",
                  nodeType: "span",
                  key: "node:child",
                  props: {},
                  children: [
                    {
                      _tag: "Text",
                      text: "hello",
                    },
                  ],
                },
              ],
            },
          ],
        })
      }),
  )

  it.effect("reconciles JSX-authored trees through DomReconciler", () =>
    Effect.gen(function* () {
      const previous = (
        <div key="node:root">
          <span key="node:text">alpha</span>
        </div>
      )
      const next = (
        <div key="node:root">
          <span key="node:text">beta</span>
        </div>
      )

      const host = document.createElement("div")
      const reconciler = DomReconciler.make(host)

      yield* reconciler.init()
      yield* reconciler.render(previous)
      const report = yield* reconciler.patch({
        current: previous,
        desired: next,
      })

      yield* Effect.sync(() => {
        expect(report.applied).toBeGreaterThan(0)
        expect(host.textContent).toBe("beta")
      })
    }),
  )
})
