# Varredura de refatorações: trilha gestor (1.3, 0.3, 1.4, 1.5). Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao status de rota e de parada uma fonte única no domínio do gestor (corrigindo o `nao_executada` cru do card mobile, B5), apagar o código morto do gestor, centralizar as operações de motorista na loja numa lib (B6) e fazer a auditoria do mapa-rota passar pelos helpers que conferem `error` (B7).

**Architecture:** `src/constants/statusConfig.ts` vira a fonte de rótulo e cor, ganhando um leitor tolerante (`rotuloDoStatus`) e o mapa de cores por status. A lista de status de parada passa a ser um `as const` em `src/types/rota.ts`. As operações de motorista vão para funções puras em `src/lib/gestor/motoristaNaLoja.ts`, que lançam o erro original. A página continua dona da confirmação e do toast. Os quatro `insert` crus em `logs` do domínio gestor trocam para `logParadaAction`/`logRotaAction` de `src/lib/queries/logs.ts`, sem mudar o payload.

**Tech Stack:** React Native + Expo Router + TypeScript, Supabase JS (RPC `alternar_motorista_na_unidade`), Jest + `@testing-library/react-native`, Unistyles.

**Spec:** `docs/superpowers/2026-11-03-varredura-refatoracoes.md` (branch `docs/varredura-refatoracoes-03-11`; itens 1.3, 0.3, 1.4, 1.5, bugs B5, B6, B7, seções 4 e 5). Relatório de origem: `2-gestor.md` da varredura (scratchpad da sessão coordenadora, temporário; o consolidado no git é a referência).

## Global Constraints

- TDD: escreva o teste e **veja-o falhar** antes do código. Em tarefa só de deleção, o "vermelho" é o `type-check`/grep que acusa o importador antes de ele ser removido.
- Branch própria `refactor/varredura-gestor` num worktree (`git worktree add .claude/worktrees/varredura-gestor -b refactor/varredura-gestor main`). Crie a branch **antes** da primeira edição.
- Nunca `--no-verify`.
- Nunca escreva em banco nem em rede: nada de `supabase db`, MCP de banco, e2e/Playwright, nem deploy. Todo Supabase em teste é mock.
- Jest dentro do worktree: `npx jest <caminho> --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`.
- Verificação final: suíte inteira do Jest, `npm run type-check`, `npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings=0 --ignore-pattern ".claude/**"`, `npm run build:web` e `npm run scan:morto:arquivos`.
- Sem push. Quem abre o PR é o coordenador.
- Commits em PT-BR no estilo do repositório (`fix(gestor): …`, `refactor(gestor): …`, `chore(gestor): …`), terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- O pre-commit pode deixar ruído CRLF: confira com `git diff --ignore-cr-at-eol` e descarte o que for só fim de linha.
- **Arquivos proibidos nesta trilha:** `src/lib/**` fora de `src/lib/gestor/` (consumir pode, editar não), `src/components/motorista/**`, `app/motorista/**`, `src/services/**`, `MapaWebMapLibre*`, `MapaAdapter*`, `.github/**`.
- Nada afrouxa RLS nem pula as RPCs. O toggle de motorista passa **só** por `alternar_motorista_na_unidade`. A edição muda **só** `nome` e `telefone`, que a trava `trava_motorista_outra_loja` permite (junto com `updated_at`, que o gatilho `update_usuarios_updated_at` preenche). Auditoria em `logs` nunca leva `parada_id` como coluna: ele vai em `detalhes`.
- O toast pertence à página: a lib nova não chama `useToast` nem mostra nada.

## Ajustes em relação ao spec

Conferidos no código em `c64859af`:

