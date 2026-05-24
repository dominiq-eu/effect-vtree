import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig } from "vite-plus"

const root = dirname(fileURLToPath(import.meta.url))
const r = (path: string) => resolve(root, path)

export default defineConfig({
  resolve: {
    alias: {
      "effect-vtree/dom/jsx-runtime": r("src/dom/jsx-runtime.ts"),
      "effect-vtree/dom/jsx-dev-runtime": r("src/dom/jsx-dev-runtime.ts"),
      "effect-vtree/dom": r("src/dom/index.ts"),
      "effect-vtree": r("src/index.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/._*"],
    environment: "node",
  },
  fmt: {
    semi: false,
    singleQuote: false,
    printWidth: 80,
    sortImports: true,
    sortTailwindcss: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  pack: {
    entry: [
      "src/index.ts",
      "src/dom/index.ts",
      "src/dom/jsx-runtime.ts",
      "src/dom/jsx-dev-runtime.ts",
    ],
    dts: true,
    format: ["esm"],
    sourcemap: true,
    deps: {
      neverBundle: [/^effect(?:\/.*)?$/],
    },
  },
})
