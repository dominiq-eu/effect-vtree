# SVG example

A small SVG scene inspired by Snabbdom's SVG example:

- <https://github.com/snabbdom/snabbdom/tree/master/examples/svg>

Two entrypoints render the same output:

- `plain.html` / `plain.ts` uses raw `VTreeNode` values with tiny `el()` and
  `text()` helpers.
- `jsx.html` / `jsx.tsx` uses JSX with `@jsxImportSource effect-vtree/dom`.

Run either page from the repository root with Vite:

```sh
bunx vite examples/svg
```

Then open `/plain.html` or `/jsx.html`.

Unlike Snabbdom's `h()` helper, these examples author `VTreeNode` data directly
or through the `effect-vtree` JSX runtime, then render the tree through
`DomReconciler`.
