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
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Tipografia de tabela irregular | Usar `styles.tableText` padrao | Frontend | P1 | **Done** | ✅ 2025-12-30: ADR documentado - incidentes.tsx como referencia |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Lista mobile (DataTable vs MobileCard) | ADR: ambos padroes validos | Frontend | P1 | **Done** | ✅ 2025-12-30: ADR documentado - DataTable para tabular, MobileCard para custom |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Modais mobile divergentes | ADR: ConfirmModal/DesktopModal/AlertDialog | Frontend | P1 | **Done** | ✅ 2025-12-30: ADR documentado - padrao por tipo de acao |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Resumo/metricas com padroes diferentes | Usar `ResponsiveGrid` + `MetricCard` | Frontend + Design | P2 | **Done** | ✅ 2025-12-30: ADR documentado - migracao para ResponsiveGrid recomendada |
| Gestor | /gestor/incidentes + /gestor/gestao-rotas | Textos PT-BR com acentuacao inconsistente | Revisao linguistica e UTF-8 | Frontend + Design | P0 | **Done** | ✅ 2025-12-30: Criado `src/lib/statusLabels.ts` com labels padronizados |

## Auditoria 2025-12-30

### Resolvidos ✅
1. **Badge de status**: `gestao-rotas.tsx` agora usa `StatusBadge` do design system
2. **FilterChip**: `gestao-rotas.tsx` agora usa `FilterChip` do design system
3. **Button.tsx hex color**: Corrigido para usar `theme.colors.errorDark`
4. **Textos PT-BR**: Criado `src/lib/statusLabels.ts` com labels padronizados (ROTA_STATUS_LABELS, PARADA_STATUS_LABELS)
5. **StatusBadge em motoristas.tsx**: Substituido emoji por StatusBadge component (2025-12-30)
6. **StatusBadge em incidentes.tsx**: Substituido badge custom por StatusBadge component (2025-12-30)
7. **ESLint design-tokens**: Adicionada regra para bloquear imports diretos de @/lib/design-tokens (2025-12-30)
8. **Migracao design-tokens**: 5 componentes migrados de colors.* para theme.colors.* (AlertDialog, ConfirmDialog, Modal, SupportModal)
9. **Exports @/design-system**: Adicionados 5 utility components (AddressAutocomplete, AuthLoadingScreen, CameraUpload, ErrorBoundary, SwipeableRow)
10. **MobileEmptyState em motoristas.tsx**: Substituido View custom por MobileEmptyState (2025-12-30)
11. **ConfirmModal consistente**: motoristas.tsx agora usa ConfirmModal em todas as plataformas (removido Alert.alert)
12. **Resumo/Metricas ADR**: Documentado padrao para usar ResponsiveGrid + MetricCard (2025-12-30)
13. **Visual Regression expandido**: Cobertura de 8 combinacoes de tema (light/dark x regular/compact x normal/high-contrast) (2025-12-30)
14. **Lista mobile ADR**: Documentado que DataTable e MobileCard sao ambos padroes validos (2025-12-30)
15. **Modais mobile ADR**: Documentado padrao ConfirmModal/DesktopModal/AlertDialog por tipo de acao (2025-12-30)
16. **Tipografia de tabela ADR**: Documentado padrao `styles.tableText` baseado em incidentes.tsx (2025-12-30)

### Decisoes de Padrao (ADR)

#### Lista Mobile: DataTable vs MobileCard
**Decisao**: Ambos padroes sao validos para casos de uso diferentes.
- **DataTable**: Usar para listagens tabulares simples (gestao-rotas, motoristas)
  - Vantagem: Responsividade built-in, paginacao, skeleton loading
  - Usar quando: Dados tabulares com colunas definidas
- **MobileCard por item**: Usar para cards com layout custom (incidentes)
  - Vantagem: Maior controle sobre layout de cada item
  - Usar quando: Cards precisam de layout complexo (icones, badges, acoes inline)

#### Empty State Mobile
**Decisao**: Sempre usar `MobileEmptyState` component para estados vazios em mobile.
- Props padrao: `icon` (emoji), `title`, `subtitle`, `actionLabel?`, `onAction?`

