# effect-vtree

`effect-vtree` is an Effect-native generic virtual tree reconciler.

It is inspired by [Snabbdom](https://github.com/snabbdom/snabbdom) and is an
attempted reimplementation of Snabbdom's virtual-tree reconciliation ideas for
the Effect-TS ecosystem: pure virtual tree values, explicit reconciliation, and
Effect-based patching boundaries.

DOM rendering is one target shipped by this package, together with a JSX runtime
for authoring DOM trees. The core package is not limited to views: it provides a
generic reconciler model that can drive any target capable of interpreting
insert, update, move, and remove operations.

## Features

- Generic virtual tree node contracts
- Reconciler builder API
- Target-agnostic reconciliation operations
- DOM reconciler implementation as one concrete target
- JSX runtime for DOM tree authoring
- Package-generic boundary for higher-level runtimes

## Entrypoints

- `effect-vtree` - reconciler API and virtual tree contracts
- `effect-vtree/dom` - DOM reconciler and DOM JSX factories
- `effect-vtree/dom/jsx-runtime` - JSX runtime
- `effect-vtree/dom/jsx-dev-runtime` - dev JSX runtime

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

## License

GPL-3.0. See `LICENSE`.
