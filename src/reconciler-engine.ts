/**
 * @file Reconciler diff engine and operation execution.
 * @responsibility Implement the keyed-diff planning algorithm, node indexing, recycling candidate matching, and operation handler execution.
 * @boundary Package-internal engine; consumed only by reconciler-api.ts.
 * @validatedBy tests/unit/src/reconciler-api.test.ts
 * @why Isolating the algorithm from the public API keeps each file focused and testable.
 * @fp-exception Imperative internals justified by performance-critical tree
 * diffing. Functionalizing adds allocation overhead to a hot path with no
 * clarity gain. See plan/fp-compliance-refactor-plan.md "Documented Exceptions".
 */
import { Effect, Option } from "effect"

import type {
  IndexedNode,
  ReconcilerAnyOperation,
  ReconcilerBuilder,
  ReconcilerFromFactory,
  ReconcilerInstance,
  ReconcilerOperationHandlers,
  ReconcilerOperationPlan,
  ReconcilerPatchReport,
  ReconcilerRecyclingFunction,
  VNode,
  VNodeAddress,
  VNodeKey,
} from "./reconciler-types.ts"

export const makeEmptyOperationHandlers = <
  TNode extends VNode,
  R,
  E,
>(): ReconcilerOperationHandlers<TNode, R, E> => ({
  insert: Option.none(),
  remove: Option.none(),
  move: Option.none(),
  replace: Option.none(),
  setProps: Option.none(),
})

/**
 * @why TypeScript cannot infer covariance through the ReconcilerRecyclingFunction
 * type alias. This minimal identity wrapper widens the R and E type parameters
 * so the recycling function can be assigned to a builder with wider union types.
 */
export const widenRecycling =
  <TNode extends VNode, RFrom, EFrom, RTo, ETo>(
    recycling: ReconcilerRecyclingFunction<TNode, RFrom, EFrom>,
  ): ReconcilerRecyclingFunction<TNode, RFrom | RTo, EFrom | ETo> =>
  (input, defaultRecycleFn) =>
    recycling(input, defaultRecycleFn)

export const applyOperationHandler = <
  TNode extends VNode,
  RCurrent,
  ECurrent,
  ROperation,
  EOperation,
>(
  handlers: ReconcilerOperationHandlers<TNode, RCurrent, ECurrent>,
  operation: ReconcilerAnyOperation<TNode, ROperation, EOperation>,
): ReconcilerOperationHandlers<
  TNode,
  RCurrent | ROperation,
  ECurrent | EOperation
> => {
  switch (operation.tag) {
    case "Insert":
      return { ...handlers, insert: Option.some(operation) }
    case "Remove":
      return { ...handlers, remove: Option.some(operation) }
    case "Move":
      return { ...handlers, move: Option.some(operation) }
    case "Replace":
      return { ...handlers, replace: Option.some(operation) }
    case "SetProps":
      return { ...handlers, setProps: Option.some(operation) }
    default:
      return handlers
  }
}

const cloneNodeAddress = <TKey extends string | number>(
  address: VNodeAddress<TKey>,
): VNodeAddress<TKey> => ({
  path: [...address.path],
  key: Option.match(address.key, {
    onNone: () => Option.none<TKey>(),
    onSome: (value) => Option.some(value),
  }),
})

const createRootNodeAddress = <
  TKey extends string | number,
>(): VNodeAddress<TKey> => ({
  path: [],
  key: Option.none<TKey>(),
})

const createNodeAddress = <TKey extends string | number>(
  parentPath: readonly number[],
  index: number,
  key: TKey,
): VNodeAddress<TKey> => ({
  path: [...parentPath, index],
  key: Option.some(key),
})

const collectMappedNodes = <TInput, TItem, TNode extends VNode>(
  input: TInput,
  selectItems: (value: TInput) => readonly TItem[],
  factories: readonly ReconcilerFromFactory<TItem, TNode>[],
): readonly TNode[] => {
  const items = selectItems(input)
  const mappedNodes: TNode[] = []

  for (const item of items) {
    for (const fromFactory of factories) {
      const candidate = fromFactory(item)
      if (Option.isNone(candidate)) {
        continue
      }

      mappedNodes.push(candidate.value)
      break
    }
  }

  return mappedNodes
}

