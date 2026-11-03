# Varredura de refatorações — consolidado (03/11/2026)

Branch `main`, commit `c64859af`. Consolida cinco relatórios independentes:
[R1] motorista, [R2] gestor/unidade, [R3] `src/lib` e infraestrutura do cliente,
[R4] componentes compartilhados e design system, [R5] testes, CI, ferramentas e SQL versionado.
Cada item diz se foi **confirmado** (lido no código, grep ou `git log` nesta consolidação) ou
**não conferido** (vem só do relatório de origem).

## 1. Resumo

- Cinco domínios varridos, só leitura. Depois de unir as duplicatas entre relatórios: **16 bugs**
  (13 confirmados no código) e **49 itens de refatoração** (Onda 0: 8 · Onda 1: 15 · Onda 2: 16 · Onda 3: 10).
  11 achados foram descartados ou reclassificados (seção 6).
- `knip` rodado agora: **216** "Unused exports", 210 tipos, 25 "Duplicate exports". O CLAUDE.md ainda diz 285
  (medido em 21/09). A queda é real e o texto está desatualizado.
- Os três temas que mais rendem:
  1. **Cópias divergentes que já viraram bug**: `google.web.ts` (o aviso de rota estimada some no painel web),
     pinos com cor do tema sobre o mapa (nativo e web), status de rota em 8+ tabelas, operações de motorista em 3 telas.
  2. **Código morto mantido vivo por teste ou barrel**: cerca de 2.000 linhas em `src/lib` e componentes, mais
     defaults órfãos e scripts que escrevem no banco. É a onda de menor risco e deixa o terreno menor para o resto.
  3. **Orquestração repetida nos fluxos quentes**: concluir/pular em 3 telas do motorista, carga por loja em cerca de 8 telas do gestor,
     cola de permissão e GPS em 5 lugares. É onde está o maior ganho, e é o trecho que só o aparelho valida.

## 2. Bugs encontrados de passagem

Ordenados pelo efeito para quem usa o app. "Teste que fixa" = teste existente que **exige** o comportamento errado.