1. **1.3, "statusLabels reexporta statusConfig" não cabe nesta trilha.** `src/lib/statusLabels.ts` é da trilha lib. Além disso, os rótulos em Title Case dele ("Em Andamento") estão fixados por três e2e da tela Gestão de Rotas (`e2e/photo-proof.e2e.ts:79,89`, `e2e/gestor-team-management.e2e.ts:179`, com `exact: true`), que esta trilha não pode rodar. **Escolha:** os consumidores do gestor que já divergiam passam a ler `statusConfig` (sentence case: "Em andamento", "Não executada", o mesmo do desktop `StatusCell` e do `RouteInfoHeaderCompact`). `useGestaoRotas.getStatusLabel` **continua** em `getRotaStatusLabel`, porque o spec já previa isso e é o que está lá (`useGestaoRotas.ts:630`). **Dependência registrada para a trilha lib:** derivar `ROTA_STATUS_LABELS`/`ParadaStatus` de `statusConfig`/`STATUS_PARADA` e decidir a capitalização junto com os três e2e.
2. **1.3, divergência de cor além do texto.** Para `nao_executada`, o cabeçalho mobile do mapa-rota usa amarelo (`RouteInfoHeader.tsx:60`), `app/gestor/gestao-rotas.tsx:82` usa `warning`, e `statusConfig`, `StatusCell` e o cabeçalho desktop usam vermelho (`error`). A fonte única fica em `error`. No card mobile, `pendente` sai de cinza para `warning` e `em_andamento` de `secondary` para `info`, igual ao desktop. É uma mudança visual intencional.
3. **1.3, `mapa-rota.tsx:176`** usa `formatStatusLabel`, em minúsculas ("em andamento"). Passa a "Em andamento".
4. **1.3, tipos.** `StatusCheckpoint` (`types/rota.ts:22`) e `StopStatusType` (`statusConfig.ts:25`) não têm `em_andamento`. `ParadaStatus` de `statusLabels.ts:39` também não, mas é da trilha lib (registrado). Alargar `StatusCheckpoint` pode quebrar o `tsc` em arquivo proibido, então a Tarefa 2 tem uma saída explícita.
5. **0.3, só parte dos itens é desta trilha.** Ficam fora e vão registrados para outras trilhas: `checkpoints.tsx:61` e o ramo `compact` do `PreRouteChecklist` (trilha motorista), e `onMarkerLongPress` do `MapaAdapter.web.tsx` (trilha mapa). **`DesktopLayout` fica adiado**, porque é exportado por `src/design-system/components/index.ts` (que o item 0.1 também edita) e montado na vitrine `app/design-system.tsx:3767-3786,3924,4090`, coberta por snapshots visuais (`e2e/design-system.e2e.ts`) que não rodam aqui. **`CollapsibleSection` está mais morto do que o spec dizia:** não aparece nem no barrel `src/components/desktop/index.ts`, só no próprio teste.
6. **1.5, seis pontos → quatro nesta trilha.** `src/lib/routeUtils.ts:420` e `src/lib/queries/paradas.ts:382` são da trilha lib. Achado a mais, também da trilha lib: `src/lib/queries/incidentes.ts:417` faz o mesmo `insert` sem olhar `error`. Nos dois pontos de `useMapaRotaHandlers`, `usuario_id` vai como `userData?.id`, possivelmente `undefined`. A policy `logs_insert_optimized` exige `usuario_id = auth.uid()` e recusaria, então pular o log sem `userData.id` tem o mesmo efeito, sem a ida ao banco.
7. **1.4.** A lista (`useMotoristasOperations`) ignora o retorno `vinculo|pessoa` da RPC. Os textos de sucesso continuam por tela, porque estão fixados por testes e não são o defeito. A lib centraliza RPC, edição, log e mensagem de erro. A edição pelo perfil troca o `update` cru (com `updated_at`) por `updateUsuario` (o mesmo da lista: `.select().single()` + retry). Efeito colateral bom: um update que a RLS zera (0 linhas) deixa de virar "sucesso" falso.
8. **Dependência para a trilha lib (0.2):** não apagar `logParadaAction`, `logRotaAction`, `logUserAction` nem `updateUsuario`, que esta trilha passa a usar.

## Decisões de desenho (≥2 alternativas)

- **Fonte de status (1.3):** A) `statusConfig` (cor + rótulo + ícone, já se declara fonte única). B) `statusLabels` (só rótulo, em `src/lib`, proibido aqui). C) lista `as const` gerando os dois. **Escolhida: A**, com o `as const` só para o tipo de parada (o mesmo que a seção 4 do spec decidiu).
- **Onde mora o badge com tema (cabeçalho mobile):** A) função em `statusConfig` recebendo `theme`. B) módulo do mapa-rota `src/components/gestor/mapa-rota/badgeDoStatusDaRota.ts` lendo `statusConfig`. **Escolhida: B.** `statusConfig` é puro e é importado pelos marcadores de mapa (`utils/mapMarkerColors.ts`); levar `Theme` para lá acoplaria a constante ao Unistyles.
- **Leitor de rótulo:** A) mudar o fallback de `getStatusLabel`. B) função nova `rotuloDoStatus`. **Escolhida: B.** `getStatusLabel` é usada pelos marcadores de mapa (`infoWindowBuilders`, área proibida). Mudar o fallback mexeria no mapa.
- **Lib de motorista (1.4):** A) funções puras em `src/lib/gestor/` (escolhida). B) hook com confirmação e toast, que esbarra em "toast pertence à página" e no `withToast` da lista. C) só alinhar textos, o que deixa três cópias para divergirem de novo. **Contrato de erro:** a lib **relança o erro original** em vez de devolver `Result`. Assim `mostrarSeBloqueado(error, nome)`, `mensagemRegraDoBanco` (que exige o objeto do PostgREST com `code`) e o `error:` do `withToast` continuam iguais.
- **Auditoria (1.5):** A) helpers de `src/lib/queries/logs.ts` (escolhida). B) manter o `insert` e conferir `error` em cada ponto, o que repete o helper quatro vezes. Import direto de `@/lib/queries/logs` (não o barrel), para os testes que mocam `@/lib/supabase` não carregarem o barrel inteiro.
- **Helpers do `RouteInfoHeader` (0.3):** A) apagar só o componente e manter os helpers no arquivo. B) levar os helpers para a fonte de status e apagar o arquivo. **Escolhida: B**, como pede a seção 5 do spec.

## Review Focus

1. **Status fora da união vindo do banco** (valor novo no CHECK, maiúsculas): o card e o badge mostram texto legível ("status novo", "Concluída") em cor neutra e nunca quebram. Teste na Tarefa 1 (`rotuloDoStatus`), na Tarefa 3 (card) e na Tarefa 4 (badge).
2. **Desativação recusada por rota aberta (Migration 54):** o erro tem de chegar intacto a `mostrarSeBloqueado`. Se a lib o embrulhar, a lista de rotas some e aparece o toast genérico. Teste na Tarefa 6 (`rejects.toBe(erroOriginal)`) e nas Tarefas 7 e 8 (fluxo de bloqueio continua).
3. **Motorista de outra loja desativado pelo perfil (escopo `vinculo`):** a tela volta para a lista, porque a RLS deixa de mostrá-lo. Teste na Tarefa 7.
4. **`useUser` ainda sem `userData`:** a lib e os handlers não gravam log nem lançam erro, e a operação principal segue. Teste nas Tarefas 6 e 10.
5. **Log de auditoria recusado com a operação principal gravada:** o toast de sucesso continua, e só sai `logger.warn` com o `evento`. Teste nas Tarefas 9 e 10.

