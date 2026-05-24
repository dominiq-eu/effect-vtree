import { build, mergeConfig, type UserConfig } from "vite"
import { describe, expect, it } from "vitest"

import baseConfig from "../../vite.config.ts"

const reorderExampleConfig: UserConfig = mergeConfig(baseConfig, {
  root: ".",
  logLevel: "silent",
  build: {
    outDir: ".tmp/examples-reorder-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        plain: "examples/reorder/plain.html",
        jsx: "examples/reorder/jsx.html",
      },
    },
  },
})

describe("reorder examples", () => {
  it("builds the plain VTree and JSX pages through the repository Vite config", async () => {
    await expect(build(reorderExampleConfig)).resolves.toBeDefined()
  })
})
