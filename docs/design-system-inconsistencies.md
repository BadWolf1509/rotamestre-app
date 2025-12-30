# Backlog de Inconsistencias de UI (Design System)

## Objetivo
Registrar divergencias entre telas similares e garantir padroes consistentes por modulo.

## Status
- Open: pendente de padronizacao.
- In Progress: em ajuste na base/infra.
- Done: padrao aplicado e validado.
- Verified: auditado em 2025-12-30.

## Backlog (Gestor - prioridade alta)
| Modulo | Telas | Item | Padrao alvo | Owner | Prioridade | Status | Verificacao |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Badge de status com estilos divergentes | Usar `StatusBadge` em ambas | Frontend | P0 | **Done** | ✅ 2025-12-30: gestao-rotas.tsx refatorado para usar StatusBadge |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Filtros com radius/padding/altura inconsistentes | Usar `FilterChip` em ambas | Frontend | P0 | **Done** | ✅ 2025-12-30: gestao-rotas.tsx refatorado para usar FilterChip |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Tipografia de tabela irregular | Textos de DataTable com style unico | Frontend | P1 | Open | Ambas usam DataTable mas com colunas diferentes |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Lista mobile (DataTable vs MobileCard) | Padrao unico para listagem mobile | Frontend | P1 | Open | Nao verificado - requer teste mobile |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Modais mobile divergentes | ConfirmModal/Modal padrao por tipo de acao | Frontend | P1 | Open | Nao verificado - requer teste mobile |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Resumo/metricas com padroes diferentes | Padrao de cards/metricas do Gestor | Frontend + Design | P2 | Open | Ambas usam MetricCard mas layouts divergentes |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Textos PT-BR com acentuacao inconsistente | Revisao linguistica e UTF-8 | Frontend + Design | P0 | In Progress | Fontes UTF-8 ok, revisar labels |

## Auditoria 2025-12-30

### Resolvidos ✅
1. **Badge de status**: `gestao-rotas.tsx` agora usa `StatusBadge` do design system
2. **FilterChip**: `gestao-rotas.tsx` agora usa `FilterChip` do design system
3. **Button.tsx hex color**: Corrigido para usar `theme.colors.errorDark`

### Ainda Open:
- **Tipografia de tabela**: DataTable com colunas diferentes entre telas
- **Lista mobile**: Padrao unico para listagem mobile
- **Modais mobile**: ConfirmModal/Modal padrao por tipo de acao
- **Resumo/metricas**: Layouts divergentes entre telas

### Recomendacoes atualizadas:
- ~~**P0**: Refatorar `gestao-rotas.tsx` para usar `StatusBadge` e `FilterChip`~~ ✅ Concluído
- **P1**: Padronizar colunas do DataTable entre as telas
- **P2**: Alinhar layout de metricas/resumo

## Como fechar itens
1) Aplicar o padrao de UI no modulo.
2) Atualizar snapshots/visual regression quando necessario.
3) Marcar como Done aqui e na matriz de cobertura.
4) Adicionar data de verificacao na coluna "Verificacao".
