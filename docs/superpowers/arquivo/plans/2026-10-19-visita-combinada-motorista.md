# Visita combinada no app do motorista — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando uma entrega e uma retirada ficam no mesmo local, o motorista vê, navega, conclui e pula como UMA visita, mantendo uma foto por serviço.

**Architecture:** Nada muda no banco: continuam duas paradas. Um módulo puro (`src/lib/motorista/visitaNoLocal.ts`) deriva a visita das coordenadas, reaproveitando `RAIO_MESMO_LOCAL_METROS` (30 m) e o haversine que o otimizador já usa (#589). A Início usa esse módulo para três coisas: não mandar navegar para 0 m; encadear o `StopCompletionFlow` existente (um fluxo por serviço, cada um com a sua foto); e oferecer pular os serviços juntos. Os mapas (nativo e web) desenham um pino só por local, rotulado "3+4".

**Tech Stack:** React Native + Expo, TypeScript, Jest + @testing-library/react-native, MapLibre (nativo `@maplibre/maplibre-react-native`, web `maplibre-gl` 6).

**Spec:** sem documento de design (o usuário dispensou as perguntas). As decisões vêm da conversa de 19/10/2026 e estão registradas na memória `visita-combinada-entrega-retirada`: duas paradas no banco, sem mudança de esquema; agrupamento derivado das coordenadas (≤ 30 m); **entrega antes da retirada**; **uma foto por serviço**. Etapas 2 (#590) e 3 (#589) já estão na main.

## Global Constraints

- Sem migration nem mudança de esquema; `paradas` continua uma linha por serviço.
- Raio do mesmo local: importar `RAIO_MESMO_LOCAL_METROS` de `src/lib/route-optimization/agrupamento.ts` (30). Não duplicar o número.
- Distância: `calculateHaversineDistance(lat1, lon1, lat2, lon2)` de `src/lib/osrm/fallback.ts`.
- Concluir parada SÓ pelo `StopCompletionFlow` (CLAUDE.md). Nada conclui em lote nem sem passar pelo fluxo.
- O modo navegação continua com uma porta só, `handleNavigateToStop` (`app/motorista/_screens/inicio.tsx`).
- Uma foto por serviço: cada serviço da visita passa pelo seu próprio `StopCompletionFlow`.
- Padrões do repo: `logger.warn(msg, err)` com no máximo 2 args; sem `as any`; os testes espiam `logger`, não `console`; textos em pt-BR.
- Rodar a suíte com `npx jest --testPathIgnorePatterns=worktrees --modulePathIgnorePatterns=worktrees` (worktrees dentro do repo contaminam o haste-map).

## Review Focus

1. **Paradas a ≤ 30 m que NÃO são consecutivas na ordem** (reordenação manual): na execução, só agrupar as consecutivas. A outra continua avulsa. No mapa, o pino agrupa todas, com rótulo "3+7". Teste na Task 2.
2. **Um serviço da visita já concluído ou pulado:** a visita na execução contém só os pendentes. O pino mostra a cor do status mais "aberto" (pendente/em andamento vence concluída/pulada). Testes nas Tasks 2 e 6.
3. **Coordenada ausente ou 0,0:** nunca agrupa (fica sozinha), sem quebrar. Teste na Task 2.
4. **Motorista cancela o fluxo do 2º serviço:** nada reabre sozinho em loop. O card continua mostrando o 2º serviço, e tocar em Navegar abre a conclusão em vez do Waze, porque a anterior foi concluída no mesmo local. Testes nas Tasks 3 e 4.
5. **Activity recriada pela câmera no meio do 1º serviço:** a restauração (`useRestaurarConclusaoEmVoo`) reabre o fluxo pelo mesmo `iniciar` da sequência, então o 2º serviço ainda é emendado. Teste na Task 4.

---

### Task 1: Textos do motorista pelo tipo da parada

**Files:**

- Create: `src/lib/motorista/rotuloTipoParada.ts`
- Test: `src/lib/motorista/__tests__/rotuloTipoParada.test.ts`
- Modify: `src/hooks/navigation/useNavigationActions.ts:53-54`
- Modify: `src/components/motorista/StopCompletionFlow.tsx:96` (e confira `:233`)
- Test: `src/components/motorista/__tests__/StopCompletionFlow.test.tsx`; teste do `useNavigationActions` (procure em `src/hooks/navigation/__tests__/`; crie se não houver)

**Interfaces:**

- Produces: `rotuloTipoParada(tipo: string): { nome: string; titulo: string }`. Devolve `{ nome: 'entrega', titulo: 'Entrega' }` ou `{ nome: 'retirada', titulo: 'Retirada' }`, e `{ nome: 'parada', titulo: 'Parada' }` para qualquer outro valor (o tipo vem como `string` em `ParadaData`).

- [ ] **Step 1: Testes que falham.** `rotuloTipoParada('retirada')` → `{ nome: 'retirada', titulo: 'Retirada' }`; `'entrega'` → Entrega; `'origem'`/`''` → Parada. No `useNavigationActions`, com `currentStop.tipo = 'retirada'`, o `showConfirm` recebe `title: 'Confirmar Retirada'` e uma `message` que começa com `'Confirma a retirada em:'`. No `StopCompletionFlow`, pular a foto numa retirada mostra `'A foto serve como comprovante da retirada. Deseja continuar sem foto?'`.
- [ ] **Step 2:** Rodar os 3 arquivos de teste. Esperado: FAIL (módulo inexistente / textos antigos com "entrega").
- [ ] **Step 3:** Implementar o helper e trocar os textos fixos. Faça grep da FORMA errada (string literal de UI com "entrega" em `src/components/motorista`, `src/hooks/navigation`, `src/hooks/route-status`, `app/motorista`) e troque só as que valem para qualquer tipo.
- [ ] **Step 4:** Rodar os testes. Esperado: PASS.
- [ ] **Step 5: Commit** `fix(motorista): textos acompanham o tipo da parada`.

### Task 2: Módulo puro da visita no local

**Files:**

- Create: `src/lib/motorista/visitaNoLocal.ts`
- Test: `src/lib/motorista/__tests__/visitaNoLocal.test.ts`

**Interfaces:**

- Consumes: `RAIO_MESMO_LOCAL_METROS`, `calculateHaversineDistance`, `ParadaData` (`src/context/route-status/types.ts`).
- Produces:
  - `paradasDaVisita(paradas: ParadaData[], atual: ParadaData): ParadaData[]`: `atual` mais as paradas seguintes **consecutivas** por `ordem` (ignorando `is_checkpoint === false`), com status `pendente`/`em_andamento`, a ≤ raio de `atual`. Para na primeira que não serve. Sempre começa por `atual`.
  - `chegouPelaParadaAnterior(paradas: ParadaData[], atual: ParadaData): boolean`: a parada real imediatamente anterior por `ordem` está `concluida`/`pulada` e a ≤ raio de `atual`.
  - `agruparPorLocal<T extends { id: string; ordem: number; latitude?: number | null; longitude?: number | null }>(paradas: T[]): T[][]`: grupos por âncora (a parada entra no primeiro grupo cuja PRIMEIRA parada está no raio, como em `agrupamento.ts`), ordenados por `ordem`, e cada grupo ordenado por `ordem`. Coordenada ausente ou 0,0 vira grupo próprio.

- [ ] **Step 1: Testes que falham** (`ParadaData` em coordenadas reais de João Pessoa; 25 m ≈ 0,000225° de latitude):
  - `paradasDaVisita`: entrega(ordem 3) + retirada(4) no mesmo ponto → `[3, 4]`; retirada a 40 m → `[3]`; 3 serviços no ponto → `[3, 4, 5]`; ponto repetido mas não consecutivo (3 e 5, com 4 em outro lugar) → `[3]`; a 4 já `concluida` → `[3]`.
  - `chegouPelaParadaAnterior`: anterior `concluida` no mesmo ponto → `true`; anterior `pendente` → `false`; anterior a 40 m → `false`; sem anterior (primeira parada) → `false`; checkpoint de partida (`is_checkpoint: false`) não conta como anterior.
  - `agruparPorLocal`: [3, 4 no mesmo ponto; 5 longe] → `[[3, 4], [5]]`; 3 e 7 no mesmo ponto (não consecutivas) → mesmo grupo; `latitude: null` → grupo próprio; fileira de 3 casas a 25 m uma da outra → `[[a, b], [c]]` (âncora, não vizinho).
- [ ] **Step 2:** Rodar. Esperado: FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar as três funções em `visitaNoLocal.ts`.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(motorista): deriva a visita no local a partir das coordenadas`.

### Task 3: Início — sem navegar para 0 m e card "Neste local"

**Files:**

- Modify: `app/motorista/_screens/inicio.tsx` (`handleNavigateToStop`, ~:275)
- Modify: `src/components/motorista/home/MainCard/MainCardActive.tsx`
- Test: `app/motorista/_screens/__tests__/inicio-modo-navegacao.test.tsx` (padrão de mocks já pronto ali); `src/components/motorista/home/__tests__/MainCard.test.tsx`

**Interfaces:**

- Consumes: `chegouPelaParadaAnterior`, `paradasDaVisita` (Task 2); `rotuloTipoParada` (Task 1).

- [ ] **Step 1: Testes que falham.**
  - Início: com a entrega (ordem 3) `concluida` e a retirada (4) no mesmo ponto como parada atual, tocar em Navegar abre o `StopCompletionFlow` da retirada e NÃO chama `abrirNavegacao` nem ativa o modo navegação. Com a anterior a 40 m, segue o caminho atual (o "Navegar com" decide).
  - MainCard: com a entrega atual e a retirada no mesmo ponto em seguida, renderiza `testID="visita-no-local"` com o texto `'Neste local: Entrega + Retirada'`. Com parada avulsa, o testID não existe. O card mostra o tipo da parada atual (`'Entrega'`/`'Retirada'`).
- [ ] **Step 2:** Rodar os dois arquivos. Esperado: FAIL.
- [ ] **Step 3:** `handleNavigateToStop`: se `chegouPelaParadaAnterior(paradas, currentStop)`, chamar `sequencia.iniciar(currentStop)` (Task 4; até lá, `modals.openCompletionFlow(currentStop)`) e retornar antes de ler as preferências. `MainCardActive`: badge do tipo e a linha "Neste local: " + os títulos de `paradasDaVisita(paradas, currentStop)` unidos por `' + '`, só quando houver mais de um.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(motorista): visita no mesmo local não manda navegar e aparece no card`.

### Task 4: Conclusão em sequência (uma foto por serviço)

**Files:**

- Create: `src/hooks/motorista/useConclusaoEmSequencia.ts`
- Test: `src/hooks/motorista/__tests__/useConclusaoEmSequencia.test.ts`
- Modify: `src/components/motorista/StopCompletionFlow.tsx` (prop opcional `contexto?: string`, exibida como subtítulo)
- Modify: `app/motorista/_screens/inicio.tsx` (`handleCompleteStop`, o callback de `useRestaurarConclusaoEmVoo`, o `onSuccess` e a prop `contexto` do `StopCompletionFlow`)

**Interfaces:**

- Consumes: `paradasDaVisita` (Task 2); `rotuloTipoParada` (Task 1).
- Produces: `useConclusaoEmSequencia({ paradas, abrirConclusao }: { paradas: ParadaData[]; abrirConclusao: (p: ParadaData) => void }): { iniciar: (p: ParadaData) => void; aoConcluir: (concluidaId: string) => void; contexto: string | null }`.
  - `iniciar(p)` guarda a fila `paradasDaVisita(paradas, p)` e chama `abrirConclusao(p)`.
  - `aoConcluir(id)` tira `id` da fila; se sobrar alguém, chama `abrirConclusao(próximo)`; se não, limpa a fila.
  - `contexto` é `'Mais 1 serviço neste local: Retirada'` enquanto houver um próximo na fila, e `null` sem fila.
  - Cancelar (fechar sem concluir) não chama `aoConcluir`, então nada reabre.

- [ ] **Step 1: Testes que falham** (`renderHook`): `iniciar(entrega)` com a retirada no mesmo ponto chama `abrirConclusao(entrega)` e `contexto` vira `'Mais 1 serviço neste local: Retirada'`; `aoConcluir(entrega.id)` chama `abrirConclusao(retirada)` e `contexto` vira `null`; `aoConcluir(retirada.id)` não chama mais nada; parada avulsa: `iniciar` abre e `aoConcluir` não reabre; sem `aoConcluir` (cancelou), `abrirConclusao` foi chamado uma vez só. No `StopCompletionFlow`: com `contexto="Mais 1 serviço neste local: Retirada"`, o texto aparece no modal.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar o hook e a prop. Na Início, usar `sequencia.iniciar` em `handleCompleteStop`, no callback do `useRestaurarConclusaoEmVoo` e no atalho da Task 3. No `onSuccess`, `refreshRoute()` e depois `sequencia.aoConcluir(paradaConcluida.id)`; o `StopCompletionFlow` já recebe a parada, então guarde o id ao abrir.
- [ ] **Step 4:** Rodar. Esperado: PASS. Rodar também `app/motorista/_screens/__tests__/` inteiro (restauração e modo navegação).
- [ ] **Step 5: Commit** `feat(motorista): conclui os serviços do mesmo local em sequência`.

### Task 5: Pular os serviços do local juntos

**Files:**

- Modify: `src/components/motorista/SkipReasonModal.tsx` (prop `outrosServicosNoLocal?: ParadaData[]`; `onConfirm(motivo, observacoes?, incluirOutros?: boolean)`)
- Modify: `app/motorista/_screens/inicio.tsx` (`handleSkipStop` passa os outros; `handleConfirmSkip` pula a parada e, se `incluirOutros`, também os outros, em sequência)
- Test: `src/components/motorista/__tests__/SkipReasonModal.test.tsx`; teste da Início (mesmo arquivo da Task 3)

**Interfaces:**

- Consumes: `paradasDaVisita` (Task 2); `rotuloTipoParada` (Task 1).

- [ ] **Step 1: Testes que falham.** Com `outrosServicosNoLocal=[retirada]`, o modal mostra um switch `'Pular também: Retirada'` LIGADO por padrão, e confirmar chama `onConfirm(motivo, obs, true)`. Desligar o switch → `false`. Sem a prop, o switch não aparece e `onConfirm` recebe `undefined` no 3º argumento. Na Início, confirmar com `incluirOutros = true` chama `skipStop` duas vezes (entrega e retirada) com o mesmo motivo.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar. `outrosServicosNoLocal = paradasDaVisita(paradas, currentStop).slice(1)`.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(motorista): pula juntos os serviços do mesmo local`.

### Task 6: Um pino por local no mapa (nativo e web)

**Files:**

- Modify: `src/components/map/mobile/markers/ParadaMarker.tsx` (props opcionais `rotulo?: string` e `servicos?: Array<{ ordem: number; tipo?: string | null; status: string }>` para o balão)
- Modify: `src/components/MapaMobile.tsx` (~:166, iterar `agruparPorLocal(paradasFiltradas)`)
- Modify: `src/components/MapaWebMapLibre.tsx` (~:231-250, features por grupo; popup ~:100)
- Test: `src/components/map/mobile/markers/__tests__/ParadaMarker.test.tsx`; `src/components/__tests__/MapaWebMapLibre.motorista.test.tsx`

**Interfaces:**

- Consumes: `agruparPorLocal` (Task 2); `rotuloTipoParada` (Task 1).
- Regra do pino do grupo: `principal` = a primeira parada do grupo com status `pendente`/`em_andamento`; se não houver, a primeira do grupo. O pino usa o id, a cor e a posição da principal, e o rótulo `grupo.map(p => p.ordem).join('+')`. Grupo de um só: rótulo = `String(ordem)`, exatamente como hoje.

- [ ] **Step 1: Testes que falham.**
  - `ParadaMarker` com `rotulo="3+4"` mostra `'3+4'`. O balão com `servicos` lista `'3 · Entrega'` e `'4 · Retirada'`, e o `accessibilityLabel` começa com `'Paradas 3 e 4'`. Sem as props, a saída é idêntica à atual (os testes existentes continuam passando sem alteração).
  - Web: com a entrega 3 e a retirada 4 no mesmo ponto, o GeoJSON de marcadores tem UMA feature com `label: '3+4'`, e o popup dela contém `'Entrega'` e `'Retirada'`. Paradas em pontos diferentes continuam uma feature por parada.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar. O gestor usa os mesmos componentes e ganha o agrupamento junto, o que é desejado. Não mexer em `configureMaplibreWorker` nem na camada de tiles.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(mapa): um pino por local, rotulado com as paradas do grupo`.

### Task 7: Verificação final

- [ ] Suíte inteira (`npx jest --testPathIgnorePatterns=worktrees --modulePathIgnorePatterns=worktrees`), `npx tsc --noEmit`, `npm run lint`: todos com exit 0.
- [ ] Revisão do branch inteiro (superpowers:requesting-code-review).
- [ ] PR (squash; merge com `--admin` só com OK do usuário).
- [ ] Validação manual pendente, declarada no PR: web (gestor e motorista) pede o login do usuário; o nativo (pino e fluxo em sequência) pede um build EAS preview e o aparelho, como no #583.
