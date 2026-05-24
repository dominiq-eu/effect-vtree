/**
 * @file DOM entrypoint exports for effect-vtree.
 * @responsibility Expose the DOM reconciler and JSX runtime from one subpath.
 * @boundary Effect-vtree DOM public module boundary.
 * @validatedBy tests/unit/src/dom/dom-reconciler.test.ts
 * @why DOM consumers import all DOM integration primitives from one entrypoint.
 */
export {
  DomReconciler,
  type DomReconcilerApi,
  type DomReconcilerConfig,
  type DomReconcilerPatchInput,
} from "./dom-reconciler.ts"
export { Fragment, jsx, jsxDEV, jsxs } from "./jsx-runtime.ts"
