import { existsSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const read = (path: string): string => readFileSync(path, "utf8")

describe("advanced transition example", () => {
  it("documents and implements the transition example near the examples suite", () => {
    const decision = read("examples/ADVANCED-TRANSITIONS.md")
    const suiteReadme = read("examples/README.md")
    const exampleReadme = read("examples/transitions/README.md")

    expect(decision).toContain("# Advanced transition example")
    expect(decision).toContain("examples/transitions")
    expect(decision).toContain("hero")
    expect(decision).toContain("carousel-svg")
    expect(decision).toContain("CSS transitions")
    expect(decision).toContain("DOM")
    expect(decision).toContain(
      "https://github.com/snabbdom/snabbdom/tree/master/examples/hero",
    )
    expect(decision).toContain(
      "https://github.com/snabbdom/snabbdom/tree/master/examples/carousel-svg",
    )
    expect(suiteReadme).toContain("bunx vite examples/transitions")
    expect(suiteReadme).toContain("ADVANCED-TRANSITIONS.md")
    expect(exampleReadme).toContain("bunx vite examples/transitions")

    expect(existsSync("examples/transitions/plain.html")).toBe(true)
    expect(existsSync("examples/transitions/plain.ts")).toBe(true)
    expect(existsSync("examples/transitions/jsx.html")).toBe(true)
    expect(existsSync("examples/transitions/jsx.tsx")).toBe(true)
  })

  it("keeps the transition sources parallel and package-style", () => {
    const plain = read("examples/transitions/plain.ts")
    const jsx = read("examples/transitions/jsx.tsx")

    for (const source of [plain, jsx]) {
      expect(source).toContain('from "effect-vtree/dom"')
      expect(source).toContain("patch({ current, desired })")
      expect(source).toContain("transition-all")
      expect(source).toContain("rotateSlides")
      expect(source).toContain("<HTMLElement>")
    }

    expect(jsx).toContain("@jsxImportSource effect-vtree/dom")
  })
})
