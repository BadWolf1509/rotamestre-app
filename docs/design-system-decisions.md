# Design System Decisions (ADR)

## Decision 01: Single Source of Truth for Tokens
Status: Accepted
Rationale:
- `src/utils/styles.base.ts` is already used by the web theme and is closest to runtime usage.
- Centralizing here minimizes breakage and reduces duplication.
Decision:
- Use `defaultTheme` as the canonical source for base tokens (colors, spacing, typography, radius, shadows).
- Other token files must derive from `defaultTheme`.

## Decision 02: Platform Variations
Status: Accepted
Rationale:
- Native needs platform-appropriate elevation and feedback.
- Web needs hover/focus and CSS-friendly properties.
Decision:
- Keep native shadows without CSS `boxShadow`.
- Keep web-only shadow fields inside web-specific tokens or mapped at use sites.

## Decision 03: Semantic Token Layer
Status: Accepted
Rationale:
- Components should not depend on raw brand colors.
Decision:
- Create semantic aliases for text, surface, border, status, and incident colors.
- Component styles must use semantic tokens whenever possible.

## Decision 04: Component Library Strategy
Status: Accepted
Rationale:
- Consistency requires a shared set of base components.
Decision:
- Introduce a design-system component entry point that re-exports base components.
- Migrate existing components incrementally to consume these shared primitives.

## Decision 05: Token Build Pipeline
Status: Accepted
Rationale:
- Token outputs are needed across web and native without manual duplication.
Decision:
- Add `tools/scripts/build-tokens.cjs` to generate `tokens/*.json` and `tokens/output/*`.
- Use `npm run build:tokens` to refresh outputs from `defaultTheme`.

## Decision 06: Design System Showcase
Status: Accepted
Rationale:
- A single screen helps validate tokens and component composition quickly.
Decision:
- Add `app/design-system.tsx` as a simple showcase page for tokens and base components.

## Decision 07: Visual Regression Opt-In
Status: Accepted
Rationale:
- Visual checks should be available without blocking all e2e runs.
Decision:
- Add a Playwright visual test tagged `@visual` and run it with `VISUAL_REGRESSION=1`.

## Decision 08: Governance Checklist
Status: Accepted
Rationale:
- UI changes require consistent review criteria.
Decision:
- Add a Design System checklist section to `.github/pull_request_template.md`.
- Document governance in `docs/design-system-governance.md`.

## Decision 09: Status Token Expansion
Status: Accepted
Rationale:
- Status-driven UI states were relying on ad-hoc colors.
Decision:
- Expand semantic status tokens in the build pipeline.
- Map route/delivery statuses to tokens instead of raw values.

## Decision 10: Social Brand Tokens
Status: Accepted
Rationale:
- External brand colors (ex: WhatsApp) appear in support flows.
Decision:
- Add `colors.social.whatsapp` derived from `defaultTheme`.
- Use the social token in components that link to WhatsApp.

## Decision 11: Design System Drift Enforcement
Status: Accepted
Rationale:
- Token outputs and hex allowlist must stay in sync.
Decision:
- Run `build:tokens`, `report:hex`, and `verify:design-system` in CI.
- Trigger visual regression when design-system paths change.

## Decision 12: Theme Preference Persistence
Status: Accepted
Rationale:
- Users need an explicit theme preference across platforms.
Decision:
- Persist theme preference in AsyncStorage.
- Apply preference via Unistyles and set `data-theme` on web.

## Decision 13: Density and Contrast Preferences
Status: Accepted
Rationale:
- Desktop users need a compact density option.
- Accessibility requires a high-contrast mode that stays aligned to tokens.
Decision:
- Persist density (`regular`/`compact`) and contrast (`normal`/`high`) preferences.
- Apply preferences through Unistyles theme names and web `data-*` attributes.

## Decision 14: Platform Override Tokens
Status: Accepted
Rationale:
- Platform-specific adjustments need a single, auditable place.
Decision:
- Define `platformOverrides` in `src/design-system/tokens/platform.ts`.
- Use overrides for touch target minimums, focus rings, ripple color, and elevation tuning.

## Decision 15: Deprecation Policy for Tokens and Components
Status: Accepted
Rationale:
- Avoid breaking changes without migration guidance.
Decision:
- Mark deprecations in docs and provide a migration path.
- Remove deprecated tokens/components after one release cycle.

## Decision 16: High Contrast Gray Modification
Status: Accepted
Date: 2025-12-30
Rationale:
- Standard dark theme has insufficient contrast for gray text on dark backgrounds.
- Users with visual impairments need higher contrast options.
Decision:
- Create `lightHighContrast` and `darkHighContrast` theme variants.
- Modify gray400-gray700 values in high contrast themes for better visibility.
- Gray values shift toward extremes (lighter grays become lighter, darker grays stay dark).

## Decision 17: Skeleton Component Family
Status: Accepted
Date: 2025-12-30
Rationale:
- Loading states need consistent visual treatment across the app.
- Different content shapes require different skeleton variants.
Decision:
- Create three skeleton components: `Skeleton`, `SkeletonCard`, `SkeletonList`.
- Export all via `@/design-system` barrel.
- Use animated pulse effect for loading indication.

## Decision 18: DataTable vs MobileCard Pattern
Status: Accepted
Date: 2025-12-30
Rationale:
- Mobile lists can use either tabular or card-based layouts.
- Both patterns have valid use cases.
Decision:
- `DataTable`: Use for tabular data with defined columns (gestao-rotas, motoristas).
- `MobileCard`: Use for custom card layouts with complex content (incidentes).
- Document in ADR, not enforce single pattern.

## Decision 19: Modal Usage Patterns
Status: Accepted
Date: 2025-12-30
Rationale:
- Multiple modal components exist with overlapping use cases.
- Clear guidance needed for when to use each type.
Decision:
- `ConfirmModal`: Simple Yes/No confirmations (delete, toggle).
- `DesktopModal`: Rich content modals (forms, details).
- `AlertDialog`: Informational alerts with single OK button.
- Rule: Never use `Alert.alert()` nativo - always use ConfirmModal for cross-platform consistency.

## Decision 20: Visual Regression Theme Coverage
Status: Accepted
Date: 2025-12-30
Rationale:
- Visual regression tests only covered 4 theme variants.
- All 8 combinations needed for complete coverage.
Decision:
- Expand visual regression to 8 combinations: light/dark × regular/compact × normal/high-contrast.
- Document coverage matrix in `docs/design-system-visual-regression.md`.
- CI runs visual regression when design-system files change.
