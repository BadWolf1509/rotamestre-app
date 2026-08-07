# Contexto operacional — Rota Mestre App

> Documento de entrada para novas sessões. Atualizado em 07/08/2026.
> Consulte o código ou o serviço responsável antes de alterar um estado externo.

## Pendências (comece por aqui)

Lista única e canônica. Se resolver uma, risque daqui.

| #   | Pendência                                                                                                                                                                                                                                                                                                                                                                                                    | Quem pode fazer                                | Onde está o detalhe                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------ |
| 1   | **Rotacionar/desativar contas de teste com senha vazada** — `gestor@`, `motorista@`, `gestor.test@`, `motorista.test@` foram **excluídas em 05/08/2026**; se recriar qualquer conta de teste, use senha forte por variável de ambiente.                                                                                                                                                                      | gestor (Supabase → Auth → Users)               | "Credenciais hardcoded" abaixo                         |
| 2   | **Furo de RLS:** motorista pode alterar `unidade_id` da própria rota. Pré-existente, exige motorista malicioso fora do app.                                                                                                                                                                                                                                                                                  | requer design (o fix óbvio quebra o motorista) | Security Advisory privado `GHSA-vw63-jxg2-28vx`        |
| 3   | **Fase 2 da auditoria:** chip na tela da rota + indicador/filtro/contador na Gestão de Rotas. Plano próprio ainda não escrito — melhor depois de algumas semanas de dado acumulado.                                                                                                                                                                                                                          | qualquer sessão                                | spec `2026-08-04-auditoria-otimizacao-rotas-design.md` |
| 4   | **Play Store:** faixa de produção vazia (`Precondition check failed`). Ampliar opt-in do teste fechado, divulgando o hub público `/testar`.                                                                                                                                                                                                                                                                  | gestor (Play Console)                          | `GOOGLE_PLAY_DEPLOYMENT.md`                            |
| 5   | **iOS:** não existe build. Bloqueado na autenticação interativa da Apple (`npx eas-cli build --platform ios --profile production`).                                                                                                                                                                                                                                                                          | gestor (Apple ID + 2FA)                        | `APP_STORE_DEPLOYMENT.md`                              |
| 6   | **Primeiro build EAS sob Node 22** ainda não aconteceu — observe o próximo.                                                                                                                                                                                                                                                                                                                                  | qualquer sessão                                | "Node 22" abaixo                                       |
| 7   | **Validar o onboarding self-service ponta a ponta.** A migration foi aplicada em 06/08/2026 e o código mergeado. Falta o teste manual: cadastro com e-mail descartável → confirmar → login → tela de onboarding → criar unidade → **criar um motorista** (prova `usuarios.unidade_id`) → **criar uma rota** (prova as coordenadas da sede). Nenhum teste automatizado cobre isso — nenhum toca o banco real. | gestor (cria dado real)                        | `database/MIGRATIONS.md` (Migration 21)                |

Follow-ups menores (nenhum bloqueia): Timeline não narra o autor da otimização
(o dado existe em `logs.usuario_id`, falta join em `useTimelineData.ts`);
**`toFixed(1)` usa ponto — confirmado em 05/08/2026 na Timeline, que exibiu
`27.1 km → 18.1 km` num app pt-BR (deveria ser `27,1`)**;
`mapLogToTimelinePreview` sem case para `rota_otimizada`, então o widget
colapsado conta o evento mas não o exibe.

### Auditoria de otimização — validada em 05/08/2026

A pendência que ocupava a linha 1 desta tabela foi **fechada**. Rota de teste
criada na Unidade Demo pelo Gestor Demo, com o botão "Otimizar", e depois
reordenada à mão:

| Momento        | `otimizacao_estado`  | `distancia_total` | `otimizacao_distancia_depois` |
| -------------- | -------------------- | ----------------- | ----------------------------- |
| Após otimizar  | `otimizada`          | 18,13 km          | 18,13 km                      |
| Após reordenar | `otimizada_alterada` | **18,74 km**      | **18,13 km** (congelado)      |

`antes` = 27,129 km e `otimizada_por` = Gestor Demo (via `auth.uid()`, não
parâmetro do cliente). O par de colunas provou ser **registro histórico, não
espelho do estado atual** — foi possível medir que a alteração manual custou
610 m. Os 3 logs saíram corretos (incluindo `desfez_otimizacao: true`, que só
grava `true` se o UPDATE de fato passou) e a Timeline narrou os 3 eventos.
A rota de teste foi cancelada em seguida.

