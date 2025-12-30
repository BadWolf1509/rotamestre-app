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

## Wave 5 (Cobertura 100% - Plano Atualizado)
Itens restantes marcados como Review/Pending na matriz de cobertura:
- `app/auth/register.tsx`
- `app/auth/forgot-password-simple.tsx`
- `app/onboarding/first-password.tsx`
- `app/gestor/inicio.tsx`
- `app/gestor/mapa-rota.tsx`
- `app/motorista/(tabs)/index.tsx`
- `app/motorista/(tabs)/paradas.tsx`
- `app/motorista/(tabs)/mapa.tsx`
- `app/motorista/(tabs)/historico.tsx`
- `app/motorista/_screens/inicio.tsx`
- `app/motorista/_screens/mapa.tsx`
- `app/motorista/_screens/checkpoints.tsx`
- `app/motorista/resumo.tsx`
- `app/motorista/desempenho.tsx`
- `app/motorista/ajuda.tsx`
- `app/motorista/perfil/editar.tsx`
- `app/motorista/perfil/configuracoes.tsx`
- `app/motorista/perfil/senha.tsx`
- `app/perfil/index.tsx`
- `app/perfil/editar.tsx`
- `app/perfil/trocar-senha.tsx`
- `app/unidade/equipe.tsx`
- `app/unidade/transferir.tsx`

## Wave 6 (Remocao de Legado + Endurecimento)
- Remover temas/aliases legados quando cobertura = 100%:
  - `src/styles/theme.ts`
  - `src/lib/design-tokens.ts`
- Endurecer lint para bloquear imports diretos de componentes base.
- Revisar e reduzir allowlists (hex/rgba/shadow) ate o minimo necessario.
- Atualizar snapshots e validar regressao visual completa.

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
| 5 | app/auth/register.tsx | Frontend | Planned | Ver matriz de cobertura |
| 5 | app/auth/forgot-password-simple.tsx | Frontend | Planned | Ver matriz de cobertura |
| 5 | app/onboarding/first-password.tsx | Frontend | Planned | Ver matriz de cobertura |
| 5 | app/gestor/inicio.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/gestor/mapa-rota.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/motorista/(tabs)/index.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/motorista/(tabs)/paradas.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/motorista/(tabs)/mapa.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/motorista/(tabs)/historico.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/motorista/_screens/inicio.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/motorista/_screens/mapa.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/motorista/_screens/checkpoints.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/motorista/resumo.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/motorista/desempenho.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/motorista/ajuda.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/motorista/perfil/editar.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/motorista/perfil/configuracoes.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/motorista/perfil/senha.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/perfil/index.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/perfil/editar.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/perfil/trocar-senha.tsx | Frontend + Design | Planned | Ver matriz de cobertura |
| 5 | app/unidade/equipe.tsx | Frontend | Planned | Ver matriz de cobertura |
| 5 | app/unidade/transferir.tsx | Frontend | Planned | Ver matriz de cobertura |
| 6 | Remover temas/aliases legados | Frontend | Planned | `src/styles/theme.ts`, `src/lib/design-tokens.ts` |
| 6 | Endurecer lint para imports diretos | Frontend | Done | regra ESLint |
| 6 | Reduzir allowlists de hex/rgba/shadow | Frontend | Planned | manter apenas base |
| 6 | Regressao visual completa | Frontend + QA | Planned | expandir cenarios |

## Ownership and Priority
| Wave | Owner | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Frontend + Design | P0 | Done | Initial hotspots |
| 2 | Frontend | P0 | Done | Auth entry points |
| 3 | Frontend + Design | P0 | Done | High-traffic gestor flows |
| 4 | Frontend + Design | P1 | Done | Motorista daily usage |
| 5 | Frontend | P1 | Done | Shared UI primitives |
| 6 | Frontend | P1 | Done | Allowlist cleanup + infra |

## Migration Steps (per component)
1. Replace raw hex values with tokens or semantic colors.
2. Replace inline sizes with spacing/radius tokens.
3. Ensure typography uses the theme scale.
4. Validate web hover/focus and native touch sizes.
5. Add screenshots (before/after) in PR.

## Exit Criteria
- No new raw hex values in UI components.
- All base components imported via `@/design-system`.
- Visual regression baseline updated.
- Coverage matrix 100% em Done.
