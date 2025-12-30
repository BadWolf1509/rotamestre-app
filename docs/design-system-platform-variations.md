# Design System Platform Variations

## Shared Rules (All Platforms)
- Use semantic tokens for color, surface, border, and text (no raw hex in UI).
- Apply spacing and radius from tokens; stay on the 4px grid.
- Minimum touch target is 44px (use hitSlop for icon-only controls).
- Keep typography hierarchy aligned with token scale and allow font scaling.
- Respect safe areas and keyboard insets for mobile layouts.
- Prefer reduced motion when users ask for it (web prefers-reduced-motion).

## Token Overrides
- Shadows: use `theme.shadows` on web/iOS and map to `elevation` on Android.
- Density: use `theme.desktop.*` for desktop sizing and spacing.
- Motion: keep transitions between 150–250ms; avoid easing drift across platforms.
- Overlays: use semantic overlays for modals/sheets (avoid heavy blur on low-end).

## Web (React Native Web)
- Provide hover and focus-visible states for all interactive controls.
- Support keyboard navigation and visible focus rings.
- Use `boxShadow` for depth; avoid relying on iOS shadow props.
- Add cursor styles and lightweight transitions (no heavy animations).

## iOS
- Favor subtle elevation and softer shadows.
- Use iOS HIG spacing and visual density for forms and sheets.
- Prefer native presentation patterns (sheet, action sheet) where applicable.
- Keep text weights conservative to preserve readability.

## Android
- Use Material elevation for surfaces and native ripple feedback.
- Favor slightly larger tap targets and clear pressed states.
- Keep contrast strong on colored surfaces and buttons.
- Respect system back behavior for modals and dialogs.

## Platform Overrides (Tokens)
- Centralized overrides live in `src/design-system/tokens/platform.ts`.
- Use `platformOverrides` for minimum touch targets, focus rings, and ripple colors.
- Apply iOS shadow tuning and Android elevation via the overrides map when needed.
- Base components already consume these overrides:
  - `Button`: min touch size, web focus ring, Android ripple.
  - `Input`: min touch size and focus ring on web.
  - `Card`: iOS shadow tuning and Android elevation.

## When to Diverge
- Navigation patterns (tabs, drawer, header layout).
- Platform-native inputs (date/time picker, select, action sheet).
- Performance constraints (blur/opacity on low-end devices).
- System gestures and back behavior (Android back, iOS swipe back).

## Practical Examples
- Modals: use `theme.colors.overlay` on all platforms; prefer `<dialog>` on web and native sheets on mobile.
- Buttons: on web add hover + focus-visible rings; on Android rely on ripple + elevation; on iOS keep pressed state subtle.
- Lists: desktop can use denser rows (`theme.desktop.rowHeight`), mobile keeps 44px+ touch targets.
- Forms: use tokenized input heights; use platform-native pickers for date/time and select controls.
- Navigation: web supports persistent sidebars; mobile uses bottom tabs or drawer per platform guidance.
