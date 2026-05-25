# Transitions example

Inspired by Snabbdom's advanced animation-oriented examples:

- <https://github.com/snabbdom/snabbdom/tree/master/examples/hero>
- <https://github.com/snabbdom/snabbdom/tree/master/examples/carousel-svg>

This example keeps the implementation deliberately small: `effect-vtree` patches
new SVG attributes, and browser CSS transitions animate the DOM between the old
and desired states. It does not introduce a transition hook/module API.

Run from the repository root:

```sh
bunx vite examples/transitions
```

Then open `/plain.html` or `/jsx.html`.
