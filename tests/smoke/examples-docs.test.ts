import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const read = (path: string): string => readFileSync(path, "utf8")

describe("examples documentation", () => {
  it("documents the suite, run pattern, and Snabbdom mapping", () => {
    const readme = read("examples/README.md")

    expect(readme).toContain("# Examples")
    expect(readme).toContain("repository root")
    expect(readme).toContain("bunx vite examples/counter")
    expect(readme).toContain("bunx vite examples/svg")
    expect(readme).toContain("bunx vite examples/reorder")
    expect(readme).toContain("bunx vite examples/transitions")
    expect(readme).toContain("Snabbdom")
    expect(readme).toContain("patch(vnode, newVnode)")
    expect(readme).toContain("patch({ current, desired })")
    expect(readme).not.toContain("package.json")
  })

  it("links each example README to the relevant Snabbdom source", () => {
    expect(read("examples/counter/README.md")).toContain(
      "https://github.com/snabbdom/snabbdom/tree/master/examples",
    )
    expect(read("examples/svg/README.md")).toContain(
      "https://github.com/snabbdom/snabbdom/tree/master/examples/svg",
    )
    expect(read("examples/reorder/README.md")).toContain(
      "https://github.com/snabbdom/snabbdom/tree/master/examples/reorder-animation",
    )
    expect(read("examples/transitions/README.md")).toContain(
      "https://github.com/snabbdom/snabbdom/tree/master/examples/hero",
    )
    expect(read("examples/transitions/README.md")).toContain(
      "https://github.com/snabbdom/snabbdom/tree/master/examples/carousel-svg",
    )
  })
})
