# Execução das varreduras (08/11 + anteriores) — Plano

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development. Passos em
> checkbox (`- [ ]`). Cada grupo é um PR, numa worktree própria a partir da `main`.

**Objetivo:** executar todos os achados da varredura de 08/11 e os pendentes decididos em 08/11,
em 7 PRs revisados, com o banco aplicado só com OK do usuário.

**Arquitetura:** grupos 1, 2, 3, 5 (parte banco/Edge) e 6 correm em paralelo (arquivos
disjuntos). O grupo 4 começa depois do 2 mesclado; o lado do app do grupo 5 depois de 1 e 2
mesclados e da migration aplicada; o 7 por último.

**Stack:** React Native + Expo SDK 58 + TypeScript, Jest + RTL, Supabase (Postgres/RLS, Edge
Functions Deno), GitHub Actions.

**Spec:** `docs/superpowers/arquivo/specs/2026-11-08-execucao-varreduras-design.md`. Os ids (G8-, M8-,
U8-, L8-, B8-) estão em `docs/superpowers/arquivo/2026-11-08-varredura-refatoracoes.md`; B-7/B-11/T-2 em
`docs/superpowers/2026-11-07-varredura-refatoracoes.md`; 26/30 em `docs/PROJECT_CONTEXT.md`.
O executor lê o item na fonte antes de implementar.

## Global Constraints

- PT-BR em código, comentário, commit e relatório. Padrões do `CLAUDE.md` valem (logger 2 args,
  sem `as any`, `requisicaoRef`, `dateUtils`, Toast da página, sem componente no render,
  `pedirPermissao`, `formatarDecimal`, `CORES_SOBRE_O_MAPA`).
- TDD: bug ganha teste que **falha antes** (registrar o vermelho no relatório). Refatoração mantém
  os testes verdes.
- ≥2 alternativas comparadas quando o relatório deixar escolha; registrar o porquê.
- Subagente **nunca** escreve no banco, aplica migration, publica Edge Function, faz push, PR ou
  merge. Não lê `.env*`, `eas.json`, keystore, `google-services.json`,
  `play-store-credentials.json`. Nunca `--no-verify`.
- Repositório público: nada de detalhe de fraqueza aberta em código, comentário ou commit.
- Commits `fix(<área>): <id> — <resumo>` / `refactor(<área>): …`, terminando com
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Pre-commit reformata: se sobrar diff
  de formatação, commit `style:` separado.
- `node_modules` na worktree: junction para o do checkout principal
  (`New-Item -ItemType Junction -Path node_modules -Target D:\rota-mestre\rotamestre-app\node_modules`).
  Jest dentro da worktree com caminhos explícitos (`npx jest <arquivos>`).
- Verificação de cada tarefa: `npx tsc --noEmit`, `npx eslint <arquivos tocados> --max-warnings=0`
  e jest dos arquivos tocados + seus testes.
- Migration: `database/migrations/YYYYMMDDhhmmss_*.sql` + cópia em `supabase/migrations/`, sonda em
  `database/sondas/`, teste estático em `database/__tests__/`, entrada ⏳ em
  `database/MIGRATIONS.md`. Seguir a skill `/new-migration`.

## Review Focus

- Sugestão de endereço sem `place_id` do Google nem CEP (Photon sem `postcode`): campos ficam
  vazios, nenhuma chamada ao Google — teste na Task 3.1.
- Duas ações offline em sequência com a rede voltando no meio: as duas sobem na mesma volta —
  teste na Task 2.1.
- Troca de loja com a carga da Transferir em voo: a lista é da loja nova — teste na Task 1.2.
- Rota cancelada com motorista sem token de push: a notificação é gravada e a RPC não falha —
  caso na sonda da Task 5.2.
- Job agendado falhando duas vezes seguidas: uma issue só, com comentário — teste na Task 6.2.

---

## Grupo 1 — Gestor (PR `refactor/gestor-08-11`)

### Task 1.1: Início desktop e resumo do dia (G8-1, G8-7, G8-8, G8-6)

**Files:** `src/components/gestor/dashboard/_hooks/useDashboardData.ts`, `app/gestor/inicio.tsx`,
`src/components/gestor/dashboard/**/ResumoDoDia.tsx`, `DashboardDesktop.tsx`, testes ao lado.

