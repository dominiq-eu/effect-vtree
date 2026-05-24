/**
 * @file Prebuilt DOM reconciler API.
 * @responsibility Provide a ready-to-use DOM reconciler with `init`, `render`,
 * and `patch({ current, desired })` methods using the Reconciler builder API.
 * Handles function-valued `on*` props as event listeners via internal module
 * system (Snabbdom-inspired).
 * @boundary Effect-vtree DOM integration boundary; no extension-specific services.
 * @validatedBy tests/unit/src/dom/dom-reconciler.test.ts
 * @why Consumers should not rebuild reconciler wiring for common DOM
 * reconciliation flows.
 * @fp-exception Imperative internals justified by DOM mutation boundary. DOM
 * APIs are inherently imperative; wrapping in FP primitives adds indirection
 * without benefit. See plan/fp-compliance-refactor-plan.md "Documented Exceptions".
 */
import { Effect, Option } from "effect"

import {
  Operation,
  Reconciler,
  type ReconcilerPatchReport,
  type VNode,
  type VNodeAddress,
} from "../reconciler-api.ts"
import type {
  VTreeElementNode,
  VTreeFragmentNode,
  VTreeNode,
  VTreeNodeKey,
  VTreeNodeProps,
} from "../vtree-node.ts"
import {
  attributeModule,
  type DomModule,
  makeEventModule,
} from "./dom-modules.ts"

type DomReconcilerPatchInput = Readonly<{
  current: VTreeNode
  desired: VTreeNode
}>

type DomReconcilerConfig = Readonly<{
  stopPropagation?: boolean
  preventDefault?: boolean
}>

type DomReconcilerApi = Readonly<{
  init: () => Effect.Effect<void>
  render: (tree: VTreeNode) => Effect.Effect<ReconcilerPatchReport>
  patch: (
    input: DomReconcilerPatchInput,
  ) => Effect.Effect<ReconcilerPatchReport>
}>

type DomNodeKey = VTreeNodeKey

type DomVNodeProps =
  | Readonly<{ _tag: "ElementProps"; attributes: VTreeNodeProps }>
  | Readonly<{ _tag: "TextProps"; text: string }>
  | Readonly<{ _tag: "FragmentProps" }>

type DomVNode = VNode<string, DomVNodeProps, DomNodeKey>

type DomSnapshotItem = Readonly<{
  nodeType: string
  key: DomNodeKey
  parentKey: Option.Option<DomNodeKey>
  props: DomVNodeProps
}>

type DomSnapshot = Readonly<{
  items: readonly DomSnapshotItem[]
}>

// --- DOM patch target state ---

type DomPatchTargetState = {
  readonly host: HTMLElement
  rootIsFragment: boolean
  readonly nodesByKey: Map<string, Node>
  readonly keysByNode: WeakMap<Node, string>
  readonly propsByNode: WeakMap<Element, VTreeNodeProps>
}

const EMPTY_PATCH_REPORT: ReconcilerPatchReport = {
  applied: 0,
  skipped: 0,
  failed: 0,
}

// --- DOM state helpers ---

const keyToken = (key: VTreeNodeKey): string => `${typeof key}:${String(key)}`

const makeDomPatchTargetState = (host: HTMLElement): DomPatchTargetState => ({
  host,
  rootIsFragment: true,
  nodesByKey: new Map<string, Node>(),
  keysByNode: new WeakMap<Node, string>(),
  propsByNode: new WeakMap<Element, VTreeNodeProps>(),
})

const registerKeyedNode = (
  state: DomPatchTargetState,
  node: Node,
  key: VTreeNodeKey,
): void => {
  const token = keyToken(key)
  state.nodesByKey.set(token, node)
  state.keysByNode.set(node, token)
}

const registerIfKeyedNode = (
  state: DomPatchTargetState,
  domNode: Node,
  vtreeNode: VTreeNode,
): void => {
  if (vtreeNode.key !== undefined) {
    registerKeyedNode(state, domNode, vtreeNode.key)
  }
}

const unregisterNodeSubtree = (
  state: DomPatchTargetState,
  node: Node,
): void => {
  const token = state.keysByNode.get(node)
  if (token !== undefined) {
    state.nodesByKey.delete(token)
  }

  for (const child of Array.from(node.childNodes)) {
    unregisterNodeSubtree(state, child)
  }
}

// --- DOM mutation helpers ---

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"

type DomCreationNamespace = "html" | "svg"

const nextCreationNamespace = (
  current: DomCreationNamespace,
  nodeType: string,
): DomCreationNamespace => {
  if (nodeType === "svg") return "svg"
  if (nodeType === "foreignObject") return "html"
  return current
}

