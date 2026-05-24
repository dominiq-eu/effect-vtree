/**
 * @file Reconciler type contracts and builder classes.
 * @responsibility Define all type contracts, payload maps, operation types, and builder classes for the reconciler API.
 * @boundary Package-internal type definitions shared by engine and API modules.
 * @validatedBy tests/unit/src/reconciler-api.test.ts
 * @why Separating types from implementation keeps the dependency graph acyclic and each file focused on one responsibility.
 */
import { type Effect, type Option, Pipeable } from "effect"

export type ReconcilerOperationTag =
  | "Insert"
  | "Remove"
  | "Move"
  | "Replace"
  | "SetProps"

export type VNode<
  TType extends string = string,
  TProps extends Readonly<Record<string, unknown>> = Readonly<
    Record<string, unknown>
  >,
  TKey extends string | number = string | number,
> = Readonly<{
  nodeType: TType
  key: TKey
  parentKey: Option.Option<TKey>
  props: TProps
}>

export type VNodeKey = string | number

export type VNodeAddress<TKey extends string | number> = Readonly<{
  path: readonly number[]
  key: Option.Option<TKey>
}>

export type ReconcilerOperationPayloadMap<TNode extends VNode> = {
  Insert: Readonly<{
    parent: VNodeAddress<VNodeKey>
    index: number
    node: TNode
  }>
  Remove: Readonly<{
    node: VNodeAddress<VNodeKey>
  }>
  Move: Readonly<{
    node: VNodeAddress<VNodeKey>
    parent: VNodeAddress<VNodeKey>
    index: number
  }>
  Replace: Readonly<{
    node: VNodeAddress<VNodeKey>
    next: TNode
  }>
  SetProps: Readonly<{
    node: VNodeAddress<VNodeKey>
    nextProps: TNode["props"]
  }>
}

export type ReconcilerOperation<
  TNode extends VNode,
  TTag extends ReconcilerOperationTag,
  R,
  E,
> = Readonly<{
  tag: TTag
  run: (
    payload: ReconcilerOperationPayloadMap<TNode>[TTag],
  ) => Effect.Effect<void, E, R>
}>

export type ReconcilerFromFactory<TItem, TNode extends VNode> = (
  item: TItem,
) => Option.Option<TNode>

export type ReconcilerRecyclingFunction<TNode extends VNode, R, E> = (
  input: Readonly<{
    prev: TNode
    next: TNode
  }>,
  defaultRecycleFn: (
    candidate: Readonly<{
      prev: TNode
      next: TNode
    }>,
  ) => boolean,
) => Effect.Effect<boolean, E, R>

export type ReconcilerAnyOperation<TNode extends VNode, R, E> =
  | ReconcilerOperation<TNode, "Insert", R, E>
  | ReconcilerOperation<TNode, "Remove", R, E>
  | ReconcilerOperation<TNode, "Move", R, E>
  | ReconcilerOperation<TNode, "Replace", R, E>
  | ReconcilerOperation<TNode, "SetProps", R, E>

export type ReconcilerOperationHandlers<TNode extends VNode, R, E> = Readonly<{
  insert: Option.Option<ReconcilerOperation<TNode, "Insert", R, E>>
  remove: Option.Option<ReconcilerOperation<TNode, "Remove", R, E>>
  move: Option.Option<ReconcilerOperation<TNode, "Move", R, E>>
  replace: Option.Option<ReconcilerOperation<TNode, "Replace", R, E>>
  setProps: Option.Option<ReconcilerOperation<TNode, "SetProps", R, E>>
}>

export type ReconcilerOperationTags<TOps extends readonly unknown[]> =
  TOps[number] extends {
    readonly tag: infer TTag extends ReconcilerOperationTag
  }
    ? TTag
    : never

export type ReconcilerOperationsRuntime<
  TNode extends VNode,
  TOps extends readonly unknown[],
> =
  TOps[number] extends ReconcilerAnyOperation<TNode, infer R, unknown>
    ? R
    : never

export type ReconcilerOperationsError<
  TNode extends VNode,
  TOps extends readonly unknown[],
> =
  TOps[number] extends ReconcilerAnyOperation<TNode, unknown, infer E>
    ? E
    : never

export class OperationDraft<
  TTag extends ReconcilerOperationTag,
> extends Pipeable.Class() {
  readonly tag: TTag

  constructor(tag: TTag) {
    super()
    this.tag = tag
  }
}

export type ReconcilerPatchReport = Readonly<{
  applied: number
  skipped: number
  failed: number
}>

export type ReconcilerPatchInput<TInput> = Readonly<{
  current: TInput
  desired: TInput
}>

export type ReconcilerInstance<TInput, R, E> = Readonly<{
  patch: (
    input: ReconcilerPatchInput<TInput>,
  ) => Effect.Effect<ReconcilerPatchReport, E, R>
}>

export class ReconcilerBuilder<
  TInput,
  TItem,
  TNode extends VNode,
  Missing extends ReconcilerOperationTag,
  R,
  E,
> extends Pipeable.Class() {
  /** @why Phantom type — tracks which operations are still missing at the type level. */
  declare readonly _Missing: Missing

  readonly selectItems: (input: TInput) => readonly TItem[]
  readonly fromFactories: readonly ReconcilerFromFactory<TItem, TNode>[]
  readonly operations: ReconcilerOperationHandlers<TNode, R, E>
  readonly recycling: ReconcilerRecyclingFunction<TNode, R, E>

  constructor(args: {
    selectItems: (input: TInput) => readonly TItem[]
    fromFactories: readonly ReconcilerFromFactory<TItem, TNode>[]
    operations: ReconcilerOperationHandlers<TNode, R, E>
    recycling: ReconcilerRecyclingFunction<TNode, R, E>
  }) {
    super()
    this.selectItems = args.selectItems
    this.fromFactories = args.fromFactories
    this.operations = args.operations
    this.recycling = args.recycling
  }
}

export type IndexedNode<TNode extends VNode> = Readonly<{
  node: TNode
  address: VNodeAddress<VNodeKey>
  children: readonly IndexedNode<TNode>[]
}>

export type ReconcilerOperationPlan<TNode extends VNode> = {
  inserts: ReconcilerOperationPayloadMap<TNode>["Insert"][]
  removes: ReconcilerOperationPayloadMap<TNode>["Remove"][]
  moves: ReconcilerOperationPayloadMap<TNode>["Move"][]
  replaces: ReconcilerOperationPayloadMap<TNode>["Replace"][]
  setProps: ReconcilerOperationPayloadMap<TNode>["SetProps"][]
  skipped: number
}
