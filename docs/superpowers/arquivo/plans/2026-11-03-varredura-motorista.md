# Varredura de refatorações — trilha motorista — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Executar os itens 0.4, 1.6, 1.8 (com B13) e 1.11 (com B16) da varredura de 03/11/2026 sem mudar o comportamento do motorista, exceto onde um bug é corrigido de propósito.

**Architecture:** Cada item vira uma fonte única: a tabela de preferências padrão num módulo puro (`src/lib/motorista/preferenciasNavegacaoPadrao.ts`), a fórmula de Haversine em `src/lib/geo/distancia.ts`, as ações do contexto de rota estáveis com `useCallback` sobre primitivos, e a aba Paradas lendo o `ParadaData` do contexto pelo id. Os nomes antigos continuam como reexport onde trocar o chamador encostaria em arquivo de outra trilha.

**Tech Stack:** Expo/React Native + TypeScript, Jest + `@testing-library/react-native`, Supabase (só mockado; nada vai à rede).

**Spec:** `docs/superpowers/2026-11-03-varredura-refatoracoes.md` (branch `docs/varredura-refatoracoes-03-11`), itens 0.4, 1.6, 1.8, 1.11 e bugs B13/B16; relatório de origem R1 (motorista) §2, §6, §10, §13 e R3 (lib) §5.

## Global Constraints

- TDD: escreva o teste, **veja-o falhar pelo motivo certo**, depois implemente.
- Branch própria `refactor/varredura-motorista`, num worktree (superpowers:using-git-worktrees), a partir de `main` em `c64859af`.
- Nunca `--no-verify`.
- Nunca escrever em banco nem em rede (nada de `supabase db`, MCP de escrita, e2e contra produção).
- Jest dentro de worktree: `npx jest <caminho> --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers` — o caminho vem **antes** das opções (armadilha do PROJECT_CONTEXT: depois delas ele vira padrão de exclusão).
- Verificação final: suíte inteira do Jest, `npm run type-check`, `npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings=0 --ignore-pattern ".claude/**"`, `npm run build:web` e `npm run scan:morto:arquivos`.
- Sem push.
- Commits em PT-BR no estilo do repo (`tipo(escopo): descrição`), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- O pre-commit pode deixar ruído CRLF: confira com `git diff --ignore-cr-at-eol` e descarte o que for só fim de linha.
- Arquivos proibidos nesta trilha: `src/lib/google*.ts`, `src/lib/timeline.ts`, `src/lib/offline.ts`, `src/lib/motorista/fila*.ts`, `src/components/gestor/**`, `app/gestor/**`, `app/unidade/**`, `src/components/MapaWebMapLibre.tsx`, `.github/**`. `src/components/motorista/NavigationMode*.tsx` só nas linhas de preferências (a trilha mapas mexe nas cores sobre o mapa).
- Armadilhas que valem aqui: concluir parada **só** pelo `StopCompletionFlow`; o modo navegação tem uma porta (`handleNavigateToStop`); permissão no Android é consultada antes de pedida; fluxo da câmera sobrevive à Activity recriada (`useRestaurar*` em hook de tela); `theme` do Unistyles nunca em deps de efeito. Nenhuma tarefa abaixo muda esses caminhos, exceto o argumento do restore na Tarefa 6 (ver o cenário de aparelho dela).

## Ajustes em relação ao spec