| #   | Quem sente                      | Arquivo:linha                                                                                                                                                               | Efeito                                                                                                                                                                                                                                                                        | Correção sugerida                                                                                                             | Teste que fixa                                                                                        | Status                                                                                       |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| B1  | Gestor (web)                    | `src/lib/google.web.ts:97-107,166-190` (x `google.ts:89-92,166`)                                                                                                            | Na web o resultado do OSRM perde `is_estimated` e `sem_rota_entre_paradas`, então o aviso de "ordem só estimada" e o toast de trecho sem rota nunca aparecem em `useRouteOptimization`/`useRouteCreation`/`useDistanceCalculation`. O gestor confirma rota estimada sem saber | Apagar `google.web.ts` e usar um conversor único (item 1.1)                                                                   | Nenhum fixa o erro, mas `google.web.test.ts:8` importa `../google`, então o `.web` tem cobertura zero | **confirmado** (coordenador + releitura)                                                     |
| B2  | Motorista (nativo, tema escuro) | `src/components/motorista/NavigationMode.tsx:702-783` (`currentDestinationMarker`, `userLocationMarker`, `checkpointMarker`, `otherMarker`, `nextStopMarker`, `markerText`) | No modo navegação, os pinos usam `theme.colors.white/gray200/gray400`, que se invertem no escuro: borda e número ficam escuros sobre o mapa claro, e o checkpoint fica escuro. É o mesmo defeito que o mini-mapa já corrigiu                                                  | `CORES_SOBRE_O_MAPA` (item 1.2)                                                                                               | Não (só `MiniMap.temaEscuro.test` existe)                                                             | **confirmado** no código, não visto no aparelho                                              |
| B3  | Gestor (web, tema escuro)       | `src/components/MapaWebMapLibre.tsx:636,675,676` (+ popup `:106,118-119`)                                                                                                   | O contorno e o número do pino ficam escuros sobre o mapa claro, e o subtítulo do popup fica quase invisível                                                                                                                                                                   | Mesmo conserto do B2 (item 1.2)                                                                                               | Não                                                                                                   | **confirmado** (coordenador)                                                                 |
| B4  | Motorista (nativo)              | `src/services/locationTracking.ts:295-305,331-365,423-429`; slider em `NavigationSettings.tsx:261-273`, texto `:70`                                                         | O "raio de proximidade" só alimenta `handleArrival`/`handleProximityNotifications`, que chamam `sendNotification`, cujo corpo está vazio. No nativo o slider não tem efeito, e "Avisa quando você chega" só vale na web (`NavigationMode.web.tsx:466`)                        | Pede decisão (item 3.1). Qualquer aviso deve continuar **só avisando**, nunca concluindo (histórico das 28 entregas sem foto) | Não                                                                                                   | **confirmado**                                                                               |
| B5  | Gestor (mobile)                 | `src/components/gestor/dashboard/_components/shared/RotaCard.tsx:35-62`                                                                                                     | Rota `nao_executada` aparece como o texto cru "nao_executada", em cinza. No desktop aparece "Não executada" em vermelho                                                                                                                                                       | Ler `getRotaStatusLabel`/`statusConfig` (item 1.3)                                                                            | Não                                                                                                   | **confirmado**                                                                               |
| B6  | Gestor                          | `app/gestor/motorista-perfil.tsx:224-257` (edição), `:175-216` (toggle); `app/unidade/equipe.tsx:152-215`                                                                   | Pelo perfil, telefone já usado por outro motorista ativo mostra o genérico "Não foi possível salvar". Editar ou ativar/desativar pelo perfil ou pela Equipe não grava `logUserAction`. A lista (`useMotoristasOperations.ts:32,332,354,398`) faz as duas coisas               | Lib única (item 1.4)                                                                                                          | Não                                                                                                   | **confirmado** (grep: nenhum `logUserAction` nem `mensagemTelefoneDuplicado` nas duas telas) |
| B7  | Gestor (auditoria)              | `useAddStopForm.ts:333`, `useEditStopForm.ts:361`, `useMapaRotaHandlers.ts:359,664`, `src/lib/routeUtils.ts:420`, `src/lib/queries/paradas.ts:382`                          | `await supabase.from('logs').insert(...)` sem olhar `error`. Se o banco recusar, o rastro some sem nenhum `logger.warn`. É a armadilha "o supabase-js devolve o erro em vez de lançar"                                                                                        | `logAction`/`logRotaAction` de `src/lib/queries/logs.ts:43`, que já trata o erro (item 1.5)                                   | Os testes mocam `from('logs')`. Ajustar, sem fixar `parada_id` como coluna                            | **confirmado** (6 pontos)                                                                    |
| B8  | Gestor (web)                    | `src/hooks/useDialogState.ts:33-66`, copiado em `Modal.tsx:127-144`, `DesktopModal.tsx:153-172`, `SupportModal.tsx:101-118`                                                 | Com dois modais empilhados (confirmação sobre `DesktopModal`), o segundo salva `scrollY=0`, e ao fechar destrava o body com o primeiro ainda aberto e rola para o topo                                                                                                        | Contador de travas no módulo (travar em 0→1, destravar em 1→0) num `useWebDialog` só (item 2.5)                               | Não                                                                                                   | **confirmado na leitura**, não reproduzido no navegador                                      |
| B9  | Gestor (web)                    | `DesktopModal.tsx:~582` (`dialog::backdrop` sem escopo), `Modal.tsx:~58`, `SupportModal.tsx:~29`, `dialog-styles.ts:29`                                                     | O CSS global de um modal muda o backdrop e a animação de todos os `<dialog>` da página, conforme a ordem de montagem                                                                                                                                                          | Unificação do item 2.5                                                                                                        | Não                                                                                                   | não conferido                                                                                |
| B10 | Gestor (timeline)               | `src/lib/timeline.ts:291-300` antes de `:358`                                                                                                                               | O ramo `rota_finalizada` ("Resumo Confirmado: N concluídas, M puladas") nunca é alcançado, porque `includes('finaliz')` casa antes. **Nenhum código do repositório grava esse evento** (app nem SQL), então só aparece com log antigo ou externo                              | Casar por igualdade com `TIMELINE_LOG_EVENTS` antes dos `includes` frouxos (item 1.10)                                        | **Sim**: `src/lib/__tests__/timeline.test.ts:437`, cujo título admite o defeito                       | **confirmado** (efeito real depende de existir o evento no banco)                            |
| B11 | Motorista (offline)             | `src/services/locationTracking.ts:376`, `src/hooks/useDriverLocationBroadcast.ts:89`                                                                                        | `getSession()` cru no caminho de cada posição. Offline com token vencido, pode esperar cerca de 25 s por fix antes de ir à fila (a lição de 25/10 já aplicada em `offline.ts` com `lerSessao()`)                                                                              | `usuarioIdDaSessaoLocal()` sobre `lerSessao()` (item 2.15)                                                                    | Não (os dois sites só têm `getSession` mockado)                                                       | código **confirmado**, efeito não medido (exige aparelho)                                    |
| B12 | Motorista                       | `src/lib/offline.ts:502-505` usado em `useRouteActions.ts:210` e `CameraUpload.tsx:244`                                                                                     | `isOnline()` sem prazo e exigindo `isInternetReachable === true`. Na abertura (`null`), concluir/pular vai para a fila mesmo com rede (seguro, só atrasa), e um `NetInfo.fetch` lento segura o toque. O próprio `semRede.ts` diz que não confia nessa função                  | `!(await semRedeConfirmada())` (item 2.15)                                                                                    | Não conferido                                                                                         | código **confirmado**, efeito não medido                                                     |
| B13 | Dev                             | `src/context/route-status/RouteStatusProvider.tsx:45-47,236-240`                                                                                                            | O default `{}` torna o `throw` de `useRouteStatus()` código morto. Fora do provider, quebra adiante com "x is not a function"                                                                                                                                                 | `createContext<… \| null>(null)` + teste do throw (item 1.8)                                                                  | Não                                                                                                   | **confirmado**                                                                               |
| B14 | CI                              | `.github/workflows/test.yml:120`                                                                                                                                            | O artefato lista `jest-results.json`, que nada gera (`jest.config.js:92-98` só tem `default` + `jest-junit`). Parece haver um relatório que não existe                                                                                                                        | Tirar da lista ou gerar com `--json --outputFile` (item 0.5)                                                                  | —                                                                                                     | **confirmado**                                                                               |
| B15 | Motorista (cosmético)           | `src/components/motorista/home/PreRouteChecklist.tsx:152,195,308`                                                                                                           | `checkAllStatus` faz `setIsChecking(true)` a cada 5 s, e o spinner ao lado do título pisca. O ramo `compact` (que trocava todos os ícones) não tem chamador: o único uso é `MainCardPending.tsx:142`                                                                          | Só ligar `isChecking` na 1ª carga; apagar o ramo `compact` (item 0.3)                                                         | Não                                                                                                   | **confirmado**                                                                               |
| B16 | Motorista (latente)             | `app/motorista/_screens/checkpoints.tsx:113,129,158,588-591` + `src/utils/typeMappers.ts:41-56`                                                                             | A volta `toParadaData` descarta `motivo_skip`, `foto_url` e `updated_at`. É inofensivo hoje (o modal só lê id/tipo/endereço/coords), mas um campo novo no modal falharia só nesta aba                                                                                         | Buscar o `ParadaData` no contexto pelo id, como `mapa.tsx:128-131` (item 1.11)                                                | Não                                                                                                   | **confirmado**                                                                               |

## 3. Ondas de refatoração

Legenda: esforço **P** (< meio dia) · **M** (1–2 dias) · **G** (> 2 dias). "Prova" = como mostrar que nada quebrou.
Prova padrão da Onda 0: `npx tsc --noEmit` + `npm run lint` (repositório inteiro) + `npx jest` + `npm run scan:morto`
(com `scan:morto:autoteste` antes de ler número baixo) + `npm run build:web`.

### Onda 0 — código morto e limpeza segura (8 itens)

**0.1 Apagar os `export default` órfãos (migração para named)** · confirmado · P · risco baixo · [R4 §2]

- **Arquivos:** `Alert`, `AnimatedListItem`, `Badge`, `Breadcrumbs`, `data-table/index`, `Dialog/*` (5), `EmptyState`, `Icon`, `Input`, `Modal`, `Progress`, `SeletorUnidade`, `SwipeOnboarding`, `Text`, `ThemeSettings` em `src/components/`, mais `hooks/useAlert.ts:348` e `lib/logger.ts:357`.
- **Problema → proposta:** a grep não acha nenhum `import X from` desses módulos em `src`/`app`/`e2e` (só JSDoc que ensina o caminho errado). Apagar as linhas, corrigir os 5 JSDoc e atualizar o número do knip no CLAUDE.md (285 → o novo medido). **Não tocar** `Slider.web.tsx` (default usado por `NavigationSettings`, variante de plataforma).
- **Benefício:** zera cerca de 19 "Duplicate exports" e reduz o ruído do knip. **Cobertura:** `indexExports.test.ts` (2 arquivos) + testes dos componentes. **Prova:** padrão; o `build:web` pega `require(...).default`.

