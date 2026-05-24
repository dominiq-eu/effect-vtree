/**
 * @file JSX dev-runtime entrypoint for effect-vtree nodes.
 * @responsibility Expose development JSX runtime hooks while delegating node
 * creation to the canonical JSX runtime implementation.
 * @boundary JSX authoring entrypoint boundary only; no planner or patch-target
 * execution behavior.
 * @validatedBy tests/unit/src/dom/jsx-runtime.test.tsx
 * @why Tooling may resolve `jsx-dev-runtime` in test/dev transforms, so the
 * package must provide a stable alias for the same factory behavior.
 */
export { Fragment, jsxDEV } from "./jsx-runtime.ts"
export type { JSX } from "./jsx-runtime.ts"
