# Design System Visual Regression

## Goal
Prevent visual drift in the design system by running snapshot-based checks.

## How it Works
- Playwright tests: `e2e/design-system.e2e.ts`, `e2e/visual-critical.e2e.ts`
- Snapshot tag: `@visual`
- Opt-in via `VISUAL_REGRESSION=1`
 - CI runs visual regression when design-system related files change.
- Scenarios: light theme, dark theme, compact density, high contrast, toast state, auth login, auth register, auth forgot password, onboarding first password, gestor dashboard, gestor gestao rotas, gestor mapa rota (empty), motorista home, motorista mapa, motorista paradas, motorista historico.

## Run Locally
1) Start with a running web server (Playwright will use `npm run web` if needed).
2) Generate or update snapshots:
   - `npm run test:visual:update`
3) Validate snapshots:
   - `npm run test:visual`

## CI Gate
- Visual regression runs in CI for design-system changes and fails on diffs.
- Update snapshots locally and commit them with the PR when changes are intended.
- Use workflow dispatch with `run_visual=true` to force a run.

## Notes
- Snapshots live under Playwright's default snapshot folder.
- Keep snapshots updated when UI changes are intentional.
- Toast snapshot runs on desktop only to avoid mobile animation flake.