1. **0.4 tem uma 4ª cópia.** `src/components/motorista/NavigationMode.web.tsx:107-110` repete os padrões (`proximityRadius ?? 50`, `showSpeedometer ?? true`), sustentada pelo tipo `NavigationPreferences` (`src/hooks/navigation/types.ts:22-30`), que tem campos opcionais. Entra na Tarefa 1, limitada a essas linhas (sobreposição com a trilha mapas registrada).
2. **0.4: não dá para só "importar `PREFERENCIAS_PADRAO` do serviço".** Três suítes (`NavigationSettings.test.tsx:23`, `NavigationMode.test.tsx:56`, `useNavigationModeLogic.test.ts:19`) mockam `@/services/locationTracking` com factory sem a constante: importada de lá, ela seria `undefined` nos testes. Alternativas: (A) importar do serviço e acrescentar a constante a cada mock (o teste volta a carregar uma tabela própria, que é o defeito); (B) mover só a constante e os tipos para um módulo puro, com reexport no serviço. **Escolhida B.** O armazenamento das preferências continua no serviço (a extração completa segue na Onda 2). Os mocks de `getNavigationPreferences` passam a devolver preferências completas, porque o spread redundante sai.
3. **1.6: `src/lib/routeGeometry.ts` não é "viva".** Só o próprio teste a importa (`src/lib/__tests__/routeGeometry.test.ts`). Ela passa a delegar à fonte única nesta trilha (uma linha), e a decisão de apagá-la fica com o item 0.2. `src/utils/timeEstimation.ts` (em km) também fica com o 0.2. **Nenhuma cópia mora em arquivo proibido.** Os 7 importadores de `calculateHaversineDistance` (entre eles `NavigationMode*.tsx`) não migram: o nome continua como reexport, para não encostar nos arquivos da trilha mapas. O consolidado (§5) põe o 1.6 na trilha **lib**; combine para ela não o refazer.
4. **B13 como proposto derrubaria todas as telas do gestor e do motorista.** O `DrawerMenuProvider` sempre renderiza `<DrawerMenu>` (`src/context/DrawerMenuContext.tsx:20`), que chama `useDrawerContact` → `useRouteStatus` (`src/components/drawer/hooks/useDrawerContact.ts:23`). No gestor não existe `RouteStatusProvider`, e no motorista o `DrawerMenuProvider` fica **por fora** dele (`app/motorista/_layout.tsx:53-58, 66-72`). Hoje o default `{}` esconde isso. Ajuste: o `throw` vem acompanhado de `useRouteStatusSeHouver()`, que o drawer usa (Tarefa 4).
5. **Bug novo (B13b).** Pelo mesmo motivo, a mensagem "Contatar gestor" do menu lateral **nunca** cita a rota nem o endereço atual, embora o código a monte (`useDrawerContact.ts:31-52`). O teste mocka o contexto e não percebe. A correção é inverter a ordem dos providers no layout do motorista (Tarefa 5), e ela **muda o texto que chega ao gestor pelo WhatsApp**. Por isso é condicional: só com OK do dono.
6. **1.8: `useCallback` com o objeto `userData` não resolveria.** O provider cria `{ id, nome }` novo a cada render (`RouteStatusProvider.tsx:147`). As dependências usam primitivos (`userData?.id`, `userData?.nome`).
7. **1.11: o skeleton não é extraído.** O bloco (`checkpoints.tsx:368-449`) usa seis estilos da própria tela (`header`, `statsRow`, `statItem`, `progressSection`, `progressContainer`, `listContainer`). Extraí-lo duplicaria estilos que precisam casar com o layout real, e o ganho é pequeno; fica para o 2.1, que reescreve o mesmo arquivo. **`concluindoParada` (do item 0.3) sai aqui**, por estar no mesmo arquivo: avise a trilha que pegar o 0.3. Com as 5 conversões trocadas, `toParadaData` (a função que perde campos) fica sem uso e é apagada.

## Review Focus

1. Ação de rota chamada logo depois de o status mudar (`pendente` → `em_andamento`): ela deve ler o status novo, nunca o de uma closure velha. Teste na Tarefa 3.
2. Componente que lê o contexto de rota montado fora do `RouteStatusProvider` (menu lateral do gestor e do motorista): monta sem lançar. Testes na Tarefa 4.
3. Parada que some do contexto entre o toque e o modal (o gestor a removeu, ou a restauração pós-câmera aponta para um id que não está mais lá): nenhum modal abre com dado velho e nada quebra. Teste na Tarefa 6.
4. Preferências ainda carregando, ou storage corrompido: tela e hook mostram a tabela única, não uma cópia local. Testes na Tarefa 1 (carga que nunca resolve); o caso corrompido já está em `locationTracking.test.ts:235`.
5. Distância na fronteira dos 30 m do agrupamento (`RAIO_MESMO_LOCAL_METROS`), pontos iguais e antípodas: o mesmo número de antes, nos três chamadores trocados. Testes na Tarefa 2.

---

### Task 1: Preferências de navegação — uma tabela de padrões (0.4)

**Aparelho:** não (os valores das três tabelas são iguais hoje). No navegador, só no smoke da Tarefa 7.

**Files:**

- Create: `src/lib/motorista/preferenciasNavegacaoPadrao.ts`
- Modify: `src/services/locationTracking.ts:53-106` (os tipos e a constante saem daqui e voltam como reexport) e o comentário em `:463-476`, que passa a dizer que as cópias foram apagadas
- Modify: `src/hooks/navigation/types.ts:22-30`
- Modify: `src/hooks/navigation/useNavigationModeLogic.ts:31-40, 76-77, 158-170`
- Modify: `src/components/motorista/NavigationSettings.tsx:19-21, 25, 38-59, 102-115, 164-167`
- Modify: `src/components/motorista/NavigationMode.web.tsx:107-110` (só isso)
- Modify (mocks): `src/components/motorista/__tests__/NavigationSettings.test.tsx:23-35`, `src/components/motorista/__tests__/NavigationMode.test.tsx:56-67`, `src/hooks/navigation/__tests__/useNavigationModeLogic.test.ts:19-32, 93-112`
- Test (novos): `src/components/motorista/__tests__/NavigationSettings.padroes.test.tsx`, `src/hooks/navigation/__tests__/useNavigationModeLogic.padroes.test.ts`

