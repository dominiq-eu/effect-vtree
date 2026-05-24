import { build, mergeConfig, type UserConfig } from "vite"
import { describe, expect, it } from "vitest"

import baseConfig from "../../vite.config.ts"

const svgExampleConfig: UserConfig = mergeConfig(baseConfig, {
  root: ".",
  logLevel: "silent",
  build: {
    outDir: ".tmp/examples-svg-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        plain: "examples/svg/plain.html",
        jsx: "examples/svg/jsx.html",
      },
    },
  },
})

describe("svg examples", () => {
  it("builds the plain VTree and JSX pages through the repository Vite config", async () => {
    await expect(build(svgExampleConfig)).resolves.toBeDefined()
  })
})
