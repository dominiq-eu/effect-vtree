/**
 * @file Unit tests for refined effect-vtree reconciler API contract.
 * @responsibility Define the desired declarative user-facing API shape for
 * reconciler construction and instance patch invocation.
 * @boundary Effect-vtree package public API contract boundary only; runtime
 * planner/adapter behavior is out of scope.
 * @testIntent Lock the refined API before implementation to prevent shape drift.
 * @validatedBehavior Users can define ordered `from` factories, register
 * operations, compose recycling with default logic, build a reconciler
 * instance, and call instance `patch`.
 * @why The refined API must be explicit and executable in tests before
 * rearchitecting internals.
 */

import { it } from "@effect/vitest"
import { Context, Effect, Option, Ref, Schema } from "effect"
import { Operation, Reconciler, type VNode } from "effect-vtree"
import { describe, expect } from "vitest"

const TabIdSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand("TabId"),
)
const GroupIdSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand("GroupId"),
)

type TabId = Schema.Schema.Type<typeof TabIdSchema>
type GroupId = Schema.Schema.Type<typeof GroupIdSchema>

type TabItem = {
  readonly _tag: "Tab"
  readonly id: TabId
  readonly groupId: Option.Option<GroupId>
  readonly title: string
  readonly url: string
}

type GroupItem = {
  readonly _tag: "Group"
  readonly id: GroupId
  readonly title: string
  readonly color: string
}

type SourceItem = TabItem | GroupItem

type Snapshot = {
  readonly items: readonly SourceItem[]
}

type GroupNode = VNode<
  "group",
  {
    readonly groupId: GroupId
    readonly title: string
    readonly color: string
  },
  GroupId
>

type TabNode = VNode<
  "tab",
  {
    readonly tabId: TabId
    readonly groupId: Option.Option<GroupId>
    readonly title: string
    readonly url: string
  },
  TabId | GroupId
>

type SnapshotNode = GroupNode | TabNode

const fromGroup = (item: SourceItem): Option.Option<SnapshotNode> => {
  if (item._tag !== "Group") {
    return Option.none()
  }

  return Option.some({
    nodeType: "group",
    key: item.id,
    parentKey: Option.none(),
    props: {
      groupId: item.id,
      title: item.title,
      color: item.color,
    },
  })
}

const fromTab = (item: SourceItem): Option.Option<SnapshotNode> => {
  if (item._tag !== "Tab") {
    return Option.none()
  }

  return Option.some({
    nodeType: "tab",
    key: item.id,
    parentKey: item.groupId,
    props: {
      tabId: item.id,
      groupId: item.groupId,
      title: item.title,
      url: item.url,
    },
  })
}

const Insert = Operation.make("Insert").pipe(
  Operation.withHandler(() => Effect.void),
)
const Remove = Operation.make("Remove").pipe(
  Operation.withHandler(() => Effect.void),
)
const Move = Operation.make("Move").pipe(
  Operation.withHandler(() => Effect.void),
)
const Replace = Operation.make("Replace").pipe(
  Operation.withHandler(() => Effect.void),
)
const SetProps = Operation.make("SetProps").pipe(
  Operation.withHandler(() => Effect.void),
)

const TabReconciler = Reconciler.make(
  (snapshot: Snapshot) => snapshot.items,
).pipe(
  Reconciler.from([fromGroup, fromTab]),
  Reconciler.withOperations([Insert, Remove, Move, Replace, SetProps]),
  Reconciler.withRecycling(({ prev, next }, defaultRecycleFn) =>
    Effect.succeed(
      defaultRecycleFn({ prev, next }) &&
        prev.nodeType === "tab" &&
        next.nodeType === "tab" &&
        prev.props.url === next.props.url,
    ),
  ),
  Reconciler.build,
)

const makeSnapshot = (): Snapshot => ({
  items: [],
})