**Interfaces:** Produces `useDashboardData(opcoes?: { comKpis?: boolean })` (padrão `true`);
`src/hooks/gestao-rotas/useExclusaoDeRota.ts` → `useExclusaoDeRota({ showToast, aoExcluir })`
devolvendo `{ pedirExclusao(rota), dialogo: ReactNode }`.

- [ ] Teste `useDashboardData.carga.test.ts`: `comKpis: false` não consulta `rotas` da semana/mês,
      não chama `nomes_motoristas_das_rotas` nem `buscarTotalHoje`; mudar para `true` recarrega KPIs.
      Rodar → vermelho.
- [ ] Implementar a opção; `inicio.tsx` passa `comKpis: !isDesktop`. Trocar o estado `stats` por
      `incidentesAbertos: number | null` (G8-7). Verde.
- [ ] Teste `ResumoDoDia.test.tsx`: rotas `concluida`(4/4), `em_andamento`(1/3), `cancelada`(2/5),
      `nao_executada`(0/2) → texto "5 de 7 paradas feitas". Vermelho → corrigir → verde.
- [ ] Extrair `useExclusaoDeRota` (Toast recebido por parâmetro, texto do diálogo guardado até o
      fim da animação) e usar em `DashboardDesktop` e `app/gestor/gestao-rotas.tsx`; trocar o toast
      manual por `useToast` na página (G8-6). Teste: o título do diálogo não muda ao confirmar.
- [ ] Verificação + commits por id.

### Task 1.2: Transferir gestão (G8-2)

**Files:** `app/unidade/transferir.tsx`, `src/lib/gestor/equipeDaLoja.ts` (só consumo), teste.

- [ ] Ler a RPC viva `transferir_gestao_principal` (migration mais recente que a define) e
      registrar no relatório o que ela exige do novo gestor.
- [ ] Testes: (a) a lista vem de `carregarEquipeDaLoja` filtrada por `papel === 'gestor' && ativo &&
!is_gestor_principal`; (b) duas cargas em voo (loja A depois B), A resolve por último → a lista é
      de B. Vermelho → implementar com `requisicaoRef` → verde → commit.

### Task 1.3: DataTable, status e tipos (G8-3, G8-4, G8-5, G8-9, G8-10, `useMemo`)

**Files:** `src/components/data-table/{types.ts,DataTableDesktopView.tsx}`,
`src/constants/statusConfig.ts`, `app/gestor/{gestao-rotas,motoristas}.tsx`,
`src/hooks/incidentes-gestor/constants.ts`, `ParadaCardCompact.tsx`,
`src/components/gestor/motorista-perfil/RotasRecentes.tsx`,
`src/components/gestor/dashboard/**/ListaDeRotasDoDia.tsx`, `src/hooks/gestao-rotas/useTimelineData.ts`.

**Interfaces:** Produces `DataTableColumn.rotulo?: (item: T) => string`;
`propsDoStatusBadge(status: string, colors: Cores): { color: string; textColor: string; icon: string; label: string }`.

- [ ] Teste: coluna com `render` e chave que não é campo → o rótulo da linha não contém
      "undefined" e usa `rotulo` quando dado. Vermelho → implementar → verde.
- [ ] Teste de `propsDoStatusBadge` (tabela dos 5 status de rota + desconhecido); trocar os 4
      chamadores e `RotasRecentes` (sem `hex + '20'`, usar `withOpacity`).
- [ ] G8-9: linha clicável vira grupo com botão de abrir só no nome; teste de papel acessível: nenhum
      `button` dentro de `button` em `ListaDeRotasDoDia` e `DataTableDesktopView`.
- [ ] G8-10: tipos locais / `.returns<…>()` em `useTimelineData`; `useMemo` de `actions`/`columns` em
      `gestao-rotas.tsx`. tsc verde.
- [ ] Verificação + commits.

### Task 1.4: Os pontos menores do #735

**Files:** os que a lista apontar (gestor desktop, `Sidebar`, `MenuDeAcoes`, `StatusBadge`,
Mapa da Rota).

- [ ] Reconstruir a lista: no transcrito
      `C:\Users\welli\.claude\projects\D--rota-mestre-rotamestre-app\72b809b0-1403-4d56-a3c4-3955631e69f3.jsonl`,
      as linhas `minor (deferred)` cujos arquivos sejam os tocados pelo #735 (`git show --stat 4a1c71d3`),
      mais "PARTIDA"/"CHEGADA" em caixa alta no Mapa da Rota. Não ler o transcrito inteiro: usar `grep -o`.
      Gravar a lista em `<workspace>/pontos-735.md` com, para cada ponto, ainda vale / já corrigido
      (evidência).
