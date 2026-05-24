/**
 * @file Virtual tree node type contracts for JSX output and DOM reconciler input.
 * @responsibility Define the tree-shaped node variants produced by JSX factories
 * and consumed by the DOM reconciler.
 * @boundary Pure data-contract boundary; no reconciliation or DOM mutation logic.
 * @validatedBy tests/unit/src/dom/jsx-runtime.test.tsx
 * @why JSX authoring produces tree-shaped nodes. The DomReconciler flattens
 * these into the Reconciler's flat VNode model internally.
 */

export type VTreeNodeKey = string | number

export type VTreeNodeProps = Readonly<Record<string, unknown>>

export type VTreeElementNode = Readonly<{
  _tag: "Element"
  nodeType: string
  props: VTreeNodeProps
  children: readonly VTreeNode[]
  key?: VTreeNodeKey
}>

export type VTreeTextNode = Readonly<{
  _tag: "Text"
  text: string
  key?: VTreeNodeKey
}>

export type VTreeFragmentNode = Readonly<{
  _tag: "Fragment"
  children: readonly VTreeNode[]
  key?: VTreeNodeKey
}>

export type VTreeNode = VTreeElementNode | VTreeTextNode | VTreeFragmentNode