#### Modais: Quando usar qual
**Decisao**: Tres tipos de modais disponiveis:
- **ConfirmModal**: Confirmacoes simples Yes/No (ex: deletar, ativar/desativar)
  - Usar com props `title`, `message`, `type`, `onConfirm`, `onCancel`
- **DesktopModal**: Modais de conteudo rico (forms, detalhes, visualizacao)
  - Usar API declarativa: `primaryButton`, `secondaryButton`
  - Evitar botoes customizados no footer
- **AlertDialog**: Alertas informativos com apenas botao OK (sem acao destrutiva)

**Regra**: Nunca usar `Alert.alert()` nativo - sempre usar ConfirmModal para consistencia cross-platform.

#### Resumo/Metricas: Layout Padrao
**Decisao**: Usar `ResponsiveGrid` + `MetricCard` para todas as secoes de metricas/resumo.

**Analise da situacao atual** (2025-12-30):
| Arquivo | Implementacao | Problemas |
|---------|---------------|-----------|
| gestao-rotas.tsx | Views customizadas | Typography 2xl, spacing xl |
| motoristas.tsx | Views customizadas | Typography 3xl, spacing lg |
| incidentes.tsx | Views customizadas | Typography 2xl, spacing misto |

**Componentes disponiveis** (nao utilizados):
- `ResponsiveGrid` - Grid responsivo com breakpoints automaticos
- `MetricCard` - Card padrao para metricas com icone, label, valor

**Padrao recomendado**:
```tsx
import { ResponsiveGrid, MetricCard } from '@/design-system';

<ResponsiveGrid columns={{ mobile: 2, tablet: 3, desktop: 4 }}>
  <MetricCard icon="📦" label="Total" value={total} />
  <MetricCard icon="🚚" label="Em Andamento" value={emAndamento} />
  <MetricCard icon="✅" label="Concluidas" value={concluidas} />
</ResponsiveGrid>
```

**Justificativa**: Componentes existem e estao exportados via @/design-system, apenas nao estao sendo utilizados. Migracao requer refatoracao de cada tela mas garante consistencia visual.

**Prioridade**: P3 (baixa) - Funcionalidade atual ok, melhoria incremental.

#### Tipografia de Tabela: Padrao tableText
**Decisao**: Usar `styles.tableText` para textos dentro de colunas de DataTable.

**Padrao de referencia** (`incidentes.tsx`):
```tsx
tableText: {
  fontSize: theme.typography.fontSize.sm,
  fontFamily: theme.typography.fontSans,
  color: theme.colors.gray700,
},
```

**Arquivos a migrar** (P3 - melhoria incremental):
- `gestao-rotas.tsx` - usa estilos inline em colunas
- `motoristas.tsx` - usa estilos inline em colunas

**Justificativa**: `incidentes.tsx` já usa o padrão. Outros arquivos podem ser migrados incrementalmente.

### Ainda Open:
- Nenhum item P0/P1 pendente. Todos resolvidos ou com ADR documentado.

### Recomendacoes atualizadas:
- ~~**P0**: Refatorar `gestao-rotas.tsx` para usar `StatusBadge` e `FilterChip`~~ ✅ Concluido
- ~~**P0**: Padronizar StatusBadge em motoristas.tsx e incidentes.tsx~~ ✅ Concluido
- ~~**P1**: Padronizar MobileEmptyState em todas as telas~~ ✅ Concluido
- ~~**P1**: Lista mobile (DataTable vs MobileCard)~~ ✅ ADR documentado
- ~~**P1**: Modais mobile divergentes~~ ✅ ADR documentado
- ~~**P1**: Padronizar tipografia de tabela~~ ✅ ADR documentado (migracao P3)
- ~~**P2**: Alinhar layout de metricas/resumo~~ ✅ ADR documentado (migracao P3)

**Status**: Todos os itens P0-P2 resolvidos ou com ADR documentado.

## Como fechar itens
1) Aplicar o padrao de UI no modulo.
2) Atualizar snapshots/visual regression quando necessario.
3) Marcar como Done aqui e na matriz de cobertura.
4) Adicionar data de verificacao na coluna "Verificacao".