const createElementForNamespace = (
  nodeType: string,
  namespace: DomCreationNamespace,
): Element => {
  if (namespace === "svg") {
    return document.createElementNS(SVG_NAMESPACE, nodeType)
  }

  return document.createElement(nodeType)
}

const createDomNodeFromVTreeNode = (
  state: DomPatchTargetState,
  node: VTreeNode,
  modules: readonly DomModule[],
  namespace: DomCreationNamespace = "html",
): Node => {
  if (node._tag === "Text") {
    const textNode = document.createTextNode(node.text)
    registerIfKeyedNode(state, textNode, node)
    return textNode
  }

  if (node._tag === "Element") {
    const elementNamespace = nextCreationNamespace(namespace, node.nodeType)
    const element = createElementForNamespace(node.nodeType, elementNamespace)

    for (const mod of modules) {
      mod.create(element, node.props)
    }
    state.propsByNode.set(element, node.props)

    registerIfKeyedNode(state, element, node)

    for (const child of node.children) {
      element.appendChild(
        createDomNodeFromVTreeNode(state, child, modules, elementNamespace),
      )
    }

    return element
  }

  const fragment = document.createDocumentFragment()
  for (const child of node.children) {
    fragment.appendChild(
      createDomNodeFromVTreeNode(state, child, modules, namespace),
    )
  }
  return fragment
}

const resolveDescendantByPath = (
  startNode: Node,
  path: readonly number[],
): Node | undefined => {
  let current: Node = startNode
  for (const segment of path) {
    const next = current.childNodes.item(segment)
    if (!next) {
      return undefined
    }
    current = next
  }
  return current
}

const resolveNodeByPath = (
  state: DomPatchTargetState,
  path: readonly number[],
): Node | undefined => {
  if (state.rootIsFragment) {
    return resolveDescendantByPath(state.host, path)
  }

  const rootNode = state.host.firstChild
  if (!rootNode) {
    return undefined
  }

  if (path.length === 0) {
    return rootNode
  }

  return resolveDescendantByPath(rootNode, path)
}

const resolveNodeByAddress = (
  state: DomPatchTargetState,
  address: VNodeAddress<DomNodeKey>,
): Node | undefined => {
  if (Option.isSome(address.key)) {
    const keyedNode = state.nodesByKey.get(keyToken(address.key.value))
    if (keyedNode !== undefined) {
      return keyedNode
    }
  }

  return resolveNodeByPath(state, address.path)
}

const resolveParentByAddress = (
  state: DomPatchTargetState,
  address: VNodeAddress<DomNodeKey>,
): Node | undefined => {
  if (
    state.rootIsFragment &&
    address.path.length === 0 &&
    Option.isNone(address.key)
  ) {
    return state.host
  }

  return resolveNodeByAddress(state, address)
}

const appendAtIndex = (parent: Node, index: number, node: Node): void => {
  const targetIndex = Math.max(0, Math.trunc(index))
  const referenceNode = parent.childNodes.item(targetIndex)
  if (!referenceNode) {
    parent.appendChild(node)
    return
  }

  parent.insertBefore(node, referenceNode)
}

const moveToIndex = (parent: Node, index: number, node: Node): void => {
  const targetIndex = Math.max(0, Math.trunc(index))
  const currentIndex = Array.prototype.indexOf.call(parent.childNodes, node)
  const referenceIndex =
    currentIndex >= 0 && currentIndex < targetIndex
      ? targetIndex + 1
      : targetIndex
  const referenceNode = parent.childNodes.item(referenceIndex)

  if (!referenceNode) {
    parent.appendChild(node)
    return
  }

  if (referenceNode === node) {
    return
  }

  parent.insertBefore(node, referenceNode)
}

const clearHostTree = (state: DomPatchTargetState): void => {
  for (const child of Array.from(state.host.childNodes)) {
    unregisterNodeSubtree(state, child)
  }
  state.host.replaceChildren()
}

const renderTree = (
  state: DomPatchTargetState,
  tree: VTreeNode,
  modules: readonly DomModule[],
): void => {
  clearHostTree(state)
  state.rootIsFragment = tree._tag === "Fragment"

  if (tree._tag === "Fragment") {
    for (const child of tree.children) {
      state.host.appendChild(createDomNodeFromVTreeNode(state, child, modules))
    }
    return
  }

  state.host.appendChild(createDomNodeFromVTreeNode(state, tree, modules))
}

// --- Key synthesis ---

const AUTO_KEY_PREFIX = "dom:auto"