- [ ] Corrigir os que ainda valem, um commit por ponto ou por arquivo; os que mudam comportamento
      ganham teste. Itens que colidam com 1.1–1.3 já feitos: marcar como cobertos.

---

## Grupo 2 — Motorista e mapas (PR `refactor/motorista-mapas-08-11`)

### Task 2.1: Fila offline e leitura (M8-3, M8-4)

**Files:** `src/lib/motorista/filaAcoesParada.ts`, `src/hooks/motorista/useFilaAcoesParada.ts`, testes.

- [ ] Teste: com a rodada em `avancarProxima` (promessa controlada), um 2º
      `processarFilaAcoesParada` marca `rodarDeNovo`; ao terminar a 1ª, a ação nova é enviada sem novo
      gatilho. Vermelho → no `finally`, se `rodarDeNovo`, agendar `sincronizarFilaAcoesParada()` → verde.
- [ ] Teste: dois `ler()` em voo, o mais velho resolve por último → o estado é o do mais novo.
      Vermelho → `leituraRef` → verde → commit.

### Task 2.2: Sobras do #742 e da Início (M8-1, M8-2, M8-5, M8-6)

**Files:** `src/utils/notificationSound.ts` (+ testes), `src/utils/navigationPreferencesMigration.ts`,
`src/services/locationTracking.ts`, `app/motorista/_screens/inicio.tsx`,
`src/lib/motorista/{contextoRastreamento,copyDePermissao}.ts` (testes novos),
`limparEstadoLocal` (lista de chaves).

- [ ] Apagar os 5 exports mortos e a chave `notification_sound_enabled` (grep de `jest.mock` antes);
      manter `playNotificationSound`.
- [ ] Teste: preferências salvas com `soundAlerts` → `getNavigationPreferences()` não devolve o campo
      e `gravarPreferencias` não o regrava. Vermelho → descartar ao ler → verde.
- [ ] Remover `completeStop: _completeStop` da Início; testes unitários de `contextoRastreamento` e
      `copyDePermissao`.

### Task 2.3: Retomar parada sem a foto antiga

**Files:** `app/motorista/_screens/checkpoints.tsx` e o update que ele chama.

- [ ] Teste: retomar uma parada concluída manda `foto_url: null` junto de `concluida_em`,
      `motivo_skip` e `observacao_pulo`. Vermelho → implementar → verde. Conferir nas migrations se algum
      gatilho recusa `foto_url` nulo nesse caminho; se recusar, registrar e parar o item (vira banco).

### Task 2.4: Mapas (U8-1…U8-8)

**Files:** `src/components/MapaMobile.tsx`, `src/components/map/pontosDaUnidade.ts`,
`MapaWebMapLibre.tsx`, `src/components/motorista/home/MiniMap{,.web}.tsx`,
`NavigationMode{,.web}.tsx`, `useParadaFiltering`, `useNavigationModeLogic`,
`src/components/map/mobile/styles.ts`, `src/design-system/components/index.ts`,
`app/unidade/equipe.tsx`, `src/components/EmptyState.tsx`.

**Interfaces:** Produces `ehPontoDaUnidade(p: { is_checkpoint?: boolean | null }): boolean` em
`pontosDaUnidade.ts`.

- [ ] Teste do `MapaMobile`: com parada selecionada, tocar no pino da sede chama `onMapPress` e
      abre o balão; `selectedParadaId` igual ao id da partida seleciona o pino da sede. Vermelho →
      implementar → verde (U8-1).
- [ ] `ehPontoDaUnidade` com teste de tabela (`true`, `undefined`, `null` → ponto; `false` →
      parada, conferir a semântica real no código antes) e trocar os 5 lugares; guarda estática nova:
      nenhum `is_checkpoint === false`/`!== false` fora de `pontosDaUnidade.ts` (U8-2).
- [ ] U8-3 `anchor="center"` no pino quadrado; U8-4 azul pelo token `usuario`; U8-5 comentário
      órfão; U8-6 import de `equipe.tsx` e exemplo do `EmptyState`; U8-7 remover do barrel o que
      `npm run scan:morto` confirmar; U8-8 `useMemo`. Commits por id.

