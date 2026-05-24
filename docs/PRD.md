# PRD: effect-vtree

## Document Status

- Status: Draft v1
- Date: 2026-03-18
- Package: `effect-vtree`

## 1. Product Summary

Build a standalone virtual tree reconciler package for generic rendering and DOM
targets.

The package must provide reusable node contracts, reconciliation behavior, and
DOM rendering support without taking ownership of application state or product
logic.

## 2. Users and Core Jobs

- Runtime authors building view layers on top of virtual trees
- App developers who need deterministic DOM reconciliation

Core jobs:

- Describe views as virtual tree values
- Reconcile current and desired trees predictably
- Render to the DOM through a reusable reconciler
- Consume JSX through package entrypoints

## 3. Goals

- Keep the package generic and reusable
- Provide stable virtual tree contracts
- Provide a DOM reconciler and JSX runtime
- Support higher-level runtimes such as `effect-tea/dom`

## 4. Non-Goals

- App state management
- Domain-specific view nodes
- Product-specific identifiers or services
- Browser-extension-specific abstractions

## 5. Functional Scope

### 5.1 Virtual Tree Contracts

- Element, text, and fragment node types
- Reconciler operation contracts
- Stable public types for consumers

### 5.2 Reconciliation

- Build reconciliation plans from tree differences
- Apply operations predictably to the active target
- Preserve package-generic semantics across consumers

### 5.3 DOM Support

- DOM reconciler implementation
- DOM event attachment through DOM modules
- JSX runtime and dev runtime entrypoints

### 5.4 Package Boundaries

- Consumers import from package entrypoints only
- Package does not absorb app-specific or domain-specific contracts

## 6. Verification

- Unit tests in `tests/`
- `bun run verify` passes
- Built package entrypoints import successfully

## 7. License

GPL-3.0.