const makeAutoKey = (node: VTreeNode, path: readonly number[]): string => {
  const pathToken = path.length === 0 ? "root" : path.join(".")

  if (node._tag === "Element") {
    return `${AUTO_KEY_PREFIX}:${pathToken}:element:${node.nodeType}`
  }
  if (node._tag === "Text") {
    return `${AUTO_KEY_PREFIX}:${pathToken}:text`
  }

  return `${AUTO_KEY_PREFIX}:${pathToken}:fragment`
}

const synthesizeBranchKeys = <
  TNode extends VTreeElementNode | VTreeFragmentNode,
>(
  node: TNode,
  path: readonly number[],
): TNode => {
  const children = node.children.map((child, index) =>
    synthesizeTreeKeys(child, [...path, index]),
  )

  if (node.key === undefined) {
    return {
      ...node,
      key: makeAutoKey(node, path),
      children,
    }
  }

  return {
    ...node,
    children,
  }
}

/**
 * @why Reconciler internals depend on stable keys for deterministic sibling
 * matching, while JSX authors may omit keys.
 * @how Fill missing keys from structural path tokens so keyed diffing remains
 * deterministic without exposing technical keys as user API.
 */
const synthesizeTreeKeys = (
  node: VTreeNode,
  path: readonly number[],
): VTreeNode => {
  if (node._tag === "Text") {
    if (node.key !== undefined) {
      return node
    }

    return {
      ...node,
      key: makeAutoKey(node, path),
    }
  }

  return synthesizeBranchKeys(node, path)
}

// --- Snapshot conversion ---

const toDomVNodeNodeType = (node: VTreeNode): string => {
  if (node._tag === "Text") {
    return "text"
  }

  if (node._tag === "Element") {
    return `element:${node.nodeType}`
  }

  return "fragment"
}

const toDomVNodeProps = (node: VTreeNode): DomVNodeProps => {
  if (node._tag === "Text") {
    return { _tag: "TextProps", text: node.text }
  }

  if (node._tag === "Element") {
    return { _tag: "ElementProps", attributes: node.props }
  }

  return { _tag: "FragmentProps" }
}

type DomSnapshotState = Readonly<{
  snapshot: DomSnapshot
  nodesByKey: ReadonlyMap<DomNodeKey, VTreeNode>
}>

/**
 * @why Reconciler patching needs both flattened snapshot items and direct
 * lookup by desired node key.
 * @how Traverse once and accumulate both structures to keep mapping logic
 * deterministic while reducing duplicated walks.
 */
const toDomSnapshotState = (tree: VTreeNode): DomSnapshotState => {
  const items: DomSnapshotItem[] = []
  const nodesByKey = new Map<DomNodeKey, VTreeNode>()

  const visit = (
    node: VTreeNode,
    parentKey: Option.Option<DomNodeKey>,
  ): void => {
    if (node.key === undefined) {
      return
    }

    nodesByKey.set(node.key, node)
    items.push({
      nodeType: toDomVNodeNodeType(node),
      key: node.key,
      parentKey,
      props: toDomVNodeProps(node),
    })

    if (node._tag === "Text") {
      return
    }

    const nextParentKey = Option.some<DomNodeKey>(node.key)
    for (const child of node.children) {
      visit(child, nextParentKey)
    }
  }

  visit(tree, Option.none<DomNodeKey>())
  return {
    snapshot: { items },
    nodesByKey,
  }
}

const fromDomSnapshotItem = (item: DomSnapshotItem): Option.Option<DomVNode> =>
  Option.some({
    nodeType: item.nodeType,
    key: item.key,
    parentKey: item.parentKey,
    props: item.props,
  })

/** @why Extracted from SetProps handler to reduce cognitive complexity. */
const applyPropsUpdate = (
  state: DomPatchTargetState,
  modules: readonly DomModule[],
  node: Node,
  nextProps: DomVNodeProps,
): void => {
  switch (nextProps._tag) {
    case "ElementProps":
      if (node instanceof Element) {
        const oldProps = state.propsByNode.get(node) ?? {}
        const newProps = nextProps.attributes
        for (const mod of modules) {
          mod.update(node, oldProps, newProps)
        }
        state.propsByNode.set(node, newProps)
      }
      return
    case "TextProps":
      if (node instanceof Text) {
        node.data = nextProps.text
      }
      return
    case "FragmentProps":
      return
    default:
      return
  }
}
// --- Public API ---