---

## Grupo 3 — Lib e endereço (PR `refactor/lib-endereco-08-11`)

### Task 3.1: Sugestão do Photon na sede (L8-1)

**Files:** `src/lib/geocoding.ts`, `src/lib/photon.ts`, `app/onboarding/criar-unidade.tsx`,
`app/unidade/index.tsx`, `src/lib/viacep.ts` (consumo).

**Interfaces:** Produces `ehPlaceIdDoGoogle(placeId: string): boolean` (falso para `cep_` e
`osm_`); a sugestão do Photon passa a levar `cidade?`, `estado?` (UF via `nomeEstadoParaUF`) e `cep?`.

- [ ] Testes: `ehPlaceIdDoGoogle('osm_N1')`/`('cep_58000000')` falsos, `'ChIJ…'` verdadeiro; nas duas
      telas, escolher sugestão `osm_` não chama `getPlaceDetails`, preenche cidade/UF do Photon; sem
      cidade/UF e com CEP → ViaCEP; sem nenhum → campos vazios. Vermelho → implementar → verde → commit.

### Task 3.2: Esgotamento do Google memorizado (L8-2)

**Files:** `src/lib/googlePlaces.ts`, `src/lib/geocoding.ts`, teste.

**Interfaces:** Produces em `googlePlaces.ts` `googleEsgotadoAte(): number | null` e o reset interno
para teste.

- [ ] Teste: depois de um 429, a busca seguinte no mesmo dia (São Paulo) vai direto ao Photon sem
      chamar a Edge Function e sem novo `logger.warn`; depois da meia-noite de São Paulo volta ao
      Google (relógio falso). Vermelho → implementar (fim do dia por `dateUtils`) → verde → commit.

### Task 3.3: Mock do tema e código morto (L8-3, L8-4, L8-5, L8-11, L8-12)

**Files:** `jest.setup.js`, `src/lib/notifications.ts`, `src/lib/routeErrors.ts`,
`src/lib/errorMapping.ts`, `src/lib/design-tokens.ts`, `src/lib/__tests__/data-local-sem-utc.test.ts`,
`src/lib/geo/__tests__/distancia-paridade.test.ts`, testes ligados.

- [ ] `mockTheme` montado de `jest.requireActual('./src/utils/styles.base').defaultTheme` (+
      sobrescritas que os testes exigirem). Rodar `npx jest` inteiro; corrigir os testes que fixavam a
      cor antiga (listar no relatório).
- [ ] Apagar os exports mortos de L8-4/L8-5 (conferir `isNetworkError`, `getExpoPushToken`,
      `initializeNotifications` antes) e seus testes.
- [ ] L8-11: `substring(0,10)` e `substr(0,10)` em `RECORTES_DE_DIA` (provar o vermelho com uma
      isca temporária, sem commitá-la). L8-12: trocar a paridade por `expect(alias).toBe(fonte)`.

### Task 3.4: Escrita atômica do `secureAuthStorage` (30(l))

**Files:** `src/lib/**/secureAuthStorage*.ts` (nativo e web), teste.

- [ ] Ler a implementação e registrar onde a escrita é parcial (ex.: valor fatiado em chaves).
      Teste: falha no meio de um `setItem` deixa a leitura com o valor anterior inteiro, nunca misturado.
      Vermelho → escrever em chave temporária e trocar o ponteiro por último (ou a alternativa registrada)
      → verde → commit.

---

## Grupo 4 — Fila offline de incidentes (PR `feat/fila-incidentes`) — depois do grupo 2 mesclado

### Task 4.1: Fila de incidentes

**Files:** `src/lib/motorista/filaIncidentes.ts` (novo), o envio de incidente do motorista
(`IncidentReportWizard` / hook de envio), `setupOfflineSync`, testes.

**Interfaces:** Produces `enfileirarIncidente(i: IncidenteNaFila): Promise<void>`,
`sincronizarFilaIncidentes(): Promise<{ enviados: number; descartados: number }>`,
`lerFilaIncidentes(): Promise<IncidenteNaFila[]>`; foto local guardada como a da conclusão offline.

