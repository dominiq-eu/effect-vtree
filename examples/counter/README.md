# Counter example

A tiny interactive example inspired by Snabbdom's examples root:

- <https://github.com/snabbdom/snabbdom/tree/master/examples>

Two entrypoints render the same counter UI with different authoring styles:

- `plain.html` / `plain.ts` uses raw `VTreeNode` values with tiny `el()` and
  `text()` helpers.
- `jsx.html` / `jsx.tsx` uses JSX with `@jsxImportSource effect-vtree/dom`.

Run either page from the repository root with Vite:

```sh
bunx vite examples/counter
```

Then open `/plain.html` or `/jsx.html`.

Snabbdom examples often keep the previous vnode and assign the return value of
patching:

```ts
vnode = patch(vnode, newVnode)
```

Both `effect-vtree` versions keep `current` and `desired` trees explicitly and
reconcile with:

```ts
Effect.runSync(reconciler.patch({ current, desired }))
current = desired
```
