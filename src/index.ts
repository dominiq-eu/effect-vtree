/**
 * @file Effect-vtree package public exports.
 * @responsibility Expose the Reconciler builder API and VTreeNode contracts.
 * @boundary Package export boundary only.
 * @validatedBy tests/unit/src/index.test.ts
 * @why A single entrypoint keeps the library import surface stable.
 */

export { Operation, Reconciler } from "./reconciler-api.ts"
export type {
  ReconcilerFromFactory,
  ReconcilerOperation,
  ReconcilerOperationPayloadMap,
  ReconcilerOperationTag,
  ReconcilerPatchReport,
  ReconcilerRecyclingFunction,
  VNode,
  VNodeAddress,
} from "./reconciler-types.ts"
export type {
  VTreeElementNode,
  VTreeFragmentNode,
  VTreeNode,
  VTreeNodeKey,
  VTreeNodeProps,
  VTreeTextNode,
} from "./vtree-node.ts"
