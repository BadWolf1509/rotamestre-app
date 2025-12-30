# Backlog de Inconsistencias de UI (Design System)

## Objetivo
Registrar divergencias entre telas similares e garantir padroes consistentes por modulo.

## Status
- Open: pendente de padronizacao.
- In Progress: em ajuste na base/infra.
- Done: padrao aplicado e validado.

## Backlog (Gestor - prioridade alta)
| Modulo | Telas | Item | Padrao alvo | Owner | Prioridade | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Badge de status com estilos divergentes | Badge "soft" com cor, borda e texto alinhados a tokens | Frontend | P0 | Open |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Filtros com radius/padding/altura inconsistentes | Filter chip padrao (padding/radius/minHeight) | Frontend | P0 | Open |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Tipografia de tabela irregular | Textos de DataTable com style unico | Frontend | P1 | Open |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Lista mobile (DataTable vs MobileCard) | Padrao unico para listagem mobile | Frontend | P1 | Open |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Modais mobile divergentes | ConfirmModal/Modal padrao por tipo de acao | Frontend | P1 | Open |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Resumo/metricas com padroes diferentes | Padrao de cards/metricas do Gestor | Frontend + Design | P2 | Open |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Textos PT-BR com acentuacao inconsistente | Revisao linguistica e UTF-8 | Frontend + Design | P0 | Open |

## Como fechar itens
1) Aplicar o padrao de UI no modulo.
2) Atualizar snapshots/visual regression quando necessario.
3) Marcar como Done aqui e na matriz de cobertura.