---

### Tarefa 1: `statusConfig` como fonte, com leitor tolerante e mapa de cores

**Files:**

- Modify: `src/constants/statusConfig.ts`
- Test (create): `src/constants/__tests__/statusConfig.test.ts`

**Interfaces:**

- Produces:
  - `rotuloDoStatus(status: string | null | undefined): string`: rótulo da rota ou da parada depois de `toLowerCase()`; `'-'` para vazio, `null` ou `undefined`; senão `status.toLowerCase().replace(/_/g, ' ')`.
  - `coresPorStatusDaRota(resolver: (k: StatusColorKey) => string): Record<RouteStatusType, string>`.
  - `STOP_STATUS_CONFIG.em_andamento = { label: 'Em andamento', colorKey: 'info', icon: 'navigate-circle' }`, com `StopStatusType` ganhando `'em_andamento'`.

- [ ] **Step 0: Preparação (uma vez)**: `git -C D:/rota-mestre/rotamestre-app worktree add .claude/worktrees/varredura-gestor -b refactor/varredura-gestor main`, e instalar dependências no worktree conforme a memória "Jest e worktrees".

- [ ] **Step 1: Escrever os testes que falham**

```ts
describe('rotuloDoStatus', () => {
  it.each([
    ['nao_executada', 'Não executada'],
    ['em_andamento', 'Em andamento'],
    ['pendente', 'Pendente'],
    ['concluida', 'Concluída'],
    ['cancelada', 'Cancelada'],
    ['pulada', 'Pulada'],
    ['CONCLUIDA', 'Concluída'],
    ['status_novo', 'status novo'],
  ])('%s → %s', (s, r) => expect(rotuloDoStatus(s)).toBe(r));
  it.each([undefined, null, ''])('%p → "-"', (s) =>
    expect(rotuloDoStatus(s)).toBe('-'),
  );
});
it('rota: a config cobre os 5 valores do CHECK rotas_status_check', () =>
  expect(Object.keys(ROUTE_STATUS_CONFIG).sort()).toEqual([
    'cancelada',
    'concluida',
    'em_andamento',
    'nao_executada',
    'pendente',
  ]));
it('parada: a config cobre os 4 status, inclusive em_andamento', () =>
  expect(Object.keys(STOP_STATUS_CONFIG).sort()).toEqual([
    'concluida',
    'em_andamento',
    'pendente',
    'pulada',
  ]));
it('coresPorStatusDaRota: nao_executada é error e em_andamento é info', () => {
  const cores = coresPorStatusDaRota((k) => `cor-${k}`);
  expect(cores).toEqual({
    pendente: 'cor-warning',
    em_andamento: 'cor-info',
    concluida: 'cor-success',
    cancelada: 'cor-error',
    nao_executada: 'cor-error',
  });
});
it('getStatusColorKey de em_andamento segue info (marcadores do mapa intactos)', () =>
  expect(getStatusColorKey('em_andamento')).toBe('info'));
```

