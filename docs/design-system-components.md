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

## Utility Components (NEW)
- `AddressAutocomplete` - Google Places autocomplete input
- `AuthLoadingScreen` - Loading state during authentication
- `CameraUpload` - Photo capture with compression and Supabase upload
- `ErrorBoundary` - React error boundary wrapper
- `SwipeableRow` - Row with swipe actions for lists

## Base Components
- `Button`
- `Badge`
- `Card`
- `DataTable`
- `FilterChip` - Filter chip for lists (selected/unselected states)
- `Input`
- `Text`
- `EmptyState`
- `Icon`
- `Avatar`
- `Progress`
- `StatusBadge` - Status badge with semantic colors (soft/solid variants)
- `StepIndicator`

### Loading States
- `Skeleton` - Base skeleton loading component
- `SkeletonCard` - Card-shaped skeleton placeholder
- `SkeletonList` - List of skeleton items for loading states

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
- `DesktopCardGrid` - Grid layout for desktop cards
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

---

# Components Not Exported via @/design-system

The following components are used across the app but imported directly from `@/components/*`.
Consider exporting these via `@/design-system` for consistency.

## Utility Components (ainda não exportados)
- `ResponsiveContainer` - Max-width container with responsive padding (`@/components/ResponsiveContainer`)
- `PasswordStrengthIndicator` - Password strength feedback (`@/components/PasswordStrengthIndicator`)
- `AvatarEditable` - Avatar with edit capability (`@/components/AvatarEditable`)
- `ConnectivityBanner` - Offline status banner (`@/components/ConnectivityBanner`)

**Migrados para @/design-system (2025-12-30):**
- ~~`AddressAutocomplete`~~ ✅ Exportado
- ~~`CameraUpload`~~ ✅ Exportado
- ~~`ErrorBoundary`~~ ✅ Exportado
- ~~`AuthLoadingScreen`~~ ✅ Exportado
- ~~`SwipeableRow`~~ ✅ Exportado
- ~~`FilterChip`~~ ✅ Exportado e documentado
- ~~`StatusBadge`~~ ✅ Exportado e documentado

## Auth Components
- `AuthBrandPanel` - Brand panel for auth screens (`@/components/auth/AuthBrandPanel`)

## Gestor Components
- `DashboardDesktop` - Desktop dashboard layout (`@/components/gestor/dashboard`)
- `DashboardMobile` - Mobile dashboard layout (`@/components/gestor/dashboard`)
- `RotasTable` - Routes table with actions (`@/components/gestor/dashboard/_components/desktop/RotasTable`)
- `StatsCard` - Statistics card for metrics (`@/components/gestor`)
- `Sidebar` - Desktop sidebar navigation (`@/components/Sidebar`)
- `GestorSidebar` - Gestor-specific sidebar (`@/components/GestorSidebar`)
- `RouteFilters` - Route filtering component (`@/components/RouteFilters`)
- `RouteControlPanel` - Route management controls (`@/components/RouteControlPanel`)
- `RouteTimeline` - Route timeline visualization (`@/components/RouteTimeline`)

## Motorista Components
- `IncidentReportWizard` - Step wizard for incident reporting (`@/components/motorista/IncidentReportWizard`)
- `StopCompletionFlow` - Flow for completing stops (`@/components/motorista/StopCompletionFlow`)
- `ParadaBottomSheet` - Bottom sheet for stop details (`@/components/motorista/ParadaBottomSheet`)
- `ParadaCard` - Card for stop information (`@/components/motorista/ParadaCard`)
- `ParadaCardSkeleton` - Loading skeleton for ParadaCard (`@/components/motorista/ParadaCardSkeleton`)
- `RotaCardSkeleton` - Loading skeleton for route cards (`@/components/motorista/RotaCardSkeleton`)
- `NavigationMode` - Navigation mode UI (`@/components/motorista/NavigationMode`)
- `NavigationSettings` - Navigation settings panel (`@/components/motorista/NavigationSettings`)
- `TurnByTurnNavigation` - Turn-by-turn guidance UI (`@/components/motorista/TurnByTurnNavigation`)
- `OptimizationAlert` - Route optimization alert (`@/components/motorista/OptimizationAlert`)
- `MainCard` - Main card on motorista home (`@/components/motorista/home/MainCard`)
- `MiniMap` - Mini map overlay (`@/components/motorista/home/MiniMap`)
- `StatusSection` - Status section on home (`@/components/motorista/home/StatusSection`)
- `FloatingActionButton` - FAB for quick actions (`@/components/motorista/home/FloatingActionButton`)
- `StartRouteButton` - Button to start route (`@/components/motorista/home/StartRouteButton`)
- `ExpiredRouteCard` - Card for expired routes (`@/components/motorista/home/ExpiredRouteCard`)
- `PictureInPictureMap` - PiP map overlay (`@/components/motorista/PictureInPictureMap`)