**0.2 Código morto de `src/lib` vivo só por teste** · confirmado (parcial) · M (3 PRs) · risco baixo · [R3 §4]

- **Arquivos (confirmados sem importador de produção):** `src/lib/type-guards.ts` (641 linhas, e o comentário em `types/rota.ts:18`), `src/utils/timeEstimation.ts` (272), adaptadores Routes API de `src/lib/google-shared.ts` (`adaptRoutesAPIResponse`, `mapRoutesAPIError`, `parseDuration`, `createAccumulators`, `processDirectionsSegment`, `validateAndAdaptRoutesResponse`) e o reexport "backwards compatibility" de `google.ts:28-33`, `offline.ts:510-555` (`save/get/clear/hasOfflineData`; **manter** a chave em `CHAVES_DA_CONTA`), `cache.ts` (`getCacheWithFetch`, `invalidateRelatedCaches`). Não conferido: 12 das 14 funções de `queries/paradas.ts`, 5 de 8 de `queries/incidentes.ts`, barrels `lib/utils.ts` e `lib/routeOptimization.ts`.
- **Cuidado:** **não apagar** `logAction`/`logRotaAction` (o item 1.5 passa a usá-las) nem `PARADA_STATUS_LABELS` antes do item 1.3 decidir a fonte de status. Confirmar que o teste removido não é guarda estática.
- **Benefício:** cerca de 1.700 linhas a menos. **Prova:** padrão.

**0.3 Hooks e componentes mortos** · confirmado · P · risco muito baixo · [R2 §8, R1 §10, R4 §7/§12, R1 bug 4]

- `src/hooks/useEnderecoUnidade.ts` + teste (o vivo é `hooks/nova-entrega/useEnderecoUnidade.ts`); `src/hooks/useAsync.ts` + teste; o componente `RouteInfoHeader` (`mapa-rota/RouteInfoHeader.tsx:131`, só os helpers `getStatusBadgeVariant`/`formatStatusLabel` são usados por `app/gestor/mapa-rota.tsx:37-38`, que vão para a fonte de status do item 1.3); `desktop/CollapsibleSection.tsx` e `desktop/DesktopLayout.tsx` (só barrel e vitrine; tirar as seções da vitrine junto); `DashboardMobile.tsx:68,504` (`<Toast>` que ninguém dispara); `checkpoints.tsx:61` (`concluindoParada`, setter nunca chamado); ramo `compact` de `PreRouteChecklist` (B15); `onMarkerLongPress` declarado em `MapaAdapter.web.tsx:22` e nunca passado por nenhum chamador de `<MapaAdapter>`.
- **Cobertura:** os testes saem junto; `mapa-rota.mobile.test`, `paradas-*`. **Prova:** padrão.

**0.4 Três tabelas de padrão das preferências de navegação → uma** · confirmado · P · risco baixo · [R1 §2 passo 1]

- **Arquivos:** `src/hooks/navigation/useNavigationModeLogic.ts:31-39` (`DEFAULT_PREFERENCES`), `src/components/motorista/NavigationSettings.tsx:51-59` (`DEFAULT_SETTINGS`); fonte certa `src/services/locationTracking.ts:97-106` (`PREFERENCIAS_PADRAO`, cujo comentário já descreve o defeito medido em aparelho).
- **Proposta:** apagar as duas cópias e importar `PREFERENCIAS_PADRAO`. Extrair o armazenamento das preferências do serviço (que define task no import) fica para a Onda 2. **Cobertura:** `NavigationSettings.test`, `NavigationMode.test`. **Prova:** padrão (sem mudança no nativo, os valores são iguais hoje).

**0.5 Apoio de teste e CI mortos** · confirmado (parcial) · P · risco baixo · [R5 §4, bug 1]

- `jest.mocks/factories.ts` (194) e `__mocks__/test-data.ts` (91) sem importador; o mock de `@/lib/supabase` definido duas vezes (`jest.setup.js:604-670` e `jest.mocks/supabase.js:2-73`; só a 1ª tem `auth.setSession`). **Antes de apagar, provar com sonda qual factory prevalece** (não conferido). `jest-results.json` fora do artefato (B14).
- **Prova:** `npx jest` inteiro (o setup afeta tudo) + o job `test.yml` em PR.

**0.6 Scripts e `npm run` órfãos que escrevem no banco** · confirmado (npm) / não conferido (lista de arquivos) · P · risco baixo · [R5 §6, bug 3]

- `package.json:50-54`: `mcp:git`/`mcp:db` apontam para pastas que não existem; `migration:run`/`migration:verify` executam scripts legados contra um banco que é produção. Mais: `tools/scripts/db/*`, `tools/prepare-google-play.js`, `.bat` da raiz, `database/apply-migration-direct.js`, `run-migration-007.js`, `schema.sql`, e os não-migration dentro de `database/migrations/` (`execute-*.js`, `CONSOLIDATED_*`, `IDENTIFY/REMOVE_*`, `VERIFY_*`, `99999999999999_seed_test_data.sql`) → apagar ou levar a `database/legado/`. Tirar `ignoreBinaries: start` do `knip.jsonc`.
- **Prova:** `git grep` de cada nome no momento de apagar + `npm run scan:morto` + `migration-drift-auditor` (que deixa de ver arquivo estranho na pasta canônica).

**0.7 Docs desatualizadas** · confirmado · P · sem risco · [R4 §14, R3]

- CLAUDE.md: "285 Unused exports" → 216 (medido agora). `.claude/refs/design-system.md:58` (AddressAutocomplete "wraps Photon"; hoje é Google Places com Photon de fallback) e `:72` (vitrine "dev-only"; é rota pública, item 3.2). Comentário `AddressAutocomplete.tsx:151` (ordem dos provedores).

**0.8 Guarda de paridade entre `database/migrations` e `supabase/migrations`** · confirmado · P · risco baixo · [R5 §1]

- **Problema:** a regra "migration nova nos dois diretórios, byte-idêntica" (`MIGRATIONS.md:16-17,38-41`) só é cobrada dentro de cada teste de migration. 8 migrations de 2026 estão só em `database/` (todas documentadas no MIGRATIONS.md como aplicadas).
- **Proposta:** `database/__tests__/paridade-pastas.test.ts`: (a) todo arquivo de `supabase/` igual ao de `database/` (CRLF normalizado); (b) migration datada a partir de um corte tem cópia, com **allowlist das 8 que só pode encolher**. **Não copiar** as 8 (subconjunto por desenho, banco único sem `db push`).
- **Prova:** ver o teste vermelho apagando uma cópia em `supabase/`; `npx jest database`.

### Onda 1 — duplicação de alto valor, com teste existente (15 itens)

