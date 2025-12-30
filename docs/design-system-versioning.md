# Design System Versioning

## Scope
- Tokens, components, and design-system documentation.

## Semver Rules
- Patch: additive token changes or bugfixes that do not break existing usage.
- Minor: new components, new variants, or additive token categories.
- Major: token renames/removals, component API breaks, or visual breaking changes.

## When to Bump
- Tokens changed in `src/utils/styles.base.ts` or `src/lib/design-tokens.ts`.
- Component API or behavior changed in `src/components` or `src/design-system`.

## Release Checklist
1) Run `npm run build:tokens` to refresh outputs in `tokens/`.
2) Run `npm run report:hex` and verify allowlist if needed.
3) Update docs and visual snapshots when UI changes are intentional.
