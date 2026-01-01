# Design System Migration Plan

## Goals
- Reduce token drift and raw hex usage.
- Standardize typography and spacing across platforms.
- Move shared UI to the design system entry point.

## Coverage Matrix
- Full coverage tracking: `docs/design-system-coverage.md`.
- Use the matrix to drive Wave 5/6 (100% coverage + legacy removal).

## Wave 1 (Completed)
High-impact components with many hardcoded colors:
- `src/components/RouteFilters.tsx`
- `src/components/SupportModal.tsx`
- `src/components/NotificationList.tsx`
- `src/components/PerformanceSettings.tsx`
- `src/components/MapaWeb.tsx`
- `app/gestor/incidentes.tsx`

## Source of Truth
- Hex hotspots tracked in `docs/design-system-hex-report.md`.
- Temporary exceptions tracked in `eslint.config.js` under `hexColorAllowlist`.

## Wave 2 (Auth)
- `app/auth/forgot-password.tsx`
- `app/auth/login.tsx`
- `app/auth/reset-password.tsx`

## Wave 3 (Gestor)
- `app/gestor/gestao-rotas.tsx`
- `app/gestor/motorista-perfil.tsx`
- `app/gestor/motoristas.tsx`
- `app/gestor/nova-entrega.tsx`

## Wave 4 (Motorista)
- `app/motorista/_screens/historico.tsx`
- `app/motorista/(tabs)/_layout.tsx`
- `app/motorista/perfil/index.tsx`
- `app/motorista/sos.tsx`

## Wave 5 (Core Components)
- `src/components/desktop/DesktopModal.tsx`
- `src/components/map/infoWindowBuilders.ts`
- `src/components/gestor/ResponsiveGrid.tsx`
- `src/components/motorista/home/StatusSection.tsx`
- `src/components/motorista/home/MainCard.tsx`
- `src/components/NotificationBell.tsx`
- `src/components/OptimizedImage.tsx`
- `src/components/OptimizedList.tsx`
- `src/components/SwipeableRow.tsx`

## Wave 6 (Allowlist Cleanup + Infra)
- `app/unidade/index.tsx`
- `src/components/DevOverlay.tsx`
- `src/components/DrawerMenu.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/components/RouteControlPanel.tsx`
- `src/components/gestor/dashboard/_components/desktop/RotasTable.tsx`
- `src/components/gestor/mapa-rota/MapaRotaSkeleton.tsx`
- `src/components/gestor/mapa-rota/ParadaCardCompact.tsx`
- `src/components/gestor/nova-entrega/ParadasListAndActions.tsx`
- `src/components/MapaRN.tsx`
- `src/components/motorista/PictureInPictureMap.tsx`
- `src/components/motorista/PictureInPictureMap.web.tsx`
- `src/components/MotoristaMarker.tsx`
- `src/config/devtools.ts`
- `src/context/NotificationModalContext.tsx`
- `src/hooks/useRealtimeRoutes.ts`
- `src/lib/notifications.ts`
- `src/services/unifiedLocationTracking.ts`

## Wave 5b (Telas Restantes) - COMPLETED
Todas as telas listadas abaixo foram verificadas e estão usando tokens do DS:
- `app/auth/register.tsx` ✅
- `app/auth/forgot-password-simple.tsx` ✅
- `app/onboarding/first-password.tsx` ✅
- `app/gestor/inicio.tsx` ✅
- `app/gestor/mapa-rota.tsx` ✅
- `app/motorista/(tabs)/index.tsx` ✅ (re-export)
- `app/motorista/(tabs)/paradas.tsx` ✅ (re-export)
- `app/motorista/(tabs)/mapa.tsx` ✅ (re-export)
- `app/motorista/(tabs)/historico.tsx` ✅ (re-export)
- `app/motorista/_screens/inicio.tsx` ✅
- `app/motorista/_screens/mapa.tsx` ✅
- `app/motorista/_screens/checkpoints.tsx` ✅
- `app/motorista/resumo.tsx` ✅
- `app/motorista/desempenho.tsx` ✅
- `app/motorista/ajuda.tsx` ✅
- `app/motorista/perfil/editar.tsx` ✅
- `app/motorista/perfil/configuracoes.tsx` ✅
- `app/motorista/perfil/senha.tsx` ✅
- `app/perfil/index.tsx` ✅
- `app/perfil/editar.tsx` ✅
- `app/perfil/trocar-senha.tsx` ✅
- `app/unidade/equipe.tsx` ✅
- `app/unidade/transferir.tsx` ✅

## Wave 6 (Remocao de Legado + Endurecimento) - COMPLETO ✅
Status: **Completo** (2025-12-31)