**Interfaces:**

- Produces, em `src/lib/motorista/preferenciasNavegacaoPadrao.ts` (sem import com efeito colateral: nada de `expo-*`, `react-native`, Supabase): `export type ModoNavegar = 'mapa' | 'externo'`, `export interface NavigationState` (movida sem mudança), `export type PreferenciasDeNavegacao` (a mesma definição de hoje) e `export const PREFERENCIAS_PADRAO: PreferenciasDeNavegacao` (os mesmos 8 valores de `locationTracking.ts:97-106`).
- `src/services/locationTracking.ts` reexporta `PREFERENCIAS_PADRAO` e os três tipos; `import { PREFERENCIAS_PADRAO } from '@/services/locationTracking'` continua valendo, e é o que `locationTracking.test.ts:119` usa.
- `src/hooks/navigation/types.ts`: `export type NavigationPreferences = PreferenciasDeNavegacao` (todos os campos obrigatórios).
- `NavigationSettings.tsx`: `export type NavigationSettingsState = Pick<PreferenciasDeNavegacao, 'navegarCom' | 'soundAlerts' | 'vibrationAlerts' | 'proximityRadius' | 'showSpeedometer' | 'preventScreenSleep' | 'preferredNavApp'>`; `NavAppPreference = PreferenciasDeNavegacao['preferredNavApp']`.

- [ ] **Step 1: Criar o módulo puro e o reexport (refatoração sem mudança de comportamento)**

Mova `ModoNavegar`, `NavigationState`, `PreferenciasDeNavegacao` e `PREFERENCIAS_PADRAO` para o arquivo novo e reexporte do serviço.

Run: `npx jest src/services/__tests__/locationTracking.test.ts src/components/motorista/__tests__/NavigationSettings.test.tsx --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: PASS (nada mudou de comportamento).

- [ ] **Step 2: Escrever os testes que falham**

Nos dois arquivos novos, mocke o módulo puro com padrões alterados, para que só a leitura da tabela única possa passar:

```ts
jest.mock('@/lib/motorista/preferenciasNavegacaoPadrao', () => {
  const real = jest.requireActual(
    '@/lib/motorista/preferenciasNavegacaoPadrao',
  );
  return {
    ...real,
    PREFERENCIAS_PADRAO: {
      ...real.PREFERENCIAS_PADRAO,
      navegarCom: 'externo',
      proximityRadius: 80,
      soundAlerts: false,
    },
  };
});
```

`NavigationSettings.padroes.test.tsx` (o resto do setup copiado de `NavigationSettings.test.tsx`; o fluxo de confirmar o diálogo é o de `'Restaurar Padrões limpa as preferências, sem gravar os padrões'`, `:258`):

- `it('Restaurar Padrões volta à tabela única de padrões')`: confirma o diálogo e espera `expect(onSettingsChange).toHaveBeenLastCalledWith(expect.objectContaining({ navegarCom: 'externo', proximityRadius: 80, soundAlerts: false }))`.

`useNavigationModeLogic.padroes.test.ts` (com `getNavigationPreferences: jest.fn(() => new Promise(() => {}))`, uma carga que nunca termina):

- `it('antes de carregar, usa a tabela única de padrões')`: `expect(result.current.preferences).toEqual(require('@/lib/motorista/preferenciasNavegacaoPadrao').PREFERENCIAS_PADRAO)`.

- [ ] **Step 3: Ver falhar**

Run: `npx jest src/components/motorista/__tests__/NavigationSettings.padroes.test.tsx src/hooks/navigation/__tests__/useNavigationModeLogic.padroes.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL nos dois, com `navegarCom: 'mapa'` e `proximityRadius: 50` recebidos (vindos de `DEFAULT_SETTINGS`/`DEFAULT_PREFERENCES`).

- [ ] **Step 4: Apagar as cópias**

- `useNavigationModeLogic.ts`: sai `DEFAULT_PREFERENCES`; o estado inicial é `PREFERENCIAS_PADRAO`; `loadPreferences` faz `setPreferences(await LocationTrackingService.getNavigationPreferences())`, sem spread (o serviço já devolve tudo preenchido). O comentário de `:160-161` sai junto.
- `NavigationSettings.tsx`: sai `DEFAULT_SETTINGS`; estado inicial e "Restaurar" usam `PREFERENCIAS_PADRAO`; `loadSettings` faz `setSettings(prefs)`, sem spread.
- `NavigationMode.web.tsx:107-110`: `const { proximityRadius, showSpeedometer } = preferences;`.
- Os três mocks de `getNavigationPreferences` passam a resolver `{ ...jest.requireActual('@/lib/motorista/preferenciasNavegacaoPadrao').PREFERENCIAS_PADRAO, <os overrides que cada um já tinha> }` (dentro da factory, com `require`).
- `useNavigationModeLogic.test.ts:103-111`: a asserção `'should have default preferences'` passa a ser `toEqual(PREFERENCIAS_PADRAO)`. Era o teste que fixava a cópia.

