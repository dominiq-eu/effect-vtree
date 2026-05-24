# Advanced transition examples decision

Decision: advanced transition examples are **deferred**.

Reviewed Snabbdom examples:

- hero: <https://github.com/snabbdom/snabbdom/tree/master/examples/hero>
- carousel-svg:
  <https://github.com/snabbdom/snabbdom/tree/master/examples/carousel-svg>

Both examples are useful references, but they lean on transition-oriented
behavior that is not part of the current `effect-vtree` DOM reconciler example
surface. The hero example depends on coordinated enter/leave-style movement
between old and new nodes. The carousel SVG example combines SVG updates with
animation-style behavior. Adapting either now would make the examples about
transition/module behavior rather than the core `VTreeNode` and
`patch({ current, desired })` interface.

The current DOM reconciler has attribute and event module behavior, plus keyed
moves, but no documented transition module contract. Until such a contract
exists, examples should not imply that advanced transitions are a supported,
clean public capability.

Future contributors should prefer small examples that demonstrate behavior
already supported by the DOM reconciler. If transition examples are revisited,
first add a narrow implementation issue for a transition/module API and a
minimal example that proves one behavior end-to-end.
