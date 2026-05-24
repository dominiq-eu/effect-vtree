/**
 * @file JSX runtime entrypoint for effect-vtree nodes.
 * @responsibility Implement `jsx`, `jsxs`, and `Fragment` factories that
 * convert JSX authoring syntax into schema-compatible VTreeNode values.
 * @boundary JSX authoring boundary only; planner/target runtime behavior stays
 * in core services.
 * @validatedBy tests/unit/src/dom/jsx-runtime.test.tsx
 * @why JSX authoring should be an optional ergonomic layer over canonical
 * VTreeNode contracts.
 * @fp-exception Imperative internals justified by JSX children normalization
 * performance. Mutable buffer accumulation during compilation is frozen/readonly
 * once returned. See plan/fp-compliance-refactor-plan.md "Documented Exceptions".
 */
import { Option } from "effect"

import type {
  VTreeElementNode,
  VTreeFragmentNode,
  VTreeNode,
  VTreeNodeKey,
  VTreeNodeProps,
  VTreeTextNode,
} from "../vtree-node.ts"

export const Fragment = Symbol.for("effect-vtree/Fragment")

type JsxProps = Readonly<Record<string, unknown>>

type JsxComponent = (props: JsxProps) => unknown

const isJsxComponent = (value: unknown): value is JsxComponent =>
  typeof value === "function"

const isVTreeNode = (value: unknown): value is VTreeNode => {
  if (!(value instanceof Object)) {
    return false
  }

  if (!("_tag" in value)) {
    return false
  }

  const tag = value._tag
  return tag === "Element" || tag === "Text" || tag === "Fragment"
}

const toVTreeNodeKey = (value: unknown): VTreeNodeKey | undefined => {
  if (typeof value === "string" || typeof value === "number") {
    return value
  }
  return undefined
}

const makeTextNode = (text: string, key?: VTreeNodeKey): VTreeTextNode => {
  if (key === undefined) {
    return {
      _tag: "Text",
      text,
    }
  }

  return {
    _tag: "Text",
    text,
    key,
  }
}

const makeElementNode = (
  nodeType: string,
  props: VTreeNodeProps,
  children: readonly VTreeNode[],
  key?: VTreeNodeKey,
): VTreeElementNode => {
  if (key === undefined) {
    return {
      _tag: "Element",
      nodeType,
      props,
      children: [...children],
    }
  }

  return {
    _tag: "Element",
    nodeType,
    props,
    children: [...children],
    key,
  }
}

const makeFragmentNode = (
  children: readonly VTreeNode[],
  key?: VTreeNodeKey,
): VTreeFragmentNode => {
  if (key === undefined) {
    return {
      _tag: "Fragment",
      children: [...children],
    }
  }

  return {
    _tag: "Fragment",
    children: [...children],
    key,
  }
}

const appendChildNode = (value: unknown, buffer: VTreeNode[]): void => {
  if (value === undefined || value === false || value === true) {
    return
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      appendChildNode(child, buffer)
    }
    return
  }

  if (isVTreeNode(value)) {
    buffer.push(value)
    return
  }

  if (typeof value === "string" || typeof value === "number") {
    buffer.push(makeTextNode(String(value)))
  }
}

const normalizeChildren = (value: unknown): VTreeNode[] => {
  const children: VTreeNode[] = []
  appendChildNode(value, children)
  return children
}

const splitProps = (
  props: JsxProps | undefined,
): {
  nextProps: VTreeNodeProps
  children: readonly VTreeNode[]
  key: VTreeNodeKey | undefined
} => {
  if (props === undefined) {
    return {
      nextProps: {},
      children: [],
      key: undefined,
    }
  }

  let nextProps: VTreeNodeProps = {}
  let key: VTreeNodeKey | undefined
  let children: readonly VTreeNode[] = []

  for (const [name, value] of Object.entries(props)) {
    if (name === "children") {
      children = normalizeChildren(value)
      continue
    }

    if (name === "key") {
      key = toVTreeNodeKey(value)
      continue
    }

    nextProps = {
      ...nextProps,
      [name]: value,
    }
  }

  return {
    nextProps,
    children,
    key,
  }
}

const withOptionalKey = (
  node: VTreeNode,
  key: VTreeNodeKey | undefined,
): VTreeNode => {
  if (key === undefined || node.key !== undefined) {
    return node
  }

  if (node._tag === "Element") {
    return {
      ...node,
      key,
    }
  }

  if (node._tag === "Text") {
    return {
      ...node,
      key,
    }
  }

  return {
    ...node,
    key,
  }
}

const renderComponentNode = (
  component: JsxComponent,
  props: JsxProps | undefined,
  key: VTreeNodeKey | undefined,
): Option.Option<VTreeNode> => {
  const rendered = component(props ?? {})
  if (!isVTreeNode(rendered)) {
    return Option.none()
  }

  return Option.some(withOptionalKey(rendered, key))
}

const createJsxNode = (
  type: unknown,
  props: JsxProps | undefined,
  keyOverride?: unknown,
): VTreeNode => {
  const split = splitProps(props)
  const key = toVTreeNodeKey(keyOverride) ?? split.key

  if (type === Fragment) {
    return makeFragmentNode(split.children, key)
  }

  if (typeof type === "string") {
    return makeElementNode(type, split.nextProps, split.children, key)
  }

  if (isJsxComponent(type)) {
    const rendered = renderComponentNode(type, props, key)
    if (Option.isSome(rendered)) {
      return rendered.value
    }
  }

  return makeFragmentNode(split.children, key)
}

export const jsx = (
  type: unknown,
  props: JsxProps | undefined,
  key?: unknown,
): VTreeNode => createJsxNode(type, props, key)

export const jsxs = (
  type: unknown,
  props: JsxProps | undefined,
  key?: unknown,
): VTreeNode => createJsxNode(type, props, key)

export const jsxDEV = (
  type: unknown,
  props: JsxProps | undefined,
  key?: unknown,
): VTreeNode => createJsxNode(type, props, key)

export namespace JSX {
  export type Element = VTreeNode

  export interface ElementChildrenAttribute {
    children: unknown
  }

  export interface IntrinsicAttributes {
    readonly key?: VTreeNodeKey
  }

  export interface IntrinsicElements {
    readonly [name: string]: VTreeNodeProps &
      Readonly<{
        children?: unknown
        key?: VTreeNodeKey
      }>
  }
}
