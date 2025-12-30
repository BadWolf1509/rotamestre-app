# Design System Tokens

## Source of Truth
- Canonical source: `src/utils/styles.base.ts` (`defaultTheme`).
- Derivations: `src/lib/design-tokens.ts`, `src/styles/theme.ts`, `src/unistyles.ts`.
- Generated outputs: `tokens/core.json`, `tokens/semantic.json`, `tokens/components.json`, `tokens/output/*`.

## Taxonomy
1) Core tokens
   - Raw scales and brand primitives.
   - Examples: `color.primary`, `spacing.md`, `radius.lg`, `shadow.lg`, `typography.fontSize.base`, `motion.duration.fast`, `desktop.input.height`.

2) Semantic tokens
   - Usage-based aliases for UI meaning.
   - Examples: `text.primary`, `surface.card`, `border.default`, `status.successBg`, `status.warningText`, `incident.accident`.

3) Component tokens
   - Component-specific defaults and sizing.
   - Examples: `component.button.height`, `component.input.paddingX`, `component.modal.headerPadding`.
   - Feature-level examples: `component.statsCard.padding`, `component.table.headerFontSize`.

## Naming Conventions
- Prefix by domain: `color.*`, `spacing.*`, `radius.*`, `shadow.*`, `typography.*`, `motion.*`, `desktop.*`.
- Semantic groups: `text.*`, `surface.*`, `border.*`, `status.*`, `incident.*`.
- Component groups: `component.<name>.<token>`.

## Update Flow
1) Update `defaultTheme` in `src/utils/styles.base.ts`.
2) Run `npm run build:tokens` to refresh generated outputs.
3) Use semantic tokens in components (avoid raw hex).

## Color & Shadow Helpers
Use helpers instead of raw `rgba()` or literal shadow strings:
- `withOpacity(color, opacity)` to derive overlays from tokens.
- `boxShadow(x, y, blur, spread, color, opacity)` for web `boxShadow` values.
- `dropShadow(x, y, blur, color, opacity)` for CSS `filter: drop-shadow()`.
- `textShadow(x, y, blur, color, opacity)` for web text shadows.

Prefer semantic colors as the base input (ex: `theme.colors.text`, `theme.colors.primary`).

## Feature-level component tokens
- `components.statsCard.*`: padding, radius, typography sizes, icon sizing.
- `components.table.*`: header/row font size and paddings for badges and action buttons.
