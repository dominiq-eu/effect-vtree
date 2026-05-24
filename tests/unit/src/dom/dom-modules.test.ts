// @vitest-environment jsdom
/**
 * @file Unit tests for DomReconciler event listener and attribute handling.
 * @responsibility Validate attribute syncing for non-event props, Snabbdom-style
 * event listener management for on* function props, and configurable
 * stopPropagation/preventDefault defaults via DomReconciler.make(host, config?).
 * @boundary Effect-vtree DOM reconciler only; no extension runtime or browser
 * service worker integration.
 * @testIntent Lock event listener attachment/swap/detach behavior, attribute
 * handling split from event handling, and configurable event defaults.
 * @validatedBehavior Non-event attributes synced correctly; on* function props
 * attached as DOM event listeners with mutable handler trick; stopPropagation
 * and preventDefault enabled by default, configurable via constructor options.
 * @why DomReconciler must handle function-valued on* props as event listeners
 * (Snabbdom-style) instead of stringifying them as attributes.
 */

import { it } from "@effect/vitest"
import { Effect } from "effect"
import type {
  VTreeElementNode,
  VTreeFragmentNode,
  VTreeNode,
  VTreeNodeKey,
  VTreeNodeProps,
  VTreeTextNode,
} from "effect-vtree"
import { DomReconciler } from "effect-vtree/dom"
import { describe, expect, vi } from "vitest"

// --- VTree node constructors (shared with dom-reconciler.test.ts) ---

const el = (
  nodeType: string,
  children: readonly VTreeNode[],
  options?: { key?: VTreeNodeKey; props?: VTreeNodeProps },
): VTreeElementNode => ({
  _tag: "Element",
  nodeType,
  props: options?.props ?? {},
  children: [...children],
  ...(options?.key !== undefined ? { key: options.key } : {}),
})

const text = (value: string, key?: VTreeNodeKey): VTreeTextNode => ({
  _tag: "Text",
  text: value,
  ...(key !== undefined ? { key } : {}),
})

const frag = (
  children: readonly VTreeNode[],
  key?: VTreeNodeKey,
): VTreeFragmentNode => ({
  _tag: "Fragment",
  children: [...children],
  ...(key !== undefined ? { key } : {}),
})

