# Varredura de refatorações — 08/11/2026

Só leitura, sobre a main em `3c571b6b` (até o #744). Cinco agentes em paralelo, um por domínio:
gestor (G8), motorista (M8), mapas e UI base (U8), lib/auth/CI (L8), banco e Edge Functions (B8).
Foco no que entrou desde 06/11: #733 (varredura 07/11), #735 (design desktop do gestor), #736
(loja ativa), #739 (pino da sede), #742 (Alertas Sonoros), #743 (teto do Places, Migration 84).

Descartados por já registrados em 03/11, 05/11 ou 07/11: 12. Cinco dos achados principais foram
conferidos no código pela sessão principal (marcados ✔). Os demais vêm só da leitura dos agentes.

**Banco conferido sem achado:** nenhuma SECURITY DEFINER sem `search_path`, nenhuma FK sem índice,
nenhuma policy permissiva repetida, nenhum trigger duplicado. M84: contador sem corrida (upsert
com `WHERE chamadas < limite`), dia em `America/Sao_Paulo`, grants e RLS corretos.

## Prioridade 1 — bugs de severidade média

| id     | o quê                                                                                                                                                                                | evidência                                                                                                        | correção recomendada                                                                                                            | esf. |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---- |
| L8-1 ✔ | Sugestão do Photon (fallback do #743) chama o details do Google com `place_id` `osm_…`: gasta a cota de 300 e não preenche cidade/UF/CEP da sede                                     | `app/onboarding/criar-unidade.tsx:125`, `app/unidade/index.tsx:314` (só filtram `cep_`); `src/lib/photon.ts:237` | helper `ehPlaceIdDoGoogle(id)` em `geocoding.ts` nos dois pontos; depois, `fromPhoton` levar cidade/UF para dispensar o details | P    |
| M8-3 ✔ | Fila offline: pedido que chega durante `avancarProxima` ou na releitura final marca `rodarDeNovo` e ninguém o consome — a ação só sobe no próximo gatilho                            | `src/lib/motorista/filaAcoesParada.ts:530-592`                                                                   | no `finally`, se `rodarDeNovo`, reagendar `sincronizarFilaAcoesParada()` (alternativa: estender o `do…while`)                   | P    |
| G8-2 ✔ | Transferir gestão lista candidatos por `usuarios.unidade_id` (legado), não por `usuario_unidades` como a Equipe; sem contador de requisição, a resposta da loja anterior pode vencer | `app/unidade/transferir.tsx:70-96`                                                                               | reaproveitar `carregarEquipeDaLoja` + `requisicaoRef`; conferir antes o que a RPC `transferir_gestao_principal` exige           | P    |
| U8-1   | Mapa nativo do gestor: tocar na sede não desfaz a seleção da parada (o web faz, `MapaWebMapLibre.tsx:732`); `selectedParadaId` de partida/chegada vindo de fora não acha pino        | `src/components/MapaMobile.tsx:141,211-215`                                                                      | chamar `onMapPress?.()` e derivar a seleção também por `pontoQueContem`; prova no aparelho                                      | P    |
| G8-1 ✔ | Início desktop ainda roda as consultas de KPI (rotas da semana e do mês, nomes, total de hoje) que só o mobile mostra desde o #735                                                   | `useDashboardData.ts:~560-585`; só `DashboardMobile.tsx` lê `kpis`/`todayStats`                                  | opção `comKpis` no hook vinda de `inicio.tsx` (recarregar se `isDesktop` mudar); divisão do hook depois                         | P-M  |
| L8-3 ✔ | `mockTheme` do `jest.setup.js` divergiu do tema real em 4 cores (`primary`, `primaryDark`, `secondary`, `success`) — teste de cor fica verde com valor antigo                        | `jest.setup.js:144-151` × `src/utils/styles.base.ts:412-430`                                                     | montar o mock de `jest.requireActual(...styles.base).defaultTheme` com sobrescritas                                             | M    |
| B8-1   | Teto de 300 details/dia por usuário corta importação em lote acima de 300 linhas (cai no Photon sem viés). Hoje não ocorre: maior rota tem 11 paradas                                | `20261108090000_teto_diario_places.sql:78-80`; `useParadasManagement.ts:338-357`                                 | **decisão sua**: subir para 1000, ou manter e avisar no lote quando a fonte deixa de ser Google                                 | P    |

## Prioridade 2 — bugs baixos e fragilidades

| id   | o quê                                                                                                                          | evidência                                                      | correção                                                                                      | esf. |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---- |
| B8-3 | RPC da cota e `fetch` do Google sem prazo: banco lento prende a busca até o limite da função, em vez do fail-open              | `_shared/cotaPlaces.ts:40-58`; `google-places-*/index.ts`      | `Promise.race` com ~2 s na cota; `AbortSignal.timeout` no fetch (padrão de `envioExpo.ts:37`) | P    |
| L8-9 | `expire-routes.yml` sem `timeout-minutes` nem `--max-time`: função pendurada segura o runner até 6 h                           | `.github/workflows/expire-routes.yml`                          | `timeout-minutes: 5`, `--max-time 60`, script único para os 3 jobs                            | P    |
| L8-2 | 429 do teto não deixa estado: cada tecla vai ao Google, leva 429 e só então ao Photon                                          | `googlePlaces.ts:129-137`, `geocoding.ts:221-245`              | memorizar `googleEsgotadoAte` (fim do dia de Brasília)                                        | P    |
| G8-3 | Rótulo acessível da linha do DataTable sai "Motorista: undefined" quando a chave da coluna não é campo                         | `DataTableDesktopView.tsx:~185`; colunas de `gestao-rotas.tsx` | `rotulo?: (item) => string` na coluna + omitir `undefined`                                    | P    |
| G8-9 | Botão dentro de botão (linha clicável com `MenuDeAcoes`)                                                                       | `ListaDeRotasDoDia.tsx:~77-120`, `DataTableDesktopView`        | linha como grupo, botão só no nome                                                            | P    |
| M8-4 | `useFilaAcoesParada` relê a cada evento sem `requisicaoRef` (suspeita)                                                         | `src/hooks/motorista/useFilaAcoesParada.ts:46-58`              | contador como em `useHistoricoData.ts:36-40`                                                  | P    |
| B8-4 | `consumir_cota_places` sem sessão devolve `false`, que vira 429 "limite atingido"                                              | M84 `:89-91`; `cotaPlaces.ts:48`                               | devolver `null` (ramo "indisponível"); sonda caso 4 muda junto                                | P    |
| B8-6 | Se a RPC da cota sumir, o teto desaparece com só um `console.error`; varredura de funções mortas que olhe só `src/` a apagaria | `cotaPlaces.ts:45`                                             | guarda estática: RPC chamada em `supabase/functions/**` não pode ter DROP/REVOKE              | P    |
| U8-3 | Âncora do pino da sede: `bottom` no `MapaMobile`, `center` nos outros cinco — ~14 px de deslocamento em zoom alto (suspeita)   | `MapaMobile.tsx:210`                                           | `center` no pino quadrado; conferir no aparelho                                               | P    |
| G8-8 | "N de M paradas feitas" conta paradas de rotas canceladas/não executadas                                                       | `ResumoDoDia.tsx:~50-56`                                       | **decisão sua** (provável: tirar do denominador)                                              | P    |

## Prioridade 3 — código morto, duplicação, testes e docs

**Código morto**

- **M8-1** — `src/utils/notificationSound.ts`: 5 exports sem chamador (`initializeNotificationAudio`, `playSuccessSound`, `set/isNotificationSoundEnabled`, `cleanupNotificationSounds`) + chave `notification_sound_enabled`; sobra do #742. Fica só `playNotificationSound`.
- **M8-2** — `soundAlerts` e `@rotamestre:sound_enabled` nunca saem de quem já migrou (`navigationPreferencesMigration.ts:19-41`); descartar ao ler em `gravarPreferencias`/`getNavigationPreferences`.
- **M8-5** — `completeStop: _completeStop` sem uso em `app/motorista/_screens/inicio.tsx:91`.
- **L8-4** — `src/lib/notifications.ts`: 6 funções só usadas por testes (`requestNotificationPermissions`, `get/saveNotificationSettings`, `sendLocalNotification`, `notifyRouteComplete`, `addNotificationReceivedListener`). Facilita a divisão 2.14 de 03/11.
- **L8-5** — exports só de teste em `routeErrors.ts` (6), `errorMapping.ts` (3) e `design-tokens.ts` (`getSpacing`).
- **L8-10** — scripts sem uso no `package.json` (`version:*`, `test:e2e:serve`, `test:verbose`, `size:analyze`, `test:e2e:report`).
- **U8-5** — comentário órfão `// Checkpoint markers` em `NavigationMode.tsx:729`; nomes `checkpointCallout*` hoje servem a sede.
- **U8-7** — barrel do design system reexporta `CameraUpload`/`AuthLoadingScreen` que ninguém importa por ele (confirmar com `npm run scan:morto`).
- **G8-7** — estado `stats` do `useDashboardData` só serve `incidentesAbertos`.

**Duplicação / padrões**

- **U8-2** — "é partida/chegada" refeito em 5 lugares com semântica invertida (`is_checkpoint === false`); predicado `ehPontoDaUnidade` em `pontosDaUnidade.ts`.
- **G8-4** — `RotasRecentes.tsx:25-62` fora da escala única de status do #735 (e `hex + '20'`).
- **G8-5** — trio `color/textColor/icon` do status montado à mão em 4 lugares → `propsDoStatusBadge`.
- **G8-6** — Toast manual em `DashboardDesktop`, contra o padrão `useToast`; fluxo de exclusão duplicado com `gestao-rotas.tsx` (o diálogo troca de texto na animação de saída).
- **G8-10** — `any` em `useTimelineData.ts:~111-190`.
- **U8-4** — azul fixo `#4285F4` na bolinha sem rumo (`NavigationMode.web.tsx:240,249`), diferente de `CORES_SOBRE_O_MAPA.usuario`.
- **U8-6** — quinta importação direta de `EmptyState` (`app/unidade/equipe.tsx:7`) e exemplo errado no próprio componente.
- **U8-8** — `pontosDaUnidade` sem `useMemo` no `MapaMobile.tsx:133`.
- **B8-2** — cliente com o `Authorization` de quem chama montado 4 vezes; `clienteDoUsuario` em `_shared/autenticacao.ts` (o `guardaPlaces.test.ts` fixa a forma atual por regex e muda junto).
- **B8-5** — `uso_places_diario` só se limpa na chamada do próprio usuário; limpeza global no cron, na próxima migration de retenção.

**CI e testes**

- **L8-6** — setup do Playwright repetido nos jobs `e2e-auth` e `visual-regression` → composite action.
- **L8-7** — `prebuild:web: tsc --noEmit` roda o tsc de novo em 3 jobs do CI (**decisão sua**: o gancho protege Vercel/EAS).
- **L8-8** — comentário do `quality.yml` diz "audit acima", agora está abaixo.
- **L8-11** — guarda `data-local-sem-utc` não pega `substring(0,10)`/`substr(0,10)`.
- **L8-12** — `distancia-paridade.test.ts` é tautológico (os alias já delegam à fonte única).
- **M8-6** — `contextoRastreamento.ts` e `copyDePermissao.ts` sem teste próprio.

## Observações para decidir (não são achados)

- Retomar parada (`checkpoints.tsx:198-203`) não passa pela fila offline e mantém o `foto_url` antigo de uma parada concluída e retomada.
- Candidatos a divisão: `app/unidade/index.tsx` (960 linhas), `app/gestor/mapa-rota.tsx` (785), `gestao-rotas.tsx` (756; `actions`/`columns` sem `useMemo` anulam o `memo` da tabela).

## Agrupamento sugerido para execução

1. **App — busca de endereço** (L8-1, L8-2): mesma área, entra na 3060.
2. **App — motorista** (M8-1…M8-5): fila offline + sobras do #742.
3. **App — gestor** (G8-1, G8-2, G8-3…G8-10): Início desktop, Transferir, DataTable.
4. **App — mapas** (U8-1…U8-8): seleção nativa + predicado único; prova no aparelho.
5. **Edge Functions + CI + testes** (B8-2…B8-6, L8-3…L8-12): sem build; B8-3/B8-4 pedem deploy com OK.
6. **Decisões suas antes**: B8-1 (teto de details), G8-8 (denominador), L8-7 (gancho do tsc).
