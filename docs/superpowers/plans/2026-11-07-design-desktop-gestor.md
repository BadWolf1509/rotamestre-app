# Design do desktop do gestor — Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development. Os passos usam checkbox (`- [ ]`).

**Objetivo:** aplicar a revisão de design do desktop do gestor com a Início em linhas de paradas, status e chips unificados, a ação destrutiva em menu, tabelas na largura do cartão, Viga e contraste, laranja só para atenção e textos sem abreviação nem "(s)".

**Arquitetura:** a mudança acontece nos componentes compartilhados, para valer em todas as telas de uma vez:

- `statusConfig` e `StatusBadge`;
- `FilterChip`;
- `DataTable`;
- `DesktopPageLayout`;
- `Sidebar`.

A Início desktop ganha dois componentes novos, `ResumoDoDia` e `LinhaDeParadas`, alimentados por `useDashboardData`, que passa a expor o status de cada parada em ordem.

**Stack:** React Native + Expo (web), Unistyles (`StyleSheet.create((theme) => …)`, `theme.colors.*`), Jest + `@testing-library/react-native` e Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-11-07-design-desktop-gestor-design.md`

## Restrições globais

- Nada de hex inline em componente: use `theme.colors.*` (`npm run verify:design-system`).
- A fonte de títulos é `theme.typography.fontDisplay` (Viga, peso 400). O corpo usa `fontSans*` com pesos 400, 600 e 700.
- No desktop do gestor, nenhum texto de dados fica abaixo de 13 px, e nenhum texto usa `gray400` (2,5:1). O mínimo para texto é `gray500` (#6b7280, 4,8:1).
- Toda cor de status vem de `ROUTE_STATUS_CONFIG`/`STOP_STATUS_CONFIG` (`src/constants/statusConfig.ts`) ou, no caso dos incidentes, de `createStatusLabels` (`src/hooks/incidentes-gestor/constants.ts`). O significado das cores não muda.
- Plural sempre pelo helper `plural(n, singular, pluralForma)` (Tarefa 5). "(s)" no texto está proibido.
- Os textos ficam em PT-BR e com inicial maiúscula só na primeira palavra ("Nova rota", "Ver detalhes").
- As regras do `CLAUDE.md` continuam valendo:
  - nenhum componente é declarado dentro do render de outro;
  - `logger.warn` aceita no máximo 2 argumentos;
  - `as any` fica proibido;
  - toda tela continua com seu `ErrorBoundary`.
- Aviso novo no console derruba o teste (`jest.mocks/consoleAvisos.js`). Corrija a causa.
- `npm run lint` roda no repositório inteiro com `--max-warnings=0`, e `npx tsc --noEmit` precisa sair com 0.
- **Regressão visual:** não atualize o baseline localmente, porque o Windows diverge. O baseline do CI (`visual-gestor-dashboard`, `visual-gestor-gestao-rotas`) vai ser atualizado pelo workflow, fora destas tarefas.
- **Sem acesso ao banco.** Nenhuma tarefa escreve no banco nem publica nada.

## Foco da revisão

1. **Rota sem parada real:** só partida e chegada, total 0. A linha de paradas mostra "Sem paradas", sem divisão por zero e sem linha vazia. Isso vai para a Tarefa 4.
2. **Rota com 40 paradas:** a linha mostra 24 pontos e "+16", sem estourar a largura. Também vai para a Tarefa 4.
3. **Nome de motorista longo** (60 caracteres): numa célula do `DataTable` desktop ele aparece numa linha só, com reticências, e o nome completo fica no `accessibilityLabel`. Vai para a Tarefa 2.
4. **Teclado no menu "⋯":** ele abre com Enter, fecha com Esc, e a escolha "Excluir" ainda passa pelo `Dialog` de confirmação que existe hoje. Vai para a Tarefa 2.
5. **Clique em ação dentro da linha clicável:** clicar em "Ver detalhes" ou no "⋯" não dispara também o `onRowPress`. Vai para a Tarefa 2.

---

### Tarefa 1: status e chips com uma só linguagem

**Arquivos:**

- Modificar `src/design-system/renderers/DataTableRenderers.tsx` (`StatusCell`). Ele passa a usar `ROUTE_STATUS_CONFIG`/`STOP_STATUS_CONFIG` e `StatusBadge` suave, e os mapas `statusLabels`/`statusColorKeys` locais são apagados.
- Modificar `src/components/StatusBadge.tsx`:
  - nova prop opcional `icon?: IconName`;
  - texto em uma linha (`numberOfLines={1}`), sem quebrar;
  - fonte `fontSansSemiBold`, tamanho 13 em `size="small"` e 14 no normal.
- Modificar `src/components/route-filters/StatusFilterSection.tsx`. Ele passa a renderizar `FilterChip`, com rótulos vindos de `ROUTE_STATUS_CONFIG` mais "Todos", e os Pressables de borda colorida são apagados.
- Modificar `src/components/gestor/mapa-rota/ParadaCardCompact.tsx`. Ele passa a usar `STOP_STATUS_CONFIG` (rótulos "Concluída", "Em andamento", "Pendente", "Pulada") e `StatusBadge`, e o objeto local `statusConfig` é apagado.
- Modificar `app/gestor/gestao-rotas.tsx`, na coluna Status: `StatusBadge` com `variant="soft"` e `icon` da config.
- Modificar `app/gestor/motoristas.tsx`: o status "Inativo" passa a usar `gray600`.
- Modificar `app/gestor/incidentes.tsx`: status e cartões, com os cartões de fundo neutro e a cor só no número.
- Atualizar os testes:
  - `src/design-system/__tests__/DataTableRenderers.test.tsx`;
  - `src/components/__tests__/StatusBadge.test.tsx`;
  - `src/components/route-filters/__tests__/StatusFilterSection.test.tsx`;
  - `src/components/gestor/mapa-rota/__tests__/ParadaCardCompact.test.tsx`;
  - o teste dos motoristas, se ele fixar a cor.

**Interfaces:**

- **Produz:** `StatusBadge` com props `{ label: string; color: string; variant?: 'soft'|'solid'; size?: 'small'|'normal'; icon?: IconName; … }`.
- **Produz:** `StatusCell({ status })`, que resolve o rótulo e a cor pela config central.

- [ ] **Passo 1: testes que falham.**
  - `StatusCell` com `status="nao_executada"` mostra "Não executada", com o rótulo de `ROUTE_STATUS_CONFIG`.
  - `ParadaCardCompact` com status `pendente` mostra "Pendente" e com `concluida` mostra "Concluída". `queryByText('Pend')` e `queryByText('OK')` devem ser nulos.
  - `StatusFilterSection` renderiza chips com `accessibilityRole="button"` e `accessibilityState.selected` no chip ativo. Os rótulos são "Todos", "Pendente", "Em andamento", "Concluída" e "Cancelada".
  - `StatusBadge` com `icon="checkmark-circle"` renderiza o ícone, e o `Text` tem `numberOfLines={1}`.
- [ ] **Passo 2: rodar e ver falhar.** Comando: `npx jest src/design-system src/components/__tests__/StatusBadge.test.tsx src/components/route-filters src/components/gestor/mapa-rota`. Esperado: FAIL nos casos novos.
- [ ] **Passo 3: implementar** conforme a lista de arquivos.
- [ ] **Passo 4: rodar de novo.** Os testes do passo 2 passam, e `npx jest app/gestor src/components` também.
- [ ] **Passo 5: commit** com a mensagem `refactor(gestor): status e chips de filtro com uma só linguagem`.

### Tarefa 2: `DataTable` na largura do cartão, linha clicável e menu de ações

**Arquivos:**

- Criar `src/components/data-table/MenuDeAcoes.tsx`. É o botão "⋯" (`accessibilityLabel="Mais ações"`), que abre uma lista sobreposta ancorada ao botão, com fechamento por Esc no web e por toque fora.
- Modificar `src/components/data-table/types.ts`:
  - `DataTableProps.onRowPress?: (item: T) => void`;
  - `DataTableColumn.width` continua como base, mas a coluna passa a crescer proporcionalmente (`flexGrow: width`, `flexBasis: width`).
- Modificar `src/components/data-table/DataTableDesktopView.tsx`:
  - as colunas preenchem a largura;
  - as células de texto ficam em uma linha, com reticências (`numberOfLines={1}`) e o texto completo no `accessibilityLabel`;
  - texto de célula com 14 px e cabeçalho com 13 px em `gray600`, `fontSansSemiBold`;
  - as ações com `type: 'danger'` vão para o `MenuDeAcoes`, e as outras continuam como botão;
  - a linha inteira vira `Pressable` quando existe `onRowPress`, e a ação ou o menu param a propagação.
- Modificar `app/gestor/gestao-rotas.tsx`:
  - `onRowPress`, que abre o mapa da rota, a mesma navegação de "Ver detalhes";
  - os rótulos passam a "Ver detalhes" e "Excluir rota" (danger, dentro do menu). A confirmação continua no `Dialog` de hoje.
- Modificar `src/components/gestor/dashboard/_components/desktop/RotasTable.tsx`: `onRowPress` e Excluir pelo menu. Esse componente pode ficar sem uso depois da Tarefa 4; nesse caso, a Tarefa 4 o apaga.
- Testes:
  - `src/components/__tests__/DataTable.test.tsx`;
  - novo `src/components/data-table/__tests__/MenuDeAcoes.test.tsx`;
  - `app/gestor/__tests__/gestao-rotas.test.tsx`.

**Interfaces:**

- **Consome:** nada da Tarefa 1.
- **Produz:** `MenuDeAcoes<T>({ item: T; acoes: DataTableAction<T>[]; testID?: string })` e `DataTableProps.onRowPress`.

- [ ] **Passo 1: testes que falham.**
  - Com `onRowPress`, tocar na linha chama `onRowPress(item)`, e tocar no botão "Ver detalhes" chama só a ação.
  - A ação `type: 'danger'` não aparece na linha. Ela aparece depois de tocar em "Mais ações", e escolhê-la chama `onPress(item)`.
  - Uma célula com nome de 60 caracteres renderiza `Text` com `numberOfLines={1}` e `accessibilityLabel` igual ao nome completo.
  - Na Gestão de Rotas, escolher "Excluir rota" no menu abre o `Dialog` de confirmação que já existe.
- [ ] **Passo 2: rodar e ver falhar.** Comando: `npx jest src/components/__tests__/DataTable.test.tsx src/components/data-table app/gestor/__tests__/gestao-rotas.test.tsx`.
- [ ] **Passo 3: implementar.**
- [ ] **Passo 4: rodar de novo.** Os testes do passo 2 passam, e `npx jest src/components app/gestor` também.
- [ ] **Passo 5: commit** com a mensagem `feat(gestor): tabela na largura do cartão, linha clicável e menu de ações`.

### Tarefa 3: tipografia, contraste, laranja só para atenção e seletor da Nova Rota

**Arquivos:**

- Modificar `src/components/desktop/DesktopPageLayout.tsx`:
  - título com `fontDisplay`, 28 px no normal e 22 px no compacto, peso 400 e cor `text`;
  - subtítulo com 14 px em `textSecondary`;
  - separador do breadcrumb em `gray500`.
  - Os tokens `components.pageLayout` ficam em `src/utils/styles.base.ts:266-271,692-697`.
- Modificar `src/components/gestor/dashboard/_components/desktop/Sidebar.tsx`:
  - `brandSubtitle` sem `textTransform`, com o texto "Painel do gestor", 13 px, `gray500` e sem `letterSpacing`;
  - `navItemActive` com `borderLeftColor: theme.colors.primary`.
- Modificar o número dos cartões dos Incidentes (feito na Tarefa 1) para usar `fontDisplay`.
- Modificar `src/components/gestor/nova-entrega/FormularioParada.tsx` e `styles.ts`, no seletor de tipo:
  - o inativo dos dois tipos fica igual, com borda `gray300`, fundo `background` e texto `textSecondary`;
  - o ativo fica com fundo cheio na cor do tipo (Entrega `primary`, Retirada `warning`), texto branco e ícone `checkmark-circle`;
  - `accessibilityState.checked` no ativo.
- Testes:
  - `src/components/desktop/__tests__/DesktopPageLayout.test.tsx` (criar, se não existir);
  - `src/components/gestor/dashboard/_components/desktop/__tests__/Sidebar.test.tsx`;
  - `src/components/gestor/nova-entrega/__tests__/` (o teste do `FormularioParada`).

**Interfaces:** nenhuma é nova.

- [ ] **Passo 1: testes que falham.**
  - O título do `DesktopPageLayout` tem `fontFamily` igual a `theme.typography.fontDisplay`.
  - A Sidebar mostra "Painel do gestor", sem `textTransform: 'uppercase'`, e o item ativo tem `borderLeftColor` igual a `colors.primary`.
  - No `FormularioParada`, com Entrega ativa, o botão "Retirada" tem `accessibilityState.checked` false e borda `gray300`, e o botão "Entrega" tem `checked` true.
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.**
- [ ] **Passo 4: verificar.** `npx jest src/components app/gestor` passa, e `npm run verify:design-system` sai com 0.
- [ ] **Passo 5: commit** com a mensagem `style(gestor): Viga nos títulos, contraste e laranja só para atenção`.

### Tarefa 4: Início desktop com resumo do dia e linhas de paradas

**Arquivos:**

- Modificar `src/components/gestor/dashboard/_hooks/useDashboardData.ts`:
  - o select passa a pedir `paradas(id,status,is_checkpoint,ordem)`;
  - `RotaResumo` ganha `paradas_status: StatusParada[]`, só com as paradas reais, ordenadas por `ordem`;
  - os campos atuais continuam.
- Criar `src/components/gestor/dashboard/_components/desktop/LinhaDeParadas.tsx`: `LinhaDeParadas({ paradas: StatusParada[]; maximo?: number /* 24 */; testID?: string })`.
- Criar `src/components/gestor/dashboard/_components/desktop/ResumoDoDia.tsx`: `ResumoDoDia({ rotas: RotaResumo[]; incidentesAbertos: number; onAbrirIncidentes: () => void })`, com `testID="gestor-dashboard-stats"`.
- Criar `src/components/gestor/dashboard/_components/desktop/ListaDeRotasDoDia.tsx`: uma linha por rota com nome, `LinhaDeParadas`, "N de M", `StatusBadge` (da Tarefa 1), distância e a linha clicável para `/gestor/mapa-rota?id=`. O menu "⋯" fica com "Excluir rota" (`MenuDeAcoes`, da Tarefa 2), que passa pelo `Dialog` atual do `DashboardDesktop`.
- Modificar `src/components/gestor/dashboard/_components/desktop/DashboardDesktop.tsx`:
  - removidos os 5 `StatsCard` e o bloco "Ações Rápidas";
  - o botão "Nova rota" (primary) vai para a área de ação do cabeçalho do `DesktopPageLayout` e leva a `/gestor/nova-entrega`;
  - entram o `ResumoDoDia` e os filtros recolhidos;
  - entra a `ListaDeRotasDoDia` no lugar da `RotasTable`;
  - o `EmptyState` ganha o botão "Criar rota".
  - Apague `RotasTable.tsx` e o teste dele, se ficarem sem uso.
- Modificar `src/components/RouteFilters.tsx` (`variant="desktop"`):
  - a barra começa recolhida, com o botão "Filtros" (`accessibilityState.expanded`) e um resumo dos filtros ativos ("Todos os status, hoje, todos os motoristas");
  - aberta, mostra as seções.
- Modificar `src/components/route-filters/MotoristaFilterSection.tsx`: os motoristas viram `FilterChip` que quebram linha.
- Atualizar os e2e:
  - `e2e/dashboard-reports.e2e.ts` passa a esperar o resumo dentro de `gestor-dashboard-stats` e o botão "Nova rota", no lugar de "Total Hoje"/"Nova Rota de Entrega";
  - `e2e/pages/gestor.page.ts`, se ele procurar os textos removidos;
  - `e2e/visual-critical.e2e.ts` continua esperando `gestor-dashboard-stats`.
- Testes:
  - `desktop/__tests__/DashboardDesktop.test.tsx`;
  - `DashboardDesktop.exclusao.test.tsx`;
  - novos `LinhaDeParadas.test.tsx`, `ResumoDoDia.test.tsx` e `ListaDeRotasDoDia.test.tsx`;
  - `useDashboardData` (no teste atual dele);
  - `src/components/__tests__/RouteFilters.test.tsx`;
  - `route-filters/__tests__/MotoristaFilterSection.test.tsx`.

**Interfaces:**

- **Consome:** `StatusBadge` com `icon` (Tarefa 1), `MenuDeAcoes` (Tarefa 2) e o título com `fontDisplay` (Tarefa 3).
- **Produz:** `RotaResumo.paradas_status: StatusParada[]`.

**Texto do resumo:** usa `plural` (Tarefa 5). Se a Tarefa 5 ainda não tiver entrado, crie o helper aqui com a assinatura da Tarefa 5. O modelo é `"<n> rota(s) em andamento, <n> pendente(s), <n> concluída(s) — <feitas> de <total> paradas feitas, <km> km"`, escrito sempre com plural correto, e omitindo a parte de status com zero.

- [ ] **Passo 1: testes que falham.**
  - `LinhaDeParadas` com `['concluida','concluida','em_andamento','pendente','pulada']` renderiza 5 pontos, cujos `accessibilityLabel` vão de "Parada 1, concluída" a "Parada 5, pulada".
  - Com 40 paradas e `maximo` 24, renderiza 24 pontos e o texto "+16".
  - Com `[]`, renderiza "Sem paradas".
  - `ResumoDoDia` com 1 rota em andamento (3 de 8, 12,4 km) e 0 incidentes renderiza "1 rota em andamento — 3 de 8 paradas feitas, 12,4 km", sem a palavra "incidente".
  - `ResumoDoDia` com 2 incidentes renderiza "2 incidentes abertos" pressionável, que chama `onAbrirIncidentes`.
  - O `DashboardDesktop` não renderiza "Ações Rápidas" nem "Total Hoje", e o botão "Nova rota" navega para `/gestor/nova-entrega`.
  - Sem rotas, renderiza "Nenhuma rota cadastrada hoje" e o botão "Criar rota".
  - O `RouteFilters` desktop começa sem as seções visíveis, e tocar em "Filtros" as mostra.
  - `useDashboardData` devolve `paradas_status` ordenado por `ordem`, sem as paradas de partida e chegada.
- [ ] **Passo 2: rodar e ver falhar.** Comando: `npx jest src/components/gestor/dashboard src/components/__tests__/RouteFilters.test.tsx src/components/route-filters`.
- [ ] **Passo 3: implementar.**
- [ ] **Passo 4: rodar de novo.** O comando do passo 2 passa, e `npx jest` também, na suíte inteira.
- [ ] **Passo 5: commit** com a mensagem `feat(gestor): Início desktop com resumo do dia e linhas de paradas`.

### Tarefa 5: textos sem "(s)" e sem abreviação

**Arquivos:**

- Criar `src/lib/plural.ts` com `export function plural(n: number, singular: string, pluralForma: string): string`. Ela devolve `"<n> <forma>"`, e o `n` é formatado em pt-BR por `formatarDecimal` só quando não for inteiro. O teste fica em `src/lib/__tests__/plural.test.ts`.
- Trocar o "(s)" por `plural` em:
  - `app/gestor/gestao-rotas.tsx:265`, com "10 rotas encontradas" e "1 rota encontrada";
  - `app/gestor/nova-entrega.tsx:163,506`;
  - `src/components/gestor/nova-entrega/MotoristaSeletor.tsx:130,135`;
  - `src/hooks/nova-entrega/useParadasManagement.ts:200,429,462`;
  - `src/hooks/nova-entrega/useRouteCreation.ts:267`;
  - `src/hooks/useNovaEntrega.helpers.ts:395`;
  - `src/lib/timeline.ts:267,269,373,425`.
- Ajustar os testes que fixam os textos antigos:
  - `app/gestor/__tests__/gestao-rotas.test.tsx:202` e `e2e/dashboard-reports.e2e.ts:136`;
  - `src/lib/__tests__/timeline.test.ts`;
  - `utils.test.ts`;
  - os testes dos hooks de nova-entrega.
- Fora do escopo: `src/hooks/route-status/useRouteActions.ts`, que é do motorista, e `app/unidade/equipe.tsx`.

**Interfaces:** produz `plural(n, singular, pluralForma)`.

- [ ] **Passo 1: testes que falham.** `plural(1,'rota','rotas')` dá `'1 rota'`, `plural(0,'rota','rotas')` dá `'0 rotas'` e `plural(2,'parada','paradas')` dá `'2 paradas'`. No subtítulo da Gestão de Rotas, com 1 rota, aparece "1 rota encontrada".
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** Ao terminar, `git grep -n "(s)" -- app/gestor src/components/gestor src/hooks/nova-entrega src/lib/timeline.ts` não pode trazer texto exibido.
- [ ] **Passo 4: verificar.** `npx jest`, `npx tsc --noEmit` e `npm run lint` saem todos com 0.
- [ ] **Passo 5: commit** com a mensagem `refactor(gestor): plural sem "(s)" nos textos do gestor`.

**Ordem:** 5 → 1 → 2 → 3 → 4. A Tarefa 5 vem primeiro porque a Tarefa 4 consome o `plural`. As tarefas rodam em sequência porque compartilham `gestao-rotas.tsx` e o dashboard.