- [ ] Testes: sem rede, enviar incidente enfileira e avisa "será enviado"; com rede de volta, sobe
      na ordem, com a foto; recusa definitiva descarta com aviso; erro de rede não conta tentativa;
      a fila é por motorista (troca de conta não envia o de A com a sessão de B). Vermelho → implementar
      seguindo `filaAcoesParada` → verde.
- [ ] Prova no aparelho fica para a 3060 (registrar no relatório).

---

## Grupo 5 — Banco e Edge Functions (PR `feat/banco-08-11`)

### Task 5.1: Places (B8-1, B8-4, B8-5) e funções (B8-2, B8-3, B8-6)

**Files:** migration `20261108120000_places_teto_e_limpeza.sql` (+ cópia, sonda, teste estático
`migration85-*.test.ts`), `supabase/functions/_shared/{cotaPlaces,autenticacao}.ts`,
`google-places-autocomplete/index.ts`, `google-place-details/index.ts`, `criar-motorista/index.ts`,
`supabase/functions/**/__tests__/guardaPlaces.test.ts`, guarda nova em `database/__tests__/`.

**Interfaces:** Produces `clienteDoUsuario(createClient, url: string, authorization: string)` em
`_shared/autenticacao.ts`; `limpar_uso_places_antigo(p_dias int default 8) returns integer`
(SECURITY DEFINER, `search_path` vazio como a M84, EXECUTE só `service_role`).

- [ ] Migration: `consumir_cota_places` com `details` = **1000** e `null` sem `auth.uid()`
      (B8-4); a função de limpeza (B8-5) e a chamada dela no `expire-routes` (mesmo lugar de
      `limpar_notificacoes_antigas`). Sonda: limite 1000, sem sessão → null, limpeza só apaga > 8 dias.
- [ ] `consumirCotaPlaces` com prazo de 2000 ms por `Promise.race` → `'indisponivel'`; `fetch` do
      Google com `AbortSignal.timeout(8000)`. Testes Jest do helper (prazo, null → indisponivel).
- [ ] B8-2 `clienteDoUsuario` nas 3 funções + validador; ajustar `guardaPlaces.test.ts`.
- [ ] B8-6 guarda: toda RPC chamada em `supabase/functions/**` (`.rpc('nome'`) não aparece em
      `DROP FUNCTION`/`REVOKE EXECUTE` em migration posterior à última que a cria. Provar o vermelho
      com isca temporária.

### Task 5.2: Aviso ao motorista ao cancelar/reativar (B-11)

**Files:** migration `20261108121000_aviso_cancelar_reativar.sql` (+ cópia, sonda, teste estático).

- [ ] Ler as versões vivas de `cancelar_rota`, `reativar_rota` e `criar_notificacao`, e o tipo de
      notificação de rota que o app já trata (`src/context/` de notificações). Recriar as duas RPCs a
      partir da viva, acrescentando `criar_notificacao` para o `motorista_id` só quando o resultado for
      `cancelada`/`reativada`. Textos: "Rota cancelada pelo gestor" / "Rota reativada" + nome/data da
      rota. Sonda: notifica nos dois casos, não notifica em `ja_cancelada`/`situacao_mudou`/
      `sem_permissao`, motorista sem token não falha.

### Task 5.3: `resolvido_em` e iniciar rota transacional (30(i), 30(j))

**Files:** migrations `20261108122000_incidentes_resolvido_em.sql`,
`20261108123000_iniciar_rota_rpc.sql` (+ cópias, sondas, testes estáticos); lado do app do 30(j)
(`useRouteActions`/início de rota do motorista) **em commit separado, mesclado só depois da
aplicação**.

**Interfaces:** Produces `iniciar_rota(p_rota_id uuid) returns text`
(`iniciada` | `ja_iniciada` | `situacao_mudou` | `sem_permissao`), SECURITY DEFINER.

- [ ] Gatilho: `status` vai a resolvido → `resolvido_em = now()` se nulo; volta → `null`. Sonda.
- [ ] `iniciar_rota`: rota `pendente` do próprio motorista com vínculo ativo → `em_andamento` +
      1ª parada `em_andamento`, numa transação; idempotente. Sonda com os 4 resultados.
- [ ] App chama `iniciar_rota` com o mesmo tratamento de recusa por `code` das outras RPCs; testes.

### Task 5.4: Indicadores do perfil por loja (26/30(h))

**Files:** migration `20261108124000_desempenho_motorista_por_loja.sql` (+ cópia, sonda, teste);
o hook do perfil do motorista no gestor (`src/components/gestor/motorista-perfil/**`), depois do
grupo 1 mesclado.

