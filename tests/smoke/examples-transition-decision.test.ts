import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const read = (path: string): string => readFileSync(path, "utf8")

describe("advanced transition examples decision", () => {
  it("documents the decision near the examples suite", () => {
    const decision = read("examples/ADVANCED-TRANSITIONS.md")
    const suiteReadme = read("examples/README.md")

    expect(decision).toContain("# Advanced transition examples decision")
    expect(decision).toContain("deferred")
    expect(decision).toContain("hero")
    expect(decision).toContain("carousel-svg")
    expect(decision).toContain("transition")
    expect(decision).toContain("module")
    expect(decision).toContain("DOM reconciler")
    expect(decision).toContain(
      "https://github.com/snabbdom/snabbdom/tree/master/examples/hero",
    )
    expect(decision).toContain(
      "https://github.com/snabbdom/snabbdom/tree/master/examples/carousel-svg",
    )
    expect(suiteReadme).toContain("ADVANCED-TRANSITIONS.md")
  })
})