- [ ] **Step 5: Ver passar**

Run: `npx jest src/components/motorista src/hooks/navigation src/services --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers` e depois `npm run type-check`
Expected: PASS; `tsc` sem erro. Confira também que `grep -rn "proximityRadius: *[0-9]" src app --include=*.ts --include=*.tsx | grep -v __tests__` devolve só a linha do módulo puro.

- [ ] **Step 6: Commit**

```bash
git add src/lib/motorista/preferenciasNavegacaoPadrao.ts src/services/locationTracking.ts src/hooks/navigation src/components/motorista/NavigationSettings.tsx src/components/motorista/NavigationMode.web.tsx src/components/motorista/__tests__
git commit -m "refactor(navegação): uma tabela de preferências padrão, sem as cópias da tela e do hook"
```

---

### Task 2: Haversine — uma implementação (1.6)

**Aparelho:** sim, no lote de validação (consolidado §5, "Aparelho em lote"). O cálculo do serviço em segundo plano trocou de função. Cenário: rota em andamento no moto g15, modo navegação → aparece "Rastreando", as posições chegam ao mapa do gestor e a chegada no raio continua detectada (log `[LocationTracking]`). Não bloqueia o merge.

**Files:**

- Create: `src/lib/geo/distancia.ts`
- Modify: `src/lib/osrm/fallback.ts:18-46` (vira reexport)
- Modify: `src/lib/routeGeometry.ts:27-65` (constante e `calculateDistance` vêm da fonte)
- Modify: `src/hooks/useNovaEntrega.helpers.ts:302-320` (`distanceInMeters` mantém a guarda e delega)
- Modify: `src/services/locationTracking.ts:284, 401-419` (sai o método privado `calculateDistance`)
- Test (novos): `src/lib/geo/__tests__/distancia.test.ts`, `src/lib/geo/__tests__/distancia-paridade.test.ts`, `src/lib/geo/__tests__/haversine-fonte-unica.test.ts`

**Interfaces:**

- Produces, em `src/lib/geo/distancia.ts`: `export interface PontoGeo { latitude: number; longitude: number }`, `export const RAIO_DA_TERRA_METROS = 6371000`, `export function distanciaMetrosEntre(lat1: number, lon1: number, lat2: number, lon2: number): number` e `export function distanciaMetros(a: PontoGeo, b: PontoGeo): number`.
- Mantidos como aliases sem corpo próprio: `calculateHaversineDistance` (`osrm/fallback.ts`, e por ele `@/lib/osrm`) e `calculateDistance` (`routeGeometry.ts`); `routeGeometry` usa `RAIO_DA_TERRA_METROS` no cross-track.

- [ ] **Step 1: Escrever o teste da função nova**

`distancia.test.ts`, com os valores medidos na implementação atual (03/11):

- `it('São Paulo → Rio')`: `expect(distanciaMetrosEntre(-23.5505, -46.6333, -22.9068, -43.1729)).toBeCloseTo(360748.8249099, 4)`.
- `it('par a 30,17 m fica fora do raio de mesmo local')`: `const d = distanciaMetrosEntre(-23.5505, -46.6333, -23.5507, -46.6335); expect(d).toBeCloseTo(30.169319000331836, 9); expect(d).toBeGreaterThan(RAIO_MESMO_LOCAL_METROS)` (de `@/lib/route-optimization/agrupamento`).
- `it('João Pessoa, ~31 m')`: `(-7.1195, -34.845, -7.1197, -34.8452)` → `toBeCloseTo(31.329660610544078, 9)`.
- `it('antípodas no equador')`: `(0, 0, 0, 180)` → `toBeCloseTo(20015086.79602057, 4)`.
- `it('mesmo ponto é zero')` → `toBe(0)`.
- `it('é simétrica')`: ida e volta `toBe` iguais.
- `it('forma de objeto = forma de 4 números')`: `distanciaMetros({latitude:-23.5505, longitude:-46.6333}, {latitude:-22.9068, longitude:-43.1729})` `toBe` o valor da forma de 4 números.

- [ ] **Step 2: Ver falhar**

