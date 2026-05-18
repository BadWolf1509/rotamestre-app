# RotaMestre Design System

This file is the canonical design reference for the app. Live source of truth is `src/lib/design-tokens.ts` — regenerate snapshots from there with `npm run report:hex` when needed.

## Brand colors

- **Primary** — Orange `#FF8C42` — CTAs, primary actions, route status accents.
- **Secondary** — Blue `#4A90E2` — informational UI (links, secondary actions).
- **Success** — Green `#2ECC71` — completed deliveries, positive state.
- **Warning** — Yellow `#F1C40F` — pending/in-progress states.
- **Danger** — Red `#E74C3C` — destructive actions, errors.

Token names in `src/lib/design-tokens.ts`: `colors.primary`, `colors.secondary`, `colors.success`, `colors.warning`, `colors.danger`. Always import — never inline hex values in components.

## Typography

- **Headings:** Viga (loaded via `@expo-google-fonts/viga`).
- **Body:** Nunito Sans (loaded via `@expo-google-fonts/nunito-sans`).

Font weights for body: 400 (regular), 600 (semi-bold), 700 (bold). Don't use other weights without adding them to the font loader in `app/_layout.tsx`.

## Spacing scale

`spacing.xs|sm|md|lg|xl|xxl` in `design-tokens.ts`. Multiples of 4: 4, 8, 16, 24, 32, 48 px.

Use spacing tokens, never raw numbers. `padding: spacing.md` not `padding: 16`.

## Breakpoints

```typescript
import { useResponsive } from '@/hooks/useResponsive';
const { isMobile, isTablet, isDesktop, width } = useResponsive();
```

- **Mobile:** width < 768
- **Tablet:** 768 ≤ width < 1024
- **Desktop:** width ≥ 1024

Always prefer the hook over raw `Dimensions.get('window')`.

## Accessibility (WCAG 2.1 AA target)

Required on every interactive component:

- `accessibilityLabel` for visual labels that aren't text (icons, images).
- `accessibilityRole` per role (`button`, `header`, `link`, etc.).
- `accessibilityState` for toggleable controls (`{ disabled, selected, checked, expanded }`).
- Minimum touch target: 44×44 px (use `hitSlop` to extend if visual size is smaller).
- Contrast: text against background ≥ 4.5:1 (≥ 3:1 for large text and UI components).

## Base components

Build with these unless there's a specific reason not to:

- `Button` (`src/components/Button.tsx`) — primary action component; check the file for current variants.
- `Card` (`src/components/Card.tsx`) — container with shadow + radius.
- `Input` (`src/components/Input.tsx`) — text field with label + error slot; integrates with `react-hook-form`.
- `AddressAutocomplete` — wraps Photon API for address input.
- `CameraUpload` — camera or gallery photo, auto-compressed to <500KB, uploads to Supabase Storage bucket `fotos-entrega`.
- `DataTable` — responsive table (cards on mobile, table on desktop).
- `ResponsiveContainer` — max-width wrapper for desktop layouts.

## Maintenance commands

- `npm run build:tokens` — regenerate the CSS-variables snapshot after editing `design-tokens.ts`.
- `npm run verify:design-system` — fail-loud check that no hardcoded hex values slipped into components.
- `npm run report:hex` — current usage audit (machine-readable; output is gitignored).

## Visual QA

The `app/design-system.tsx` screen (dev-only) renders every base component for live visual review. Open via deep link or navigate directly while running the dev server.
