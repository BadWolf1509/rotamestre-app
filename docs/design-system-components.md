# Design System Components

This document lists the base components exposed by the design system entry point.

## Usage
- Import from `@/design-system` to avoid direct component paths.
- Keep visual variants consistent across platforms.
- Prefer component props/variants over local style overrides.
- If a variant is missing, add it to the component instead of duplicating UI.
 - Use `app/design-system.tsx` as the canonical showcase for real examples.

Example:
```ts
import { Button, Card, Input } from '@/design-system';
```

## Base Components
- `Button`
- `Badge`
- `Card`
- `DataTable`
- `Input`
- `Text`
- `EmptyState`
- `Icon`
- `Avatar`
- `Progress`
- `StepIndicator`
- `SkeletonLoader`

## Overlays & Feedback
- `Modal`
- `AlertDialog`
- `ConfirmDialog`
- `ConfirmModal`
- `SupportModal`
- `Toast`

## Desktop Layout
- `DesktopLayout`
- `DesktopPageLayout`
- `DesktopCard`
- `DesktopModal`
- `SplitView`

## Composed (Feature-Level)
- `ResponsiveGrid`
- `GridItem`
- `MetricCard`

## Mobile Layout
- `MobileHeader`
- `MobileCard`
- `MobileButton`
- `MobileEmptyState`
- `MobileLoading`

## Token Usage Guidelines
- Color: `theme.colors.*` (semantic tokens first).
- Spacing: `theme.spacing.*`, `theme.desktop.*` for dense layouts.
- Typography: `theme.typography.*` for sizes and font families.
- Density: avoid fixed pixel sizes; rely on `theme.desktop.*` so compact mode can scale.
- Contrast: avoid custom alpha colors; prefer semantic tokens so high-contrast stays legible.

## Notes
- These exports are wrappers over existing components in `src/components`.
- Future updates should add new base components here first, then migrate call sites.
 - Feature-level examples (ex: `MetricCard`, `DataTable`) live in the showcase screen.
