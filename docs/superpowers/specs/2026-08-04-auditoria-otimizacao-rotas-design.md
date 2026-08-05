# Auditoria de uso do otimizador de rotas — Design

**Date:** 2026-08-04
**Branch:** `feat/auditoria-otimizacao-rotas`
**Origem:** pedido do gestor a partir da tela `gestor/mapa-rota` — "informar se a rota foi otimizada ou manual e qual o ganho". Refinado em brainstorming para o objetivo real: **auditar a adesão da equipe ao otimizador**.

## Problema

O otimizador existe e é sério: matriz de distâncias via OSRM Table API, TSP por força bruta até 10 paradas e vizinho-mais-próximo + 2-opt acima disso (`src/lib/osrm/api.ts:387`, `src/lib/osrm/tsp.ts:195`). Otimiza por distância, não por duração (`api.ts:385`).

Mas o uso dele é invisível. Nada no sistema registra que uma rota foi otimizada:

- `rotas` tem só `distancia_total` e `tempo_total` — o valor atual, sem baseline. Não há flag de otimização em nenhuma tabela.
- A ordem anterior das paradas não é guardada: `paradas.ordem` é sobrescrita.
- Em recálculo, os valores antigos são **apagados de propósito** antes de gravar os novos (`src/lib/routeUtils.ts:50-59`).
- Não existe evento de otimização na Timeline. A lista canônica tem 14 eventos (`src/lib/timeline.ts:17-32`) e nenhum é sobre otimização; `mapLogToTimelineEvent` retorna `null` para evento desconhecido (`timeline.ts:465`), então um log novo não apareceria sem alterar esse arquivo.
- O único sinal em memória (`ordemManual`, `src/hooks/nova-entrega/useRouteOptimization.ts:56`) morre ao salvar.

Consequência: **depois que a rota é criada, é impossível saber se ela foi otimizada ou montada na mão.** O gestor não tem como responder "quantas rotas estão saindo sem otimizar, e quem monta na mão".

Dois agravantes encontrados na investigação:

1. A otimização é **manual, opcional e existe num único ponto**: o botão "Otimizar melhor percurso" na tela de criação (`src/components/gestor/nova-entrega/ParadasListAndActions.tsx:196`).
2. A tela `gestor/mapa-rota` **não tem otimização nenhuma**. O botão "Reordenar" é drag-and-drop manual e o recálculo é explicitamente sem otimizar — comentário literal em `src/lib/routeUtils.ts:77`: _"Mantém a ordem atual (sem otimização)"_. A distância muda no banco em silêncio, sem log (`useMapaRotaHandlers.ts:384-394`). Ou seja, hoje dá para piorar uma rota otimizada sem que ninguém saiba.

### Dados de produção que dimensionam o problema

Consultados em 04/08/2026 no projeto `xezslsyxjivunmhhyxtd`:

- 562 rotas (544 concluídas), 559 com `distancia_total`, média 54,8 km.
- 57 rotas (10%) têm evento `paradas_reordenadas`, 98 eventos no total. O `detalhes` guarda a **nova** ordem e quem alterou — não guarda a ordem anterior nem distância, e não distingue otimização de arraste manual.

## Objetivo

Permitir que o gestor responda, sem abrir rota por rota: **quantas rotas estão saindo sem otimizar, e quem as montou na mão** — para corrigir processo de equipe.

**Métrica de sucesso:** o gestor consegue, na Gestão de Rotas, filtrar as rotas montadas na mão de um período e identificar quem as criou.

## Escopo

1. Migration acrescentando 5 colunas de auditoria em `rotas` + índice para o filtro.
2. Captura do estado nos três pontos onde a ordem é definida ou alterada.
3. Evento `rota_otimizada` na Timeline + enriquecimento do `paradas_reordenadas` existente.
4. Chip de estado na tela da rota (desktop e mobile).
5. Indicador por linha + filtro independente + contador na Gestão de Rotas.

### Não-objetivos

