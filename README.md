# effect-vtree

`effect-vtree` is an Effect-native virtual tree reconciler package for generic
view rendering and DOM targets.

It is inspired by [Snabbdom](https://github.com/snabbdom/snabbdom) and is an
attempted reimplementation of Snabbdom's virtual-DOM ideas for the Effect-TS
ecosystem: pure virtual tree values, explicit reconciliation, and an Effect-based
DOM patching boundary.

## Features

- Generic virtual tree node contracts
- Reconciler builder API
- DOM reconciler implementation
- JSX runtime for DOM views
- Package-generic rendering boundary for higher-level runtimes

## Entrypoints

- `effect-vtree` - reconciler API and virtual tree contracts
- `effect-vtree/dom` - DOM reconciler and DOM JSX factories
- `effect-vtree/dom/jsx-runtime` - JSX runtime
- `effect-vtree/dom/jsx-dev-runtime` - dev JSX runtime

## Package Rules

- Runtime code imports from package entrypoints only.
- Do not import internal `src/*` paths from outside the package.
- Keep the package generic; do not add product-specific identifiers or services.

## Examples

The [`examples/`](./examples/) directory contains small, source-code-focused
examples inspired by Snabbdom's examples:

- [`examples/counter`](./examples/counter/) shows the basic render/patch loop in
  both plain `VTreeNode` style and JSX.
- [`examples/svg`](./examples/svg/) shows SVG rendering in plain VTree and JSX.
- [`examples/reorder`](./examples/reorder/) shows keyed reconciliation by
  reordering DOM nodes.

Run them from the repository root with Vite, for example:

```bash
bunx vite examples/counter
```

Each example has separate `plain.html` and `jsx.html` pages so the raw VTree and
JSX versions stay easy to compare.

## Development

```bash
bun run check
bun run test
bun run build
```

`bun run test` intentionally uses Vitest directly because `@effect/vitest` is a
Vitest peer dependency. Vite+ still owns formatting, linting, and packaging
through `vp check` and `vp pack`.

## Source of Truth

- Requirements: `docs/PRD.md`
- Package rules: `AGENTS.md`
- Tests: `tests/`

## License

GPL-3.0. See `LICENSE`.