**1.1 `google.web.ts`: apagar o gêmeo e ter um conversor OSRM→resultado** · confirmado · P · risco baixo · corrige **B1** · [R3 §1, B1]

- **Proposta:** apagar `src/lib/google.web.ts`; extrair `osrmParaResultadoGoogle()` usado nos dois métodos de `google.ts` (`:79-107` e `:157-182`); renomear `google.web.test.ts` → `google.sequencial.test.ts` e exigir `is_estimated`/`sem_rota_entre_paradas` na saída. **Ajustes obrigatórios:** `supabase/functions/_shared/__tests__/configFuncoes.test.ts:56-61` lê `google.web.ts` com `readFileSync` (passa a ler `google.ts` ou sai), e `jest.config.js:31` exclui o arquivo da cobertura.
- **Por que é seguro:** `google.ts` só importa `logger`, `@/lib/osrm`, `google-shared`, `routeErrors` e tipos, nada de plataforma. Os métodos extras do `.web` (`autocompleteAddress`/`getPlaceDetails` via Edge Function) não têm chamador.
- **Prova:** jest + `build:web` + no dev web (OSRM demo) forçar a falha do serviço viário e ver o aviso "estimada" em Nova Rota. Não exige aparelho.

**1.2 Cores sobre o mapa: lugar neutro e aplicação nos dois mapas restantes** · confirmado · P · risco baixo · corrige **B2/B3** · [R1 §4, R4 §11, R4 bug C]

- **Proposta:** mover `CORES_SOBRE_O_MAPA` de `components/motorista/home/miniMapCompartilhado.ts:20` para `src/components/map/coresSobreOMapa.ts` (ou `utils/mapMarkerColors.ts`), com reexport em `miniMapCompartilhado`. Trocar os tokens de pino em `NavigationMode.tsx` e `MapaWebMapLibre.tsx:636,675,676` + o HTML do popup. Conferir também o HTML de marcador de `NavigationMode.web.tsx:227-373` (`gray200/gray400/info/error/warning`, não conferido). O painel e os botões (UI sobre a tela) continuam com o tema.
- **Cobertura:** estender `MiniMap.temaEscuro.test.tsx` ao NavigationMode e ao MapaWebMapLibre; checar se `maplibre-fonte-unica.test.ts` cita o caminho. **Prova:** jest; web com tema escuro em `/gestor/mapa-rota`; **aparelho** em tema escuro no modo navegação (só cor, Marker e toque intocados).

**1.3 Status de rota e de parada: fonte única** · confirmado (parcial) · P · risco baixo · corrige **B5** · [R2 §3, R3 §7 passo 1]

- **Arquivos:** `RotaCard.tsx:35-62`, `RouteInfoHeader.tsx:33-125` (helpers), `RotasAbertasModal.tsx:60`, `useGestaoRotas.ts:630-640`, `app/gestor/mapa-rota.tsx:176` contra `src/constants/statusConfig.ts` ("Single source of truth", `:6`) e `src/lib/statusLabels.ts:31`. Tipos: `StatusCheckpoint` (`types/rota.ts:22`) e `ParadaStatus` (`statusLabels.ts:39`) **sem `em_andamento`**, que o banco tem (o invariante do `useReorderState`).
- **Proposta:** eleger `statusConfig` (cor + rótulo) e fazer `statusLabels` reexportar; `STATUS_PARADA = [...4] as const` em `types/rota.ts`, com `StatusCheckpoint`/`ParadaStatus` derivados. Decidir a capitalização ("Em andamento").
- **Cobertura:** `RouteInfoHeader.test`, testes do Dashboard (nenhum cobre `nao_executada` no card: acrescentar). **Prova:** jest + tsc (o `Record<StatusParada,…>` passa a exigir os 4) + olhar a lista mobile do Dashboard.

**1.4 Operações de motorista na loja: uma lib** · confirmado · M · risco baixo-médio · corrige **B6** · [R2 §1]

- **Proposta:** `src/lib/gestor/motoristaNaLoja.ts` com `alternarMotoristaNaLoja()` (RPC `alternar_motorista_na_unidade` + `logUserAction`, devolve o escopo `vinculo|pessoa`), `editarDadosMotorista()` (update + log) e `mensagemErroMotorista()` (telefone duplicado + `mensagemRegraDoBanco`, saindo de `useMotoristasOperations.ts:32`). As três telas ficam com a confirmação e o toast (o toast continua da página).
- **Cobertura:** `motorista-perfil.{bloqueio,edicao}.test`, `equipe.test`, `useMotoristasGestor.test`. Faltam o teste da lib e o caso "telefone duplicado pelo perfil". **Prova:** jest; web com dois motoristas e o mesmo telefone.

**1.5 Auditoria em `logs` pelos helpers que checam erro** · confirmado · P · risco baixo · corrige **B7** · [R2 §5]

- Trocar os 6 `insert` crus pelos helpers de `src/lib/queries/logs.ts` (`parada_id` continua dentro de `detalhes`). **Prova:** jest com os mocks de `from('logs')` ajustados, mais um teste que exige `logger.warn` quando o insert devolve `error`.

**1.6 Haversine: uma implementação** · confirmado · P · risco baixo · [R3 §5, R1 §13]

- Vivas: `osrm/fallback.ts:31`, `routeGeometry.ts:28`, `useNovaEntrega.helpers.ts:311`, `locationTracking.ts:408` (a de `timeEstimation` sai na 0.2). → `src/lib/geo/distancia.ts` (`distanciaMetros(a,b)`), com reexport por um ciclo. **Prova:** jest (`routeGeometry`, `osrm`, `agrupamento`) + um teste de paridade numérica. A troca em `locationTracking` não muda a cadência, mas toca o serviço de segundo plano: incluir na próxima validação de aparelho.

**1.7 Série das filas offline: um `criarSerie`** · confirmado · P-M · risco baixo-médio · [R3 §2]

- 4 cópias: `offline.ts:125`, `filaAcoesParada.ts:139`, `filaPosicoes.ts:303`, `rotaGuardada.ts:49`. → `src/lib/armazenamentoLocal.ts` com `criarSerie({ imediato? })` + `lerJsonParaExibir()`. **Não unificar** retry, dono, geração nem a política de 42501 (cada fila tem decisão documentada). **Cobertura:** muito boa (`offline-indice-fotos-em-serie`, `offline-foto-sem-esperar-refresh` conta microtarefas, `filaPosicoes*`, `filaAcoesParada`). **Prova:** jest; essas suítes medem a ordem.

**1.8 Contexto de rota: ações estáveis e erro claro** · confirmado · P · risco baixo · corrige **B13** · [R1 §6]