/**
 * @why Create a self-contained DOM reconciler that patches a host element.
 * Handles function-valued `on*` props as event listeners with configurable
 * stopPropagation/preventDefault defaults.
 * @how Build a Reconciler instance with DOM-specific operation handlers that
 * close over the host state. Internal DomModule system (attributeModule +
 * eventModule) handles property dispatch. No Effect service provision needed
 * per-call.
 */
export const DomReconciler = {
  make: (host: HTMLElement, config?: DomReconcilerConfig): DomReconcilerApi => {
    const state = makeDomPatchTargetState(host)
    const modules: readonly DomModule[] = [
      attributeModule,
      makeEventModule({
        stopPropagation: config?.stopPropagation ?? true,
        preventDefault: config?.preventDefault ?? true,
      }),
    ]
    let currentDesiredNodesByKey: ReadonlyMap<DomNodeKey, VTreeNode> = new Map()

    const resolveDesiredVTreeNode = (
      vnode: DomVNode,
    ): VTreeNode | undefined => {
      if (vnode.key === undefined) {
        return undefined
      }
      return currentDesiredNodesByKey.get(vnode.key)
    }

    const Insert = Operation.make("Insert").pipe(
      Operation.withHandler<DomVNode, "Insert">((payload) =>
        Effect.sync(() => {
          const desiredNode = resolveDesiredVTreeNode(payload.node)
          if (desiredNode === undefined) return

          const parentNode = resolveParentByAddress(state, payload.parent)
          if (parentNode === undefined) return

          const newNode = createDomNodeFromVTreeNode(
            state,
            desiredNode,
            modules,
          )
          appendAtIndex(parentNode, payload.index, newNode)
        }),
      ),
    )

    const Remove = Operation.make("Remove").pipe(
      Operation.withHandler<DomVNode, "Remove">((payload) =>
        Effect.sync(() => {
          const node = resolveNodeByAddress(state, payload.node)
          if (node === undefined || !node.parentNode) return

          if (node instanceof Element) {
            for (const mod of modules) {
              mod.destroy(node)
            }
          }

          unregisterNodeSubtree(state, node)
          node.parentNode.removeChild(node)
        }),
      ),
    )

    const Move = Operation.make("Move").pipe(
      Operation.withHandler<DomVNode, "Move">((payload) =>
        Effect.sync(() => {
          const node = resolveNodeByAddress(state, payload.node)
          const parentNode = resolveParentByAddress(state, payload.parent)
          if (node === undefined || parentNode === undefined) return

          moveToIndex(parentNode, payload.index, node)
        }),
      ),
    )

    const Replace = Operation.make("Replace").pipe(
      Operation.withHandler<DomVNode, "Replace">((payload) =>
        Effect.sync(() => {
          const node = resolveNodeByAddress(state, payload.node)
          if (node === undefined || !node.parentNode) return

          if (node instanceof Element) {
            for (const mod of modules) {
              mod.destroy(node)
            }
          }

          const desiredNode = resolveDesiredVTreeNode(payload.next)
          if (desiredNode === undefined) return

          unregisterNodeSubtree(state, node)
          const replacement = createDomNodeFromVTreeNode(
            state,
            desiredNode,
            modules,
          )
          node.parentNode.replaceChild(replacement, node)
        }),
      ),
    )

    const SetProps = Operation.make("SetProps").pipe(
      Operation.withHandler<DomVNode, "SetProps">((payload) =>
        Effect.sync(() => {
          const node = resolveNodeByAddress(state, payload.node)
          if (node === undefined) return

          applyPropsUpdate(state, modules, node, payload.nextProps)
        }),
      ),
    )

    const reconciler = Reconciler.make(
      (snapshot: DomSnapshot) => snapshot.items,
    ).pipe(
      Reconciler.from([fromDomSnapshotItem]),
      Reconciler.withOperations([Insert, Remove, Move, Replace, SetProps]),
      Reconciler.build,
    )

    return {
      init: () => Effect.void,
      render: (tree) =>
        Effect.sync(() => {
          renderTree(state, synthesizeTreeKeys(tree, []), modules)
          return EMPTY_PATCH_REPORT
        }),
      patch: (input) =>
        Effect.suspend(() => {
          const currentTree = synthesizeTreeKeys(input.current, [])
          const desiredTree = synthesizeTreeKeys(input.desired, [])
          const currentState = toDomSnapshotState(currentTree)
          const desiredState = toDomSnapshotState(desiredTree)
          currentDesiredNodesByKey = desiredState.nodesByKey

          return reconciler.patch({
            current: currentState.snapshot,
            desired: desiredState.snapshot,
          })
        }),
    }
  },
}

export type { DomReconcilerApi, DomReconcilerConfig, DomReconcilerPatchInput }