- **Backfill retroativo.** É impossível com honestidade: o dado nunca existiu. As 562 rotas existentes ficam `NULL` = "sem registro", nunca "manual" (ver Decisão 2).
- **Relatório dedicado / card no dashboard.** Descartados no brainstorming em favor do filtro na listagem, que já é o fluxo diário.
- **Medir o custo das rotas manuais** (calcular a rota ótima para quem não otimizou, só para saber o que se perdeu). Exigiria chamada OSRM em toda rota criada, com latência e custo contínuos. Fica como evolução possível sobre esta base.
- **Levar a otimização para a tela `mapa-rota`.** É uma lacuna real (ver "Oportunidades descobertas"), mas é feature própria, não auditoria.

## Decisões (validadas com o gestor no brainstorming)

1. **Propósito é auditoria de adesão**, não prova de valor ao cliente nem decisão operacional pontual.
2. **Rota antiga é "sem registro" (`NULL`), nunca "manual".** Pintar 562 rotas de manual faria a auditoria começar mentindo — a maioria pode ter sido otimizada e não há como saber.
3. **Três estados**, não binário: `otimizada`, `manual`, `otimizada_alterada`. O terceiro é o mais revelador — alguém otimizou e depois desfez na mão.
4. **Ganho capturado no clique de otimizar** (distância antes e depois). Uma chamada OSRM extra, só nesse clique, sem custo recorrente.
5. **Arquitetura híbrida:** coluna em `rotas` (para filtrar rápido) + evento em `logs` (para a Timeline contar a história).
6. **Adicionar parada NÃO marca "alterada".** É evolução normal da operação (entrega nova chegou), não erro de processo; marcar encheria a auditoria de falso positivo. Só reordenação manual marca.

## Modelo de dados

Migration `2026MMDDhhmmss_auditoria_otimizacao_rotas.sql` (timestamp gerado via `/new-migration`, versionada nos dois diretórios conforme `database/MIGRATIONS.md`).

Colunas novas em `rotas`, todas anuláveis:

| Coluna                        | Tipo                    | Semântica                                                                  |
| ----------------------------- | ----------------------- | -------------------------------------------------------------------------- |
| `otimizacao_estado`           | `text` + CHECK          | `'otimizada'` · `'manual'` · `'otimizada_alterada'`; `NULL` = sem registro |
| `otimizacao_distancia_antes`  | `numeric`               | km na ordem original, no momento do clique                                 |
| `otimizacao_distancia_depois` | `numeric`               | km na ordem otimizada                                                      |
| `otimizada_em`                | `timestamptz`           | quando                                                                     |
| `otimizada_por`               | `uuid` → `usuarios(id)` | quem clicou; `ON DELETE SET NULL`                                          |

Índice para o filtro da listagem: `(unidade_id, otimizacao_estado)`, acompanhando como a tela já consulta.

**Convenção do ganho:** `ganho = otimizacao_distancia_antes − otimizacao_distancia_depois`. Positivo = economia. O ganho não é coluna: é derivado na leitura, para não haver duas fontes de verdade que possam divergir.

**RLS:** as colunas herdam as policies de `rotas`. `otimizada_por` referencia `usuarios`, então exibir o nome de quem otimizou precisa respeitar o escopo de unidade. A migration passa pelo agente `rls-policy-reviewer` antes do merge, conforme `CLAUDE.md`.

**Tipos:** regenerar `src/types/database.ts` via `/regenerate-supabase-types` e acrescentar os campos ao tipo `Rota` da tela (`src/components/gestor/mapa-rota/types.ts:24-41`).

## Captura

### ① No clique em "Otimizar" — `useRouteOptimization.ts:58`

Antes de chamar o otimizador, calcular a rota na **ordem atual** com `getDirectionsSequential` (`src/lib/google.ts:118` / `google.web.ts:140`, split por plataforma) → `distancia_antes`. O otimizador já devolve `distanciaTotalMetros` → `distancia_depois`. Ambos ficam em estado React junto com `rotaOtimizada`.

### ② Ao salvar — `useRouteCreation.ts:188` → RPC `criar_rota_com_paradas`

A RPC ganha parâmetros novos e grava **estado + distâncias + autor + evento `rota_otimizada` na mesma transação**, aproveitando que ela já insere o log `rota_criada` atomicamente (migration `20260723223000`, linhas 284-368).

O estado sai de `ordemManual` (`useRouteOptimization.ts:56`): otimizou e não mexeu depois → `'otimizada'`; caso contrário → `'manual'`.