const hasEqualProps = (
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean => {
  const leftEntries = Object.entries(left)
  const rightEntries = Object.entries(right)
  if (leftEntries.length !== rightEntries.length) {
    return false
  }

  for (const [key, value] of leftEntries) {
    if (!(key in right && Object.is(value, right[key]))) {
      return false
    }
  }

  return true
}

const defaultRecycleNode = <TNode extends VNode>(
  input: Readonly<{
    prev: TNode
    next: TNode
  }>,
): boolean =>
  input.prev.nodeType === input.next.nodeType &&
  input.prev.key === input.next.key

const indexMappedNodes = <TNode extends VNode>(
  nodes: readonly TNode[],
): readonly IndexedNode<TNode>[] => {
  const rootNodes: TNode[] = []
  const childrenByParentKey = new Map<VNodeKey, TNode[]>()

  for (const node of nodes) {
    Option.match(node.parentKey, {
      onNone: () => {
        rootNodes.push(node)
      },
      onSome: (parentKey) => {
        const children = childrenByParentKey.get(parentKey)
        if (children === undefined) {
          childrenByParentKey.set(parentKey, [node])
          return
        }

        children.push(node)
      },
    })
  }

  /**
   * @why Parent-child relations can form invalid cycles in malformed adapter
   * input, which would recurse forever.
   * @how Keep a visited-key set per branch and skip nodes already in the
   * ancestor chain.
   */
  const buildIndexedChildren = (
    parentAddress: VNodeAddress<VNodeKey>,
    children: readonly TNode[],
    ancestorKeys: ReadonlySet<VNodeKey>,
  ): readonly IndexedNode<TNode>[] => {
    const indexedChildren: IndexedNode<TNode>[] = []

    for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
      const childNode = children[childIndex]
      if (childNode === undefined || ancestorKeys.has(childNode.key)) {
        continue
      }

      const childAddress = createNodeAddress(
        parentAddress.path,
        childIndex,
        childNode.key,
      )
      const nextAncestorKeys = new Set<VNodeKey>(ancestorKeys)
      nextAncestorKeys.add(childNode.key)
      const childChildren = childrenByParentKey.get(childNode.key)

      indexedChildren.push({
        node: childNode,
        address: childAddress,
        children:
          childChildren === undefined
            ? []
            : buildIndexedChildren(
                childAddress,
                childChildren,
                nextAncestorKeys,
              ),
      })
    }

    return indexedChildren
  }

  return buildIndexedChildren(
    createRootNodeAddress<VNodeKey>(),
    rootNodes,
    new Set<VNodeKey>(),
  )
}

const createEmptyOperationPlan = <
  TNode extends VNode,
>(): ReconcilerOperationPlan<TNode> => ({
  inserts: [],
  removes: [],
  moves: [],
  replaces: [],
  setProps: [],
  skipped: 0,
})

type IndexedNodeByKey<TNode extends VNode> = Readonly<
  Map<
    VNodeKey,
    Readonly<{
      entry: IndexedNode<TNode>
      index: number
    }>
  >
>

const createIndexedNodeByKey = <TNode extends VNode>(
  previousNodes: readonly IndexedNode<TNode>[],
): IndexedNodeByKey<TNode> => {
  const previousByKey = new Map<
    VNodeKey,
    Readonly<{
      entry: IndexedNode<TNode>
      index: number
    }>
  >()

  for (
    let previousIndex = 0;
    previousIndex < previousNodes.length;
    previousIndex += 1
  ) {
    const previousEntry = previousNodes[previousIndex]
    if (previousEntry === undefined) {
      continue
    }

    previousByKey.set(previousEntry.node.key, {
      entry: previousEntry,
      index: previousIndex,
    })
  }

  return previousByKey
}

type PreviousNodeMatch<TNode extends VNode> = Readonly<{
  entry: IndexedNode<TNode>
  index: number
  recyclingDecision: Option.Option<boolean>
}>

