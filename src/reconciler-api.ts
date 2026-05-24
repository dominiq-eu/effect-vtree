/**
 * @file Public reconciler API namespace objects.
 * @responsibility Expose the user-facing Operation and Reconciler builder combinators.
 * @boundary Public package API boundary only; does not depend on extension runtime modules or browser APIs.
 * @validatedBy tests/unit/src/reconciler-api.test.ts
 * @why The public API is a thin orchestration layer over types and engine internals.
 */
import { Effect } from "effect"

import {
  applyOperationHandler,
  createReconcilerInstance,
  makeEmptyOperationHandlers,
  widenRecycling,
} from "./reconciler-engine.ts"

export type {
  ReconcilerPatchReport,
  VNode,
  VNodeAddress,
} from "./reconciler-types.ts"

import {
  OperationDraft,
  type ReconcilerAnyOperation,
  ReconcilerBuilder,
  type ReconcilerFromFactory,
  type ReconcilerInstance,
  type ReconcilerOperation,
  type ReconcilerOperationHandlers,
  type ReconcilerOperationPayloadMap,
  type ReconcilerOperationsError,
  type ReconcilerOperationsRuntime,
  type ReconcilerOperationTag,
  type ReconcilerOperationTags,
  type ReconcilerRecyclingFunction,
  type VNode,
} from "./reconciler-types.ts"

export const Operation = {
  make: <TTag extends ReconcilerOperationTag>(
    tag: TTag,
  ): OperationDraft<TTag> => new OperationDraft(tag),

  withHandler:
    <
      TNode extends VNode,
      TTag extends ReconcilerOperationTag,
      R = never,
      E = never,
    >(
      run: (
        payload: ReconcilerOperationPayloadMap<TNode>[TTag],
      ) => Effect.Effect<void, E, R>,
    ) =>
    (draft: OperationDraft<TTag>): ReconcilerOperation<TNode, TTag, R, E> => ({
      tag: draft.tag,
      run,
    }),
}

export const Reconciler = {
  make: <TInput, TItem>(
    selectItems: (input: TInput) => readonly TItem[],
  ): ReconcilerBuilder<
    TInput,
    TItem,
    never,
    ReconcilerOperationTag,
    never,
    never
  > =>
    new ReconcilerBuilder({
      selectItems,
      fromFactories: [],
      operations: makeEmptyOperationHandlers<never, never, never>(),
      recycling: (input, recycleByDefault) =>
        Effect.succeed(recycleByDefault(input)),
    }),

  from:
    <TInput, TItem, TNode extends VNode>(
      factories: readonly ReconcilerFromFactory<TItem, TNode>[],
    ) =>
    <Missing extends ReconcilerOperationTag, R, E>(
      builder: ReconcilerBuilder<TInput, TItem, never, Missing, R, E>,
    ): ReconcilerBuilder<TInput, TItem, TNode, Missing, R, E> =>
      new ReconcilerBuilder({
        selectItems: builder.selectItems,
        fromFactories: factories,
        operations: makeEmptyOperationHandlers<TNode, R, E>(),
        recycling: (input, recycleByDefault) =>
          Effect.succeed(recycleByDefault(input)),
      }),

  withOperation:
    <
      TInput,
      TItem,
      TNode extends VNode,
      Missing extends ReconcilerOperationTag,
      RCurrent,
      ECurrent,
      ROperation,
      EOperation,
      TOperation extends ReconcilerAnyOperation<TNode, ROperation, EOperation>,
    >(
      operation: TOperation,
    ) =>
    (
      builder: ReconcilerBuilder<
        TInput,
        TItem,
        TNode,
        Missing,
        RCurrent,
        ECurrent
      >,
    ): ReconcilerBuilder<
      TInput,
      TItem,
      TNode,
      Exclude<Missing, Extract<TOperation["tag"], Missing>>,
      RCurrent | ROperation,
      ECurrent | EOperation
    > => {
      const nextOperations = applyOperationHandler(
        builder.operations,
        operation,
      )

      return new ReconcilerBuilder({
        selectItems: builder.selectItems,
        fromFactories: builder.fromFactories,
        operations: nextOperations,
        recycling: widenRecycling(builder.recycling),
      })
    },

  withOperations:
    <
      TInput,
      TItem,
      TNode extends VNode,
      Missing extends ReconcilerOperationTag,
      RCurrent,
      ECurrent,
      TOps extends readonly {
        readonly tag: ReconcilerOperationTag
      }[],
    >(
      operations: TOps &
        readonly ReconcilerAnyOperation<
          TNode,
          ReconcilerOperationsRuntime<TNode, TOps>,
          ReconcilerOperationsError<TNode, TOps>
        >[],
    ) =>
    (
      builder: ReconcilerBuilder<
        TInput,
        TItem,
        TNode,
        Missing,
        RCurrent,
        ECurrent
      >,
    ): ReconcilerBuilder<
      TInput,
      TItem,
      TNode,
      Exclude<Missing, Extract<ReconcilerOperationTags<TOps>, Missing>>,
      RCurrent | ReconcilerOperationsRuntime<TNode, TOps>,
      ECurrent | ReconcilerOperationsError<TNode, TOps>
    > => {
      let nextOperations: ReconcilerOperationHandlers<
        TNode,
        RCurrent | ReconcilerOperationsRuntime<TNode, TOps>,
        ECurrent | ReconcilerOperationsError<TNode, TOps>
      > = builder.operations

      for (const operation of operations) {
        nextOperations = applyOperationHandler(nextOperations, operation)
      }

      return new ReconcilerBuilder({
        selectItems: builder.selectItems,
        fromFactories: builder.fromFactories,
        operations: nextOperations,
        recycling: widenRecycling(builder.recycling),
      })
    },

  withRecycling:
    <
      TInput,
      TItem,
      TNode extends VNode,
      Missing extends ReconcilerOperationTag,
      RCurrent,
      ECurrent,
      RRecycling,
      ERecycling,
    >(
      recycling: ReconcilerRecyclingFunction<TNode, RRecycling, ERecycling>,
    ) =>
    (
      builder: ReconcilerBuilder<
        TInput,
        TItem,
        TNode,
        Missing,
        RCurrent,
        ECurrent
      >,
    ): ReconcilerBuilder<
      TInput,
      TItem,
      TNode,
      Missing,
      RCurrent | RRecycling,
      ECurrent | ERecycling
    > =>
      new ReconcilerBuilder({
        selectItems: builder.selectItems,
        fromFactories: builder.fromFactories,
        operations: builder.operations,
        recycling: widenRecycling(recycling),
      }),

  build: <TInput, TItem, TNode extends VNode, R, E>(
    builder: ReconcilerBuilder<TInput, TItem, TNode, never, R, E>,
  ): ReconcilerInstance<TInput, R, E> => createReconcilerInstance(builder),
}