describe("effect-vtree reconciler api contract", () => {
  it.effect("supports instance patch invocation on built reconciler", () =>
    Effect.sync(() => {
      const current = makeSnapshot()
      const desired = makeSnapshot()
      const program = TabReconciler.patch({
        current,
        desired,
      })

      expect(program).toBeDefined()
    }),
  )

  it.effect("inserts nodes when from-factory provides required key", () =>
    Effect.gen(function* () {
      type Item = {
        readonly id: number
      }

      type Node = VNode<
        "item",
        {
          readonly id: number
        },
        number
      >

      const fromItem = (item: Item): Option.Option<Node> =>
        Option.some({
          nodeType: "item",
          key: item.id,
          parentKey: Option.none(),
          props: {
            id: item.id,
          },
        })

      const InsertNode = Operation.make("Insert").pipe(
        Operation.withHandler<Node, "Insert">(() => Effect.void),
      )
      const RemoveNode = Operation.make("Remove").pipe(
        Operation.withHandler<Node, "Remove">(() => Effect.void),
      )
      const MoveNode = Operation.make("Move").pipe(
        Operation.withHandler<Node, "Move">(() => Effect.void),
      )
      const ReplaceNode = Operation.make("Replace").pipe(
        Operation.withHandler<Node, "Replace">(() => Effect.void),
      )
      const SetPropsNode = Operation.make("SetProps").pipe(
        Operation.withHandler<Node, "SetProps">(() => Effect.void),
      )

      const reconciler = Reconciler.make(
        (input: { readonly items: readonly Item[] }) => input.items,
      ).pipe(
        Reconciler.from([fromItem]),
        Reconciler.withOperations([
          InsertNode,
          RemoveNode,
          MoveNode,
          ReplaceNode,
          SetPropsNode,
        ]),
        Reconciler.build,
      )

      const report = yield* reconciler.patch({
        current: {
          items: [],
        },
        desired: {
          items: [{ id: 1 }],
        },
      })

      yield* Effect.sync(() => {
        expect(report.applied).toBe(1)
      })
    }),
  )

  it.effect(
    "uses ordered from-factories and dispatches Insert with first match",
    () =>
      Effect.gen(function* () {
        type Item = {
          readonly id: number
        }

        type OrderedNode = VNode<
          "first" | "second",
          {
            readonly id: number
          },
          number
        >

        const fromFirst = (item: Item): Option.Option<OrderedNode> =>
          Option.some({
            nodeType: "first",
            key: item.id,
            parentKey: Option.none(),
            props: {
              id: item.id,
            },
          })

        const fromSecond = (item: Item): Option.Option<OrderedNode> =>
          Option.some({
            nodeType: "second",
            key: item.id,
            parentKey: Option.none(),
            props: {
              id: item.id,
            },
          })

        const insertedNodeTypes: OrderedNode["nodeType"][] = []

        const InsertOrdered = Operation.make("Insert").pipe(
          Operation.withHandler<OrderedNode, "Insert">(({ node }) =>
            Effect.sync(() => {
              insertedNodeTypes.push(node.nodeType)
            }),
          ),
        )
        const RemoveOrdered = Operation.make("Remove").pipe(
          Operation.withHandler<OrderedNode, "Remove">(() => Effect.void),
        )
        const MoveOrdered = Operation.make("Move").pipe(
          Operation.withHandler<OrderedNode, "Move">(() => Effect.void),
        )
        const ReplaceOrdered = Operation.make("Replace").pipe(
          Operation.withHandler<OrderedNode, "Replace">(() => Effect.void),
        )
        const SetPropsOrdered = Operation.make("SetProps").pipe(
          Operation.withHandler<OrderedNode, "SetProps">(() => Effect.void),
        )

        const orderedReconciler = Reconciler.make(
          (input: { readonly items: readonly Item[] }) => input.items,
        ).pipe(
          Reconciler.from([fromFirst, fromSecond]),
          Reconciler.withOperations([
            InsertOrdered,
            RemoveOrdered,
            MoveOrdered,
            ReplaceOrdered,
            SetPropsOrdered,
          ]),
          Reconciler.build,
        )

        const report = yield* orderedReconciler.patch({
          current: {
            items: [],
          },
          desired: {
            items: [{ id: 1 }],
          },
        })

        yield* Effect.sync(() => {
          expect(insertedNodeTypes).toEqual(["first"])
          expect(report.applied).toBe(1)
        })
      }),
  )

  it.effect(
    "dispatches SetProps when keyed node keeps type but props change",
    () =>
      Effect.gen(function* () {
        type Item = {
          readonly id: number
          readonly value: number
        }

        type ItemNode = VNode<
          "item",
          {
            readonly value: number
          },
          number
        >

        const fromItem = (item: Item): Option.Option<ItemNode> =>
          Option.some({
            nodeType: "item",
            key: item.id,
            parentKey: Option.none(),
            props: {
              value: item.value,
            },
          })

        const setPropsCalls: number[] = []

        const InsertItem = Operation.make("Insert").pipe(
          Operation.withHandler<ItemNode, "Insert">(() => Effect.void),
        )
        const RemoveItem = Operation.make("Remove").pipe(
          Operation.withHandler<ItemNode, "Remove">(() => Effect.void),
        )
        const MoveItem = Operation.make("Move").pipe(
          Operation.withHandler<ItemNode, "Move">(() => Effect.void),
        )
        const ReplaceItem = Operation.make("Replace").pipe(
          Operation.withHandler<ItemNode, "Replace">(() => Effect.void),
        )
        const SetPropsItem = Operation.make("SetProps").pipe(
          Operation.withHandler<ItemNode, "SetProps">(({ nextProps }) =>
            Effect.sync(() => {
              setPropsCalls.push(nextProps.value)
            }),
          ),
        )

        const reconciler = Reconciler.make(
          (input: { readonly items: readonly Item[] }) => input.items,
        ).pipe(
          Reconciler.from([fromItem]),
          Reconciler.withOperations([
            InsertItem,
            RemoveItem,
            MoveItem,
            ReplaceItem,
            SetPropsItem,
          ]),
          Reconciler.build,
        )

        const report = yield* reconciler.patch({
          current: {
            items: [{ id: 1, value: 1 }],
          },
          desired: {
            items: [{ id: 1, value: 2 }],
          },
        })

        yield* Effect.sync(() => {
          expect(setPropsCalls).toEqual([2])
          expect(report.applied).toBe(1)
        })
      }),
  )

  it.effect("dispatches Replace when key is same but nodeType changes", () =>
    Effect.gen(function* () {
      type Item = {
        readonly id: number
        readonly nodeType: "tab" | "group"
      }

      type Node = VNode<
        "tab" | "group",
        {
          readonly id: number
        },
        number
      >

      const fromItem = (item: Item): Option.Option<Node> =>
        Option.some({
          nodeType: item.nodeType,
          key: item.id,
          parentKey: Option.none(),
          props: {
            id: item.id,
          },
        })

      const replacedNodeTypes: Node["nodeType"][] = []

      const InsertNode = Operation.make("Insert").pipe(
        Operation.withHandler<Node, "Insert">(() => Effect.void),
      )
      const RemoveNode = Operation.make("Remove").pipe(
        Operation.withHandler<Node, "Remove">(() => Effect.void),
      )
      const MoveNode = Operation.make("Move").pipe(
        Operation.withHandler<Node, "Move">(() => Effect.void),
      )
      const ReplaceNode = Operation.make("Replace").pipe(
        Operation.withHandler<Node, "Replace">(({ next }) =>
          Effect.sync(() => {
            replacedNodeTypes.push(next.nodeType)
          }),
        ),
      )
      const SetPropsNode = Operation.make("SetProps").pipe(
        Operation.withHandler<Node, "SetProps">(() => Effect.void),
      )

      const reconciler = Reconciler.make(
        (input: { readonly items: readonly Item[] }) => input.items,
      ).pipe(
        Reconciler.from([fromItem]),
        Reconciler.withOperations([
          InsertNode,
          RemoveNode,
          MoveNode,
          ReplaceNode,
          SetPropsNode,
        ]),
        Reconciler.build,
      )

      const report = yield* reconciler.patch({
        current: {
          items: [{ id: 7, nodeType: "tab" }],
        },
        desired: {
          items: [{ id: 7, nodeType: "group" }],
        },
      })

      yield* Effect.sync(() => {
        expect(replacedNodeTypes).toEqual(["group"])
        expect(report.applied).toBe(1)
      })
    }),
  )

  it.effect("keeps operation service requirements on reconciler.patch", () =>
    Effect.gen(function* () {
      type Item = {
        readonly id: number
      }

      type ItemNode = VNode<
        "item",
        {
          readonly id: number
        },
        number
      >

      const MarkerService = Context.GenericTag<{
        readonly mark: Effect.Effect<void>
      }>("MarkerService")

      const fromItem = (item: Item): Option.Option<ItemNode> =>
        Option.some({
          nodeType: "item",
          key: item.id,
          parentKey: Option.none(),
          props: {
            id: item.id,
          },
        })

      const InsertWithService = Operation.make("Insert").pipe(
        Operation.withHandler<
          ItemNode,
          "Insert",
          Readonly<{ mark: Effect.Effect<void> }>
        >(() =>
          Effect.gen(function* () {
            const marker = yield* MarkerService
            yield* marker.mark
          }),
        ),
      )
      const RemoveNoop = Operation.make("Remove").pipe(
        Operation.withHandler<ItemNode, "Remove">(() => Effect.void),
      )
      const MoveNoop = Operation.make("Move").pipe(
        Operation.withHandler<ItemNode, "Move">(() => Effect.void),
      )
      const ReplaceNoop = Operation.make("Replace").pipe(
        Operation.withHandler<ItemNode, "Replace">(() => Effect.void),
      )
      const SetPropsNoop = Operation.make("SetProps").pipe(
        Operation.withHandler<ItemNode, "SetProps">(() => Effect.void),
      )

      const reconciler = Reconciler.make(
        (input: { readonly items: readonly Item[] }) => input.items,
      ).pipe(
        Reconciler.from([fromItem]),
        Reconciler.withOperations([
          InsertWithService,
          RemoveNoop,
          MoveNoop,
          ReplaceNoop,
          SetPropsNoop,
        ]),
        Reconciler.build,
      )

      const markedRef = yield* Ref.make(0)
      const report = yield* reconciler
        .patch({
          current: {
            items: [],
          },
          desired: {
            items: [{ id: 1 }],
          },
        })
        .pipe(
          Effect.provideService(MarkerService, {
            mark: Ref.update(markedRef, (count) => count + 1),
          }),
        )

      const marked = yield* Ref.get(markedRef)
      yield* Effect.sync(() => {
        expect(report.applied).toBe(1)
        expect(marked).toBe(1)
      })
    }),
  )

  it.effect(
    "recycles unmatched-key candidates and avoids insert-remove churn",
    () =>
      Effect.gen(function* () {
        type Item = {
          readonly key: number
          readonly url: string
        }

        type Node = VNode<
          "tab",
          {
            readonly url: string
          },
          number
        >

        const comparisons: Array<{
          readonly prevKey: number
          readonly nextKey: number
        }> = []
        const counters = {
          inserts: 0,
          removes: 0,
        }

        const fromItem = (item: Item): Option.Option<Node> =>
          Option.some({
            nodeType: "tab",
            key: item.key,
            parentKey: Option.none(),
            props: {
              url: item.url,
            },
          })

        const InsertItem = Operation.make("Insert").pipe(
          Operation.withHandler<Node, "Insert">(() =>
            Effect.sync(() => {
              counters.inserts += 1
            }),
          ),
        )
        const RemoveItem = Operation.make("Remove").pipe(
          Operation.withHandler<Node, "Remove">(() =>
            Effect.sync(() => {
              counters.removes += 1
            }),
          ),
        )
        const MoveItem = Operation.make("Move").pipe(
          Operation.withHandler<Node, "Move">(() => Effect.void),
        )
        const ReplaceItem = Operation.make("Replace").pipe(
          Operation.withHandler<Node, "Replace">(() => Effect.void),
        )
        const SetPropsItem = Operation.make("SetProps").pipe(
          Operation.withHandler<Node, "SetProps">(() => Effect.void),
        )

        const reconciler = Reconciler.make(
          (input: { readonly items: readonly Item[] }) => input.items,
        ).pipe(
          Reconciler.from([fromItem]),
          Reconciler.withOperations([
            InsertItem,
            RemoveItem,
            MoveItem,
            ReplaceItem,
            SetPropsItem,
          ]),
          Reconciler.withRecycling(({ prev, next }, defaultRecycleFn) =>
            Effect.sync(() => {
              comparisons.push({
                prevKey: prev.key,
                nextKey: next.key,
              })
              return (
                defaultRecycleFn({ prev, next }) ||
                prev.props.url === next.props.url
              )
            }),
          ),
          Reconciler.build,
        )

        const report = yield* reconciler.patch({
          current: {
            items: [
              { key: 1, url: "https://a.example" },
              { key: 2, url: "https://b.example" },
            ],
          },
          desired: {
            items: [
              { key: 11, url: "https://b.example" },
              { key: 12, url: "https://a.example" },
            ],
          },
        })

        yield* Effect.sync(() => {
          expect(comparisons.length).toBeGreaterThan(0)
          expect(counters.inserts).toBe(0)
          expect(counters.removes).toBe(0)
          expect(report.applied).toBeGreaterThanOrEqual(1)
        })
      }),
  )

  it.effect("limits candidate recycling comparisons to sibling scope", () =>
    Effect.gen(function* () {
      type Item =
        | {
            readonly _tag: "Group"
            readonly key: number
          }
        | {
            readonly _tag: "Tab"
            readonly key: number
            readonly parentKey: Option.Option<number>
            readonly url: string
          }

      type Node = VNode<
        "group" | "tab",
        {
          readonly url: string
        },
        number
      >

      const tabComparisons: Array<{
        readonly prevParent: string
        readonly nextParent: string
      }> = []

      const fromItem = (item: Item): Option.Option<Node> => {
        if (item._tag === "Group") {
          return Option.some({
            nodeType: "group",
            key: item.key,
            parentKey: Option.none(),
            props: {
              url: "",
            },
          })
        }

        return Option.some({
          nodeType: "tab",
          key: item.key,
          parentKey: item.parentKey,
          props: {
            url: item.url,
          },
        })
      }

      const InsertNode = Operation.make("Insert").pipe(
        Operation.withHandler<Node, "Insert">(() => Effect.void),
      )
      const RemoveNode = Operation.make("Remove").pipe(
        Operation.withHandler<Node, "Remove">(() => Effect.void),
      )
      const MoveNode = Operation.make("Move").pipe(
        Operation.withHandler<Node, "Move">(() => Effect.void),
      )
      const ReplaceNode = Operation.make("Replace").pipe(
        Operation.withHandler<Node, "Replace">(() => Effect.void),
      )
      const SetPropsNode = Operation.make("SetProps").pipe(
        Operation.withHandler<Node, "SetProps">(() => Effect.void),
      )

      const reconciler = Reconciler.make(
        (input: { readonly items: readonly Item[] }) => input.items,
      ).pipe(
        Reconciler.from([fromItem]),
        Reconciler.withOperations([
          InsertNode,
          RemoveNode,
          MoveNode,
          ReplaceNode,
          SetPropsNode,
        ]),
        Reconciler.withRecycling(({ prev, next }, defaultRecycleFn) =>
          Effect.sync(() => {
            if (prev.nodeType === "tab" && next.nodeType === "tab") {
              tabComparisons.push({
                prevParent: Option.match(prev.parentKey, {
                  onNone: () => "root",
                  onSome: (value) => String(value),
                }),
                nextParent: Option.match(next.parentKey, {
                  onNone: () => "root",
                  onSome: (value) => String(value),
                }),
              })
            }

            return (
              defaultRecycleFn({ prev, next }) ||
              (prev.nodeType === "tab" &&
                next.nodeType === "tab" &&
                prev.props.url === next.props.url)
            )
          }),
        ),
        Reconciler.build,
      )

      yield* reconciler.patch({
        current: {
          items: [
            { _tag: "Group", key: 500 },
            {
              _tag: "Tab",
              key: 1,
              parentKey: Option.some(500),
              url: "https://youtube.com",
            },
            {
              _tag: "Tab",
              key: 2,
              parentKey: Option.none(),
              url: "https://youtube.com",
            },
          ],
        },
        desired: {
          items: [
            { _tag: "Group", key: 500 },
            {
              _tag: "Tab",
              key: 11,
              parentKey: Option.some(500),
              url: "https://youtube.com",
            },
            {
              _tag: "Tab",
              key: 12,
              parentKey: Option.none(),
              url: "https://youtube.com",
            },
          ],
        },
      })

      yield* Effect.sync(() => {
        expect(tabComparisons).toEqual([
          { prevParent: "500", nextParent: "500" },
          { prevParent: "root", nextParent: "root" },
        ])
      })
    }),
  )

  it.effect(
    "prefers nearest-index candidate when multiple recyclable siblings match",
    () =>
      Effect.gen(function* () {
        type Item = {
          readonly key: number
          readonly url: string
        }

        type Node = VNode<
          "tab",
          {
            readonly url: string
          },
          number
        >

        const movedKeys: number[] = []
        const removedKeys: number[] = []

        const fromItem = (item: Item): Option.Option<Node> =>
          Option.some({
            nodeType: "tab",
            key: item.key,
            parentKey: Option.none(),
            props: {
              url: item.url,
            },
          })

        const InsertNode = Operation.make("Insert").pipe(
          Operation.withHandler<Node, "Insert">(() => Effect.void),
        )
        const RemoveNode = Operation.make("Remove").pipe(
          Operation.withHandler<Node, "Remove">(({ node }) =>
            Effect.sync(() => {
              Option.match(node.key, {
                onNone: () => undefined,
                onSome: (value) => {
                  if (typeof value === "number") {
                    removedKeys.push(value)
                  }
                  return undefined
                },
              })
            }),
          ),
        )
        const MoveNode = Operation.make("Move").pipe(
          Operation.withHandler<Node, "Move">(({ node }) =>
            Effect.sync(() => {
              Option.match(node.key, {
                onNone: () => undefined,
                onSome: (value) => {
                  if (typeof value === "number") {
                    movedKeys.push(value)
                  }
                  return undefined
                },
              })
            }),
          ),
        )
        const ReplaceNode = Operation.make("Replace").pipe(
          Operation.withHandler<Node, "Replace">(() => Effect.void),
        )
        const SetPropsNode = Operation.make("SetProps").pipe(
          Operation.withHandler<Node, "SetProps">(() => Effect.void),
        )

        const reconciler = Reconciler.make(
          (input: { readonly items: readonly Item[] }) => input.items,
        ).pipe(
          Reconciler.from([fromItem]),
          Reconciler.withOperations([
            InsertNode,
            RemoveNode,
            MoveNode,
            ReplaceNode,
            SetPropsNode,
          ]),
          Reconciler.withRecycling(({ prev, next }, defaultRecycleFn) =>
            Effect.succeed(
              defaultRecycleFn({ prev, next }) ||
                prev.props.url === next.props.url,
            ),
          ),
          Reconciler.build,
        )

        yield* reconciler.patch({
          current: {
            items: [
              { key: 1, url: "https://same.example" },
              { key: 2, url: "https://keep-2.example" },
              { key: 3, url: "https://keep-3.example" },
              { key: 4, url: "https://same.example" },
            ],
          },
          desired: {
            items: [
              { key: 2, url: "https://keep-2.example" },
              { key: 3, url: "https://keep-3.example" },
              { key: 20, url: "https://same.example" },
            ],
          },
        })

        yield* Effect.sync(() => {
          expect(removedKeys).toEqual([1])
          expect(movedKeys).toContain(4)
          expect(movedKeys).not.toContain(1)
        })
      }),
  )
})