const canAttemptRecyclingCandidate = <TNode extends VNode>(input: {
  previousEntry: IndexedNode<TNode>
  matchedPreviousKeys: ReadonlySet<VNodeKey>
  nextEntry: IndexedNode<TNode>
}): boolean =>
  !input.matchedPreviousKeys.has(input.previousEntry.node.key) &&
  input.previousEntry.node.nodeType === input.nextEntry.node.nodeType

const pickNearestRecyclingCandidate = <TNode extends VNode>(input: {
  selectedCandidate: Option.Option<PreviousNodeMatch<TNode>>
  selectedDistance: number
  nextIndex: number
  previousEntry: IndexedNode<TNode>
  previousIndex: number
  canRecycle: boolean
}): Readonly<{
  selectedCandidate: Option.Option<PreviousNodeMatch<TNode>>
  selectedDistance: number
}> => {
  const distanceToTargetIndex = Math.abs(input.previousIndex - input.nextIndex)
  if (distanceToTargetIndex >= input.selectedDistance) {
    return {
      selectedCandidate: input.selectedCandidate,
      selectedDistance: input.selectedDistance,
    }
  }

  return {
    selectedCandidate: Option.some({
      entry: input.previousEntry,
      index: input.previousIndex,
      recyclingDecision: Option.some(input.canRecycle),
    }),
    selectedDistance: distanceToTargetIndex,
  }
}

const findRecyclingCandidateMatch = <TNode extends VNode, R, E>(input: {
  previousNodes: readonly IndexedNode<TNode>[]
  matchedPreviousKeys: ReadonlySet<VNodeKey>
  nextEntry: IndexedNode<TNode>
  nextIndex: number
  recycling: ReconcilerRecyclingFunction<TNode, R, E>
}): Effect.Effect<Option.Option<PreviousNodeMatch<TNode>>, E, R> =>
  Effect.gen(function* () {
    let selectedCandidate: Option.Option<PreviousNodeMatch<TNode>> =
      Option.none()
    let selectedDistance = Number.POSITIVE_INFINITY

    for (
      let previousIndex = 0;
      previousIndex < input.previousNodes.length;
      previousIndex += 1
    ) {
      const previousEntry = input.previousNodes[previousIndex]
      if (previousEntry === undefined) {
        continue
      }
      if (
        !canAttemptRecyclingCandidate({
          previousEntry,
          matchedPreviousKeys: input.matchedPreviousKeys,
          nextEntry: input.nextEntry,
        })
      ) {
        continue
      }

      const canRecycle = yield* input.recycling(
        {
          prev: previousEntry.node,
          next: input.nextEntry.node,
        },
        defaultRecycleNode,
      )
      if (!canRecycle) {
        continue
      }

      const nextSelection = pickNearestRecyclingCandidate({
        selectedCandidate,
        selectedDistance,
        nextIndex: input.nextIndex,
        previousEntry,
        previousIndex,
        canRecycle,
      })
      selectedCandidate = nextSelection.selectedCandidate
      selectedDistance = nextSelection.selectedDistance
    }

    return selectedCandidate
  })

const resolvePreviousNodeMatch = <TNode extends VNode, R, E>(input: {
  previousByKey: IndexedNodeByKey<TNode>
  previousNodes: readonly IndexedNode<TNode>[]
  matchedPreviousKeys: ReadonlySet<VNodeKey>
  nextEntry: IndexedNode<TNode>
  nextIndex: number
  recycling: ReconcilerRecyclingFunction<TNode, R, E>
}): Effect.Effect<Option.Option<PreviousNodeMatch<TNode>>, E, R> =>
  Effect.gen(function* () {
    const keyedMatch = input.previousByKey.get(input.nextEntry.node.key)
    if (
      keyedMatch !== undefined &&
      !input.matchedPreviousKeys.has(keyedMatch.entry.node.key)
    ) {
      return Option.some({
        entry: keyedMatch.entry,
        index: keyedMatch.index,
        recyclingDecision: Option.none(),
      })
    }

    return yield* findRecyclingCandidateMatch({
      previousNodes: input.previousNodes,
      matchedPreviousKeys: input.matchedPreviousKeys,
      nextEntry: input.nextEntry,
      nextIndex: input.nextIndex,
      recycling: input.recycling,
    })
  })