## Armadilhas que já custaram caro

Cada uma quebrou algo de verdade. Leia antes de agir na área correspondente.

- **`supabase db push`:** o histórico foi reconciliado em 05/08/2026 e hoje está
  sem pendências, mas o MCP `apply_migration` registra sob **timestamp próprio**
  (≠ nome do arquivo) e colar no Dashboard não registra nada. Rode
  `npx supabase migration list` antes de qualquer push. Detalhe em
  `database/MIGRATIONS.md`.
- **Banco único = produção.** Não há staging. Peça aval antes de aplicar
  migration e **nunca deixe subagente escrever no banco** — foi essa regra que
  impediu um `CREATE OR REPLACE` defeituoso de derrubar a criação de rotas.
- **`src/types/database.ts` NÃO existe.** Tipos de domínio são curados à mão. Não
  rode `/regenerate-supabase-types` (é aspiracional, nunca executado); acrescente
  os campos ao tipo em `src/types/`.
- **Worker do maplibre 6** servido de `public/`: se sumir, o mapa trava em
  "Carregando..." **sem erro no console e com o CI verde**. Detalhe do que não
  pode ser removido em "Regras que não podem regredir".
- **OSRM não atende `localhost`.** O servidor responde
  `Access-Control-Allow-Origin: https://app.rotamestre.tec.br` **fixo**,
  ignorando a origem que pediu. Em produção casa e funciona; em
  `localhost:8082` o browser bloqueia **toda** chamada OSRM (`status: 0`,
  "Trajeto indisponível" no mapa). O fluxo não quebra porque
  `buildHaversineMatrix` (linha reta × 1,3) assume e o TSP roda normalmente —
  a reordenação continua sendo otimização real, mas **as distâncias em dev são
  estimativas, não distância de via**. Não confunda com bug: valide distância
  em produção. Verificado em 05/08/2026 com
  `curl -H "Origin: http://localhost:8082"`.