**Interfaces:** Produces `desempenho_motorista_na_loja(p_motorista_id uuid, p_unidade_id uuid)
returns jsonb` (mesmas métricas da `vw_performance_motoristas`), só para gestor ativo da loja.

- [ ] Migration + sonda (gestor de outra loja → recusa; números contam só rotas da loja).
- [ ] App troca a view pela RPC com `unidadeId` da loja ativa; teste.

### Task 5.5: Medição e aposentadoria de atalhos (B-7, M51) — sessão principal

- [ ] Sessão principal (não subagente) consulta `edge_logs` dos últimos 14 dias: contagem por
      versão no `x_client_info`, sem dado pessoal. Registrar no relatório.
- [ ] Para cada atalho com zero acessos da versão dependente (nativo sem `rotamestre/` conta como
      dependente): migration própria (ou ajuste de código) com sonda; os demais registram a data e os
      números na pendência 30.

---

## Grupo 6 — CI (PR `ci/agendador-e-jobs-08-11`)

### Task 6.1: Jobs e scripts (L8-6, L8-7, L8-8, L8-10, 30(m))

**Files:** `.github/workflows/{test,quality}.yml`, `.github/actions/setup-playwright-web/action.yml`
(novo), `package.json`.

- [ ] Composite action com o setup comum de `e2e-auth` e `visual-regression`; os jobs usam a action.
- [ ] `build:web` nos jobs de CI sem o `tsc` do gancho: `npm run build:web --ignore-scripts` ou
      chamar o script interno — escolher e registrar; o gancho `prebuild:web` fica no `package.json`.
- [ ] L8-8 comentário; L8-10 apagar os scripts sem uso (grep em docs/workflows antes).
- [ ] 30(m): passo que roda depois do jest e escreve no `$GITHUB_STEP_SUMMARY` os testes que só
      passaram após retentativa (se houver retentativa configurada; se não houver, os 10 mais lentos e
      os que falharam). Registrar a escolha.

### Task 6.2: Agendador endurecido (L8-9, 30(e))

**Files:** `.github/workflows/expire-routes.yml`, `scripts/chamar-edge.sh` (novo),
`scripts/avisar-falha-agendada.js` (novo) + teste Jest.

**Interfaces:** Produces `avisarFalha({ octokit, owner, repo, workflow, runUrl, falhou: boolean })`.

- [ ] Script `chamar-edge.sh` (curl com `--max-time 60`, checagem `jq`), usado pelos 3 jobs;
      `timeout-minutes: 5` em cada job.
- [ ] `avisarFalha`: falha sem issue aberta com label `agendador-falhou` e o nome do workflow → cria;
      com issue aberta → comenta; sucesso com issue aberta → fecha. Teste com octokit falso dos três
      casos (inclui duas falhas seguidas → uma issue, um comentário). Texto: nome do job, link da
      execução, horário — sem segredo nem payload.
- [ ] Passo final `if: always()` com `permissions: issues: write`.

---

## Grupo 7 — Lint type-aware (PR `chore/lint-type-aware`) — por último

### Task 7.1: `no-floating-promises`

**Files:** config do ESLint, `src/lib/**`, `src/hooks/**`, `src/services/**`.

- [ ] Ligar `@typescript-eslint/no-floating-promises` (com `parserOptions.project`) só nesses
      diretórios; medir o total.
- [ ] Corrigir por diretório: `void` + comentário só onde é disparo proposital; o resto `await` ou
      `.catch(e => logger.warn(...))`. Mudança de comportamento ganha teste. `npm run lint` inteiro
      verde e o tempo do lint registrado.

---

## Integração (sessão principal)

- [ ] Por grupo: review package + revisor; branch empurrada e PR aberto; CI verde; merge só com OK.
- [ ] Banco: aplicar cada migration com OK (sonda antes, aplicação, sonda depois, registro com
      `RETURNING`); publicar as Edge Functions com OK; só então mesclar o lado do app que depende.
- [ ] Docs: `PROJECT_CONTEXT` (pendências 26/30/35), `HISTORICO`, `MIGRATIONS.md`.
- [ ] 3060: aumentar a versão, gerar a build pelo Actions, enviar para a interna, conferir no aparelho e promover para a alpha, cada etapa com OK.