### Concluído ✅
- `src/styles/theme.ts` removido (não era mais utilizado)
- `gestao-rotas.tsx` refatorado para usar `StatusBadge` e `FilterChip`
- `Button.tsx` hex color corrigido → usa `theme.colors.errorDark`
- `src/lib/design-tokens.ts` agora interno via `@/design-system/tokens`
- ESLint endurecido para bloquear imports diretos de `@/lib/design-tokens`
- Componentes migrados: AlertDialog, ConfirmDialog, Modal, SupportModal
- Visual regression expandida para 8 combinacoes de tema
- Feature sub-exports criados: `motorista.ts`, `gestor.ts`, `map.ts`

### Allowlist Final (Minimo Necessario)
- `src/utils/styles.base.ts` - Source of truth (esperado)
- `app/design-system.tsx` - Showcase page (esperado)

## Backlog detalhado (por wave)
| Wave | Item | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | src/components/RouteFilters.tsx | Frontend + Design | Done | Tokens semanticos |
| 1 | src/components/SupportModal.tsx | Frontend + Design | Done | Modal base |
| 1 | src/components/NotificationList.tsx | Frontend + Design | Done | Lista de alertas |
| 1 | src/components/PerformanceSettings.tsx | Frontend + Design | Done | Preferencias |
| 1 | src/components/MapaWeb.tsx | Frontend + Design | Done | Tokens e sombras |
| 1 | app/gestor/incidentes.tsx | Frontend + Design | Done | Fluxo gestor |
| 2 | app/auth/forgot-password.tsx | Frontend | Done | Auth reset |
| 2 | app/auth/login.tsx | Frontend | Done | Auth login |
| 2 | app/auth/reset-password.tsx | Frontend | Done | Auth reset |
| 3 | app/gestor/gestao-rotas.tsx | Frontend + Design | Done | Gestao de rotas |
| 3 | app/gestor/motorista-perfil.tsx | Frontend + Design | Done | Perfil motorista |
| 3 | app/gestor/motoristas.tsx | Frontend + Design | Done | Lista motoristas |
| 3 | app/gestor/nova-entrega.tsx | Frontend + Design | Done | Criacao rota |
| 4 | app/motorista/_screens/historico.tsx | Frontend + Design | Done | Historico |
| 4 | app/motorista/(tabs)/_layout.tsx | Frontend + Design | Done | Tabs motorista |
| 4 | app/motorista/perfil/index.tsx | Frontend + Design | Done | Perfil motorista |
| 4 | app/motorista/sos.tsx | Frontend + Design | Done | SOS |
| 5 | src/components/desktop/DesktopModal.tsx | Frontend | Done | Modal desktop |
| 5 | src/components/map/infoWindowBuilders.ts | Frontend | Done | InfoWindow |
| 5 | src/components/gestor/ResponsiveGrid.tsx | Frontend | Done | Grid |
| 5 | src/components/motorista/home/StatusSection.tsx | Frontend | Done | Status |
| 5 | src/components/motorista/home/MainCard.tsx | Frontend | Done | Card principal |
| 5 | src/components/NotificationBell.tsx | Frontend | Done | Sino |
| 5 | src/components/OptimizedImage.tsx | Frontend | Done | Imagens |
| 5 | src/components/OptimizedList.tsx | Frontend | Done | Lista otimizada |
| 5 | src/components/SwipeableRow.tsx | Frontend | Done | Swipe |
| 6 | app/unidade/index.tsx | Frontend | Done | Unidade |
| 6 | src/components/DevOverlay.tsx | Frontend | Done | Debug UI |
| 6 | src/components/DrawerMenu.tsx | Frontend | Done | Drawer |
| 6 | src/components/ErrorBoundary.tsx | Frontend | Done | Erros |
| 6 | src/components/RouteControlPanel.tsx | Frontend | Done | Controles rota |
| 6 | src/components/gestor/dashboard/_components/desktop/RotasTable.tsx | Frontend | Done | Tabela rotas |
| 6 | src/components/gestor/mapa-rota/MapaRotaSkeleton.tsx | Frontend | Done | Skeleton mapa |
| 6 | src/components/gestor/mapa-rota/ParadaCardCompact.tsx | Frontend | Done | Parada compacta |
| 6 | src/components/gestor/nova-entrega/ParadasListAndActions.tsx | Frontend | Done | Lista paradas |
| 6 | src/components/MapaRN.tsx | Frontend | Done | Mapa RN |
| 6 | src/components/motorista/PictureInPictureMap.tsx | Frontend | Done | PiP mobile |
| 6 | src/components/motorista/PictureInPictureMap.web.tsx | Frontend | Done | PiP web |
| 6 | src/components/MotoristaMarker.tsx | Frontend | Done | Marker motorista |
| 6 | src/config/devtools.ts | Frontend | Done | Devtools |
| 6 | src/context/NotificationModalContext.tsx | Frontend | Done | Modal notif |
| 6 | src/hooks/useRealtimeRoutes.ts | Frontend | Done | Realtime |
| 6 | src/lib/notifications.ts | Frontend | Done | Notificacoes |
| 6 | src/services/unifiedLocationTracking.ts | Frontend | Done | Tracking |
| 5b | app/auth/register.tsx | Frontend | Done | Verificado: usa DS |
| 5b | app/auth/forgot-password-simple.tsx | Frontend | Done | Verificado: usa DS |
| 5b | app/onboarding/first-password.tsx | Frontend | Done | Verificado: usa DS |
| 5b | app/gestor/inicio.tsx | Frontend + Design | Done | Verificado: wrapper DashboardDesktop/Mobile |
| 5b | app/gestor/mapa-rota.tsx | Frontend + Design | Done | Verificado: usa theme.colors |
| 5b | app/motorista/(tabs)/index.tsx | Frontend + Design | Done | Re-export de _screens/inicio |
| 5b | app/motorista/(tabs)/paradas.tsx | Frontend + Design | Done | Re-export de _screens/checkpoints |
| 5b | app/motorista/(tabs)/mapa.tsx | Frontend + Design | Done | Re-export de _screens/mapa |
| 5b | app/motorista/(tabs)/historico.tsx | Frontend + Design | Done | Re-export de _screens/historico |
| 5b | app/motorista/_screens/inicio.tsx | Frontend + Design | Done | Verificado: 10+ theme.colors |
| 5b | app/motorista/_screens/mapa.tsx | Frontend + Design | Done | Verificado: usa DS |
| 5b | app/motorista/_screens/checkpoints.tsx | Frontend + Design | Done | Verificado: usa DS |
| 5b | app/motorista/resumo.tsx | Frontend + Design | Done | Usa MobileButton, MobileCard |
| 5b | app/motorista/desempenho.tsx | Frontend + Design | Done | 20+ theme.colors |
| 5b | app/motorista/ajuda.tsx | Frontend + Design | Done | 20+ theme.colors |
| 5b | app/motorista/perfil/editar.tsx | Frontend + Design | Done | Verificado: usa DS |
| 5b | app/motorista/perfil/configuracoes.tsx | Frontend + Design | Done | Verificado: usa DS |
| 5b | app/motorista/perfil/senha.tsx | Frontend + Design | Done | Verificado: usa DS |
| 5b | app/perfil/index.tsx | Frontend + Design | Done | Usa DesktopPageLayout |
| 5b | app/perfil/editar.tsx | Frontend + Design | Done | Verificado: usa DS |
| 5b | app/perfil/trocar-senha.tsx | Frontend + Design | Done | Verificado: usa DS |
| 5b | app/unidade/equipe.tsx | Frontend | Done | Verificado: usa DS |
| 5b | app/unidade/transferir.tsx | Frontend | Done | Verificado: usa DS |
| 6 | Remover temas/aliases legados | Frontend | Done | `theme.ts` removido, `design-tokens` interno |
| 6 | Endurecer lint para imports diretos | Frontend | Done | regra ESLint |
| 6 | Reduzir allowlists de hex/rgba/shadow | Frontend | Done | apenas base + showcase |
| 6 | Regressao visual completa | Frontend + QA | Done | 8 combinacoes de tema |

## Ownership and Priority
| Wave | Owner | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Frontend + Design | P0 | Done | Initial hotspots |
| 2 | Frontend | P0 | Done | Auth entry points |
| 3 | Frontend + Design | P0 | Done | High-traffic gestor flows |
| 4 | Frontend + Design | P1 | Done | Motorista daily usage |
| 5 | Frontend | P1 | Done | Shared UI primitives (core components) |
| 5b | Frontend + Design | P1 | Done | Telas restantes (100% cobertura) |
| 6 | Frontend | P1 | Done | Allowlist cleanup + legacy removal |

## Migration Steps (per component)
1. Replace raw hex values with tokens or semantic colors.
2. Replace inline sizes with spacing/radius tokens.
3. Ensure typography uses the theme scale.
4. Validate web hover/focus and native touch sizes.
5. Add screenshots (before/after) in PR.

## Exit Criteria ✅ ATINGIDOS (2025-12-31)
- ✅ No new raw hex values in UI components
- ✅ All base components imported via `@/design-system`
- ✅ Visual regression baseline updated (8 temas)
- ✅ Coverage matrix 100% em Done
- ✅ Feature sub-exports criados (motorista, gestor, map)
- ✅ Platform variations documentadas
