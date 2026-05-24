# Keyed reorder example

A tiny keyed-list example inspired by Snabbdom's reorder-animation example:

- <https://github.com/snabbdom/snabbdom/tree/master/examples/reorder-animation>

Two entrypoints render the same output:

- `plain.html` / `plain.ts` uses raw `VTreeNode` values and passes each row key
  explicitly.
- `jsx.html` / `jsx.tsx` uses JSX with `@jsxImportSource effect-vtree/dom` and
  `key={item.id}`.

Run either page from the repository root with Vite:

```sh
bunx vite examples/reorder
```

Then open `/plain.html` or `/jsx.html`.

The example intentionally skips transitions and animations. It keeps the
reconciliation loop visible: derive `desired`, call
`patch({ current, desired })`, then assign `current = desired`.
