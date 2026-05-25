# Examples

Small source-code examples for `effect-vtree`, inspired by the Snabbdom
examples:

- [Counter](./counter/) adapts the basic interactive patch loop from Snabbdom's
  examples root.
- [SVG](./svg/) adapts Snabbdom's SVG example with plain VTree and JSX sources.
- [Keyed reorder](./reorder/) adapts Snabbdom's reorder-animation idea without
  transitions.
- [Transitions](./transitions/) adapts Snabbdom's hero/carousel-style animation
  ideas with SVG attribute updates and browser CSS transitions.

See [ADVANCED-TRANSITIONS.md](./ADVANCED-TRANSITIONS.md) for the transition
example boundary.

Run examples from the repository root with Vite:

```sh
bunx vite examples/counter
bunx vite examples/svg
bunx vite examples/reorder
bunx vite examples/transitions
```

Then open `/plain.html` or `/jsx.html` for the example you started.

## Snabbdom mapping

Snabbdom examples commonly keep the previous vnode and replace it with the
result of patching:

```ts
vnode = patch(vnode, newVnode)
```

These examples keep the previous tree as `current`, derive the next tree as
`desired`, and patch with an explicit input object:

```ts
Effect.runSync(reconciler.patch({ current, desired }))
current = desired
```

The examples are not nested apps. They are HTML and TypeScript entrypoints
served by the repository Vite config, using package-style imports such as
`effect-vtree/dom` that resolve to local source aliases.
