# Matriz de Cobertura do Design System

## Objetivo
Mapear a cobertura total do design system (100% das telas, fluxos e componentes), com status e ownership por modulo.

## Status
- Done: migrado para tokens/DS e revisado.
- Review: migrado parcialmente ou sem revisao formal.
- Pending: ainda nao migrado para tokens/DS.
- N/A: infra/arquivo tecnico sem impacto visual direto.

## Telas e Fluxos
| Modulo | Tela/Arquivo | Status | Owner | Observacoes |
| --- | --- | --- | --- | --- |
| App | app/index.tsx | Done | Frontend | Usa theme.colors.*, theme.spacing.*, StyleSheet.create |
| App | app/_layout.tsx | N/A | Frontend | Infra de layout |
| App | app/+html.tsx | N/A | Frontend | Infra web |
| App | app/design-system.tsx | Done | Frontend | Showcase DS |
| Auth | app/auth/login.tsx | Done | Frontend | Wave 2 |
| Auth | app/auth/forgot-password.tsx | Done | Frontend | Wave 2 |
| Auth | app/auth/reset-password.tsx | Done | Frontend | Wave 2 |
| Auth | app/auth/register.tsx | Done | Frontend | Wave 2 |
| Auth | app/auth/forgot-password-simple.tsx | Done | Frontend | Wave 2 |
| Onboarding | app/onboarding/first-password.tsx | Done | Frontend | Wave 2 |
| Gestor | app/gestor/inicio.tsx | Done | Frontend + Design | Wave 3 |
| Gestor | app/gestor/gestao-rotas.tsx | Done | Frontend + Design | Wave 3 |
| Gestor | app/gestor/nova-entrega.tsx | Done | Frontend + Design | Wave 3 |
| Gestor | app/gestor/motoristas.tsx | Done | Frontend + Design | Wave 3 |
| Gestor | app/gestor/motorista-perfil.tsx | Done | Frontend + Design | Wave 3 |
| Gestor | app/gestor/incidentes.tsx | Done | Frontend + Design | Wave 1 |
| Gestor | app/gestor/mapa-rota.tsx | Done | Frontend + Design | Wave 3 |
| Motorista | app/motorista/(tabs)/_layout.tsx | Done | Frontend + Design | Wave 4 |
| Motorista | app/motorista/(tabs)/index.tsx | Done | Frontend + Design | Wave 4 |
| Motorista | app/motorista/(tabs)/paradas.tsx | Done | Frontend + Design | Wave 4 |
| Motorista | app/motorista/(tabs)/mapa.tsx | Done | Frontend + Design | Wave 4 |
| Motorista | app/motorista/(tabs)/historico.tsx | Done | Frontend + Design | Wave 4 |
| Motorista | app/motorista/_screens/inicio.tsx | Done | Frontend + Design | Wave 4 |
| Motorista | app/motorista/_screens/mapa.tsx | Done | Frontend + Design | Wave 4 |
| Motorista | app/motorista/_screens/checkpoints.tsx | Done | Frontend + Design | Wave 4 |
| Motorista | app/motorista/_screens/historico.tsx | Done | Frontend + Design | Wave 4 |
| Motorista | app/motorista/resumo.tsx | Done | Frontend + Design | Usa MobileButton, MobileCard, MobileLoading |
| Motorista | app/motorista/desempenho.tsx | Done | Frontend + Design | 20+ theme.colors.* references |
| Motorista | app/motorista/ajuda.tsx | Done | Frontend + Design | 20+ theme.colors.* references |
| Motorista | app/motorista/sos.tsx | Done | Frontend + Design | Wave 4 |
| Motorista | app/motorista/perfil/index.tsx | Done | Frontend + Design | Wave 4 |
| Motorista | app/motorista/perfil/editar.tsx | Done | Frontend + Design | Wave 4 |
| Motorista | app/motorista/perfil/configuracoes.tsx | Done | Frontend + Design | Wave 4 |
| Motorista | app/motorista/perfil/senha.tsx | Done | Frontend + Design | Wave 4 |
| Perfil | app/perfil/index.tsx | Done | Frontend + Design | Wave 4 |
| Perfil | app/perfil/editar.tsx | Done | Frontend + Design | Wave 4 |
| Perfil | app/perfil/trocar-senha.tsx | Done | Frontend + Design | Wave 4 |
| Unidade | app/unidade/index.tsx | Done | Frontend | Wave 6 |
| Unidade | app/unidade/equipe.tsx | Done | Frontend | Wave 6 |
| Unidade | app/unidade/transferir.tsx | Done | Frontend | Wave 6 |

## Componentes
### Base (Design System)
Status esperado: Done (migrado e exportado via `@/design-system`).

### Feature-level (amostra)
| Componente | Status | Owner | Observacoes |
| --- | --- | --- | --- |
| RouteFilters | Done | Frontend + Design | Wave 1 |
| SupportModal | Done | Frontend + Design | Wave 1 |
| NotificationList | Done | Frontend + Design | Wave 1 |
| PerformanceSettings | Done | Frontend + Design | Wave 1 |
| MapaWeb | Done | Frontend + Design | Wave 1 |
| StatsCard | Done | Frontend | Tokens de componente aplicados |
| RotasTable | Done | Frontend | Tokens de tabela aplicados |
| DashboardMobile | Done | Frontend | Wave 3 |
| DashboardDesktop | Done | Frontend | Wave 3 |

## Observacoes
- Atualizar esta matriz ao final de cada wave.
- Meta: 100% cobertura atingida (2025-12-31).
- Todas as telas usam tokens semanticos do design system.