Run: `npx jest src/lib/geo/__tests__/distancia.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL com "Cannot find module '../distancia'".

- [ ] **Step 3: Implementar `src/lib/geo/distancia.ts`** com a fórmula de `osrm/fallback.ts:25-46`. A forma de objeto chama a de 4 números.

- [ ] **Step 4: Ver passar**

Run: o mesmo do Step 2. Expected: PASS.

- [ ] **Step 5: Teste de paridade (caracterização, verde antes da troca)**

`distancia-paridade.test.ts`: para os 5 pares do Step 1, `it.each` comparando com `distanciaMetrosEntre` por `toBeCloseTo(esperado, 9)`: `calculateHaversineDistance` (`@/lib/osrm/fallback`), `calculateDistance` (`@/lib/routeGeometry`) e `distanceInMeters({latitude, longitude}, {latitude, longitude})` (`@/hooks/useNovaEntrega.helpers`). Mais `it('distanceInMeters sem coordenada continua infinita')`: `expect(distanceInMeters({}, {latitude:0, longitude:0})).toBe(Number.POSITIVE_INFINITY)`.

Run: `npx jest src/lib/geo --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: PASS (as cópias ainda existem e concordam).

- [ ] **Step 6: Guarda estática (falha agora)**

`haversine-fonte-unica.test.ts`, no modelo de `src/lib/__tests__/data-local-sem-utc.test.ts` (varre `src/` e `app/` fora de `__tests__`): `it('o raio da Terra em metros só aparece na fonte única')`: arquivos que casam com `/\b6_?371_?000\b/` devem ser `['src/lib/geo/distancia.ts']`. (O `6371` em km de `src/utils/timeEstimation.ts` não casa; ele sai no 0.2.)

Run: `npx jest src/lib/geo/__tests__/haversine-fonte-unica.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL, listando `osrm/fallback.ts`, `routeGeometry.ts`, `useNovaEntrega.helpers.ts` e `locationTracking.ts`.

- [ ] **Step 7: Trocar as quatro cópias pela fonte única** (aliases e delegação descritos em Interfaces; em `locationTracking.ts`, `processLocationUpdate` chama `distanciaMetrosEntre`).

- [ ] **Step 8: Ver passar**

Run: `npx jest src/lib/geo src/lib/__tests__/routeGeometry.test.ts src/lib/__tests__/osrm.test.ts src/lib/route-optimization src/lib/motorista src/hooks/__tests__/useNovaEntrega.helpers.test.ts src/services/__tests__/locationTracking.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers` e `npm run type-check`
Expected: PASS em todos, inclusive os de chegada/proximidade de `locationTracking.test.ts:920-1160`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/geo src/lib/osrm/fallback.ts src/lib/routeGeometry.ts src/hooks/useNovaEntrega.helpers.ts src/services/locationTracking.ts
git commit -m "refactor(geo): Haversine numa fonte só, com guarda contra nova cópia"
```

---

### Task 3: Contexto de rota — ações estáveis (1.8, parte 1)

**Aparelho:** não. Smoke no navegador na Tarefa 7 (iniciar, concluir com foto, pular).

**Files:**

- Modify: `src/hooks/route-status/useRouteActions.ts:96-300` (`startRoute`, `executarOuEnfileirar`, `completeStop`, `skipStop`, `completeRoute` em `useCallback`; o helper de rótulo que lê `paradas`, logo antes de `completeStop`, entra nas deps ou vira função pura recebendo `paradas`)
- Modify: `src/context/route-status/RouteStatusProvider.tsx:1-6` (cabeçalho desatualizado: "~100-line orchestrator")
- Test (novo): `src/hooks/route-status/__tests__/useRouteActions.estabilidade.test.ts`
- Test (acrescentar describe): `src/context/__tests__/RouteStatusContext.test.tsx`

**Interfaces:**

- Consumes: `UseRouteActionsOptions` (sem mudança de assinatura).
- Produces: `useRouteActions` devolve as mesmas 4 funções, com identidade estável enquanto `route`, `paradas`, `userData?.id`, `userData?.nome`, `loadActiveRoute` e `portaParadas` não mudarem. Deps em primitivos: `const motoristaId = userData?.id; const motoristaNome = userData?.nome;`.

- [ ] **Step 1: Escrever os testes que falham**

`useRouteActions.estabilidade.test.ts` (mocks copiados de `useRouteActions.test.ts`, com `portaParadas` em memória):

- `it('mantém a identidade das ações quando re-renderiza com os mesmos dados')`: `rerender` com o **mesmo** `route` e `paradas` e um `userData` **novo** `{ id: 'm1', nome: 'Ana' }`; para cada uma das 4 ações, `expect(depois.x).toBe(antes.x)`.
- `it('depois de a rota passar a em_andamento, concluir usa o status novo')`: começa com `route.status = 'pendente'`, `rerender` com `{ ...route, status: 'em_andamento' }`; `await expect(result.current.completeStop('p1')).resolves.toBeDefined()` (não lança "A rota precisa estar em andamento").
- `it('troca a ação quando o motorista muda')`: `rerender` com `userData` de outro `id`; `expect(depois.completeStop).not.toBe(antes.completeStop)`.

`RouteStatusContext.test.tsx`, novo `describe('identidade do valor')`:

