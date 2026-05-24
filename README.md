# effect-vtree

`effect-vtree` is an Effect-native virtual tree reconciler package for generic
view rendering and DOM targets.

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

## Development

```bash
bun run check
bun run test
bun run build
bun run verify
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