- [ ] **Step 2: Rodar e ver falhar**
      Run: `npx jest src/constants/__tests__/statusConfig.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
      Expected: FAIL (`rotuloDoStatus is not a function`, `coresPorStatusDaRota is not a function`, chaves da parada sem `em_andamento`).

- [ ] **Step 3: Implementar** em `src/constants/statusConfig.ts` as duas funções e a entrada `em_andamento`. Não mude `getStatusLabel`, `getStatusColorKey`, `getStatusColor` nem `getStatusIcon`, que os marcadores do mapa usam. `rotuloDoStatus` consulta `ROUTE_STATUS_CONFIG` e depois `STOP_STATUS_CONFIG` pela chave normalizada.

- [ ] **Step 4: Rodar e ver passar**, mais `npx jest src/utils/__tests__/mapMarkerColors.test.ts src/components/map --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers` (Expected: PASS, cores dos marcadores iguais) e `npm run type-check` (Expected: 0 erros).

- [ ] **Step 5: Commit**: `git add src/constants/statusConfig.ts src/constants/__tests__/statusConfig.test.ts` → `refactor(status): statusConfig ganha rotuloDoStatus, cores por status e a parada em_andamento`

### Tarefa 2: `STATUS_PARADA` como lista única do tipo de parada

**Files:**

- Modify: `src/types/rota.ts:6-22` (e o comentário de `:14`, que cita `RouteInfoHeader.tsx`)
- Modify: `src/constants/statusConfig.ts` (`RouteStatusType`, `StopStatusType` viram aliases)
- Test: `src/constants/__tests__/statusConfig.test.ts`

**Interfaces:**

- Consumes: `STOP_STATUS_CONFIG` da Tarefa 1.
- Produces: `export const STATUS_PARADA = ['pendente', 'em_andamento', 'concluida', 'pulada'] as const;`, `export type StatusParada = (typeof STATUS_PARADA)[number];`, `StatusCheckpoint = StatusParada`. Em `statusConfig`: `export type RouteStatusType = StatusRota; export type StopStatusType = StatusParada;` (import só de tipo).

- [ ] **Step 1: Teste que falha**: `it('STOP_STATUS_CONFIG tem exatamente STATUS_PARADA', () => expect(Object.keys(STOP_STATUS_CONFIG).sort()).toEqual([...STATUS_PARADA].sort()))`, importando `STATUS_PARADA` de `@/types/rota`.
- [ ] **Step 2: Rodar**. Expected: FAIL (`STATUS_PARADA` undefined).
- [ ] **Step 3: Implementar** a constante e os aliases. Atualize o comentário de `types/rota.ts:14` para apontar `rotuloDoStatus` em `statusConfig`.
- [ ] **Step 4: Gate de tipos**. Run: `npm run type-check`. Expected: 0 erros. **Se aparecer erro em arquivo proibido** (por exemplo `src/lib/**`, `src/components/motorista/**`, `app/motorista/**`), desfaça só o alias `StatusCheckpoint = StatusParada` (mantenha `STATUS_PARADA`, `StatusParada` e `StopStatusType`) e anote no corpo do commit, para o coordenador, "alargar StatusCheckpoint depende da trilha X (arquivo:linha)". Rode de novo o teste e o `type-check`.
- [ ] **Step 5: Commit**: `refactor(tipos): STATUS_PARADA como lista única do status de parada, com em_andamento`

### Tarefa 3: card do Dashboard mobile pela fonte única (B5)

**Files:**

- Modify: `src/components/gestor/dashboard/_components/shared/RotaCard.tsx:35-62,80-81`
- Test: `src/components/gestor/dashboard/_components/shared/__tests__/RotaCard.test.tsx`

**Interfaces:**

- Consumes: `rotuloDoStatus`, `ROUTE_STATUS_CONFIG` (Tarefa 1).

- [ ] **Step 1: Testes que falham** (acrescente `warning`, `info`, `error` ao tema mockado do arquivo; o badge é identificado pelo texto):
  - `it('nao_executada mostra "Não executada" em error, nunca o texto cru')`: `getByText('Não executada')` existe; `queryByText('nao_executada')` é `null`; a cor do texto ou do badge (o mesmo estilo que o teste lê hoje) é `mockTheme.colors.error`.
  - Troque o teste de `:97` por `'mostra "Em andamento" (sentence case, como o desktop) em info'`.
  - `it('pendente usa warning')`.
  - Mantenha `:115` reescrito: `'status desconhecido "status_novo" vira "status novo" em gray500'`.
- [ ] **Step 2: Rodar** `npx jest src/components/gestor/dashboard --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. Expected: FAIL nos quatro casos.
- [ ] **Step 3: Implementar**: apague `getStatusColor`/`getStatusLabel` locais. O rótulo vem de `rotuloDoStatus(rota.status)`. A cor é `theme.colors[ROUTE_STATUS_CONFIG[status].colorKey]` quando o status existe na config, senão `theme.colors.gray500` (o fallback neutro de hoje). O `memo` continua igual.
- [ ] **Step 4: Rodar** a pasta do dashboard. Expected: PASS (inclusive `DashboardMobile.test` e `DashboardDesktop.test`).
- [ ] **Step 5: Commit**: `fix(gestor): card do Dashboard mobile mostra "Não executada" pela fonte única de status`

### Tarefa 4: cabeçalho mobile do mapa-rota pela fonte única; apagar o `RouteInfoHeader` morto (1.3 + 0.3)

**Files:**

- Create: `src/components/gestor/mapa-rota/badgeDoStatusDaRota.ts`
- Create: `src/components/gestor/mapa-rota/__tests__/badgeDoStatusDaRota.test.ts`
- Modify: `app/gestor/mapa-rota.tsx:37-38,172-179`; `src/components/gestor/mapa-rota/index.ts:10-14`; `src/components/gestor/mapa-rota/types.ts:40` (comentário)
- Modify: `src/components/gestor/mapa-rota/styles.ts` (seção `// ===== RouteInfoHeader =====`: apague **só** as chaves sem outro uso, conferindo cada uma com `grep -rn "styles\.<chave>" app src`; `statusBadge` e `statusBadgeText` ficam, porque `mapa-rota.tsx:660-661` as usa)
- Delete: `src/components/gestor/mapa-rota/RouteInfoHeader.tsx`, `src/components/gestor/mapa-rota/__tests__/RouteInfoHeader.test.tsx`

**Interfaces:**

- Consumes: `ROUTE_STATUS_CONFIG`, `rotuloDoStatus` (Tarefa 1).
- Produces: `badgeDoStatusDaRota(colors: Theme['colors'], status?: string | null): { container: { backgroundColor: string; borderColor: string }; text: { color: string } }`, com fundo por `colorKey` (`warning→warningBg`, `info→infoBg`, `success→successBg`, `error→errorBg`, `gray600→gray100`), borda e texto iguais a `colors[colorKey]`. Para status fora da config: `gray100`/`gray200`/`gray700`. Normalize com `toLowerCase()` antes de consultar.

- [ ] **Step 1: Testes que falham**, portando os casos de `describe('getStatusBadgeVariant')`: pendente → `warningBg`/`warning`; em_andamento → `infoBg`/`info`; concluida → `successBg`; cancelada → `errorBg`; **`nao_executada` → `errorBg`/`error`** (antes era `yellow100`/`warning`: é a unificação com o desktop); `'CONCLUIDA'` → `successBg`; `'xyz'` e `undefined` → `gray100`/`gray200`/`gray700`.
- [ ] **Step 2: Rodar** `npx jest src/components/gestor/mapa-rota/__tests__/badgeDoStatusDaRota.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implementar** o módulo. Em `mapa-rota.tsx`, `statusBadgeVariant = badgeDoStatusDaRota(theme.colors, rota?.status)` e `statusLabel = rotuloDoStatus(rota?.status)`. Tire `RouteInfoHeader`, `getStatusBadgeVariant` e `formatStatusLabel` do barrel e apague os dois arquivos.
- [ ] **Step 4: Rodar** `npx jest src/components/gestor/mapa-rota app/gestor --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers` (Expected: PASS, inclusive `mapa-rota.mobile.test` e `mapa-rota.toast.test`), `npm run type-check` (Expected: 0 erros) e `grep -rn "RouteInfoHeader\b\|getStatusBadgeVariant\|formatStatusLabel" src app` (Expected: nenhuma ocorrência fora de comentário histórico; `RouteInfoHeaderCompact` não conta).
- [ ] **Step 5: Commit**: `refactor(gestor): cabeçalho mobile do mapa-rota lê statusConfig; RouteInfoHeader morto sai`

### Tarefa 5: demais tabelas de status do gestor (modal de rotas abertas, card de parada, cores da Gestão de Rotas)

**Files:**

- Modify: `src/components/gestor/motoristas/RotasAbertasModal.tsx:60-63` (`ROTULO_STATUS` → `rotuloDoStatus`)
- Modify: `src/components/gestor/mapa-rota/ParadaCard.tsx:108-112` (os quatro `&&` → `{rotuloDoStatus(parada.status)}`; os estilos por status ficam)
- Modify: `app/gestor/gestao-rotas.tsx:75-85` (`statusColorMap = useMemo(() => coresPorStatusDaRota((k) => theme.colors[k]), [theme.colors])`)
- Test: `src/components/gestor/mapa-rota/__tests__/ParadaCard.test.tsx`, `src/components/gestor/motoristas/__tests__/RotasAbertasModal.test.tsx` (crie o caso se o arquivo não existir), `app/gestor/__tests__/gestao-rotas.test.tsx`

**Interfaces:**

- Consumes: `rotuloDoStatus`, `coresPorStatusDaRota` (Tarefa 1). `useGestaoRotas.getStatusLabel` **não muda** (Ajuste 1).

- [ ] **Step 1: Testes que falham**:
  - ParadaCard: `it('status fora da lista não some: "status_novo" aparece como "status novo"')` (hoje o `&&` não renderiza nada).
  - Gestão de Rotas: capture o `options` passado ao `useGestaoRotas` mockado e `expect(options.statusColorMap.nao_executada).toBe(theme.colors.error)` (hoje `warning`).
  - RotasAbertasModal: `it('rota em andamento e pendente mostram "Em andamento" e "Pendente"')`. É guarda de não-regressão: pode já passar, e isso deve ficar dito no commit.
- [ ] **Step 2: Rodar** os três arquivos. Expected: FAIL nos dois primeiros.
- [ ] **Step 3: Implementar** as três trocas.
- [ ] **Step 4: Rodar** `npx jest src/components/gestor app/gestor src/hooks/__tests__/useGestaoRotas.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. Expected: PASS (o teste de `useGestaoRotas.test.ts:1009-1016`, Title Case, continua verde).
- [ ] **Step 5: Commit**: `refactor(gestor): rótulos e cores de status do gestor saem de statusConfig`

### Tarefa 6: código morto do gestor (0.3)

**Files:**

- Delete: `src/hooks/useEnderecoUnidade.ts` + `src/hooks/__tests__/useEnderecoUnidade.test.ts` (o vivo é `src/hooks/nova-entrega/useEnderecoUnidade.ts`, que **fica**)
- Delete: `src/hooks/useAsync.ts` + `src/hooks/__tests__/useAsync.test.ts`
- Delete: `src/components/desktop/CollapsibleSection.tsx` + `src/components/desktop/__tests__/CollapsibleSection.test.tsx`
- Modify: `src/components/gestor/dashboard/_components/mobile/DashboardMobile.tsx:19,22,68,503-504` (tire `useToast`, `Toast` e o `<Toast>` que ninguém dispara) e o mock correspondente em `DashboardMobile.test.tsx:32-61`

- [ ] **Step 1: Prova de que estão mortos (o "vermelho" desta tarefa)**. Run: `grep -rnE "from '(@/hooks|\.\.?)/(useAsync|useEnderecoUnidade)'|CollapsibleSection" src app e2e --include=*.ts --include=*.tsx`. Expected: só os próprios arquivos e os seus testes. `src/hooks/nova-entrega/__tests__/useEnderecoUnidade.test.ts` também casa, mas importa o hook **vivo** (`nova-entrega/`) e fica. Em `DashboardMobile.tsx`, `grep -n "showToast\|withToast" ` deve dar vazio. Se aparecer qualquer outro importador, pare e reporte.
- [ ] **Step 2: Apagar e editar** conforme a lista. Não toque em `DesktopLayout` (Ajuste 5).
- [ ] **Step 3: Rodar** `npm run type-check` (Expected: 0 erros), `npx jest src/hooks src/components/desktop src/components/gestor/dashboard --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers` (Expected: PASS) e `npm run scan:morto:arquivos` (Expected: lista vazia, como na main).
- [ ] **Step 4: Commit**: `chore(gestor): apaga hooks e componentes sem importador (useEnderecoUnidade antigo, useAsync, CollapsibleSection, toast mudo do Dashboard mobile)`

### Tarefa 7: lib `motoristaNaLoja` (1.4)

**Files:**

- Create: `src/lib/gestor/motoristaNaLoja.ts`
- Test (create): `src/lib/gestor/__tests__/motoristaNaLoja.test.ts`

**Interfaces:**

- Consumes: `supabase.rpc` (`@/lib/supabase`), `updateUsuario` e `logUserAction` (`@/lib/queries`, o mesmo barrel que a lista e os testes dela mocam), `getErrorMessage` (`@/lib/errorMapping`), `mensagemRegraDoBanco` (`@/lib/motorista/mensagemRegraDoBanco`).
- Produces:
  - `export type EscopoAlternancia = 'vinculo' | 'pessoa';`
  - `alternarMotoristaNaLoja(p: { motoristaId: string; motoristaNome: string; unidadeId: string; ativo: boolean; gestorId?: string | null }): Promise<EscopoAlternancia>`: chama a RPC `alternar_motorista_na_unidade` com `{ p_motorista_id, p_unidade_id, p_ativo }`. Com `error`, **relança o mesmo objeto**. Sucesso: `data === 'vinculo' ? 'vinculo' : 'pessoa'`. Com `gestorId`, chama `logUserAction(gestorId, ativo ? 'motorista_ativado' : 'motorista_desativado', { motorista_id, motorista_nome })` sem aguardar (fire-and-forget, como a lista hoje).
  - `editarDadosMotorista(p: { motoristaId: string; nome: string; telefone?: string | null; gestorId?: string | null }): Promise<{ nome: string; telefone: string | null }>`: `updateUsuario(motoristaId, { nome: nome.trim(), telefone: telefone?.trim() || null })`. Com `!result.success`, relança `result.error.originalError ?? result.error`. Com `gestorId`, `logUserAction(gestorId, 'motorista_editado', { motorista_id, motorista_nome })`. Devolve os valores gravados. Nunca envia outra coluna.
  - `mensagemErroMotorista(error: unknown, padrao: string): string`: colisão do índice `usuarios_motorista_telefone_unico` (no `message` de `Error` ou de objeto) → `getErrorMessage(error).message`; senão `mensagemRegraDoBanco(error)`; senão `padrao`.

- [ ] **Step 1: Testes que falham**:
  - `'alternar chama só a RPC da loja, com os três parâmetros'`: `rpc` chamado com `('alternar_motorista_na_unidade', { p_motorista_id: 'm1', p_unidade_id: 'u1', p_ativo: false })`; `supabase.from` não chamado.
  - `'alternar devolve vinculo quando a RPC diz vinculo, e pessoa no resto'` (`'vinculo'`, `'pessoa'`, `null`).
  - `'alternar relança o erro ORIGINAL (bloqueio por rota aberta)'`: `rejects.toBe(erro)` com `erro = { code: 'P0001', message: 'rota aberta…' }`; `logUserAction` não chamado.
  - `'alternar grava motorista_desativado / motorista_ativado com o gestor'`.
  - `'sem gestorId não grava log e não lança'`.
  - `'editar manda só nome e telefone aparados; telefone vazio vira null'`: `updateUsuario` com `('m1', { nome: 'Ana', telefone: null })` para `nome: ' Ana '`, `telefone: '  '`.
  - `'editar relança originalError (P0001 da trava de outra loja)'`.
  - `'editar grava motorista_editado'`.
  - `mensagemErroMotorista`: índice de telefone → `'Já existe um motorista ativo com este telefone. Confira se ele já tem conta.'` (texto de `errorMapping.ts:459`), tanto para `new Error('… usuarios_motorista_telefone_unico …')` quanto para `{ code: '23505', message: '… usuarios_motorista_telefone_unico …' }`; `{ code: 'P0001', message: 'Regra X' }` → `'Regra X'`; `new Error('boom')` → padrão.
- [ ] **Step 2: Rodar** `npx jest src/lib/gestor/__tests__/motoristaNaLoja.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implementar** o módulo (sem `useToast`, sem React).
- [ ] **Step 4: Rodar** de novo. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(gestor): lib motoristaNaLoja centraliza a RPC da loja, a edição, a auditoria e a mensagem de erro`

### Tarefa 8: perfil do motorista usa a lib (B6, edição e toggle)

**Files:**

- Modify: `app/gestor/motorista-perfil.tsx:171-257` (sai `supabase` e `mensagemRegraDoBanco` dos imports se ficarem sem uso)
- Test: `app/gestor/__tests__/motorista-perfil.edicao.test.tsx`, `app/gestor/__tests__/motorista-perfil.bloqueio.test.tsx`

**Interfaces:**

- Consumes: `alternarMotoristaNaLoja`, `editarDadosMotorista`, `mensagemErroMotorista` (Tarefa 7); `userData?.id` de `useUser` como `gestorId`.

- [ ] **Step 1: Testes que falham** (acrescente `jest.mock('@/lib/queries', () => ({ updateUsuario: mockUpdateUsuario, logUserAction: mockLog }))` e mantenha o mock de `@/lib/supabase` para a carga e a RPC):
  - edicao: `'telefone de outro motorista ativo mostra a mensagem específica, não "Não foi possível salvar"'`: `mockUpdateUsuario` resolve `{ success: false, error: { originalError: { code: '23505', message: 'duplicate key value violates unique constraint "usuarios_motorista_telefone_unico"' } } }` → `getByText('Já existe um motorista ativo com este telefone. Confira se ele já tem conta.')`.
  - edicao: `'editar grava motorista_editado'`: `mockLog` chamado com `(gestorId, 'motorista_editado', expect.objectContaining({ motorista_id }))`.
  - edicao: ajuste o teste que hoje espera `mockUpdate('usuarios', { nome, telefone, updated_at })` para esperar `mockUpdateUsuario(id, { nome, telefone })`, sem `updated_at` (o gatilho o preenche).
  - bloqueio: `'desativar grava motorista_desativado'`; e `'escopo vinculo desativando volta para a lista'` (`router.back` chamado e toast `'Motorista desativado só nesta loja'`). Os dois testes atuais de bloqueio continuam como estão.
- [ ] **Step 2: Rodar** `npx jest app/gestor/__tests__/motorista-perfil --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. Expected: FAIL (mensagem genérica, sem log, `updateUsuario` não chamado).
- [ ] **Step 3: Implementar**. `handleToggleStatus`: `const escopo = await alternarMotoristaNaLoja({...})`, com os mesmos toasts e o mesmo `router.back()` por `escopo === 'vinculo' && !newStatus`. No `catch`, `mostrarSeBloqueado` primeiro e depois `showToast(mensagemErroMotorista(error, 'Não foi possível alterar o status'), 'error')`. `handleSaveEdit`: `const gravado = await editarDadosMotorista({...})` → `setMotorista({ ...motorista, nome: gravado.nome, telefone: gravado.telefone ?? undefined })`. No erro, `mensagemErroMotorista(error, 'Não foi possível salvar as alterações')`.
- [ ] **Step 4: Rodar** `npx jest app/gestor --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. Expected: PASS (inclusive `motorista-perfil.loja` e `.trocaDeLoja`).
- [ ] **Step 5: Commit**: `fix(gestor): perfil do motorista mostra o telefone duplicado e grava a auditoria pela lib da loja`

### Tarefa 9: Equipe da loja usa a lib (B6, toggle)

**Files:**

- Modify: `app/unidade/equipe.tsx:173-208`
- Test: `app/unidade/__tests__/equipe.test.tsx`

**Interfaces:**

- Consumes: `alternarMotoristaNaLoja`, `mensagemErroMotorista` (Tarefa 7). `gestorId = userData?.id`.

- [ ] **Step 1: Testes que falham** (mock de `@/lib/queries` com `logUserAction: mockLog`; a RPC segue pelo `mockRpc` existente):
  - `'reativar motorista grava motorista_ativado'`.
  - `'reativar esbarrando no telefone de outro motorista ativo mostra a mensagem específica'`: `mockRpc` resolve `{ data: null, error: { code: '23505', message: '… usuarios_motorista_telefone_unico …' } }` → toast com o texto da Tarefa 7.
  - Os casos de `:198` (só pela RPC) e `:216` (rota aberta lista as rotas e não recarrega) continuam verdes sem mudança.
- [ ] **Step 2: Rodar** `npx jest app/unidade --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. Expected: FAIL nos dois novos.
- [ ] **Step 3: Implementar**: `const escopo = await alternarMotoristaNaLoja({...}); const soNestaLoja = escopo === 'vinculo';`. Os textos de sucesso ficam. Erro: `mensagemErroMotorista(error, 'Erro ao atualizar usuário')`. As travas de "própria conta" e "gestor" ficam antes, sem mudança.
- [ ] **Step 4: Rodar** `npx jest app/unidade --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. Expected: PASS (inclusive `troca-de-loja-equipe`).
- [ ] **Step 5: Commit**: `fix(gestor): Equipe grava a auditoria e explica o telefone duplicado ao reativar motorista`

### Tarefa 10: a lista de Motoristas usa a lib; sai a cópia local

**Files:**

- Modify: `src/hooks/motoristas-gestor/useMotoristasOperations.ts:25-41,316-440` (apague `INDICE_TELEFONE_MOTORISTA` e `mensagemTelefoneDuplicado`)
- Test: `src/hooks/motoristas-gestor/__tests__/useMotoristasOperations.test.ts`, `src/hooks/__tests__/useMotoristasGestor.test.ts`

**Interfaces:**

- Consumes: `alternarMotoristaNaLoja`, `editarDadosMotorista`, `mensagemErroMotorista` (Tarefa 7). Os mocks de `@/lib/queries` e `@/lib/supabase` que os testes já têm alcançam a lib, porque ela importa dos mesmos módulos.

- [ ] **Step 1: Teste que falha (guarda de fonte única)**: em `useMotoristasOperations.test.ts`, `it('não mantém cópia própria da regra do telefone')`, lendo o arquivo com `readFileSync` e esperando `not.toContain('usuarios_motorista_telefone_unico')` e `toContain("from '@/lib/gestor/motoristaNaLoja'")`. Os testes de comportamento existentes (mensagens `:942`, `:963`, log `:1066`) são a rede de não-regressão.
- [ ] **Step 2: Rodar** os dois arquivos. Expected: FAIL só na guarda nova.
- [ ] **Step 3: Implementar**. Dentro do `withToast` de `confirmarToggleAtivo`: `await alternarMotoristaNaLoja({ ..., gestorId: userData?.id })`, com `error: (e) => mensagemErroMotorista(e, 'Não foi possível alterar o status do motorista')`. Em `editarMotorista`: `try { await editarDadosMotorista(...) } catch (e) { falhar(e) }`, com `falhar` usando `mensagemErroMotorista(e, 'Não foi possível editar o motorista.')`. Os textos de sucesso, `hideToast` e `mostrarSeBloqueado` ficam como estão.
- [ ] **Step 4: Rodar** `npx jest src/hooks/motoristas-gestor src/hooks/__tests__/useMotoristasGestor.test.ts app/gestor --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. Expected: PASS.
- [ ] **Step 5: Commit**: `refactor(gestor): lista de Motoristas usa a lib da loja; a regra do telefone duplicado mora num lugar só`

### Tarefa 11: auditoria de adicionar e editar parada pelo helper (B7, 2 de 4)

**Files:**

- Modify: `src/components/gestor/mapa-rota/useAddStopForm.ts:331-348`, `src/components/gestor/mapa-rota/useEditStopForm.ts:359-377`
- Test: `src/components/gestor/mapa-rota/__tests__/useAddStopForm.test.ts`, `src/components/gestor/mapa-rota/__tests__/useEditStopForm.test.ts` (e conferir `AddStopModal.test.tsx:562,612`, `EditStopModal.test.tsx`)

**Interfaces:**

- Consumes: `logParadaAction(usuarioId: string, paradaId: string, rotaId: string, evento: string, detalhes?: Record<string, unknown>): Promise<void>` de `@/lib/queries/logs` (import direto). O payload final é igual ao de hoje: `{ usuario_id, rota_id, evento, detalhes: { ...detalhes, parada_id } }`.

- [ ] **Step 1: Testes que falham** (com `@/lib/logger` mockado):
  - `'log recusado pelo banco vira logger.warn e a parada continua adicionada'`: o mock de `from('logs').insert` resolve `{ error: { message: 'new row violates row-level security policy' } }` → `logger.warn` chamado com `('Failed to log action:', expect.objectContaining({ evento: 'parada_adicionada' }))`, toast de sucesso exibido e `onSuccess` chamado.
  - O mesmo caso para `'parada_editada'` em `useEditStopForm`.
  - `'o insert de logs não tem coluna parada_id'`: o argumento do `insert` não tem a chave `parada_id` no topo, e `detalhes.parada_id` é o id da parada. Guarda contra a armadilha do schema inventado.
- [ ] **Step 2: Rodar** `npx jest src/components/gestor/mapa-rota --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. Expected: FAIL nos dois casos de `logger.warn`.
- [ ] **Step 3: Implementar**: `if (usuarioId) await logParadaAction(usuarioId, newParadaId, rotaId, 'parada_adicionada', { endereco, tipo, ordem, posicao_insercao })` e o equivalente `'parada_editada'` com `{ campos_alterados, coordenadas_alteradas }`. Tire o `supabase` do import se ficar sem uso.
- [ ] **Step 4: Rodar** a pasta. Expected: PASS.
- [ ] **Step 5: Commit**: `fix(gestor): falha ao gravar a auditoria de adicionar ou editar parada deixa de ser silenciosa`

### Tarefa 12: auditoria de trocar motorista e reordenar paradas pelo helper (B7, 4 de 4)

**Files:**

- Modify: `src/components/gestor/mapa-rota/hooks/useMapaRotaHandlers.ts:359-370,663-679`
- Test: `src/components/gestor/mapa-rota/hooks/__tests__/useMapaRotaHandlers.test.ts`

**Interfaces:**

- Consumes: `logRotaAction(usuarioId: string, rotaId: string, evento: string, detalhes?: Record<string, unknown>): Promise<void>` de `@/lib/queries/logs`.

- [ ] **Step 1: Testes que falham**:
  - `'trocar motorista: log recusado vira logger.warn e o toast de sucesso aparece'` (`evento: 'motorista_alterado'`).
  - `'reordenar: log recusado vira logger.warn e a reordenação segue até a notificação'` (`evento: 'paradas_reordenadas'`, com `detalhes.desfez_otimizacao` refletindo o que foi gravado, como hoje).
  - `'sem userData.id não tenta gravar log'`: `supabase.from` não chamado com `'logs'`, e o toast de sucesso aparece.
  - Os casos de `:668` e `:830` (zero linhas, nada de log) continuam verdes.
- [ ] **Step 2: Rodar** `npx jest src/components/gestor/mapa-rota/hooks --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. Expected: FAIL nos três novos.
- [ ] **Step 3: Implementar**: `if (userData?.id) await logRotaAction(userData.id, id, 'motorista_alterado', {...})` e `'paradas_reordenadas'`, com os mesmos `detalhes` de hoje, na mesma posição da sequência (antes do toast e da notificação).
- [ ] **Step 4: Rodar** `npx jest src/components/gestor app/gestor --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. Expected: PASS (inclusive `useMapaRotaHandlers.paradaFeita.test`). Depois `grep -rn "from('logs').insert" src/components src/hooks app/gestor app/unidade`. Expected: nenhuma ocorrência.
- [ ] **Step 5: Commit**: `fix(gestor): auditoria de troca de motorista e reordenação passa pelo helper que confere o erro`

### Tarefa 13: verificação final da branch

- [ ] **Step 1:** `npx jest --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. Expected: todas as suítes verdes. Compare a contagem com a da main: só caem os testes apagados nas Tarefas 4 e 6.
- [ ] **Step 2:** `npm run type-check`. Expected: 0 erros.
- [ ] **Step 3:** `npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings=0 --ignore-pattern ".claude/**"`. Expected: 0 problemas.
- [ ] **Step 4:** `npm run build:web`. Expected: export concluído sem erro.
- [ ] **Step 5:** `npm run scan:morto:autoteste` e depois `npm run scan:morto:arquivos`. Expected: autoteste acha a isca, e a lista de arquivos fica vazia.
- [ ] **Step 6:** `git diff main --stat --ignore-cr-at-eol` não pode listar nenhum arquivo proibido (Global Constraints). Descarte ruído CRLF. Sem push. Passe ao coordenador a lista de dependências registradas (Ajustes 1, 4, 5, 6, 8) e a conferência visual pedida pelo spec: web mobile do Dashboard com rota `nao_executada` e cabeçalho mobile do mapa-rota em vermelho; web com dois motoristas e o mesmo telefone pelo perfil e pela Equipe. Essa conferência é de quem tiver login e banco, fora desta trilha.