## Map Components
- `MapaAdapter` - Map abstraction layer (`@/components/map/MapaAdapter`)
- `MapaRN` - React Native map implementation (`@/components/MapaRN`)
- `MapaWeb` - Web map implementation (`@/components/MapaWeb`)
- `MapaMobile` - Mobile-specific map (`@/components/map/MapaMobile`)
- `MapaRotas` - Route-specific map (`@/components/map/MapaRotas`)
- `MotoristaMarker` - Driver marker on map (`@/components/MotoristaMarker`)
- `StreetViewPreview` - Street view integration (`@/components/StreetViewPreview`)

## Infrastructure Components
- `DrawerMenu` - Drawer navigation menu (`@/components/DrawerMenu`)
- `CustomDrawerContent` - Custom drawer content (`@/components/CustomDrawerContent`)
- `NotificationBell` - Notification bell icon (`@/components/NotificationBell`)
- `NotificationList` - Notification list panel (`@/components/NotificationList`)
- `UserMenuTrigger` - User menu trigger (`@/components/UserMenuTrigger`)
- `DevOverlay` - Development overlay (`@/components/DevOverlay`)
- `OptimizedImage` - Optimized image loading (`@/components/OptimizedImage`)
- `OptimizedList` - Optimized list rendering (`@/components/OptimizedList`)
- `SeletorUnidade` - Unit selector (`@/components/SeletorUnidade`)
- `PerformanceSettings` - Performance settings (`@/components/PerformanceSettings`)

---

## Export Recommendations

### Priority 1: Add to @/design-system ✅ CONCLUÍDO (2025-12-30)
Components used in 5+ locations that should be exported:
- ~~`ErrorBoundary`~~ ✅
- ~~`AuthLoadingScreen`~~ ✅
- ~~`SwipeableRow`~~ ✅
- ~~`AddressAutocomplete`~~ ✅
- ~~`CameraUpload`~~ ✅

### Priority 2: Feature Sub-Exports ✅ CONCLUÍDO (2025-12-30)
Created sub-exports for feature modules:
```ts
// Available imports
import { Button, Card, Input } from '@/design-system';           // Base components
import { NavigationMode, ParadaCard } from '@/design-system/motorista';  // 20+ components
import { GestorSidebar, RouteFilters } from '@/design-system/gestor';    // 8 components
import { MapaRotas, MapaMobile } from '@/design-system/map';             // 7 components
```

**Files created:**
- `src/design-system/motorista.ts` - Navigation, stops, home components
- `src/design-system/gestor.ts` - Dashboard, sidebar, route components
- `src/design-system/map.ts` - Map adapters and markers

### Priority 3: Platform Variants ✅ DOCUMENTADO (2025-12-30)
Components with `.web.tsx` variants documented in `docs/design-system-platform-variations.md`:
- `MapaMobile` / `MapaMobile.web.tsx`
- `MapaRotas` / `MapaRotas.web.tsx`
- `MiniMap` / `MiniMap.web.tsx`
- `PictureInPictureMap` / `PictureInPictureMap.web.tsx`
- `NavigationMode` / `NavigationMode.web.tsx`
