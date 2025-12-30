# Design System Audit

Date: 2025-12-29

## Scope
Project: rotamestre-app (Expo / React Native Web)
Platforms: Web, iOS, Android

## Current State Summary
- Multiple token sources exist and diverge:
  - `src/utils/styles.base.ts` (defaultTheme used by web)
  - `src/unistyles.ts` (native theme, duplicated values)
  - `src/styles/theme.ts` (legacy theme shape)
  - `src/lib/design-tokens.ts` (nested tokens, different values)
- Hardcoded colors and platform-specific styles exist in several high-use components.
- Brand guidelines file references a path that is no longer the source of truth.

## Token Alignment (Status)
- `src/lib/design-tokens.ts` now derives spacing, radius, and shadows from `defaultTheme`.
- `src/styles/theme.ts` continues as a legacy wrapper sourced from `defaultTheme`.
- Remaining divergence resolved: `src/unistyles.ts` now consumes the base themes from `src/utils/styles.base.ts`.

## Hotspots (Hardcoded Colors)
Resolved in Wave 1:
- `src/components/RouteFilters.tsx`
- `src/components/SupportModal.tsx`
- `src/components/NotificationList.tsx`
- `src/components/PerformanceSettings.tsx`
- `src/components/MapaWeb.tsx`
- `app/gestor/incidentes.tsx`

Additional cleanups:
- `src/components/AddressAutocomplete.tsx`
- `src/components/DataTable.tsx`
- `src/components/StreetViewPreview.tsx`
- `src/components/Toast.tsx`
- `src/components/gestor/mapa-rota/DraggableStopList/StopCard.tsx`
- `src/components/gestor/mapa-rota/ParadaCard.tsx`
- `src/components/motorista/ParadaBottomSheet.tsx`
- `src/components/motorista/home/ExpiredRouteCard.tsx`
- `src/components/motorista/home/MiniMap.tsx`

Remaining hotspots are tracked in `eslint.config.js` (hexColorAllowlist).

## Risks
- Visual drift between web and native themes.
- Inconsistent typography and spacing in shared components.
- Hardcoded values reduce maintainability and block scalable theming.

## Immediate Recommendations
- Establish `src/utils/styles.base.ts` as the single source of truth for base tokens.
- Align `src/unistyles.ts`, `src/styles/theme.ts`, and `src/lib/design-tokens.ts` to it.
- Introduce semantic tokens for status, incident, surface, text, and borders.
- Plan incremental migration for hotspot components.