- `it('o valor do contexto não muda quando o provider re-renderiza sem mudança de dados')`: um consumidor guarda cada `useRouteStatus()` num array; espera a carga terminar; `rerender(<RouteStatusProvider><Consumidor /></RouteStatusProvider>)`; `expect(valores.at(-1)).toBe(valores.at(-2))`.

- [ ] **Step 2: Ver falhar**

Run: `npx jest src/hooks/route-status/__tests__/useRouteActions.estabilidade.test.ts src/context/__tests__/RouteStatusContext.test.tsx --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL em "mantém a identidade" e em "o valor do contexto não muda" (função nova a cada render). Os outros dois testes novos já passam: são guarda de regressão.

- [ ] **Step 3: Envolver as cinco funções em `useCallback`**, com as deps de Interfaces. O provider não muda. Se o teste do provider continuar vermelho por **outra** dependência instável, identifique qual comparando as chaves de `valores.at(-1)` e `valores.at(-2)`. Estabilize-a só se morar em `src/hooks/route-status/` ou no provider; senão, registre no commit e pare.

- [ ] **Step 4: Ver passar**

Run: `npx jest src/hooks/route-status src/context --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers` e `npx eslint src/hooks/route-status src/context --max-warnings=0`
Expected: PASS; sem aviso de `react-hooks/exhaustive-deps`.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/route-status src/context
git commit -m "perf(rota): ações do contexto estáveis, sem re-renderizar quem só as chama"
```

---

### Task 4: `useRouteStatus` fora do provider lança, e o menu lateral não depende disso (1.8 parte 2, B13)

**Aparelho:** não. **No navegador é obrigatório** (Tarefa 7): abrir o app como gestor e como motorista e abrir o menu lateral, porque um erro aqui derruba todas as telas. O login é do usuário.

**Files:**

- Modify: `src/context/route-status/RouteStatusProvider.tsx:45-47, 234-242`
- Modify: `src/context/RouteStatusContext.tsx:11` (reexporta o hook novo)
- Modify: `src/components/drawer/hooks/useDrawerContact.ts:8, 23`
- Test (novos): `src/context/__tests__/RouteStatusContext.foraDoProvider.test.tsx`, `src/components/drawer/hooks/__tests__/useDrawerContact.semProvider.test.ts`

**Interfaces:**

- Produces: `createContext<RouteStatusContextData | null>(null)`; `useRouteStatus(): RouteStatusContextData`, que lança `Error('useRouteStatus must be used within RouteStatusProvider')` sem provider; `export function useRouteStatusSeHouver(): RouteStatusContextData | null` (para quem monta nos dois layouts: hoje só o drawer).
- `useDrawerContact`: `const status = useRouteStatusSeHouver(); const rotaAtiva = status?.route ?? null; const currentStop = status?.currentStop ?? null;`.

- [ ] **Step 1: Escrever os testes**

`RouteStatusContext.foraDoProvider.test.tsx` (silencie `console.error` com `jest.spyOn`):

- `it('useRouteStatus fora do provider lança com mensagem clara')`: `expect(() => renderHook(() => useRouteStatus())).toThrow('useRouteStatus must be used within RouteStatusProvider')`.
- `it('useRouteStatusSeHouver fora do provider devolve null')`: `expect(renderHook(() => useRouteStatusSeHouver()).result.current).toBeNull()`.

`useDrawerContact.semProvider.test.ts` (mocks de `useUser`, `supabase` e `Linking` copiados de `useDrawerContact.test.ts`, **sem** mockar `@/context/RouteStatusContext`):

- `it('monta fora do RouteStatusProvider, como no layout do gestor')`: `expect(() => renderHook(() => useDrawerContact({ onClose: jest.fn() }))).not.toThrow()`.

- [ ] **Step 2: Ver o estado de partida**

Run: `npx jest src/context/__tests__/RouteStatusContext.foraDoProvider.test.tsx src/components/drawer --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL nos dois testes de `foraDoProvider` (o primeiro não lança, porque o default é `{}`; o segundo, porque o hook não existe). `semProvider` passa.

- [ ] **Step 3: Só o `throw` (contexto `null`, `useRouteStatusSeHouver` exportado), sem mexer no drawer**

Run: o mesmo do Step 2.
Expected: `foraDoProvider` PASS; `useDrawerContact.semProvider` e `src/components/__tests__/DrawerMenu.test.tsx` **FAIL** com a mensagem do throw. Isso prova que a guarda pega o caso real.

- [ ] **Step 4: `useDrawerContact` passa a usar `useRouteStatusSeHouver`**

Run: o mesmo do Step 2, mais `src/components/__tests__/DrawerMenu.test.tsx`. Expected: PASS.

- [ ] **Step 5: Suíte inteira, atrás de dependentes do `{}`**

Run: `npx jest --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: PASS. Teste que quebrar com "must be used within RouteStatusProvider" renderizava sem provider e sem mock: corrija o **teste** (mock do `@/context/RouteStatusContext` ou wrapper), nunca reabra o default, e liste os arquivos no corpo do commit. Se a falha vier de código de produção fora do drawer, pare e reporte: seria outro consumidor fora do provider que este plano não achou (o grep de 03/11 achou só o drawer).