- `useRouteActions.ts:105,206,266,306,338` são `const` async recriadas a cada render, o que anula o `useMemo` de `RouteStatusProvider.tsx:181-212` e re-renderiza os 13+ consumidores. → refs para `route/paradas/userData` + `useCallback`, e `createContext(null)`. **Risco:** ref obsoleta (`completeStop` lê `route.status`). **Cobertura:** `useRouteActions.test`, `.offline.test`, `RouteStatusContext.test`. **Prova:** jest + teste de contagem de render do consumidor.

**1.9 Telefone, CNPJ e "só dígitos"** · confirmado (parcial) · P · risco baixo · [R3 §8, R2 §11]

- `formatPhone` local em `app/perfil/editar.tsx:29` e `app/motorista/perfil/editar.tsx:23` (difere da lib com 1–2 dígitos); WhatsApp/`tel:` refeito em `ParadaCard`, `ParadaCardCompact`, `ParadaCardDetails`; regra 10/11 dígitos repetida em `BulkStopImporter.tsx:146`/`schemas/parada.ts:50`. → `lib/phone.ts` (`telefoneValido`, `telefoneInternacional`) + `lib/documentos.ts` (`soDigitos`, `formatCnpj`). Remover os aliases mortos de `phone.ts:174-180`. Não mexer em `maskCEP`/`formatCEP`. **Prova:** `phone.test.ts` + um teste de máscara na tela de perfil.

**1.10 Timeline: `rota_finalizada` e `includes` frouxos** · confirmado · P · risco baixo · corrige **B10** · [R3 B2]

- Casar os eventos de `TIMELINE_LOG_EVENTS` por igualdade antes dos `includes('start'|'cancel'|'finaliz')` e **inverter `timeline.test.ts:437`**. **Prova:** o teste invertido falha antes da correção.

**1.11 Aba Paradas: usar o `ParadaData` do contexto** · confirmado · P · risco baixo · corrige **B16** · [R1 §10]

- Trocar os 5 `toParadaData(...)` por `paradasContext.find(id)`; extrair o skeleton inline (`:368-455`) para perto de `ParadaCardSkeletonList`. **Cobertura:** `paradas-visita-combinada`, `paradas-retomar`, `paradas-recarga-silenciosa`. **Prova:** jest; não exige aparelho (sem mudar o fluxo da câmera).

**1.12 Helpers das guardas de migration** · não conferido · M · risco baixo · [R5 §3]

- 37 testes em `database/__tests__/` repetem `ler`, `semComentarios`, o bloco de rollback, "nas duas pastas" e "documentada". → `database/__tests__/_helpers/migration.ts`, migrando arquivo a arquivo **sem mudar asserções**. **Prova:** `npx jest database` verde antes e depois, com a mesma contagem de testes.

**1.13 Cadeia falsa do Supabase em helper** · não conferido · M · risco baixo · [R5 §2 alt. A]

- Cerca de 24 construtores locais (`chain`, `cadeia`, `mockQueryBuilder`) → `src/__tests__/helpers/cadeiaSupabase.ts`. Troca mecânica: o teste afirma o mesmo que antes (não passa a provar o filtro, que é a Onda 3). **Prova:** jest com contagem igual.

**1.14 Esperas reais contra debounce → fake timers** · não conferido · P · risco baixo · [R5 §8]

- `useTimelineData.test.ts:339,365`, `useMapaRotaData.realtime.test.ts:161,214,322`, `useMainCardData.test.ts:254,272`, `ChangeDriverModal.test.tsx:554`. Importar as constantes (exportar `DEBOUNCE_RECARGA_MS`). **Prova:** quebrar o debounce no código e ver o teste vermelho.

**1.15 `MapaAdapter`: uma interface de props** · confirmado (parcial) · P · risco baixo · [R4 §7]

- `MapaAdapter.tsx:15-69` e `.web.tsx:15-65` copiam a interface; o stub `MapaMobile.web.tsx` tem `Parada`/`StatusFilter` próprios. → `src/types/mapa.ts`. **Não apagar nenhuma variante** (decisão do knip/Metro); só trocar o corpo. **Prova:** `MapaAdapter.test`, `MapaMobile.web.test`, e2e `renders motorista mapa`.

### Onda 2 — divisões e unificações que pedem aparelho ou visual (16 itens)

**2.1 Concluir/pular: hook + `ModaisDaParada` compartilhados** · não conferido · M · risco baixo-médio · [R1 §1]

- `inicio.tsx`, `mapa.tsx`, `checkpoints.tsx` repetem `useConclusaoEmSequencia` + `usePuloDaVisita` + `handleConclusaoSucesso` + o par `StopCompletionFlow`/`SkipReasonModal`. Ver alternativas na seção 4. **Prova:** suítes `inicio-modo-navegacao`, `mapa-conclusao-com-foto`, `mapa-pular-parada`, `*-visita-combinada` + **aparelho** com `always_finish_activities 1` (restauração pós-câmera) e confirmação de que o modal não desmonta durante o `loading` (`mapa.tsx:177`).

**2.2 Permissão + posição inicial + watcher: `usePosicaoEmPrimeiroPlano`** · não conferido · M · risco médio · [R1 §3]

