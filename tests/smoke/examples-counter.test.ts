import { build, mergeConfig, type UserConfig } from "vite"
import { describe, expect, it } from "vitest"

import baseConfig from "../../vite.config.ts"

const counterExampleConfig: UserConfig = mergeConfig(baseConfig, {
  root: ".",
  logLevel: "silent",
  build: {
    outDir: ".tmp/examples-counter-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        plain: "examples/counter/plain.html",
        jsx: "examples/counter/jsx.html",
      },
    },
  },
})

describe("counter examples", () => {
  it("builds the plain VTree and JSX pages through the repository Vite config", async () => {
    await expect(build(counterExampleConfig)).resolves.toBeDefined()
  })
})