- [ ] **Step 6: Commit**

```bash
git add src/context src/components/drawer
git commit -m "fix(rota): useRouteStatus fora do provider lança; menu lateral usa a leitura opcional"
```

---

### Task 5 (CONDICIONAL — só com OK do dono): menu lateral do motorista enxerga a rota (B13b)

**Aparelho:** não. No navegador, como motorista com rota em andamento: Menu → "Contatar gestor" → a mensagem cita `rota #xxxxxxxx` e o endereço atual.

**Por que condicional:** a mensagem que o gestor recebe pelo WhatsApp passa a trazer a rota e o endereço. Era o desenho original, mas é texto visível a terceiros.

**Files:**

- Modify: `app/motorista/_layout.tsx:51-72` (nos dois ramos, desktop e mobile, `<RouteStatusProvider>` passa a envolver `<DrawerMenuProvider>`; `TransmissaoDePosicao` continua dentro do `RouteStatusProvider`)
- Test (novo): `app/__tests__/motorista-layout-ordem-providers.test.ts`

**Interfaces:**

- Consumes: `useRouteStatusSeHouver` (Tarefa 4). Nenhuma assinatura muda.

- [ ] **Step 1: Escrever o teste**

Guarda estática (o layout é pesado demais para renderizar): lê `app/motorista/_layout.tsx` e, para cada ocorrência de `<DrawerMenuProvider>`, exige um `<RouteStatusProvider>` aberto antes dela e ainda não fechado.

- `it('o menu lateral do motorista fica dentro do RouteStatusProvider, nos dois layouts')`: `expect(ocorrenciasForaDoProvider).toEqual([])` e `expect(totalDeDrawerMenuProvider).toBe(2)`.

- [ ] **Step 2: Ver falhar**

Run: `npx jest app/__tests__/motorista-layout-ordem-providers.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL com as 2 ocorrências fora do provider.

- [ ] **Step 3: Inverter a ordem dos providers nos dois ramos.**

- [ ] **Step 4: Ver passar**

Run: `npx jest app/__tests__ src/components/drawer --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: PASS, inclusive `app/__tests__/layouts-sem-conexao.test.tsx`.

- [ ] **Step 5: Commit**

```bash
git add app/motorista/_layout.tsx app/__tests__/motorista-layout-ordem-providers.test.ts
git commit -m "fix(motorista): menu lateral dentro do contexto da rota; contato com o gestor volta a citar a rota"
```

---

### Task 6: Aba Paradas usa o `ParadaData` do contexto (1.11, B16)

**Aparelho:** recomendado no lote, não bloqueante, porque o argumento da restauração pós-câmera mudou. Cenário: `adb shell settings put global always_finish_activities 1`, aba Paradas, concluir uma entrega com foto, voltar da câmera → o fluxo reabre na **mesma** parada e o comprovante grava nela. Depois, `always_finish_activities 0`.

**Files:**

- Modify: `app/motorista/_screens/checkpoints.tsx:38, 61-63, 76-81, 103-131, 146-170, 286-302, 585-596`
- Modify: `src/utils/typeMappers.ts:38-56` (sai `toParadaData`)
- Modify: `src/utils/__tests__/typeMappers.observacaoPulo.test.ts:24-27` (sai o caso de `toParadaData`; fica o de `toParada`)
- Test (novo): `app/motorista/_screens/__tests__/paradas-parada-do-contexto.test.tsx`

**Interfaces:**

- Na tela: `const paradasReais = useMemo(() => paradasContext.filter((p) => p.is_checkpoint !== false), [paradasContext])` (`ParadaData[]`); `const paradas = useMemo(() => paradasReais.map(toParada), [paradasReais])`; `const paradaDoContexto = useCallback((id: string): ParadaData | null => paradasContext.find((p) => p.id === id) ?? null, [paradasContext])`.
- `concluirParada(parada: Parada)` → `sequencia.iniciar(paradaDoContexto(parada.id))`, só quando não for `null`.
- `useRestaurarConclusaoEmVoo(route, paradasReais, (parada) => sequencia.iniciar(parada))` (o hook é genérico em `P`, `useRestaurarConclusaoEmVoo.ts:42`).
- Pulo: `skipModalParada` continua `Parada | null`; `const paradaParaPular = skipModalParada ? paradaDoContexto(skipModalParada.id) : null`; o `SkipReasonModal` só monta com `paradaParaPular` e recebe `parada={paradaParaPular}` e `paradasDaVisita(paradasContext, paradaParaPular).slice(1)`; `confirmarSkip` usa `paradaParaPular`, e com `null` só fecha o modal.
- Sai `concluindoParada`/`_setConcluindoParada` e o `concluindo={...}` passado ao `ParadaCard` (a prop é opcional; confira em `ParadaCard.types.ts`).