- 5 cópias (`inicio.tsx:172-251`, `NavigationMode.tsx:177-216`, `.web.tsx:479-541`, `sos.tsx:172-215`, `useDriverLocationBroadcast.ts:140-175`). Hook de cola **sem mudar cadência nem número de watchers**. **Prova:** só o **aparelho**: rota ativa com "Rastreando" e geofence, Android 12+ (#570), ordem dos efeitos.

**2.3 Adicionar/Editar parada: `CamposParadaModal` + `useCamposEnderecoParada`** · não conferido · M · risco médio · [R2 §2]

- JSX e handlers gêmeos em `AddStopModal`/`EditStopModal` e `useAddStopForm`/`useEditStopForm`; o erro cruzado (`clearErrors('endereco')`) copiado 4 vezes (também `FormularioParada.tsx:299-314`, `criar-unidade.tsx:288`). Saves separados (RPC `inserir_parada` x UPDATE condicionado). Componente **de módulo**, nunca no render. **Prova:** os 4 testes + web desktop e mobile (foco do autocomplete: marcar o nó e digitar).

**2.4 Casca `useCargaPorLoja`** · não conferido · M · risco médio · [R2 §4]

- Contador de requisição + reset na troca de loja + `dadosDe` reescritos em cerca de 8 telas. Ver seção 4. **Prova:** os `*.trocaDeLoja.test` de cada tela migrada + web trocando de loja no seletor durante uma carga lenta (throttling).

**2.5 Modais web: `Modal.tsx` → `DesktopModal`, `useWebDialog` com contador** · **reclassificado** · M · risco médio · corrige **B8/B9** · [R4 §1, §9, bugs A/B]

- **Correção do relatório:** `Modal.tsx` tem **dois** consumidores, não um: `app/gestor/gestao-rotas.tsx:677` (Exportar) **e `src/components/SeletorUnidade.tsx:24,216`** (o seletor de loja do gestor, montado em `app/gestor/_layout.tsx` e `DesktopPageLayout`). Ver seção 4. **Prova:** `Modal*.test`, `DesktopModal*.test`, `SupportModal*.test`, `useDialogState.test` + web (desktop e mobile) abrindo confirmação sobre modal + **Android** (o seletor de loja tem ramo nativo).

**2.6 Estado vazio: consolidar `MobileEmptyState`+`MobileButton` em `EmptyState`** · confirmado (parcial) · M · risco médio (visual) · [R4 §4]

- É exatamente o pré-requisito que o CLAUDE.md pede antes de polir. 8 arquivos usam `MobileEmptyState`, que é o único usuário de `MobileButton`. Passo 1: `fullScreen` no `EmptyState`, trocar os usos e apagar os dois. Passo 2 (separado): `MobileCard` → `Card`. **Prova:** jest + as telas em web mobile, web desktop e Android (o emoji renderiza diferente).

**2.7 MiniMap: derivação compartilhada `useDadosDoMiniMap`** · não conferido · P-M · risco baixo · [R1 §5]

- Cerca de 120 linhas idênticas entre `MiniMap.tsx:148-260` e `.web.tsx:136-262`; o desenho fica em cada variante (decisão documentada). **Prova:** `MiniMap.test`/`.web.test` + e2e do mapa + aparelho na Início.

**2.8 Regras puras da Início** · não conferido · P-M · risco baixo · [R1 §9]

- `getFABProps` e `handleMainAction` são dois `switch` sobre os mesmos estados → `lib/motorista/acaoPrincipal.ts`; `getElapsedTime` e `validarInicioDeRota` → funções puras; `calculateSuccessRate` sai de `MainCard.utils`. Junto com 2.1/2.2 (mesmo arquivo, 19 commits em 3 meses). **Prova:** testes puros + `inicio-*.test`.

**2.9 Escrita de servidor do mapa-rota em `lib/gestor/edicaoRota.ts`** · não conferido · M · risco médio · [R2 §6]

- `useMapaRotaHandlers.ts` (762): trocar motorista, remover e reordenar (5 operações, `try` aninhado). Espelha `acoesRota.ts`. Depois de 1.5. **Prova:** `useMapaRotaHandlers.test`, `.paradaFeita.test` + web reordenando e conferindo a timeline.

**2.10 Excluir rota: `useExcluirRota` + `useToast` no Dashboard desktop** · não conferido · M · risco baixo · [R2 §7]

- `DashboardDesktop.tsx:66-150` x `useGestaoRotas.ts:441-545`. **Prova:** `useGestaoRotas.exclusao.test`, `_components/desktop/__tests__` + web.

**2.11 Gestor: consultas puras fora de hooks e telas** · não conferido · M · risco médio · [R2 §10, §11, §12]

- `useDashboardData.ts` (consultas, `calcularTempoMedio(any[])`, mock de E2E no caminho de produção) → `lib/gestor/consultaDashboard.ts`; parser do `BulkStopImporter` → `lib/gestor/importacaoEmLote.ts`; `app/unidade/index.tsx` → `useFichaUnidade` (a sede continua fora do RHF). **Prova:** as suítes `useDashboardData.*`, `BulkStopImporter.test`, `index*.test` + web.

**2.12 Classificação de erro: primitivas compartilhadas, políticas locais** · não conferido · M · risco médio · [R3 §3]

- Sete classificadores (`filaAcoesParada.ts:309-366`, `filaPosicoes.ts:143-195`, `falhaPerfil.ts:60-95`, `queryClient.ts`, `errorMapping.ts`, `offline.ts:80`); hooks importam classificador de dentro de uma fila. 1º passo: tabela de casos (erro → classe) + mover sem mudar comportamento. **Prova:** jest, e a tabela vira o contrato. Se a regra mudar (PGRST303 em `falhaPerfil`), **aparelho** offline.

**2.13 `storage.ts`: núcleo de upload que lança erro tipado** · não conferido · M · risco baixo · [R3 §11]

- 4 uploads com o mesmo miolo e falha engolida (`null`/`''`/`false`). Núcleo interno com wrappers que **mantêm o contrato público**. **Prova:** `storage.test`, `storage-foto-da-fila.test` + aparelho tirando foto com e sem rede.

**2.14 Divisões de arquivo: `notifications.ts` e `offline.ts`** · não conferido · M · risco médio · [R3 §10, §13]

- `notifications.ts` (731) → registro do push em `lib/notificacoes/registroPush.ts`; `offline.ts` (727) → `offline/fotos.ts` + `offline/sincronizacao.ts`, com reexport. **Só depois de 0.2 e 1.7.** **Prova:** jest (muitos `jest.mock('@/lib/offline')`) + aparelho: push na bandeja e fila na reconexão.

**2.15 Sessão e "estou online" no caminho do motorista** · código confirmado · P · risco médio · corrige **B11/B12** · [R3 §6, §12]

- `usuarioIdDaSessaoLocal()` sobre `lerSessao()` nos sites por posição e por tentativa de fila; `isOnline()` = `!(await semRedeConfirmada())`, conferindo antes que `CameraUpload` cai para a fila quando o envio falha. **Prova:** só o **aparelho**: modo avião com token vencido e Wi-Fi sem internet, medindo o tempo até a posição entrar na fila; e a consulta de duplicatas da pendência 23(b) vazia.

**2.16 Infra: workflows e Edge Functions** · confirmado (parcial) · M · risco médio · [R5 §5, §7]

- Cron `expire-routes.yml`: 3 jobs iguais → `matrix` (1º passo, sem SHA nem Playwright). Composites `preparar-node`/`preparar-playwright` **só** com `workflows-seguranca.test.ts` lendo `.github/actions/**` e entrada própria no `dependabot.yml`. Edge Functions: `corsHeaders` em 4 funções (confirmado) e `usuarioValido` em 2 → `_shared/http.ts` e `_shared/autenticacao.ts`, uma função por PR. Não mexer no `build:web` em 3 jobs (decisão em `test.yml`). **Prova:** PR com os jobs verdes; Edge Function exige novo deploy de quem importa `_shared` (fora desta varredura).

Também da Onda 2, para quando o arquivo for tocado por outro motivo (não conferidos): `useLoadActiveRoute` com `useReducer` [R1 §7, M]; `sos.tsx` → `lib/motorista/sos.ts` + `useContatoDoGestor` [R1 §11, M]; `NavigationInfoPanel` x `…Web` [R1 §12, M]; `AddressAutocomplete` → `useSugestoesDeEndereco` + `extrairNumeroDoTexto` [R4 §8, M]; `Input` que aceita `ref`, migrando os formulários de auth primeiro [R4 §5, M]; `mapa-rota/styles.ts` (809) dividido por componente e `useParadaCardModel` [R2 §9, M]; `DesktopModal` com `<Button>` no rodapé [R4 §9, depois de 2.5].

### Onda 3 — precisam de decisão (10 itens)

**3.1 Aviso de chegada no nativo (B4) e divergência NavigationMode nativo x web** · confirmado (B4) · M-G · [R1 §8, §13]

- **Decidir:** o raio e o aviso valem nos dois lados? Confirmação ao sair também na web? Se "não", apagar o slider no nativo e o código morto de `locationTracking.ts:331-365,423-429`; se "sim", implementar o aviso **só como aviso** (o `StopCompletionFlow` segue como a única porta de concluir). Depois: `enquadramentoDaNavegacao()` pura em `lib/motorista/`. **Prova:** aparelho andando.

**3.2 Vitrine `/design-system` publicada em produção** · confirmado · P (gate) / M-G (divisão) · [R4 §3, §12]

- `app/design-system.tsx` (5.315 linhas) não tem nenhuma guarda (`__DEV__`, `Redirect`), e é o único teste visual dos componentes base (`e2e/design-system.e2e.ts`). **Decidir:** gate por env (o e2e liga a env) e, mais tarde, dividir por seção. **Prova:** e2e visual com e sem a env.

**3.3 Tipo `ParadaBase` para as cerca de 14 interfaces `Parada*`** · não conferido · G · [R3 §7 passo 2] — só com um bug concreto de campo renomeado que justifique. Depende de 1.3.

**3.4 Datas: `toLocale*('pt-BR')` contra a regra "sem ICU"** · não conferido · M · [R3 §9] — cerca de 25 usos (7 na timeline). O texto exibido muda; decidir o formato antes. Guarda estática no modelo de `data-local-sem-utc.test.ts`.

**3.5 Barrel `@/design-system` dentro de `src/components`/`src/hooks`** · não conferido · M · [R4 §13] — medir antes (tempo da suíte, bundle web) e só então propor `no-restricted-imports`.

**3.6 Tema: `styles.base.ts` → `src/theme/*`; botão compacto de 36 px** · não conferido · M · [R4 §10, bug E] — o 36 px "Min touch target" contradiz os 44 px da doc: decidir se a densidade compacta é só desktop. `defaultTheme` fora de hook em CSS injetado (scrollbar do `DesktopModal`) usa token claro no escuro.

**3.7 Suíte de datas com `TZ=America/Sao_Paulo` no processo** · não conferido · P · [R5 §9] — complementa, não substitui, a guarda estática. A premissa (o `TZ` do ambiente vale para os workers do Node 22) **tem de ser provada no runner**, com um teste que falha se o offset não for 180.

**3.8 Versões exatas dos imports das Edge Functions** · confirmado · P · [R5 §10] — `supabase-js@2` flutuante em 6 funções, `@2.45.0` em uma; `std@0.168`/`@0.224`. Fixar **na versão que roda em produção** (exige conferir o deploy).

**3.9 `MapaWebMapLibre` em hooks por camada** · não conferido · G · risco alto · [R4 §6] — adiar até haver outro motivo para mexer no mapa (a armadilha do "Carregando..." silencioso). Só com o e2e funcional verde.

**3.10 Testes que provam o filtro (`consultaFalsa`/`postgrestFalso`)** · não conferido · G · [R5 §2 alt. B] — arquivo a arquivo, quando o hook for tocado, começando por `useLastRoute`/`useExpiredRoute`/`useMotoristaStats`. Cada teste migrado tem de ser visto vermelho removendo o `.eq` no hook.

## 4. Os 5 itens de maior valor: alternativas e escolha

**(1) `google.web.ts` (item 1.1)**

- A) Apagar o `.web` e extrair o conversor. B) Manter e sincronizar à mão. C) Só um teste de paridade nativo x web.
- **Recomendada: A.** O gêmeo não tem motivo de plataforma (imports conferidos), e B repete a causa: a divergência nasceu justamente de uma mudança feita só no `.ts`. C detecta, mas mantém duas cópias e exige um projeto de jest por plataforma.