const planRemovedNodes = <TNode extends VNode>(input: {
  previousNodes: readonly IndexedNode<TNode>[]
  matchedPreviousKeys: ReadonlySet<VNodeKey>
  plan: ReconcilerOperationPlan<TNode>
}): void => {
  for (const previousEntry of input.previousNodes) {
    if (input.matchedPreviousKeys.has(previousEntry.node.key)) {
      continue
    }

    input.plan.removes.push({
      node: cloneNodeAddress(previousEntry.address),
    })
  }
}

const planNextNodeOperation = <TNode extends VNode, R, E>(input: {
  nextEntry: IndexedNode<TNode>
  nextIndex: number
  previousByKey: IndexedNodeByKey<TNode>
  previousNodes: readonly IndexedNode<TNode>[]
  matchedPreviousKeys: Set<VNodeKey>
  parentAddress: VNodeAddress<VNodeKey>
  recycling: ReconcilerRecyclingFunction<TNode, R, E>
  plan: ReconcilerOperationPlan<TNode>
}): Effect.Effect<void, E, R> =>
  Effect.gen(function* () {
    const previousMatch = yield* resolvePreviousNodeMatch({
      previousByKey: input.previousByKey,
      previousNodes: input.previousNodes,
      matchedPreviousKeys: input.matchedPreviousKeys,
      nextEntry: input.nextEntry,
      nextIndex: input.nextIndex,
      recycling: input.recycling,
    })
    if (Option.isNone(previousMatch)) {
      input.plan.inserts.push({
        parent: cloneNodeAddress(input.parentAddress),
        index: input.nextIndex,
        node: input.nextEntry.node,
      })
      return
    }
    input.matchedPreviousKeys.add(previousMatch.value.entry.node.key)

    if (previousMatch.value.index !== input.nextIndex) {
      input.plan.moves.push({
        node: cloneNodeAddress(previousMatch.value.entry.address),
        parent: cloneNodeAddress(input.parentAddress),
        index: input.nextIndex,
      })
    }

    const canRecycle = yield* Option.match(
      previousMatch.value.recyclingDecision,
      {
        onNone: () =>
          input.recycling(
            {
              prev: previousMatch.value.entry.node,
              next: input.nextEntry.node,
            },
            defaultRecycleNode,
          ),
        onSome: (decision) => Effect.succeed(decision),
      },
    )
    if (
      !canRecycle ||
      previousMatch.value.entry.node.nodeType !== input.nextEntry.node.nodeType
    ) {
      input.plan.replaces.push({
        node: cloneNodeAddress(previousMatch.value.entry.address),
        next: input.nextEntry.node,
      })
      return
    }

    if (
      !hasEqualProps(
        previousMatch.value.entry.node.props,
        input.nextEntry.node.props,
      )
    ) {
      input.plan.setProps.push({
        node: cloneNodeAddress(previousMatch.value.entry.address),
        nextProps: input.nextEntry.node.props,
      })
    } else {
      input.plan.skipped += 1
    }

    yield* planPatchOperations({
      previousNodes: previousMatch.value.entry.children,
      nextNodes: input.nextEntry.children,
      parentAddress: input.nextEntry.address,
      recycling: input.recycling,
      plan: input.plan,
    })
  })