### ③ Em reordenação manual — `useMapaRotaHandlers.ts:384`

Transições:

| Estado atual  | Depois de reordenar à mão                    |
| ------------- | -------------------------------------------- |
| `'otimizada'` | → `'otimizada_alterada'`                     |
| `'manual'`    | continua `'manual'`                          |
| `NULL`        | **continua `NULL`** — não inventamos passado |

`recalcularRota` tem **dois** call sites; o de `useAddStopForm.ts:236` (adicionar parada) **não** altera o estado, por Decisão 6.

Para a Timeline, em vez de criar evento novo, enriquecer o `paradas_reordenadas` que já existe com `desfez_otimizacao: true` no `detalhes` — menos superfície, e a Timeline passa a narrar "Ordem alterada por Fulano — desfez a otimização".

## Superfícies

### Tela da rota (`gestor/mapa-rota`)

Chip a mais na fileira do `RouteInfoHeaderCompact`, ao lado de distância/tempo/paradas:

| Estado               | Chip                                            |
| -------------------- | ----------------------------------------------- |
| `otimizada`          | `Otimizada · −3,2 km` (positivo)                |
| `manual`             | `Manual` (neutro, sem alarme)                   |
| `otimizada_alterada` | `Otimizada · alterada` (âmbar)                  |
| `NULL`               | nada — não poluir toda rota antiga com um traço |

O header **mobile** (`app/gestor/mapa-rota.tsx:586-607`) é mais pobre hoje (motorista, data, status, distância); o chip entra lá também.

Timeline passa a narrar o evento: _"Rota otimizada por Amanda — 29,1 km → 25,9 km"_.

### Gestão de Rotas (`app/gestor/gestao-rotas.tsx`)

- Indicador compacto por linha.
- **Filtro em grupo próprio, separado do `filtroStatus` existente.** Status da rota (pendente/em andamento/concluída) e estado de otimização são dimensões diferentes; no mesmo radiogroup gerariam combinações sem sentido. Os dois filtram em conjunto.
- Contador no cabeçalho seguindo o padrão de `concluidasCount`/`pendentesCount` (`gestao-rotas.tsx:231-234`): _"8 de 12 rotas registradas foram montadas na mão"_.

**O contador considera apenas rotas com registro.** Se incluir as 562 antigas, o percentual fica diluído e não significa nada por meses.

## Sequenciamento

Duas fases, nesta ordem obrigatória — a segunda não tem dado para exibir sem a primeira:

1. **Registrar** (migration + RPC + os três pontos de captura + evento na Timeline). Entrega valor **zero visível**: nada muda na tela. É fundação.
2. **Exibir** (chip na rota, indicador/filtro/contador na listagem). É onde a auditoria acontece.

Vale mergear a fase 1 assim que estiver verde, mesmo sem UI: quanto antes ela entrar em produção, antes o histórico começa a acumular — e a fase 2 nasce com dado de verdade em vez de tela vazia.

## Erros e casos de borda

- **Falha ao calcular o "antes"** (OSRM fora, timeout): a otimização **continua funcionando normalmente**; grava `'otimizada'` com `distancia_antes = NULL`. O chip mostra `Otimizada` sem número. Métrica nunca bloqueia a função principal.
- **Ganho negativo ou zero:** possível — o otimizador minimiza distância, e a ordem manual pode já ser ótima. Exibir honestamente (`Otimizada · sem ganho`), nunca esconder nem inverter sinal.
- **Falha ao salvar a rota:** a RPC é atômica; ou grava rota + paradas + auditoria + log, ou nada.
- **Concorrência:** dois gestores mexendo na mesma rota é last-write-wins, igual ao comportamento atual de `distancia_total`. Aceitável — não introduz regressão.
- **Usuário removido:** `otimizada_por` com `ON DELETE SET NULL`; a UI cai para "autor não disponível" sem quebrar.
- **Rota sem paradas suficientes** para otimizar: fluxo atual já trata; não marcar estado nenhum.

## Testes

