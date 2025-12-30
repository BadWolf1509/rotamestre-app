# Design System Audit

Date: 2025-12-30 (Updated)
Previous: 2025-12-29

## Scope
Project: rotamestre-app (Expo / React Native Web)
Platforms: Web, iOS, Android

## Current State Summary (v2.0.0)

### Token Architecture ✅
- **Single Source of Truth**: `src/utils/styles.base.ts` (`defaultTheme`)
- **Derivations aligned**: All token files derive from `defaultTheme`
  - `src/lib/design-tokens.ts` - derives spacing, radius, shadows
  - `src/styles/theme.ts` - legacy wrapper (to be removed in Wave 6)
  - `src/unistyles.ts` - consumes base themes

### Theme Variants ✅
- Light/Dark themes
- High Contrast variants (`lightHighContrast`, `darkHighContrast`)
- Compact Density variants (`lightCompact`, `darkCompact`)

### Hex Color Report (2025-12-30)
Only 3 files contain hex colors:
1. `src/utils/styles.base.ts` - **Source of truth** (expected)
2. `app/design-system.tsx` - **Showcase only** (acceptable)
3. `src/components/Button.tsx` - **1 hex found** (#dc2626 - needs review)

## Migration Status

### Completed ✅
- Wave 1: High-impact components (RouteFilters, SupportModal, MapaWeb, etc.)
- Wave 2: Auth screens (login, forgot-password, reset-password)
- Wave 3: Gestor screens (gestao-rotas, motoristas, nova-entrega)
- Wave 4: Motorista screens (tabs, perfil, sos)
- Wave 5: Core components (DesktopModal, ResponsiveGrid, SwipeableRow)
- Wave 5b: Remaining screens (100% coverage achieved)
- Wave 6 (partial): Allowlist cleanup, ESLint rules

### In Progress
- Wave 6: Legacy removal (parcial - ver `design-system-migration.md`)
  - ✅ `src/styles/theme.ts` removido
  - ⏳ `src/lib/design-tokens.ts` ainda em uso por 7 arquivos
- UI inconsistencies between similar screens (see `design-system-inconsistencies.md`)

## Known Issues

### Button.tsx Hex Color ✅ RESOLVIDO
- File: `src/components/Button.tsx:163`
- Color: `#dc2626` (red) → Substituído por `theme.colors.errorDark`
- Token `errorDark` adicionado em `styles.types.ts` e `styles.base.ts`

### gestao-rotas.tsx ✅ RESOLVIDO
- Refatorado para usar `StatusBadge` e `FilterChip` do design system
- Estilos custom removidos (filtroButton*, statusBadge*)

### UI Inconsistencies (Open)
1. ~~`gestao-rotas.tsx` uses custom statusBadge styles~~ ✅ Resolvido (usa StatusBadge)
2. ~~`gestao-rotas.tsx` uses custom filter buttons~~ ✅ Resolvido (usa FilterChip)
3. DataTable columns differ between screens

See `docs/design-system-inconsistencies.md` for full backlog.

## Recommendations

### Immediate (P0) ✅ CONCLUÍDO
- [x] Fix Button.tsx hex color → `theme.colors.errorDark`
- [x] Refactor gestao-rotas.tsx to use StatusBadge and FilterChip

### Short-term (P1)
- [x] Complete Wave 6 legacy removal (parcial - `theme.ts` removido)
- [ ] Standardize DataTable columns across Gestor screens
- [ ] Add 5 high-use components to @/design-system exports
- [ ] Migrar componentes restantes de `@/lib/design-tokens` para `theme.*`

### Long-term (P2)
- [ ] Create feature-level sub-exports (@/design-system/motorista, etc.)
- [ ] Document platform-specific variants (.web.tsx pattern)
- [ ] Visual regression expansion for all themes

## Metrics

| Metric | 2025-12-29 | 2025-12-30 (Final) |
|--------|------------|------------|
| Coverage Matrix | ~90% Done | 100% Done |
| Files with hex colors | 1 | 1 (source only - Button.tsx corrigido) |
| Components exported | ~20 | 23 |
| UI inconsistencies | 7 Open | 5 Open (2 resolvidos) |
| Release notes | Empty | v2.0.0 documented |
| Legacy files | 2 | 1 (theme.ts removido) |
| P0 tasks | 2 Open | ✅ Concluído |

## Historical Hotspots (Resolved)

Resolved in Wave 1:
- `src/components/RouteFilters.tsx`
- `src/components/SupportModal.tsx`
- `src/components/NotificationList.tsx`
- `src/components/PerformanceSettings.tsx`
- `src/components/MapaWeb.tsx`
- `app/gestor/incidentes.tsx`

Additional cleanups (Waves 2-5):
- `src/components/AddressAutocomplete.tsx`
- `src/components/DataTable.tsx`
- `src/components/StreetViewPreview.tsx`
- `src/components/Toast.tsx`
- `src/components/gestor/mapa-rota/DraggableStopList/StopCard.tsx`
- `src/components/gestor/mapa-rota/ParadaCard.tsx`
- `src/components/motorista/ParadaBottomSheet.tsx`
- `src/components/motorista/home/ExpiredRouteCard.tsx`
- `src/components/motorista/home/MiniMap.tsx`