const planPatchOperations = <TNode extends VNode, R, E>(input: {
  previousNodes: readonly IndexedNode<TNode>[]
  nextNodes: readonly IndexedNode<TNode>[]
  parentAddress: VNodeAddress<VNodeKey>
  recycling: ReconcilerRecyclingFunction<TNode, R, E>
  plan: ReconcilerOperationPlan<TNode>
}): Effect.Effect<void, E, R> =>
  Effect.gen(function* () {
    const previousByKey = createIndexedNodeByKey(input.previousNodes)
    const matchedPreviousKeys = new Set<VNodeKey>()

    for (
      let nextIndex = 0;
      nextIndex < input.nextNodes.length;
      nextIndex += 1
    ) {
      const nextEntry = input.nextNodes[nextIndex]
      if (nextEntry === undefined) {
        continue
      }

      yield* planNextNodeOperation({
        nextEntry,
        nextIndex,
        previousByKey,
        previousNodes: input.previousNodes,
        matchedPreviousKeys,
        parentAddress: input.parentAddress,
        recycling: input.recycling,
        plan: input.plan,
      })
    }

    planRemovedNodes({
      previousNodes: input.previousNodes,
      matchedPreviousKeys,
      plan: input.plan,
    })
  })

const runOperationPayloads = <TPayload, R, E>(input: {
  operation: Option.Option<{
    run: (payload: TPayload) => Effect.Effect<void, E, R>
  }>
  payloads: readonly TPayload[]
}): Effect.Effect<
  Readonly<{
    applied: number
    skipped: number
  }>,
  E,
  R
> =>
  Effect.gen(function* () {
    let applied = 0
    let skipped = 0

    for (const payload of input.payloads) {
      if (Option.isSome(input.operation)) {
        yield* input.operation.value.run(payload)
        applied += 1
      } else {
        skipped += 1
      }
    }

    return {
      applied,
      skipped,
    }
  })

const runOperationHandlers = <TNode extends VNode, R, E>(input: {
  operations: ReconcilerOperationHandlers<TNode, R, E>
  plan: ReconcilerOperationPlan<TNode>
}): Effect.Effect<ReconcilerPatchReport, E, R> =>
  Effect.gen(function* () {
    const insertReport = yield* runOperationPayloads({
      operation: input.operations.insert,
      payloads: input.plan.inserts,
    })
    const removeReport = yield* runOperationPayloads({
      operation: input.operations.remove,
      payloads: input.plan.removes,
    })
    const moveReport = yield* runOperationPayloads({
      operation: input.operations.move,
      payloads: input.plan.moves,
    })
    const replaceReport = yield* runOperationPayloads({
      operation: input.operations.replace,
      payloads: input.plan.replaces,
    })
    const setPropsReport = yield* runOperationPayloads({
      operation: input.operations.setProps,
      payloads: input.plan.setProps,
    })

    return {
      applied:
        insertReport.applied +
        removeReport.applied +
        moveReport.applied +
        replaceReport.applied +
        setPropsReport.applied,
      skipped:
        input.plan.skipped +
        insertReport.skipped +
        removeReport.skipped +
        moveReport.skipped +
        replaceReport.skipped +
        setPropsReport.skipped,
      failed: 0,
    }
  })

export const createReconcilerInstance = <
  TInput,
  TItem,
  TNode extends VNode,
  R,
  E,
>(
  builder: ReconcilerBuilder<TInput, TItem, TNode, never, R, E>,
): ReconcilerInstance<TInput, R, E> => ({
  patch: (input) =>
    Effect.gen(function* () {
      const previousNodes = collectMappedNodes(
        input.current,
        builder.selectItems,
        builder.fromFactories,
      )
      const nextNodes = collectMappedNodes(
        input.desired,
        builder.selectItems,
        builder.fromFactories,
      )

      const previousIndexedNodes = indexMappedNodes(previousNodes)
      const nextIndexedNodes = indexMappedNodes(nextNodes)
      const plan = createEmptyOperationPlan<TNode>()

      /**
       * @why Reconciler patch must remain deterministic and side-effect free
       * until operation handlers execute.
       * @how Build one operation plan from keyed diff first, then execute in
       * canonical order through configured handlers.
       */
      yield* planPatchOperations({
        previousNodes: previousIndexedNodes,
        nextNodes: nextIndexedNodes,
        parentAddress: createRootNodeAddress<VNodeKey>(),
        recycling: builder.recycling,
        plan,
      })

      return yield* runOperationHandlers({
        operations: builder.operations,
        plan,
      })
    }),
})