describe("effect-vtree dom modules", () => {
  // --- backward compatibility ---

  describe("backward compatibility", () => {
    it.effect(
      "DomReconciler.make(host) without config sets attributes as before",
      () =>
        Effect.gen(function* () {
          const host = document.createElement("div")
          const reconciler = DomReconciler.make(host)

          const tree = frag([
            el("section", [text("hello")], {
              key: "node:section",
              props: { id: "s1", "data-x": "42" },
            }),
          ])

          yield* reconciler.init()
          yield* reconciler.render(tree)

          yield* Effect.sync(() => {
            const section = host.querySelector("section")
            expect(section).not.toBeNull()
            expect(section!.getAttribute("id")).toBe("s1")
            expect(section!.getAttribute("data-x")).toBe("42")
            expect(section!.textContent).toBe("hello")
          })
        }),
    )

    it.effect(
      "DomReconciler.make(host, {}) with empty config uses defaults",
      () =>
        Effect.gen(function* () {
          const host = document.createElement("div")
          const reconciler = DomReconciler.make(host, {})

          const tree = frag([
            el("div", [text("ok")], { key: "d", props: { id: "test" } }),
          ])

          yield* reconciler.init()
          yield* reconciler.render(tree)

          yield* Effect.sync(() => {
            const div = host.querySelector("div")
            expect(div!.getAttribute("id")).toBe("test")
            expect(div!.textContent).toBe("ok")
          })
        }),
    )
  })

  // --- attribute handling ---

  describe("attribute handling", () => {
    it.effect("sets non-event attributes on element create", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const reconciler = DomReconciler.make(host)

        const tree = frag([
          el("div", [], {
            key: "d",
            props: { id: "main", "data-role": "container", class: "active" },
          }),
        ])

        yield* reconciler.init()
        yield* reconciler.render(tree)

        yield* Effect.sync(() => {
          const div = host.querySelector("div")!
          expect(div.getAttribute("id")).toBe("main")
          expect(div.getAttribute("data-role")).toBe("container")
          expect(div.getAttribute("class")).toBe("active")
        })
      }),
    )

    it.effect("updates attributes on patch — add, change, remove stale", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const reconciler = DomReconciler.make(host)

        const tree1 = frag([
          el("div", [], {
            key: "d",
            props: { id: "a", "data-old": "remove-me" },
          }),
        ])
        const tree2 = frag([
          el("div", [], {
            key: "d",
            props: { id: "b", "data-new": "added" },
          }),
        ])

        yield* reconciler.init()
        yield* reconciler.render(tree1)
        yield* reconciler.patch({ current: tree1, desired: tree2 })

        yield* Effect.sync(() => {
          const div = host.querySelector("div")!
          expect(div.getAttribute("id")).toBe("b")
          expect(div.getAttribute("data-new")).toBe("added")
          expect(div.hasAttribute("data-old")).toBe(false)
        })
      }),
    )

    it.effect("skips on* function-valued props — not set as attributes", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const reconciler = DomReconciler.make(host)
        const handler = vi.fn()

        const tree = frag([
          el("button", [], {
            key: "btn",
            props: { id: "b1", onclick: handler },
          }),
        ])

        yield* reconciler.init()
        yield* reconciler.render(tree)

        yield* Effect.sync(() => {
          const button = host.querySelector("button")!
          expect(button.getAttribute("id")).toBe("b1")
          // onclick function must NOT be stringified as attribute
          expect(button.hasAttribute("onclick")).toBe(false)
        })
      }),
    )

    it.effect("handles boolean true as attribute string 'true'", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const reconciler = DomReconciler.make(host)

        const tree = frag([
          el("input", [], { key: "i", props: { disabled: true } }),
        ])

        yield* reconciler.init()
        yield* reconciler.render(tree)

        yield* Effect.sync(() => {
          const input = host.querySelector("input")!
          expect(input.getAttribute("disabled")).toBe("true")
        })
      }),
    )

    it.effect("removes attribute for undefined and false values", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const reconciler = DomReconciler.make(host)

        const tree1 = frag([
          el("div", [], {
            key: "d",
            props: { "data-a": "yes", "data-b": "yes" },
          }),
        ])
        const tree2 = frag([
          el("div", [], {
            key: "d",
            props: { "data-a": undefined, "data-b": false },
          }),
        ])

        yield* reconciler.init()
        yield* reconciler.render(tree1)
        yield* reconciler.patch({ current: tree1, desired: tree2 })

        yield* Effect.sync(() => {
          const div = host.querySelector("div")!
          expect(div.hasAttribute("data-a")).toBe(false)
          expect(div.hasAttribute("data-b")).toBe(false)
        })
      }),
    )

    it.effect("passes non-function on* props through as attributes", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const reconciler = DomReconciler.make(host)

        const tree = frag([
          el("div", [], {
            key: "d",
            props: { onfocus: "doSomething()" },
          }),
        ])

        yield* reconciler.init()
        yield* reconciler.render(tree)

        yield* Effect.sync(() => {
          const div = host.querySelector("div")!
          expect(div.getAttribute("onfocus")).toBe("doSomething()")
        })
      }),
    )
  })

  // --- event handling ---

  describe("event handling", () => {
    it.effect("attaches click listener on element create", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const reconciler = DomReconciler.make(host)
        const handler = vi.fn()

        const tree = frag([
          el("button", [], { key: "btn", props: { onclick: handler } }),
        ])

        yield* reconciler.init()
        yield* reconciler.render(tree)
        host.querySelector("button")!.click()

        yield* Effect.sync(() => {
          expect(handler).toHaveBeenCalledOnce()
        })
      }),
    )

    it.effect("passes Event object to handler", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const reconciler = DomReconciler.make(host)
        let receivedEvent: Event | undefined

        const tree = frag([
          el("button", [], {
            key: "btn",
            props: {
              onclick: (e: Event) => {
                receivedEvent = e
              },
            },
          }),
        ])

        yield* reconciler.init()
        yield* reconciler.render(tree)
        host.querySelector("button")!.click()

        yield* Effect.sync(() => {
          expect(receivedEvent).toBeInstanceOf(MouseEvent)
        })
      }),
    )

    it.effect("detaches listener on element remove", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const reconciler = DomReconciler.make(host)
        const handler = vi.fn()

        const tree1 = frag([
          el("button", [], { key: "btn", props: { onclick: handler } }),
        ])
        const tree2 = frag([])

        yield* reconciler.init()
        yield* reconciler.render(tree1)
        const button = host.querySelector("button")!

        yield* reconciler.patch({ current: tree1, desired: tree2 })

        // button is orphaned — click should not fire handler if listener
        // was properly removed by destroy
        button.click()

        yield* Effect.sync(() => {
          expect(handler).not.toHaveBeenCalled()
        })
      }),
    )

    it.effect(
      "swaps handler reference without removeEventListener on update",
      () =>
        Effect.gen(function* () {
          const host = document.createElement("div")
          const reconciler = DomReconciler.make(host)
          const handler1 = vi.fn()
          const handler2 = vi.fn()

          const tree1 = frag([
            el("button", [], { key: "btn", props: { onclick: handler1 } }),
          ])
          const tree2 = frag([
            el("button", [], { key: "btn", props: { onclick: handler2 } }),
          ])

          yield* reconciler.init()
          yield* reconciler.render(tree1)

          const button = host.querySelector("button")!
          const removeSpy = vi.spyOn(button, "removeEventListener")

          yield* reconciler.patch({ current: tree1, desired: tree2 })
          button.click()

          yield* Effect.sync(() => {
            // Mutable handler trick: ref.current swapped, no DOM API call
            expect(removeSpy).not.toHaveBeenCalled()
            expect(handler1).not.toHaveBeenCalled()
            expect(handler2).toHaveBeenCalledOnce()
          })

          removeSpy.mockRestore()
        }),
    )

    it.effect("calls stopPropagation by default", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const parentHandler = vi.fn()
        host.addEventListener("click", parentHandler)

        const reconciler = DomReconciler.make(host)
        const childHandler = vi.fn()

        const tree = frag([
          el("button", [], { key: "btn", props: { onclick: childHandler } }),
        ])

        yield* reconciler.init()
        yield* reconciler.render(tree)
        host.querySelector("button")!.click()

        yield* Effect.sync(() => {
          expect(childHandler).toHaveBeenCalledOnce()
          // stopPropagation prevents bubbling to parent
          expect(parentHandler).not.toHaveBeenCalled()
        })
      }),
    )

    it.effect("calls preventDefault by default", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const reconciler = DomReconciler.make(host)
        const handler = vi.fn()

        const tree = frag([
          el("button", [], { key: "btn", props: { onclick: handler } }),
        ])

        yield* reconciler.init()
        yield* reconciler.render(tree)

        const event = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
        })
        host.querySelector("button")!.dispatchEvent(event)

        yield* Effect.sync(() => {
          expect(handler).toHaveBeenCalledOnce()
          expect(event.defaultPrevented).toBe(true)
        })
      }),
    )

    it.effect("handles multiple event types on same element", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const reconciler = DomReconciler.make(host)
        const clickHandler = vi.fn()
        const mouseoverHandler = vi.fn()

        const tree = frag([
          el("button", [], {
            key: "btn",
            props: { onclick: clickHandler, onmouseover: mouseoverHandler },
          }),
        ])

        yield* reconciler.init()
        yield* reconciler.render(tree)

        const button = host.querySelector("button")!
        button.click()
        button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))

        yield* Effect.sync(() => {
          expect(clickHandler).toHaveBeenCalledOnce()
          expect(mouseoverHandler).toHaveBeenCalledOnce()
        })
      }),
    )

    it.effect("adds new event listener when on* prop added on update", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const reconciler = DomReconciler.make(host)
        const handler = vi.fn()

        const tree1 = frag([
          el("button", [], { key: "btn", props: { id: "b1" } }),
        ])
        const tree2 = frag([
          el("button", [], {
            key: "btn",
            props: { id: "b1", onclick: handler },
          }),
        ])

        yield* reconciler.init()
        yield* reconciler.render(tree1)
        yield* reconciler.patch({ current: tree1, desired: tree2 })

        host.querySelector("button")!.click()

        yield* Effect.sync(() => {
          expect(handler).toHaveBeenCalledOnce()
        })
      }),
    )

    it.effect("removes event listener when on* prop removed on update", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const reconciler = DomReconciler.make(host)
        const handler = vi.fn()

        const tree1 = frag([
          el("button", [], { key: "btn", props: { onclick: handler } }),
        ])
        const tree2 = frag([el("button", [], { key: "btn", props: {} })])

        yield* reconciler.init()
        yield* reconciler.render(tree1)
        yield* reconciler.patch({ current: tree1, desired: tree2 })

        host.querySelector("button")!.click()

        yield* Effect.sync(() => {
          // Listener removed on update — handler must not fire
          expect(handler).not.toHaveBeenCalled()
        })
      }),
    )
  })

  // --- configurable event defaults ---

  describe("configurable event defaults", () => {
    it.effect("stopPropagation: false allows event bubbling", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const parentHandler = vi.fn()
        host.addEventListener("click", parentHandler)

        const reconciler = DomReconciler.make(host, {
          stopPropagation: false,
        })
        const childHandler = vi.fn()

        const tree = frag([
          el("button", [], { key: "btn", props: { onclick: childHandler } }),
        ])

        yield* reconciler.init()
        yield* reconciler.render(tree)
        host.querySelector("button")!.click()

        yield* Effect.sync(() => {
          expect(childHandler).toHaveBeenCalledOnce()
          // Event bubbles because stopPropagation is disabled
          expect(parentHandler).toHaveBeenCalledOnce()
        })
      }),
    )

    it.effect("preventDefault: false allows default behavior", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const reconciler = DomReconciler.make(host, {
          preventDefault: false,
        })
        const handler = vi.fn()

        const tree = frag([
          el("button", [], { key: "btn", props: { onclick: handler } }),
        ])

        yield* reconciler.init()
        yield* reconciler.render(tree)

        const event = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
        })
        host.querySelector("button")!.dispatchEvent(event)

        yield* Effect.sync(() => {
          expect(handler).toHaveBeenCalledOnce()
          expect(event.defaultPrevented).toBe(false)
        })
      }),
    )

    it.effect("both false disables all default behavior", () =>
      Effect.gen(function* () {
        const host = document.createElement("div")
        const parentHandler = vi.fn()
        host.addEventListener("click", parentHandler)

        const reconciler = DomReconciler.make(host, {
          stopPropagation: false,
          preventDefault: false,
        })
        const childHandler = vi.fn()

        const tree = frag([
          el("button", [], { key: "btn", props: { onclick: childHandler } }),
        ])

        yield* reconciler.init()
        yield* reconciler.render(tree)

        const event = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
        })
        host.querySelector("button")!.dispatchEvent(event)

        yield* Effect.sync(() => {
          expect(childHandler).toHaveBeenCalledOnce()
          expect(parentHandler).toHaveBeenCalledOnce()
          expect(event.defaultPrevented).toBe(false)
        })
      }),
    )
  })
})
