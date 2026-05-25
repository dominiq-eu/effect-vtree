# Advanced transition example

Advanced transition behavior is demonstrated in
[`examples/transitions`](./transitions/).

The example is inspired by Snabbdom's animation-oriented examples:

- hero: <https://github.com/snabbdom/snabbdom/tree/master/examples/hero>
- carousel-svg:
  <https://github.com/snabbdom/snabbdom/tree/master/examples/carousel-svg>

Unlike Snabbdom's hero example, this package currently does not expose a
transition hook/module API. The example therefore keeps the boundary explicit:
`effect-vtree` reconciles the old and desired SVG trees through the DOM target,
while ordinary browser CSS transitions animate changed attributes such as
position, radius, and opacity.

Run from the repository root:

```sh
bunx vite examples/transitions
```

Then open `/plain.html` or `/jsx.html`.