**(2) Operações de motorista (item 1.4)**

- A) Funções puras em `src/lib/gestor/`. B) Hook `useAlternarMotorista` com confirmação e toast embutidos. C) Só alinhar os textos e copiar o log.
- **Recomendada: A.** B esbarra no "toast pertence à página" e atrapalha o `withToast` da lista; C deixa três cópias para divergirem de novo (já divergiram em mensagem, auditoria e redação).

**(3) Concluir/pular no motorista (item 2.1)**

- A) Hook + componente `ModaisDaParada`. B) Só o hook; o JSX fica nas telas. C) Modais no `_layout` com um contexto.
- **Recomendada: A, entregue como B primeiro**, uma tela por PR, começando pelo Mapa (menos churn, mais testes). B sozinho deixa o JSX duplicado, que é onde o esquecimento aconteceu (#565). C muda onde o estado vive (o modal sobreviveria à troca de aba) e mexe na restauração pós-câmera.

**(4) Modais web e trava de rolagem (item 2.5)**

- A) Migrar os 2 consumidores de `Modal.tsx` para `DesktopModal` e apagar o `Modal`. B) `Modal` como casca fina sobre `DesktopModal`. C) Só trocar a cópia da trava pelo `useWebDialog` com contador.
- **Recomendada: C primeiro, depois A.** C corrige B8 em todos os modais com risco visual quase nulo. A muda o visual do seletor de loja (uso diário de todo gestor, com ramo nativo), por isso vem em PR separado com conferência visual. B mantém três nomes para a mesma coisa.

**(5) Carga por loja no gestor (item 2.4)**

- A) Hook genérico `useListaPaginadaPorLoja` (rotas + incidentes). B) Casca `useCargaPorLoja` aplicada primeiro às cargas simples (equipe, unidade, perfil, dashboard). C) Migrar tudo para `useCachedData`.
- **Recomendada: B.** Tira a duplicação mais perigosa (a corrida entre cargas) e cada passo tem seu `trocaDeLoja.test`. A é G e as paginações diferem em abort, exportação e cursor. C exigiria estender um hook central que também serve o motorista, e não modela "erro com dados de HH:MM" (decisão documentada para `useDashboardData`).