- **Unit — transições de estado:** as três linhas da tabela do ponto ③, incluindo `NULL → NULL`, e a garantia de que adicionar parada não altera o estado (Decisão 6).
- **Unit — ganho:** cálculo correto, `distancia_antes` indisponível, e ganho zero/negativo.
- **Unit — Timeline:** `rota_otimizada` aparece (exige estar em `TIMELINE_LOG_EVENTS`); `paradas_reordenadas` com `desfez_otimizacao` narra a nuance.
- **Componente — chip:** um caso por estado, incluindo `NULL` renderizando **nada**.
- **Componente — listagem:** os dois filtros combinando (ex.: "concluídas" + "manuais"), e o contador ignorando rotas sem registro.
- **Migration:** revisão pelo agente `rls-policy-reviewer` antes do merge.

Convenções de teste em `docs/TESTING.md`; a suíte de `nova-entrega` e `mapa-rota` já existe e cobre os arquivos tocados.

## Arquivos afetados

| Arquivo                                                        | Mudança                                                   |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| `database/migrations/` + `supabase/migrations/`                | migration nova (colunas, CHECK, índice, alteração da RPC) |
| `src/types/database.ts`                                        | regenerado                                                |
| `src/components/gestor/mapa-rota/types.ts`                     | campos no tipo `Rota`                                     |
| `src/hooks/nova-entrega/useRouteOptimization.ts`               | cálculo do "antes"; expor estado + distâncias             |
| `src/hooks/nova-entrega/useRouteCreation.ts`                   | passar auditoria à RPC                                    |
| `src/components/gestor/mapa-rota/hooks/useMapaRotaHandlers.ts` | transição de estado ao reordenar                          |
| `src/lib/timeline.ts`                                          | evento `rota_otimizada` + nuance do `paradas_reordenadas` |
| `src/components/gestor/mapa-rota/RouteInfoHeaderCompact.tsx`   | chip                                                      |
| `app/gestor/mapa-rota.tsx`                                     | chip no header mobile                                     |
| `app/gestor/gestao-rotas.tsx`                                  | indicador, filtro próprio, contador                       |

## Riscos e mitigação

| Risco                                                                                                                            | Mitigação                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Alterar `criar_rota_com_paradas` mexe no caminho crítico de criação de rota** — é a RPC atômica/idempotente do fluxo principal | Parâmetros novos com default, para chamada antiga continuar válida; cobertura de teste existente da Nova Entrega roda antes do merge |
| **Densidade baixa nas primeiras semanas** — quase tudo "sem registro" e o filtro vem quase vazio                                 | Esperado e comunicado; contador conta só sobre rotas com registro                                                                    |
| Uma chamada OSRM extra por clique em otimizar                                                                                    | Só no clique, nunca em background; falha não bloqueia a otimização                                                                   |
| Evento novo invisível na Timeline se esquecerem de `TIMELINE_LOG_EVENTS`                                                         | Teste de Timeline cobre exatamente isso                                                                                              |

## Oportunidades descobertas e deliberadamente não incluídas

Encontradas na investigação, registradas para não se perderem — cada uma é trabalho próprio:

1. **Paradas puladas não geram evento nenhum.** 165 paradas com status `pulada` no banco (7,8% das paradas reais), espalhadas por 119 rotas — **22% de todas as concluídas** — e **zero** eventos de pulo em `logs`. A Timeline registra parada concluída, adicionada, removida, editada e reordenada, mas não registra a entrega que **não** aconteceu: o evento mais crítico de última milha. O gestor não sabe quando foi pulada, por quem, nem por quê. Na rota `db9be68d-…` isso é visível: a parada 4 aparece "Pulada" no painel e o histórico não tem uma linha sobre ela.
2. **Não dá para otimizar a partir da tela do mapa.** Depois de criada, a rota só aceita reordenação manual, e o recálculo é explicitamente sem otimização (`routeUtils.ts:77`). Um gestor pode piorar uma rota e não há caminho para reotimizá-la.
3. **Incidentes têm `parada_id`** (25 incidentes em 18 rotas) e podem ser amarrados à parada exata no mapa — provavelmente subaproveitado hoje.
4. **`is_checkpoint` é `NULL` em 1877 de 3231 paradas.** O código trata `!== false` como parada real (`MapaWebMapLibre.tsx:151`), então funciona, mas a semântica de três valores para um booleano é frágil.
