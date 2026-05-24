/**
 * @file Unit tests for effect-vtree package export contract.
 * @responsibility Validate that the public API surface exports the Reconciler
 * builder API and VTreeNode types.
 * @boundary Effect-vtree package export boundary only.
 * @testIntent Lock the public export shape to prevent drift after planner
 * system removal.
 * @validatedBehavior Package entrypoint re-exports Operation, Reconciler, and
 * VTreeNode type contracts.
 * @why The export surface should fail fast if symbols drift.
 */

import { it } from "@effect/vitest"
import { Effect, Option } from "effect"
import { Operation, Reconciler, type VNode } from "effect-vtree"
import { describe, expect } from "vitest"

describe("effect-vtree exports", () => {
  it.effect("exports Operation and Reconciler builder API", () =>
    Effect.sync(() => {
      expect(Operation).toBeDefined()
      expect(Operation.make).toBeTypeOf("function")
      expect(Operation.withHandler).toBeTypeOf("function")
      expect(Reconciler).toBeDefined()
      expect(Reconciler.make).toBeTypeOf("function")
      expect(Reconciler.from).toBeTypeOf("function")
      expect(Reconciler.withOperation).toBeTypeOf("function")
      expect(Reconciler.withOperations).toBeTypeOf("function")
      expect(Reconciler.withRecycling).toBeTypeOf("function")
      expect(Reconciler.build).toBeTypeOf("function")
    }),
  )

  it.effect("supports minimal reconciler construction and patch", () =>
    Effect.gen(function* () {
      type Item = { readonly id: number }
      type Node = VNode<"item", { readonly id: number }, number>

      const fromItem = (item: Item): Option.Option<Node> =>
        Option.some({
          nodeType: "item",
          key: item.id,
          parentKey: Option.none(),
          props: { id: item.id },
        })

      const Insert = Operation.make("Insert").pipe(
        Operation.withHandler<Node, "Insert">(() => Effect.void),
      )
      const Remove = Operation.make("Remove").pipe(
        Operation.withHandler<Node, "Remove">(() => Effect.void),
      )
      const Move = Operation.make("Move").pipe(
        Operation.withHandler<Node, "Move">(() => Effect.void),
      )
      const Replace = Operation.make("Replace").pipe(
        Operation.withHandler<Node, "Replace">(() => Effect.void),
      )
      const SetProps = Operation.make("SetProps").pipe(
        Operation.withHandler<Node, "SetProps">(() => Effect.void),
      )

      const reconciler = Reconciler.make(
        (input: { readonly items: readonly Item[] }) => input.items,
      ).pipe(
        Reconciler.from([fromItem]),
        Reconciler.withOperations([Insert, Remove, Move, Replace, SetProps]),
        Reconciler.build,
      )

      const report = yield* reconciler.patch({
        current: { items: [] },
        desired: { items: [{ id: 1 }] },
      })

      yield* Effect.sync(() => {
        expect(report.applied).toBe(1)
      })
    }),
  )
})