(Status único, item 1.3: `statusConfig` como fonte x `statusLabels` como fonte x lista `as const` derivando os dois. A escolha é `statusConfig`, porque já tem cor e rótulo e se declara fonte única, com a lista `as const` só para o tipo de parada.)

## 5. Dependências e ordem

**Precisa vir antes:**

- 0.1 (defaults) antes de 2.5 e 2.6 (mexem em `Modal`, `EmptyState`).
- 0.2 **não** apaga `logAction`/`logRotaAction` (1.5) nem `PARADA_STATUS_LABELS` (1.3). 0.2 e 1.7 antes de 2.14.
- 0.3 (`RouteInfoHeader`) junto com ou depois de 1.3, porque os helpers vão para a fonte de status.
- 0.4 antes da extração das preferências (Onda 2); 3.1 antes de apagar o código de notificação do `locationTracking`.
- 1.2 antes de 2.7 (mini-mapa) e de 3.9. 1.5 antes de 2.9. 1.11 antes de 2.1 (mesmo arquivo). 2.1 antes de 2.2 e 2.8 (`inicio.tsx`). 1.3 antes de 3.3.
- 1.4 e 2.4 tocam `motorista-perfil.tsx` e `equipe.tsx`: sequenciar (1.4 primeiro).
- 2.5 (C) antes de 2.5 (A) e do rodapé do `DesktopModal`. 1.12 antes de 0.8 só se a guarda de paridade usar o helper (pode ir antes, sem ele).

**Pode correr em paralelo (sem tocar os mesmos arquivos):**

- Trilha **lib**: 1.1, 1.6, 1.7, 1.10.
- Trilha **gestor**: 1.3 → 1.4 → 1.5.
- Trilha **motorista**: 0.4, 1.8, 1.11.
- Trilha **mapa**: 1.2, 1.15.
- Trilha **testes/infra**: 0.5, 0.6, 0.8, 1.12, 1.13, 1.14.
- Atenção: 1.6 e 1.2 encostam no `locationTracking`/mapas. 1.6 toca `locationTracking.ts:408`, que 3.1 também toca: fazer 1.6 primeiro.
- **Aparelho em lote:** 1.2 (escuro), 1.6, 2.1, 2.2, 2.15 numa mesma sessão de validação no moto g15, depois da validação pendente da 1.14.11 (pendência 23) e respeitando a migração do SDK 58 (pendência 31, prazo 24/11), que concorre pelo aparelho e pela cota de build.

## 6. Descartados e por quê

1. **"`Modal.tsx` tem um consumidor de produção"** [R4 §1]: está errado. `SeletorUnidade.tsx:24` também o usa (seletor de loja do gestor). O item foi mantido e reclassificado para a Onda 2 (2.5), com risco visual maior.
2. **"`MapaAdapter.web` ignora `onMarkerLongPress`" como bug** [R4 bug D]: nenhum chamador de `<MapaAdapter>` passa a prop (`mapa-rota.tsx:517,715`, `mapa.tsx:340`). Não tem efeito; virou limpeza (0.3).
3. **"8 migrations fora de `supabase/migrations/` = bug"** [R5 bug 2]: `supabase/` é subconjunto por desenho, o MIGRATIONS.md prevê exceções retroativas, as 8 estão documentadas como aplicadas e o banco é único (ninguém reconstrói pela pasta). Ficou só a guarda com allowlist (0.8), sem copiar arquivos.
4. **"`PreRouteChecklist` troca os ícones por spinner a cada 5 s"** [R1 bug 4]: o ramo `compact` não tem chamador. Sobra o spinner pequeno do título (B15, cosmético).
5. **"knip 216 x 285" como regressão ou mistério**: não é nenhum dos dois. Medido agora: 216. O 285 do CLAUDE.md é de 21/09 e só precisa ser atualizado (0.7).
6. **Unificar `NavigationMode`/`MiniMap`/`MapaAdapter` com a variante `.web` num arquivo só**: contraria a decisão documentada (o Metro escolhe por extensão; o mapa web quebra em silêncio). Só se extrai o que não depende de plataforma.
7. **Modais da parada no `_layout`** [R1 §1 alt. C], **fábrica única de fila persistente** [R3 §2 alt. B], **enum fechado de erro** [R3 §3 alt. B], **teste de migration parametrizado único** [R5 §3 alt. B]: escondem decisões documentadas ou mudam comportamento; descartados em favor das alternativas menores.
8. **`useDashboardData` em `useCachedData`**, **dois schemas de parada**, **sede no RHF**, **`startRoute` multi-passo no client**, **shim `RouteStatusContext`**, **`build:web` em 3 jobs do CI**: decisões documentadas (CLAUDE.md, pendência 30(j), comentário do `test.yml`).
9. **Storybook ou Ladle no lugar da vitrine** [R4 §3 alt. B]: perde os 8 snapshots visuais e o ganho é incerto.
10. **`PosicaoContext` com um watcher só** [R1 §3 alt. B]: sem medida de bateria que justifique; mexe na cadência que alimenta `motorista_locations` e a fila de posições.
11. **`getElapsedTime` "não atualiza sozinho"** [R1 bug 5]: não é defeito (recalcula a cada re-render); virar cronômetro é decisão de produto, tratada só como função pura no 2.8.

## 7. Itens sensíveis de segurança (termos gerais)

- **Scripts legados alcançáveis por `npm run`** conectam direto a um banco que é produção. Remover (0.6) reduz o risco de execução acidental. Nada a expor aqui sobre como se conectam.
- **Dependências flutuantes no código de servidor** (3.8): uma publicação futura pode puxar outra versão do cliente sem mudança de código. Fixar na versão em produção.
- **Rota interna de demonstração publicada** (3.2): não expõe dado, mas é superfície e bundle desnecessários em produção.
- **Classificação de erro e sessão nas filas offline** (2.12, 2.15) decide entre descartar e reter ações. Mudança aqui é de risco funcional e de integridade, e exige a tabela de casos e o aparelho.
- **Unificar a autorização das Edge Functions em `_shared`** (2.16) tem de preservar a autorização feita por dentro de cada função e o contrato de CORS e de erro. Revisar com o guarda de vazamento de erro existente.
- **Nada nesta varredura afrouxa RLS, grants ou o modelo de vínculo entre lojas.** Os itens do gestor (1.4, 2.4) continuam passando pelas RPCs existentes e pela trava de motorista de outra loja. Qualquer mudança de schema derivada passa pelo `rls-policy-reviewer` antes do merge.
