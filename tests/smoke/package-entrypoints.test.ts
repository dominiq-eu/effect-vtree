import { execFileSync } from "node:child_process"

import { describe, expect, it } from "vitest"

describe("package entrypoints", () => {
  it("imports built package entrypoints through package exports", () => {
    expect(() => {
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          `
            await import("effect-vtree")
            await import("effect-vtree/dom")
            await import("effect-vtree/dom/jsx-runtime")
            await import("effect-vtree/dom/jsx-dev-runtime")
          `,
        ],
        { stdio: "pipe" },
      )
    }).not.toThrow()
  })
})