- [ ] **Step 1: Escrever os testes que falham**

Setup copiado de `paradas-visita-combinada.test.tsx`, com duas mudanças. O mock de `useRouteStatus` lê `mockParadasDoContexto`, que é mutável e traz a parada `p3` com `foto_url: 'u1/r1/p3_1.jpg'` e `updated_at: '2026-11-03T12:00:00Z'`. E os mocks de `StopCompletionFlow`/`SkipReasonModal` registram as props em `mockPropsFluxo`/`mockPropsPulo` (`jest.fn()`), mantendo os mesmos textos e botões:

- `it('concluir entrega ao fluxo o ParadaData do contexto, sem perder campos')`: `fireEvent.press(getByText('concluir:p3'))`; `expect(mockPropsFluxo.mock.calls.at(-1)[0].parada).toBe(mockParadasDoContexto.find(p => p.id === 'p3'))`.
- `it('pular entrega ao modal o ParadaData do contexto')`: `pular:p3` → `expect(mockPropsPulo.mock.calls.at(-1)[0].parada).toBe(<p3 do contexto>)`.
- `it('restauração pós-câmera reabre o fluxo com o ParadaData do contexto')`: `const restaurar = (useRestaurarConclusaoEmVoo as jest.Mock).mock.calls.at(-1)[2]`; `act(() => restaurar(<p3 do contexto>))`; `expect(mockPropsFluxo.mock.calls.at(-1)[0].parada).toBe(<p3 do contexto>)`.
- `it('parada que sumiu do contexto não abre o modal de pulo')`: `pular:p3`; tira `p3` de `mockParadasDoContexto` e faz `rerender`; `expect(queryByText('confirmar-com-outros')).toBeNull()`.

- [ ] **Step 2: Ver falhar**

Run: `npx jest app/motorista/_screens/__tests__/paradas-parada-do-contexto.test.tsx --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL nos três primeiros (`toBe` recebe o objeto recriado por `toParadaData`, sem `foto_url`/`updated_at`) e no quarto (o modal continua aberto com a `Parada` guardada).

- [ ] **Step 3: Implementar como em Interfaces; apagar `toParadaData` e o caso de teste dele.**

- [ ] **Step 4: Ver passar**

Run: `npx jest app/motorista/_screens/__tests__ src/utils/__tests__/typeMappers.observacaoPulo.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers` e `npm run type-check`
Expected: PASS, inclusive `paradas-visita-combinada`, `paradas-retomar` e `paradas-recarga-silenciosa`; `grep -rn "toParadaData" src app` vazio.

- [ ] **Step 5: Commit**

```bash
git add app/motorista/_screens src/utils/typeMappers.ts src/utils/__tests__/typeMappers.observacaoPulo.test.ts
git commit -m "fix(paradas): concluir e pular usam a parada do contexto, sem a conversão que perdia campos"
```

---

### Task 7: Verificação final e smoke

**Aparelho:** não aqui. Os cenários das Tarefas 2 e 6 vão para o lote de validação do moto g15, depois da pendência 23 e respeitando a 31 (SDK 58), conforme o consolidado §5.

- [ ] **Step 1: Suíte e checagens**

Run, em sequência:

- `npx jest --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
- `npm run type-check`
- `npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings=0 --ignore-pattern ".claude/**"`
- `npm run build:web`
- `npm run scan:morto:arquivos`

Expected: todos com exit 0. Confira também que a contagem de testes no resumo do Jest subiu e nenhuma suíte sumiu (silêncio não é prova). O `scan:morto:arquivos` deve continuar vazio. Rode também `npm run scan:morto:autoteste`, porque lista vazia sozinha não distingue cegueira de limpeza.

- [ ] **Step 2: Smoke no navegador** (servindo o `dist` local, não o preview da Vercel; o login é do usuário): gestor abre e o menu lateral abre (Tarefa 4); motorista abre, menu lateral abre, Configurações de navegação mostram os padrões e "Restaurar Padrões" funciona (Tarefa 1); com rota em andamento: concluir com foto e pular na aba Paradas (Tarefas 3 e 6). Se a Tarefa 5 entrou, também "Contatar gestor" cita a rota.

- [ ] **Step 3: Ruído CRLF**

Run: `git status` e `git diff --ignore-cr-at-eol`
Expected: nada além do que foi commitado; descarte arquivo que só mudou fim de linha (`git checkout -- <arquivo>`).
