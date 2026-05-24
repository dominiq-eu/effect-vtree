/**
 * @file Internal DOM module system for the DomReconciler.
 * @responsibility Provide Snabbdom-inspired lifecycle modules (attributeModule,
 * eventModule) that handle attribute sync and event listener management.
 * @boundary Internal to effect-vtree DOM layer; not exported from package.
 * @validatedBy tests/unit/src/dom/dom-modules.test.ts
 * @why Separates property-dispatch concerns from reconciler tree-diffing logic.
 * The module system is an implementation detail of DomReconciler, not a public API.
 * @fp-exception Imperative internals justified by DOM mutation boundary. DOM
 * APIs are inherently imperative; wrapping in FP primitives adds indirection
 * without benefit.
 */
import type { VTreeNodeProps } from "../vtree-node.ts"

// --- Internal module system (Snabbdom-inspired, not exported from package) ---

type DomModule = Readonly<{
  create: (element: Element, props: VTreeNodeProps) => void
  update: (
    element: Element,
    oldProps: VTreeNodeProps,
    newProps: VTreeNodeProps,
  ) => void
  destroy: (element: Element) => void
}>

// --- Event prop detection ---

const isEventProp = (name: string, value: unknown): boolean =>
  name.startsWith("on") && typeof value === "function"

/** @why DOM events are lowercase ("click"), JSX props are camelCase ("onClick"). */
const normalizeEventName = (propName: string): string =>
  propName.slice(2).toLowerCase()

// --- attributeModule: handles non-event DOM attributes ---

const isStringablePrimitive = (
  value: unknown,
): value is string | number | bigint | boolean | symbol =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "bigint" ||
  typeof value === "boolean" ||
  typeof value === "symbol"

/** @why Preserve DOM String() coercion while keeping type-aware lint precise. */
const toAttributeString = (value: unknown): string => {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (isStringablePrimitive(value)) return String(value)
  if (typeof value === "function") return value.toString()

  const stringifier = Reflect.get(value, "toString")
  if (typeof stringifier === "function") {
    const rendered = Reflect.apply(stringifier, value, [])
    if (isStringablePrimitive(rendered)) return String(rendered)
  }

  return Object.prototype.toString.call(value)
}

/**
 * @why Sync a single attribute value to the DOM element.
 * @how Treats undefined/false as removal, true as string "true", rest as DOM
 * string coercion.
 */
const setAttributeValue = (
  element: Element,
  name: string,
  value: unknown,
): void => {
  if (value === undefined || value === false) {
    element.removeAttribute(name)
    return
  }

  if (value === true) {
    element.setAttribute(name, "true")
    return
  }

  element.setAttribute(name, toAttributeString(value))
}

const attributeModule: DomModule = {
  create: (element, props) => {
    for (const [name, value] of Object.entries(props)) {
      if (isEventProp(name, value)) continue
      setAttributeValue(element, name, value)
    }
  },
  update: (element, oldProps, newProps) => {
    for (const [name, value] of Object.entries(oldProps)) {
      if (isEventProp(name, value)) continue
      if (!(name in newProps)) {
        element.removeAttribute(name)
      }
    }
    for (const [name, value] of Object.entries(newProps)) {
      if (isEventProp(name, value)) continue
      setAttributeValue(element, name, value)
    }
  },
  destroy: () => {
    /* attributeModule has no destroy behavior */
  },
}

// --- eventModule: Snabbdom-style mutable handler trick ---

/**
 * @why VTreeNodeProps values are `unknown`. After runtime typeof verification,
 * we invoke the handler with the DOM event at this imperative boundary.
 * @sideEffects Calls the event handler.
 */
const invokeEventHandler = (handler: unknown, event: Event): void => {
  if (typeof handler === "function") {
    Reflect.apply(handler, undefined, [event])
  }
}

type EventListenerEntry = Readonly<{
  ref: { current: unknown }
  stableListener: (e: Event) => void
}>

/** @why Separate loop for updating/removing existing listeners reduces cognitive complexity. */
const updateExistingEventListeners = (
  listeners: Map<string, EventListenerEntry>,
  element: Element,
  oldProps: VTreeNodeProps,
  newProps: VTreeNodeProps,
): void => {
  for (const [name, value] of Object.entries(oldProps)) {
    if (!isEventProp(name, value)) continue
    const eventName = normalizeEventName(name)
    const newValue = newProps[name]

    if (isEventProp(name, newValue)) {
      const entry = listeners.get(eventName)
      if (entry) {
        entry.ref.current = newValue
      }
    } else {
      const entry = listeners.get(eventName)
      if (entry) {
        element.removeEventListener(eventName, entry.stableListener)
        listeners.delete(eventName)
      }
    }
  }
}

/** @why Separate loop for attaching new listeners reduces cognitive complexity. */
const attachNewEventListeners = (
  listeners: Map<string, EventListenerEntry>,
  element: Element,
  eventConfig: { stopPropagation: boolean; preventDefault: boolean },
  newProps: VTreeNodeProps,
): void => {
  for (const [name, value] of Object.entries(newProps)) {
    if (!isEventProp(name, value)) continue
    const eventName = normalizeEventName(name)

    if (!listeners.has(eventName)) {
      const ref: { current: unknown } = { current: value }
      const stableListener = (e: Event): void => {
        if (eventConfig.stopPropagation) e.stopPropagation()
        if (eventConfig.preventDefault) e.preventDefault()
        invokeEventHandler(ref.current, e)
      }

      listeners.set(eventName, { ref, stableListener })
      element.addEventListener(eventName, stableListener)
    }
  }
}

/**
 * @why Attach/swap/detach event listeners efficiently using Snabbdom's mutable
 * handler trick: one stable DOM listener per element+event, handler swapped by
 * reference, zero DOM mutations for handler reference changes.
 * @how WeakMap<Element, Map<eventName, { ref, stableListener }>> tracks per-
 * element listeners. Stable listener reads ref.current at dispatch time.
 */
const makeEventModule = (eventConfig: {
  stopPropagation: boolean
  preventDefault: boolean
}): DomModule => {
  const listenersByElement = new WeakMap<
    Element,
    Map<string, EventListenerEntry>
  >()

  return {
    create: (element, props) => {
      const listeners = new Map<string, EventListenerEntry>()

      for (const [name, value] of Object.entries(props)) {
        if (!isEventProp(name, value)) continue

        const eventName = normalizeEventName(name)
        const ref: { current: unknown } = { current: value }
        const stableListener = (e: Event): void => {
          if (eventConfig.stopPropagation) e.stopPropagation()
          if (eventConfig.preventDefault) e.preventDefault()
          invokeEventHandler(ref.current, e)
        }

        listeners.set(eventName, { ref, stableListener })
        element.addEventListener(eventName, stableListener)
      }

      if (listeners.size > 0) {
        listenersByElement.set(element, listeners)
      }
    },

    update: (element, oldProps, newProps) => {
      const listeners =
        listenersByElement.get(element) ?? new Map<string, EventListenerEntry>()

      updateExistingEventListeners(listeners, element, oldProps, newProps)
      attachNewEventListeners(listeners, element, eventConfig, newProps)

      if (listeners.size > 0) {
        listenersByElement.set(element, listeners)
      } else {
        listenersByElement.delete(element)
      }
    },

    destroy: (element) => {
      const listeners = listenersByElement.get(element)
      if (!listeners) return

      for (const [eventName, entry] of listeners) {
        element.removeEventListener(eventName, entry.stableListener)
      }

      listenersByElement.delete(element)
    },
  }
}

export { attributeModule, type DomModule, makeEventModule }