- **As API keys legacy estão DESABILITADAS (verificado 06/08/2026).** O projeto
  migrou para o formato novo: `sb_publishable_…` no lugar da `anon` e
  `sb_secret_…` no lugar da `service_role` (Settings → API Keys, aba
  _Publishable and secret_). `.env` local, EAS `production` e EAS `preview` já
  usam a publishable — **a variável continua com o nome herdado
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`**, o que engana. Pegadinha cara: a
  `sb_secret_…` devolve **401 na Admin API do Auth** (`/auth/v1/admin/users/…`),
  provavelmente porque o endpoint ainda espera um JWT e não um token opaco. Para
  redefinir senha de usuário, use o **SQL Editor** — `pgcrypto` está instalada no
  schema `extensions` e o Auth guarda bcrypt (`$2a$`, 60 chars):

  ```sql
  update auth.users
  set encrypted_password = extensions.crypt('<senha>', extensions.gen_salt('bf')),
      updated_at = now()
  where id = '<uuid>';
  ```

  Limpe o editor depois: o histórico de execuções recentes guarda a query.

- **Credenciais hardcoded (05/08/2026).** Dois scripts de criação de usuário de
  teste, o fixture de E2E, um script de RLS e a seed traziam senha em texto puro
  num repositório **público**, e quatro dessas contas estavam **vivas em
  produção**. Todas removidas do código (agora exigem variável de ambiente, sem
  fallback) e as 4 contas foram excluídas. Regra: **nenhuma senha no repo, nem
  como fallback, nem em `console.log`** — o log sobrevive no scrollback e no CI.
- **RPC `criar_rota_com_paradas`:** acrescentar parâmetro cria _overload_ em vez
  de substituir (identidade de função no Postgres = nome + tipos). Exige `DROP`
  da assinatura antiga + reaplicar os grants. Reverter a migration depois de
  mergear o código derruba a criação de rotas — **reverta o código primeiro**.
- **Cadastro público quebrado — correção escrita em 06/08/2026, ainda não aplicada.** `signUp` criava a conta no Auth
  e depois inseria em `usuarios` — insert que o RLS bloqueia porque exige que o
  autor já seja gestor. O erro vinha DEPOIS da conta criada: 5 pessoas reais
  ficaram com conta órfã, e `app/index.tsx` as devolvia ao login sem mensagem.
  Lição: **operação que precisa de mais de uma linha vira RPC em transação**,
  nunca dois passos no client. Indicador de saúde:
  `select au.email from auth.users au left join public.usuarios u on u.id = au.id where u.id is null;`
- **`unidades` não tem — e não deve ter — policy de UPDATE.** A tabela tem 17
  colunas fora do que o app edita, várias comerciais (`plano`, `status`,
  `desconto_percentual`, `asaas_customer_id`, `observacoes_admin`). Como
  `anon`/`authenticated` já têm grant de tabela cheio (default do Supabase) e
  RLS **não restringe coluna**, criar uma policy de UPDATE libera as 17 de uma
  vez — um gestor poderia se promover de plano e estender o próprio trial. A
  escrita passa pela RPC `atualizar_unidade`, que aceita 10 campos explícitos.
  **Se algum dia essa RPC parar de funcionar, o conserto não é adicionar
  policy.** Verificação: um `.update()` direto em `unidades` pelo client tem
  que continuar falhando.

## Estado atual

- Caminho local canônico: `D:\rota-mestre\rotamestre-app`.
- Web: <https://app.rotamestre.tec.br> publicada e validada. Deploy automático a
  cada push na `main`.
- **Node 22** é o baseline de dev/CI/EAS/Vercel (`.nvmrc`, `engines.node`,
  matriz `22.x`). A proteção da `main` exige `Run Tests (22.x)` e
  `TypeScript & Linting`; o check do Vercel aparece como _pending_ e não bloqueia.
- Merge exige **admin override** (`gh pr merge --squash --admin`): a `main` pede
  1 review, o gestor é autor de tudo e não há segundo revisor. Histórico linear
  obrigatório, então squash — merge commit não passa.
- Android: `1.12.2` / `3024` concluído no teste fechado; produção vazia (pend. 4).
- iOS: configuração versionada, sem build (pend. 5).

## Resumo executivo

Este repositório contém o produto operacional do Rota Mestre:

- painel web para gestores em <https://app.rotamestre.tec.br>;
- aplicativo Android para motoristas;
- backend compartilhado no Supabase;
- otimização, execução e acompanhamento de rotas;
- fotos privadas de comprovação, ocorrências, notificações e histórico.

O código local está na versão **1.12.2**, com
`androidVersionCode` **3024**. O app foi reconstruído sob uma nova identidade
Android após a perda das contas de distribuição originais. O Supabase e os
dados dos usuários foram preservados.

## Identidades e serviços

| Item                     | Valor atual                            | Fonte de verdade                       |
| ------------------------ | -------------------------------------- | -------------------------------------- |
| Repositório              | `BadWolf1509/rotamestre-app`           | `git remote -v`                        |
| Caminho local canônico   | `D:\rota-mestre\rotamestre-app`        | workspace                              |
| Branch de produção       | `main`                                 | Git/Vercel                             |
| Web                      | <https://app.rotamestre.tec.br>        | Vercel                                 |
| Android package          | `br.tec.rotamestre.app`                | `app.config.js`                        |
| Versão Android no código | `1.12.2` / `3024`                      | `package.json`                         |
| EAS project              | `c6401a59-af97-484a-93b7-c75016bf331d` | `app.config.js`                        |
| Firebase                 | `rota-mestre-97084`                    | console Firebase / configuração nativa |
| Supabase project ref     | `xezslsyxjivunmhhyxtd`                 | `supabase/.temp/project-ref`           |
| Site institucional/legal | <https://rotamestre.tec.br>            | repositório `lp-rotamestre`            |
| Plataforma               | Expo 56, React Native 0.85.3, React 19 | `package.json`                         |

Não copie versões para outros documentos. Quando houver divergência, prevalecem
`package.json`, `app.config.js`, `eas.json` e o estado consultado nos consoles.

## Estado confirmado em 24/07/2026

### Aplicação e banco

- A Nova Entrega preserva rascunhos, faz validações mais defensivas, oferece
  revisão da rota e cria rota/paradas de forma transacional e idempotente.
- As migrations `20260722195606_security_revoke_definer_anon_param` e
  `20260723223000_nova_entrega_drafts_atomic_route` aparecem no histórico
  remoto do Supabase. A primeira revoga acesso indevido a funções
  `SECURITY DEFINER`; a segunda cria os rascunhos protegidos e a RPC atômica.
- O bucket `fotos-entrega` é privado. A aplicação resolve signed URLs em leitura
  e o RLS isola objetos por unidade.
- A autenticação Android foi corrigida após a rotação da chave pública do
  Supabase. Credenciais/sessões usam armazenamento seguro quando disponível.
- Os mapas usam a `polyline` viária persistida em `rotas` como fonte principal,
  com cache local e OSRM como fallback. Na ausência de geometria viária real, o
  app mantém os marcadores e informa a indisponibilidade; nunca representa
  paradas por segmentos retos como se fossem vias.
- Alterações de paradas invalidam a geometria e as métricas anteriores antes do
  recálculo. Se o serviço de rotas falhar, a operação permanece salva, o gestor
  recebe um aviso e o mapa não reutiliza um trajeto incompatível.
- As páginas de política de privacidade, termos e exclusão de conta existem no
  app e no site público.

### Android e Google Play

- A identidade nova está configurada no EAS, Firebase e Google Play; Play App
  Signing está habilitado.
- Estado das trilhas confirmado pela API em 24/07: teste fechado (`alpha`) em
  `1.12.2` / `3024`, teste interno em `1.12.1` / `3021`, `beta` e produção
  vazias. O AAB `1.12.2` / `3024` foi concluído no EAS sob o ID
  `630fe91d-a0b0-41f7-be7d-334876910375` e enviado com sucesso ao teste fechado
  pela submissão `b832dbc7-1b42-49fc-b7bc-838c2bb5fe46`.
- A submissão `f3c7e7a5-db29-4131-bafe-972d7b565946` à produção foi recusada
  pelo Play com `Precondition check failed`. O bloqueio é de elegibilidade da
  faixa, não de compilação ou assinatura do AAB. O profile `alpha` agora usa
  `releaseStatus: completed`.
- O build EAS de prévia `35fff202-d45b-4664-b447-8bc4c8756827`
  (`1.12.2` / `3024`) foi concluído e instalado incrementalmente no dispositivo
  de validação em 24/07. A atividade iniciou sem crash. É um artefato de teste,
  não uma publicação no Play.
- O teste interno foi configurado e a lista de testadores foi revisada nesta
  sessão. O endereço usado no Google Play deve ser o da **Conta Google** do
  testador; ele pode ser diferente do e-mail cadastrado no Rota Mestre.
- A versão presente em cada trilha, o período do teste fechado e a elegibilidade
  para produção são estados externos: confirme-os no Play Console antes de
  qualquer nova submissão. Não deduza isso apenas pelo `versionCode` local.
- Metadados, declarações e assets preparados para a loja estão em
  [play-store-metadata.md](play-store-metadata.md). O procedimento seguro de
  release está em [GOOGLE_PLAY_DEPLOYMENT.md](GOOGLE_PLAY_DEPLOYMENT.md).

### Web e iOS

- O commit funcional `3788f55` está publicado em
  <https://app.rotamestre.tec.br>. O bundle de produção foi validado no Chrome
  desktop e no Chrome de um Android físico: a consulta carrega `rotas.polyline`,
  o mapa usa a geometria viária persistida e não desenha segmentos retos.
- Site, política de privacidade, termos de uso e exclusão de conta responderam
  HTTP 200 em 24/07/2026.
- O iOS usa o bundle identifier `br.tec.rotamestre.app`. O commit `191db5a`
  adicionou `buildNumber` 1, a declaração de criptografia isenta e o profile de
  submissão. O primeiro build ainda depende da configuração interativa do
  certificado/provisioning profile com Apple ID e 2FA.
- O procedimento iOS está em
  [APP_STORE_DEPLOYMENT.md](APP_STORE_DEPLOYMENT.md).

### Qualidade

- O projeto possui Jest, Playwright, regressão visual, lint, type-check e CI.
- Em 24/07, `npm run validate` e `npm run build:web:clear` passaram. O Jest
  executou 312 suites, 5729 testes e 5 snapshots com exit code 0.
- No E2E, os cenários públicos de login passaram; os autenticados não puderam
  prosseguir porque as duas contas-fixture do ambiente não existem ou não têm
  credenciais válidas. Na regressão visual pública, 24/26 passaram; os dois
  snapshots de toast possuem diferença de rasterização de 1 px no Windows. Os
  detalhes e critérios de correção estão em `docs/TESTING.md`.
- Um dispositivo Android físico foi usado nesta sessão, mas sua conexão e
  autorização ADB devem ser verificadas novamente em cada ambiente.
- No aparelho de validação, `RUN_ANY_IN_BACKGROUND` estava em `ignore`. Isso é
  uma restrição de bateria configurada no dispositivo e pode impedir o
  rastreamento quando o app não está visível, mesmo com as permissões de
  localização concedidas. Confirme esse estado no smoke test de cada aparelho.
- O smoke visual da geometria da build 3024 foi concluído após o desbloqueio:
  a rota ativa carregou 28 pontos viários, coincidiu com a sequência de ruas
  retornada pelo OSRM e não usou ligação direta entre marcadores. No cenário
  inspecionado, o trecho longo parece diagonal porque acompanha a própria
  Avenida Rui Barbosa.
- A validação completa recomendada antes de release é `npm run validate`,
  seguida dos testes E2E/visuais relevantes e de um smoke test no Android.

## Estado confirmado em 04/08/2026

- Cinco PRs foram integrados à `main` por squash, em série com rebase entre cada
  um: `/testar` (#341), maplibre-gl 5→6 (#345), Sentry alinhado (#343), lote de
  dependências do Dependabot (#342) e Node 20→22 (#344). Como todos os PRs são
  do mesmo autor e a `main` exige uma aprovação de revisão, o merge usou override
  de administrador; os checks obrigatórios estavam verdes em cada um.
- **Node 22** passou a ser o baseline de dev, CI, EAS e Vercel: `.nvmrc` em `22`,
  `engines.node` em `>=22` e os workflows na matriz `22.x`. O EAS Build lê o
  `.nvmrc`, então o próximo build nativo será o primeiro sob Node 22.
- A proteção da `main` foi ajustada de `Run Tests (20.x)` para `Run Tests (22.x)`
  (mais `TypeScript & Linting`), acompanhando a renomeação dos jobs de CI.
- As versões de Sentry foram realinhadas juntas (dependência acoplada),
  `size-limit` subiu para a linha 13 e `react-native-nitro-modules` recebeu um
  patch — validados na suíte completa antes do merge. No conflito do lote de Node
  22, `supabase` foi mantido na versão da `main`, evitando um downgrade
  silencioso trazido pela base antiga da branch.
- Os dez PRs individuais do Dependabot que esses lotes substituem foram fechados
  (a maioria pelo próprio Dependabot ao detectar as versões já na base).
- O hub público `/testar` recruta testadores para o teste fechado Android, com
  passo a passo, detecção de plataforma e aviso de "mesma Conta Google". É a peça
  web que apoia o P0 de destravar a produção.
- O deploy de produção no Vercel concluiu com sucesso. Smoke test em
  <https://app.rotamestre.tec.br>: login e `/testar` carregam sem erros de
  console e a detecção de plataforma responde.

- O servidor OSRM próprio (`osrm.rotamestre.tec.br`) responde apenas à origem de
  produção: o header `Access-Control-Allow-Origin` é fixo em
  `https://app.rotamestre.tec.br`. Consequência: **no dev local o cálculo de rota
  falha com `Failed to fetch`** — é CORS, não indisponibilidade (o mesmo endereço
  responde 200 via `curl`). Os mapas continuam desenhando o trajeto no dev porque
  usam a `polyline` persistida em `rotas`. Para exercitar o cálculo localmente
  seria preciso liberar `localhost` no CORS ou usar proxy; nada disso foi feito.

### Três regressões corrigidas no mesmo dia

O smoke test do lote acima não cobriu as telas autenticadas. Ao exercitá-las,
apareceram três defeitos que a suíte existente não pegava — todos corrigidos,
merjados e validados em produção no mesmo dia.

- **Mapa web travado em "Carregando..." (#346).** O `maplibre-gl 6` é ESM-only e
  resolve seu web worker por `import.meta.url`, que o bundler do Expo (Metro) não
  empacota. Sem o worker, o estilo nunca termina de carregar, o evento `load`
  nunca dispara e nenhum tile é buscado. A correção serve
  `maplibre-gl-worker.mjs` e o sibling `maplibre-gl-shared.mjs` a partir de
  `public/` (copiados de `node_modules` no `postinstall` e no início do
  `build:web`) e aponta `setWorkerUrl` para o caminho servido, via
  `configureMaplibreWorker()` nos cinco componentes de mapa web. Os testes não
  pegaram porque usam mock do maplibre, e a regressão visual só cobre telas
  públicas. O app nativo não é afetado (usa `@maplibre/maplibre-react-native`).
- **Autocomplete de endereço ficava mudo (#347).** Quem apagava o endereço
  inteiro sem sair do campo zerava a flag interna de interação, que só era
  religada no evento de foco — como o campo seguia focado, cada tecla passava a
  ser descartada em silêncio, sem disparar requisição. Passou a marcar a
  interação também ao digitar. As Edge Functions estavam saudáveis o tempo todo
  (todas as chamadas em 200), o que descarta API/quota como causa.
- **Resposta obsoleta do autocomplete (#348).** O debounce cancelava só o timer,
  nunca a requisição já em voo: com duas buscas simultâneas, a que respondia por
  último vencia. O cleanup do efeito passa a invalidar a busca anterior.
- Os dois defeitos do autocomplete ganharam teste de regressão. O do mapa é
  coberto indiretamente (o worker é validado no build), mas **não há teste
  automatizado que falhe se o worker sumir** — a verificação continua manual.

## Estado confirmado em 05/08/2026

### Auditoria de uso do otimizador — Fase 1 (PR #350)

O sistema passou a **registrar** em cada rota nova se ela foi otimizada, montada
à mão, ou otimizada-e-depois-alterada, com distância antes/depois. **Nada mudou
na tela** — é fundação para a Fase 2 (pendência 3).

- Colunas em `rotas`: `otimizacao_estado` (`otimizada` | `manual` |
  `otimizada_alterada`; **`NULL` = sem registro, nunca leia como `'manual'`**),
  as duas distâncias, `otimizada_em` e `otimizada_por`.
- **Autoria vem de `auth.uid()` no servidor**, nunca de parâmetro do cliente: a
  primeira versão aceitava o autor do cliente e, sendo `SECURITY DEFINER`,
  qualquer gestor podia forjá-lo — o que anularia o propósito da auditoria.
- O ganho é **derivado** na leitura (`antes − depois`), nunca persistido.
- Adicionar parada **não** marca "alterada"; só reordenação manual marca.
- As 562 rotas anteriores ficaram `NULL`. **Backfill é impossível com honestidade**
  — o dado nunca existiu. A auditoria só ganha densidade com o tempo.
- Um defeito só apareceu na revisão da branch inteira: a coluna **nunca era lida
  do banco** (faltava no `select`), o que tornava a marcação de "alterada" código
  morto. Nenhuma revisão por tarefa podia ver — os testes injetam a rota direto no
  hook. Hoje há teste que trava essa regressão.

### Histórico de migrations reconciliado

Auditoria completa concluiu que **o drift era de contabilidade, não de schema**:
nenhuma migration documentada como aplicada estava faltando no banco. As 4
versões pendentes foram reparadas (`migration repair --status applied`, só
metadado) e hoje **não há arquivo local sem linha remota**. Sobram 4 linhas
só-remotas: 2 são o mesmo conteúdo registrado sob outro timestamp, e 2
(`plan_prices_and_mrr_history`, `analytics_rpcs`) pertencem ao **projeto do
painel admin**, que compartilha este Postgres — não há arquivo a recuperar.

### Correção de um relato errado sobre RLS

Foi relatado, e propagado por mim, que a policy `rotas_update` permitiria a um
**gestor** mover rota entre unidades. **Falso**: pela documentação do Postgres,
`WITH CHECK` ausente faz o `USING` valer também para a linha nova, e o gestor não
passa por "gestor da unidade de destino". A exposição real é outra e mais
estreita — pelo ramo do **motorista** — e está na pendência 2.

## Mudanças relevantes desta etapa

| Data       | Mudança                                                                                   | Referência                                   |
| ---------- | ----------------------------------------------------------------------------------------- | -------------------------------------------- |
| 23/07/2026 | Nova Entrega com rascunho persistente, importação, revisão e criação atômica/idempotente  | commit `e1f1bd5`, migration `20260723223000` |
| 23/07/2026 | Migration de segurança já aplicada foi incorporada ao histórico versionado                | commit `de8a036`, migration `20260722195606` |
| 24/07/2026 | Correção da autenticação Android após rotação de chave                                    | commit `6dd8aa8`                             |
| 24/07/2026 | Preparação do app e da ficha para o Google Play, páginas legais e exclusão de conta       | commit `b7a39dc`                             |
| 24/07/2026 | Geometria viária persistida nos mapas; remoção dos fallbacks visuais em linha reta        | commit `3788f55`                             |
| 24/07/2026 | Configuração inicial de distribuição e conformidade iOS                                   | commit `191db5a`                             |
| 04/08/2026 | Integração de 5 PRs: `/testar`, maplibre 6, Sentry, deps e Node 22 (baseline/CI)          | PRs #341/#345/#343/#342/#344                 |
| 04/08/2026 | Correção do worker do maplibre 6 (mapa web travado em "Carregando...")                    | PR #346                                      |
| 04/08/2026 | Correções do autocomplete de endereço: interação após limpar e resposta obsoleta          | PRs #347 e #348                              |
| 05/08/2026 | Auditoria de uso do otimizador, Fase 1 (registrar): colunas, RPC de 11 params, Timeline   | PR #350, migration `20260804235500`          |
| 05/08/2026 | Histórico de migrations reconciliado + `IF NOT EXISTS` no arquivo que travava o `db push` | PR #351                                      |

O histórico completo do rebuild está em
[REBUILD_RELAUNCH_PLAN.md](REBUILD_RELAUNCH_PLAN.md), agora tratado como
registro de decisão e rollout — não como checklist inicial ainda não executado.

## Arquitetura e limites entre projetos

```text
rotamestre.tec.br
  Site institucional, SEO, marca e páginas legais públicas
                  │
                  ├── CTA de login
                  ▼
app.rotamestre.tec.br ── Expo Web / React Native
                  │
                  ├── Supabase: Auth, Postgres, RLS, Storage, Realtime
                  ├── Edge Functions: Google Places, exclusão de conta, push
                  ├── OSRM: cálculo/otimização de rotas
                  └── Firebase/Expo: notificações no Android
```

- Este repositório não é o site institucional.
- O repositório irmão `D:\rota-mestre\lp-rotamestre` não contém lógica
  autenticada nem dados operacionais.
- As páginas legais públicas do site são as URLs informadas ao Google Play. Ao
  alterar coleta, retenção ou compartilhamento de dados, atualize o app, a
  landing e as declarações do Play no mesmo trabalho.

## Regras que não podem regredir

- Nunca exponha `service_role`, chave do Google Places ou credencial do Play no
  cliente ou no Git.
- Toda leitura/escrita de tenant deve respeitar `unidade_id` e RLS.
- `fotos-entrega` permanece privado; não recrie URLs públicas.
- Migrations de schema devem ser versionadas em `database/migrations/` e
  `supabase/migrations/` com o mesmo timestamp e conteúdo. Exceções históricas
  aplicadas manualmente precisam ser documentadas, nunca executadas novamente
  por suposição.
- `versionCode` é monotônico. Confirme o maior código no Play Console antes do
  próximo bump.
- Não altere `br.tec.rotamestre.app`, o EAS project ID ou o Firebase project sem
  um plano formal de migração.
- Dependências acopladas exigem validação nativa: versões de Sentry devem ficar
  alinhadas; Unistyles e Nitro Modules devem ser testados juntos em build EAS.
- O baseline de runtime é **Node 22** (`.nvmrc`, `engines.node`, CI e EAS). Não
  regrida para Node 20; a proteção da `main` espera `Run Tests (22.x)`.
- O mapa web só funciona com o worker do `maplibre-gl 6` servido de `public/`.
  Não remova `tools/scripts/copy-maplibre-worker.cjs` do `postinstall`/`build:web`,
  a chamada de `configureMaplibreWorker()` nos componentes de mapa web, nem os
  `.mjs` copiados. Quebrar isso trava o mapa em "Carregando..." **sem erro no
  console e com o CI verde** — nenhum teste automatizado detecta.
- `otimizacao_estado = NULL` significa **sem registro**, nunca `'manual'`. Não
  conte, filtre nem exiba rota antiga como manual: não há como saber se ela foi
  otimizada, e assumir falsearia a auditoria.
- Autoria de ações sensíveis vem de `auth.uid()` **dentro** da função
  `SECURITY DEFINER`, nunca de parâmetro enviado pelo cliente — caso contrário
  qualquer usuário autenticado pode forjá-la.
- Não existe `src/types/database.ts`. Os tipos de domínio são curados à mão em
  `src/types/`; não introduza tipos gerados sem decidir isso para o projeto todo.

## Próximas ações

> As pendências ativas estão na **tabela do topo deste documento**, que é a lista
> canônica. Esta seção guarda só o detalhe operacional de cada frente e o
> backlog de médio prazo — não repita itens aqui.

### P0 — concluir distribuição móvel (detalhe das pendências 4 e 5)

1. Confirmar no Play Console a quantidade e a continuidade dos participantes
   com opt-in; divulgue o hub `/testar` para ampliar a base. Contas cadastradas
   sem opt-in não contam para o requisito.
2. Solicitar acesso à produção quando o requisito mostrado pelo Console estiver
   satisfeito e promover o build `3024`; não gerar um novo AAB apenas para
   repetir a tentativa.
3. Revisar “Conteúdo do app”, Segurança de dados, classificação, público-alvo,
   acesso do revisor e URLs legais contra `play-store-metadata.md`.
4. Concluir a autenticação interativa da Apple para criar/validar certificado e
   provisioning profile, gerar o primeiro build iOS e testá-lo no TestFlight.
5. Preencher a ficha e o App Privacy no App Store Connect, anexar screenshots
   de iPhone/iPad e enviar o build validado para revisão.

### P1 — qualidade e acompanhamento funcional

1. Monitorar erros da Nova Entrega: recuperação de rascunho após refresh,
   importação em massa, dependências retirada/entrega, retries e duplicidade.
2. Provisionar de forma segura as contas-fixture autenticadas do Playwright e
   rerodar o E2E completo.
3. Validar no Android e no iOS o ciclo completo de um motorista em rede instável.
4. Confirmar entrega de push nos artefatos instalados pelas lojas e revisar
   tickets/receipts da Expo.
5. Planejar o aviso aos usuários do app antigo sem interromper o backend
   compartilhado.

### P2 — evolução posterior ao rollout

1. Definir métricas de produto e alertas operacionais sem coletar dados além do
   declarado.
2. Retomar cobrança/Asaas somente com regras comerciais e de acesso definidas.
3. Definir uma estratégia de rollout e monitoramento equivalente para Android e
   iOS após a aprovação das lojas.

## Roteiro para a próxima sessão

1. Leia, **nesta ordem**, as três primeiras seções deste documento: Pendências,
   Armadilhas e Estado atual. Elas bastam para começar; o resto é referência sob
   demanda.
2. `git status --short --branch`. **Espere ver `.claude/settings.json` modificado
   e não commitado** — é uma permissão local do gestor, intencional. Não commite
   e **não use `git reset --hard`**, que a destrói (já aconteceu três vezes).
3. Confira `package.json`, o último commit e os checks do GitHub.
4. Se houver banco no escopo, rode `npx supabase migration list` e compare o
   schema vivo antes de criar SQL. Releia "Armadilhas" antes de aplicar.
5. Se houver release Android no escopo, consulte primeiro o Play Console e o
   EAS; não gere build só para descobrir o estado.
6. Execute a menor validação proporcional à mudança e registre aqui qualquer
   nova decisão, estado externo ou pendência.

## Mapa da documentação

| Necessidade                               | Documento                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Começar uma nova sessão / estado atual    | este arquivo                                                                            |
| Arquitetura, padrões e phonebook técnico  | [`../CLAUDE.md`](../CLAUDE.md)                                                          |
| Testes                                    | [TESTING.md](TESTING.md)                                                                |
| Histórico e processo de migrations        | [`../database/MIGRATIONS.md`](../database/MIGRATIONS.md)                                |
| Google Play: procedimento                 | [GOOGLE_PLAY_DEPLOYMENT.md](GOOGLE_PLAY_DEPLOYMENT.md)                                  |
| Google Play: textos, assets e declarações | [play-store-metadata.md](play-store-metadata.md)                                        |
| App Store / iOS: procedimento             | [APP_STORE_DEPLOYMENT.md](APP_STORE_DEPLOYMENT.md)                                      |
| Reconstrução da identidade Android        | [REBUILD_RELAUNCH_PLAN.md](REBUILD_RELAUNCH_PLAN.md)                                    |
| Firebase e push                           | [FIREBASE_MIGRATION.md](FIREBASE_MIGRATION.md)                                          |
| Recuperação de senha                      | [PASSWORD_RECOVERY.md](PASSWORD_RECOVERY.md)                                            |
| Marca e tokens                            | [`../brand-guidelines.md`](../brand-guidelines.md)                                      |
| Specs e planos de features                | [`superpowers/specs/`](superpowers/specs/) e [`superpowers/plans/`](superpowers/plans/) |

Os specs e planos em `superpowers/` são **registro de decisão**, não estado
atual: leia-os quando for continuar a feature de que tratam (ex.: a Fase 2 da
auditoria). Onde eles divergirem deste documento ou do código, **o código vence** —
vários deles registram passos que a execução provou errados.

## Segurança documental

Não registre senhas, tokens, chaves, arquivos JSON de serviço, keystores ou
listas nominais de usuários/testadores. Este documento pode registrar **onde**
uma credencial é administrada e como verificar seu funcionamento, nunca seu
conteúdo.
