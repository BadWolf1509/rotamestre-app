# Contexto operacional — Rota Mestre App

> Documento de entrada para novas sessões. Atualizado em 26/10/2026.
> Consulte o código ou o serviço responsável antes de alterar um estado externo.
>
> **O que este documento é:** estado atual, pendências e armadilhas — o que você
> precisa para **começar a agir**. **O que ele não é:** histórico e validações já
> feitas (em [HISTORICO.md](HISTORICO.md)), arquitetura e padrões de código (em
> [`../CLAUDE.md`](../CLAUDE.md)), versões (no `package.json`) nem estado de
> schema (`npx supabase migration list`). Duplicar qualquer um deles aqui é como
> este arquivo já ficou desatualizado.
>
> **Para começar rápido:** leia Pendências → Armadilhas → Estado atual. Bastam
> para agir; o resto é referência sob demanda.
>
> **Contrato de tamanho:** este arquivo é lido por inteiro em toda sessão, então
> cresce a um custo que ninguém vê. Já foi cortado **cinco vezes** — a cronologia
> está em [HISTORICO.md](HISTORICO.md) — e **volta a crescer entre um corte e o
> seguinte**, sempre por acréscimo legítimo.
>
> O que sobrevive a um corte é regra que muda decisão. Sai daqui: relato de
> trabalho terminado, e **cópia do que já está no `CLAUDE.md`** — os dois são
> lidos em toda sessão, então duplicar entre eles custa em dobro e ainda deixa as
> versões divergirem. Antes de somar uma seção, pergunte se ela precisa ser lida
> **em toda sessão** ou só quando alguém for mexer naquele fluxo; no segundo
> caso, o lugar é o `HISTORICO.md` ou o doc do tema, com uma linha no Mapa da
> documentação.

## Pendências (comece por aqui)

Lista única e canônica. Se resolver uma, risque daqui. **Os números não são
renumerados** quando uma sai — a 2 foi fechada em 06/09/2026 e o resto do
documento cita as outras pelo número ("pendência 4"), que passaria a apontar
para outra coisa.

- **3.** **Fase 2 da auditoria:** chip na tela da rota + indicador/filtro/contador na Gestão de Rotas. Plano próprio ainda não escrito — melhor depois de algumas semanas de dado acumulado.<br>_Quem:_ qualquer sessão · _Detalhe:_ spec `2026-08-04-auditoria-otimizacao-rotas-design.md`
- **4.** **Play Store: produção continua vazia, e o gargalo é contável.** Teste fechado (`alpha`) e interno publicados e `completed` — confira qual build com `npm run play:status`. Para solicitar produção faltam **12 testadores com opt-in mantidos por 14 dias corridos** no teste fechado (em 31/08 eram **6**; o número vivo está no Painel do app no Console, não aqui). O caminho para os que faltam é divulgar o hub público `/testar`. **O teste aberto não é atalho:** ele fica bloqueado até haver acesso de produção — a dependência corre nesse sentido, e tentar promover para `beta` antes disso devolve `FAILED_PRECONDITION`.<br>_Quem:_ gestor (Play Console) · _Detalhe:_ `GOOGLE_PLAY_DEPLOYMENT.md`
- **5.** **iOS:** não existe build. Bloqueado na autenticação interativa da Apple (`npx eas-cli build --platform ios --profile production`).<br>_Quem:_ gestor (Apple ID + 2FA) · _Detalhe:_ `APP_STORE_DEPLOYMENT.md`
- **6.** **4 das 9 unidades têm coordenadas de sede NULL, mas só 1 está ativa** — o registro anterior dizia "4 unidades não conseguem gerar rota"; conferido no banco em 15/08, três delas estão inativas e o impacto real hoje é **uma**. A tela "Minha Unidade" é o caminho de conserto e desde 08/08 funciona de verdade (ver Migration 22 e a armadilha do componente aninhado). Desde o PR #385 a Nova Rota avisa e leva até lá, em vez de só sumir com o cartão de partida.<br>_Quem:_ gestor (edita a unidade ativa) · _Detalhe:_ `database/MIGRATIONS.md` (Migration 22)
- **7.** **Proteção contra senha vazada: exige plano Pro, não dá para ligar hoje.** O advisor aponta `auth_leaked_password_protection`, mas a checagem contra o HaveIBeenPwned é **Pro ou acima** — a assinatura é por organização, não por projeto. **Não é um toggle**, é upgrade de plano. O que o free permite e vale conferir: comprimento mínimo e caracteres exigidos, em Auth → Providers → Email.<br>_Quem:_ gestor (decisão de plano; ou ajuste no Email) · _Detalhe:_ "Política de senha" em [HISTORICO.md](HISTORICO.md)

- **8.** **Mapa nativo continua sem executar em CI — e nenhum check distingue tile com marca d'água.** Fechado em 31/08: a divergência web/nativo virou teste estático (`src/lib/__tests__/maplibre-fonte-unica.test.ts`, quebra se um lado embutir outro provedor) e o e2e passou a exigir que tiles reais tenham sido buscados, sem falha e só do provedor esperado — antes ele parava no evento `load`, que dispara mesmo com tile em 403. **O que sobra é o caro:** rodar o mapa nativo exigiria emulador Android + app compilado (~25 min por execução), desproporcional para check de PR; e tile marcado chega como **200 com PNG válido**, que só análise de imagem ou olho humano distingue. Para essa classe, o caminho é canário agendado contra o endpoint, não check de PR.<br>_Quem:_ qualquer sessão · _Detalhe:_ armadilha "Fonte de tiles"

- **9.** **Duas decisões de produto levantadas no smoke de 05/09/2026 — nenhuma é defeito.** (a) **"Excluir motorista" é só desativar**, e o vínculo em `usuario_unidades` continua `ativo` — o seletor do app checa os dois, mas código que filtre só pelo vínculo veria um motorista desativado. (b) **Não existe caminho para reabrir parada concluída** em nenhuma das duas contas: o botão "Retomar" só aparece para parada _pulada_, e o painel do gestor não oferece a ação.<br>_Quem:_ gestor (decisão) · _Detalhe:_ [HISTORICO.md](HISTORICO.md), sessão de 05/09

- **10.** **O app coleta localização em background e persiste — a ficha do Play precisa dizer isso.** `motorista_locations` acumula desde 18/12/2025 e **cresce rápido**: 17.725 linhas em 414 rotas em 06/09/2026, **32.193 em 466** em 17/09 — quase o dobro em onze dias. O número vivo sai de `select count(*), count(distinct rota_id) from motorista_locations`; **não copie o valor para cá de novo** (a versão anterior deste item trazia o de 06/09 como se fosse atual, e é a mesma regra "um fato, uma fonte" que o cabeçalho cobra). O código pede `requestBackgroundPermissionsAsync()` (`src/services/unifiedLocationTracking.ts:151`) e roda `startLocationUpdatesAsync` com foreground service (`:256`). Isso obriga a **Declaração de Permissões Sensíveis** com vídeo demonstrativo e a marcação de coleta **em background** na Segurança de Dados — divergência entre ficha e comportamento é motivo de suspensão. **Retenção desde 22/10/2026 (Migration 37):** posições de rotas encerradas há mais de 90 dias são apagadas toda noite pela `limpar_localizacoes_antigas`, chamada pela Edge Function `expire-routes` (não há `pg_cron`); a declaração pode citar esse prazo. A produção ainda está vazia (pendência 4), então dá para corrigir antes de pedir acesso. A _prominent disclosure_ que o Google exige **já está** implementada e correta (`:157`), antes do diálogo do sistema. **Como o registro anterior errou:** observou-se `ProviderRequest[OFF]` com o app em background e concluiu-se "só primeiro plano" — mas o rastreamento só começa em `startRoute`, então medir fora de uma rota `em_andamento` produz `OFF` tanto no código certo quanto no errado. Evidência que não distingue as hipóteses, a mesma armadilha do banner de expiração.<br>_Quem:_ gestor (Play Console) · _Detalhe:_ `GOOGLE_PLAY_DEPLOYMENT.md`

- **11.** **Nenhuma das 9 unidades tem gestor principal, e não há caminho no app para estabelecer o primeiro.** Medido em 06/09/2026: 0 de 16 usuários com `is_gestor_principal = true`, porque nenhuma unidade nasceu pelo fluxo self-service — o único que liga o flag. Efeito hoje: a tela de transferência de gestão está **inalcançável para todos os gestores** (ela exige ser o principal), e o mesmo vale para o badge do drawer. A Migration 27 fechou a autopromoção por `.update()` direto, que era o único "caminho" anterior e era o próprio buraco — então o bootstrap do primeiro titular passa a exigir `service_role` ou uma RPC dedicada, **nenhuma das duas existe**. Não é esquecimento: escolher quem é o titular de cada unidade dá poder sobre ela e é decisão de produto, não de quem escreve a migration.<br>_Quem:_ gestor (decidir os titulares) · _Detalhe:_ `database/MIGRATIONS.md`, Migration 27

- **12.** **Interna e alpha na 1.14.7 (3045) desde 26/10/2026; a 1.14.8 (3046) está na `main`, com release em preparação (pendência 23). Falta o teste de rua antes de produção.** **Validada no moto g15 com o binário da Play (26/10):** Wi-Fi conectado sem internet, a rota aparece em 12 s (60–75 s na 1.14.6); token vencido sem rede, até 6 s e sem pedir login; modo avião, 5 s; foto sem rede em menos de 2 s, com `concluida_em` preservado; na volta da rede com fila, tudo sobe sem requisição anônima. O que as versões até a 1.14.6 trouxeram e as validações de 22 e 24/10 estão em [HISTORICO.md](HISTORICO.md). **Falta:** teste de rua com tela apagada (o intervalo de 50 m em movimento não foi exercitado — aparelho parado). **Como saber quem atualizou:** o app nativo põe a versão no `X-Client-Info` (`rotamestre/1.14.4+3042; supabase-js; runtime=react-native`) — consulte `log_attributes['request.headers.x_client_info']` nos `edge_logs` (header próprio não serve: os edge_logs só guardam uma lista fixa). **`eas update`:** seguro só para binários do mesmo `version` (o `runtimeVersion` é `appVersion`). **No dia seguinte a cada upload:** conferir que o robô de pré-lançamento entrou na conta de avaliação, não na demo do e2e. **Promover:** `npm run play:promote -- <faixas> <versionCode> <nome> --notas=<arquivo>` — **sem `--notas`, apaga as notas que a faixa tinha** (o PUT substitui a release inteira). Notas usadas em `docs/HISTORICO.md`. Produção segue presa na pendência 4.<br>_Quem:_ gestor (teste de rua, promoção) · _Detalhe:_ [HISTORICO.md](HISTORICO.md), 21–26/10/2026

- **21.** **Vínculo multi-loja: travado; falta o convite aceito pelo motorista.** Em 20/10/2026 o vínculo pelo e-mail saiu (qualquer gestor puxava o motorista de outra empresa, também direto pelo PostgREST), a `criar-motorista` deixou de apagar conta do Auth, e o gestor não mexe mais na pessoa de quem atende outra loja (Migration 31). **Migration e função publicadas só depois do merge — confira `supabase migration list` e a versão da função antes de dar por aplicado.** Novo vínculo entre lojas hoje é pelo suporte (service role). Próximo passo, ainda não aprovado: convite pendente que o motorista aceita no app (precisa de release).<br>_Quem:_ gestor (aprovar o desenho do convite) · _Detalhe:_ `supabase/functions/criar-motorista/index.ts`, `database/MIGRATIONS.md` (Migration 31)
- **22.** **Sobras do incidente da `service_role` (22/10/2026).** As Migrations 33–36 fecharam a parte do banco (push entre empresas, destino do incidente, todos os gestores da loja, `get_gestor_principal` apagada). Falta: (a) o **painel administrativo** (outro projeto) roda com `service_role` e precisa trocar para a chave secreta nova — e lá vale um grep por `get_gestor_principal` e `cleanup_old_locations`, que não existem mais (Migrations 36 e 37); (b) opcional: `git filter-repo` para tirar a chave morta do histórico.<br>_Quem:_ gestor · _Detalhe:_ armadilha "Chaves do Supabase"; [HISTORICO.md](HISTORICO.md), 22/10/2026

- **23.** **1.14.8 (3046): na `main` (#670/#671), release em preparação.** Traz o lado do app das Migrations 70–73: o gestor cancela e reativa a rota pelas RPCs, vê o nome do motorista que saiu da loja e lê a observação do pulo à parte da instrução que deu. Depois do build: `eas submit` na interna e promoção para a alpha (pendência 12). **Ainda não foi feito em aparelho com tela apagada e andando** (o intervalo de 50 m em movimento). **Cota de build:** a cota Free de builds Android do EAS acabou em outubro e renova em 01/11/2026; até lá, iterar com dev client + Metro. Depois de validar: `npm run play:promote -- internal,alpha <versionCode> <nome> --notas=<arquivo>` (sem `--notas` apaga as notas). **Aparelho com dev client:** o moto g15 pode ter o dev client (instalado por adb), não o app da Play; atualizar pela Play falha com `INSTALL_FAILED_UPDATE_INCOMPATIBLE` (assinatura) — é preciso desinstalar e instalar pela Play.<br>_Quem:_ gestor (aparelho, promoção) · _Detalhe:_ [HISTORICO.md](HISTORICO.md), 23–26/10/2026
- **24.** **Pendências conhecidas da fila offline (nenhuma bloqueia):** (a) atomicidade de `avancarProxima` (duas escritas); (b) sonda do UPDATE condicional que a fila usa para não regredir status. Fechados no #638: aviso de ações de outra conta no aparelho e foto de comprovante desacoplada da ação (ligada sem sobrescrever, registrada em `logs` com evento `foto_comprovante_sem_vinculo`, ou mantida no aparelho).<br>_Quem:_ qualquer sessão · _Detalhe:_ `src/lib/offline.ts`
- **25.** **Release 1.14.3 distribuído → publicar as Edge Functions que dependem dele (detalhe fora do repositório).**<br>_Quem:_ gestor · _Detalhe:_ fora do repositório
- **26.** **Pequeno adiado do gestor (varredura de 23/10):** performance do motorista soma todas as lojas. Fechados no #638: gestor principal por loja e contagem de membros igual à lista da Equipe.<br>_Quem:_ qualquer sessão · _Detalhe:_ [HISTORICO.md](HISTORICO.md), 22–23/10/2026
- **29.** **Não existe tela para adicionar ou promover gestor de uma loja.** Lacuna de produto; a decisão é do gestor.<br>_Quem:_ gestor (decisão) · _Detalhe:_ pendência 11
- **30.** **Restos da varredura de 25–26/10 (com o gestor):** (a) passo 5 do roteiro do aparelho — sair e entrar na conta no meio do envio da fila; (b) tirar `SUPABASE_SERVICE_ROLE_KEY` do `.env.example`; (c) Migration 51 (SELECT de `unidades` só pelas colunas de `COLUNAS_UNIDADE_APP`; o número segue sem arquivo no repositório), a aplicar quando as versões anteriores à 1.14.6 sumirem dos acessos; (d) um projeto de staging do Supabase para o e2e não escrever na produção (armadilha "Banco único"); (e) alerta de falha do cron que chama `expire-routes`/`remind-routes` (`.github/workflows/expire-routes.yml`).<br>_Quem:_ gestor · _Detalhe:_ [HISTORICO.md](HISTORICO.md), 25–26/10/2026

Fechadas em 26/10/2026: a **27** (reabrir com Wi-Fi sem internet; medido na 1.14.7 — armadilha "Teste sem rede") e a **28** (cancelar rota pelo painel: RPCs `cancelar_rota`/`reativar_rota`, Migrations 70/71, app no #670, e Migration 75).

**Trabalho já fechado não mora aqui.** As listas "Fechadas em ..., não reabra"
de 08, 15, 17 e 25/08 foram para [HISTORICO.md](HISTORICO.md) em 25/08 — eram
**86 linhas** lidas em toda sessão para responder "isso já foi resolvido?", que
é pergunta rara. Consulte-as lá antes de reabrir qualquer frente. O que era
regra durável ficou nas Armadilhas; o que segue **aberto** está abaixo.

Follow-ups menores (nenhum bloqueia): **Timeline não narra o autor da
otimização** — o dado existe em `logs.usuario_id` e falta o join em
`src/hooks/gestao-rotas/useTimelineData.ts`. Deixado aberto de propósito em
08/09/2026: é melhoria, não defeito, e tem uma dobra de design real — o handler
de realtime (`:195`) recebe `payload.new`, que **não traz dado de join**, então
o autor apareceria na carga inicial e sumiria nos eventos ao vivo. Resolver isso
exige escolher entre resolver nomes no cliente (cache de usuários da unidade) ou
aceitar a inconsistência; é decisão de produto, não conserto óbvio. ~~Cada envio de localização chamava `getUser()`~~ — fechado no #568 (sessão local, `getSession`).

**Achado na validação em aparelho de 08/09/2026, ainda aberto** (o outro, rastreamento só ligado por `startRoute`, fechou no #613):

- **O painel do gestor esconde rota em andamento de dia anterior.**
  `useDashboardData` filtra por `data >= hoje` quando não há filtro explícito,
  então uma rota `em_andamento` com `data` passada — estado legítimo, dentro da
  carência de 7 dias da expiração (Migrations 25/26) — não entra na consulta, e
  o cartão "Em Andamento" mostra **0 com o motorista na rua**. Reproduzido em
  08/09 com a rota `31d4b0d2…` (`data` 05/09). A Gestão de Rotas mostra tudo,
  então o gestor não fica cego — o resumo é que mente. **Não é regressão** e o
  conserto é decisão de produto: "Início" significa _hoje_ ou _hoje mais o que
  segue aberto_? Mudar a janela padrão altera a primeira tela de todo gestor.

**Fechados em 08/09/2026** (não reabra): `mapLogToTimelinePreview` devolvia
`null` para 6 dos 15 eventos que `TIMELINE_LOG_EVENTS` conta, então o widget
colapsado somava eventos que nunca exibia — corrigido com um teste de
INVARIANTE (todo evento contado tem preview), que quebra sozinho quando alguém
acrescentar o 16º; e `finalizar_rota`/`update_parada` em `src/lib/offline.ts`
ganharam allowlist de colunas, derivada do que o caminho online grava, tirando
a armadilha que o `REVOKE UPDATE (unidade_id)` da Migration 27 tinha criado.

## Armadilhas que já custaram caro

Cada uma quebrou algo de verdade. Leia antes de agir na área correspondente.
O relato de como cada uma foi descoberta está em [HISTORICO.md](HISTORICO.md).

**Banco e migrations**

- **Chaves do Supabase: só as novas, desde 22/10/2026.** A `service_role` antiga estava no histórico do repositório público; `anon`/`service_role` foram desligadas e o segredo JWT legado revogado (token assinado por ele → 401 `PGRST301`). App (1.12.9 em diante) e web usam `sb_publishable_`; as Edge Functions leem `SUPABASE_SECRET_KEYS`/`SUPABASE_PUBLISHABLE_KEYS` por `supabase/functions/_shared/chaves.ts` (guarda `semChaveAntiga.test.ts`) e rodam com `--no-verify-jwt` — o `verify_jwt` só entende JWT antigo, então cada função autoriza por dentro (`auth.getUser`, `x-cron-secret`, `x-push-secret`). O push só sai pelo gatilho `pg_net` com o segredo do Vault `push_webhook_secret` (= secret `PUSH_WEBHOOK_SECRET`). Publicar: `npx supabase functions deploy <fn> --no-verify-jwt --project-ref xezslsyxjivunmhhyxtd`. **Nunca grave chave em arquivo, SQL ou webhook do painel** — foi assim que a antiga ficou em texto puro. Relato em [HISTORICO.md](HISTORICO.md), 22/10/2026; Migration 32.

- **`supabase db push`:** o MCP `apply_migration` registra sob **timestamp
  próprio** (≠ nome do arquivo) e colar no Dashboard não registra nada. Rode
  `npx supabase migration list` antes de qualquer push. Ver `database/MIGRATIONS.md`.
- **Assinatura de realtime em tabela fora da publicação não recebe nada, e não
  reclama.** O gestor nunca viu o motorista se mover: os dois componentes
  assinavam `postgres_changes` em `motorista_locations`, que só entrou na
  publicação `supabase_realtime` em 08/09/2026 (Migration 28). O canal conecta,
  entra em `SUBSCRIBED`, e nenhum evento chega — sem erro, sem log. Passou
  despercebido porque os componentes fazem um `SELECT` inicial: abre-se o mapa,
  o motorista está lá, e o marcador congela. **Ao criar assinatura, confirme que
  a tabela está na publicação**, com
  `SELECT ... FROM pg_publication_tables WHERE pubname='supabase_realtime'`.
- **O RLS do realtime NÃO cobre DELETE.** Verificado lendo
  `realtime.apply_rls` implantado: para INSERT/UPDATE ela roda a checagem com o
  role e as claims do assinante, mas o ramo
  `if not is_rls_enabled or action = 'DELETE'` entrega a linha a qualquer
  assinatura cujo filtro de CLIENTE case, sem RLS. Assinar `'DELETE'` ou `'*'`
  numa tabela multi-tenant vaza entre unidades. Guarda em
  `src/lib/__tests__/realtime-motorista-locations-somente-insert.test.ts`.
- **Banco único = produção.** Não há staging. Peça aval antes de aplicar
  migration e **nunca deixe subagente escrever no banco**. Desde 01/09/2026 o
  **CI também escreve**: `e2e/fixtures/garantir-rota-do-mapa.ts`, quando o
  motorista de teste não tem rota aberta, cria uma cópia da encerrada mais
  recente por `criar_rota_com_paradas` (chave idempotente derivada do modelo) e
  a inicia como o app. **Não reabra rota encerrada** no fixture: desde a
  Migration 75 o UPDATE de status vindo da API é recusado (`ROTA_ENCERRADA`).
  Decisão testável em `e2e/fixtures/planoDaRotaDoMapa.ts`. É escrita
  condicional — conte com ela ao auditar acesso ao banco.
- **A leitura de `usuarios` depende do RLS de `usuario_unidades`.** A policy
  `usuarios_select_optimized` libera a pessoa que tem vínculo ativo numa loja
  minha, consultando `usuario_unidades` com o RLS de quem lê; como
  `usuario_unidades_select` só mostra ao motorista as próprias linhas (ao
  gestor, as da loja), o motorista só lê a própria linha de `usuarios`. Por
  isso a Migration 67 não foi feita. **Afrouxar `usuario_unidades_select` abre
  a leitura de `usuarios`** (nome, telefone) — confira as duas juntas.
- **`src/types/database.ts` não existe** — regra e motivo em
  [`../CLAUDE.md`](../CLAUDE.md), seção Skills. Escapou da deduplicação de
  27/08, que pegou a cópia em "Regras" e deixou esta.
- **RPC com parâmetro novo cria _overload_** (custou a `criar_rota_com_paradas`), não substitui (identidade de função
  no Postgres = nome + tipos). Exige `DROP` da assinatura antiga + reaplicar os
  grants. Reverter a migration depois de mergear o código derruba a criação de
  rotas: **reverta o código primeiro**.
- **`unidades` não tem — e não deve ter — policy de UPDATE.** RLS **não restringe
  coluna** e `authenticated` já tem grant cheio, então uma policy liberaria as 17
  colunas fora do app de uma vez, incluindo comerciais (`plano`, `status`,
  `desconto_percentual`, `asaas_customer_id`) — o gestor se promoveria de plano. A
  escrita passa pela RPC `atualizar_unidade`; **se ela parar, o conserto não é
  adicionar policy.** Verificação: `.update()` direto em `unidades` tem que falhar.
- **O supabase-js _devolve_ o erro em vez de lançar, então `try/catch` não pega.**
  A escrita falha, o código segue, e a falha vira no máximo um `logger.warn` —
  foi assim que `logs.parada_id`, coluna inexistente, custou **oito meses** de
  auditoria. Em qualquer `.insert()`, confira `error` no retorno. Schema real e
  padrão no phonebook do [`../CLAUDE.md`](../CLAUDE.md).
- **Foto de entrega multiunidade usa a unidade da ROTA, nunca
  `usuarios.unidade_id`.** O campo do usuário é legado/principal e pode divergir
  da unidade de uma rota atribuída ao motorista. Como a policy do bucket privado
  autoriza pelo 1º segmento do path, gravar
  `{usuarios.unidade_id}/{rotaId}/...` permite o upload ao motorista vinculado
  às duas unidades, mas impede o gestor da rota de assinar a URL. A fonte
  autoritativa é `RouteData.unidade_id`, carregada de `rotas.unidade_id`; vale
  igualmente para upload direto e para a fila offline. No retry, não confie no
  `unidadeId` persistido no índice: filas criadas por versões antigas podem
  carregá-lo errado; resolva `rotas.unidade_id` novamente antes do upload.

- **Ao registrar à mão uma migration aplicada em `supabase_migrations.schema_migrations`, nunca use `ON CONFLICT DO NOTHING`.** Use `INSERT ... RETURNING` e confira a linha devolvida: o `DO NOTHING` escondeu uma colisão de versão (a Migration 50 com a 53, que acabou registrada como `20261024121500`).
- **Antes de criar migration, liste os timestamps** de `database/migrations` de **todos** os worktrees em `.claude/worktrees/*` e os de `schema_migrations`. Sessões paralelas escolhem o mesmo prefixo sem se ver.

**Auth, chaves e segredos**

- **As API keys legacy estão DESABILITADAS.** O projeto usa `sb_publishable_…` e
  `sb_secret_…` — mas **a variável mantém o nome herdado
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`**, o que engana. Pegadinha: a `sb_secret_…`
  devolve **401 na Admin API do Auth** (`/auth/v1/admin/users/…`). Para redefinir senha, use o SQL Editor (o
  Auth guarda bcrypt e `pgcrypto` está em `extensions`), e limpe o editor depois —
  o histórico de execuções guarda a query:

  ```sql
  update auth.users
  set encrypted_password = extensions.crypt('<senha>', extensions.gen_salt('bf')),
      updated_at = now()
  where id = '<uuid>';
  ```

- **Nenhuma senha no repo** — nem como fallback, nem em `console.log`. O
  repositório é público e o log sobrevive no scrollback e no CI. Em 05/08/2026
  quatro contas com senha em texto puro estavam vivas em produção.
- **Editar `supabase/templates/*.html` NÃO muda o email enviado** — o Supabase lê
  só do painel. A regra completa, com a proteção anti link-scanner, está no
  phonebook do [`../CLAUDE.md`](../CLAUDE.md) e em `supabase/templates/README.md`.
- **São 5 arquivos para 6 abas do painel, e é intencional.** O Magic Link saiu do
  repo porque o app nunca chama `signInWithOtp`. A aba continua no painel com o
  layout antigo — inofensivo só enquanto nada dispara o envio. Se o login sem
  senha entrar no produto, recupere `supabase/templates/magic-link.html` do git **antes** de usar.
- **Operação que precisa de mais de uma linha vira RPC em transação**, nunca dois
  passos no client. O cadastro público criava a conta no Auth e só depois inseria
  em `usuarios`, insert que o RLS bloqueia — pessoas reais ficaram com conta
  órfã. Indicador de saúde (hoje retorna zero):
  `select au.email from auth.users au left join public.usuarios u on u.id = au.id where u.id is null;`

**React e formulários**

- **Componente aninhado no render** — a regra e o mecanismo estão em
  [`../CLAUDE.md`](../CLAUDE.md). O que só existe aqui: manteve o autocomplete da
  sede **impossível** de usar em "Minha Unidade" e destruiu um `Slider` no meio do
  arrasto. Diagnóstico: marque o nó (`el.dataset.x = '1'`) e digite uma letra; se
  a marca sumir, remontou. Onde a tela tem vários returns, o invólucro vai **em
  volta** do componente de conteúdo, não return a return.
- **`ResponsiveContainer` envolvendo `ScrollView flex:1` dá tela vazia no nativo.**
  Um filho `flex: 1` dentro de pai de altura automática contribui zero para a
  altura: ambos ficam em 0. Na web o RN Web mapeia para CSS e o sintoma **não
  existe** — o screenshot passa. Manteve `/auth/register` vazia no Android por
  **nove meses**. Ordem correta: `ScrollView` **por fora**, container por dentro
  (padrão de `app/onboarding/criar-unidade.tsx`). Sintoma: cabeçalho aparece,
  corpo em branco, sem erro no logcat.
- **Não remova o `KeyboardAvoidingView` das telas de auth "porque o
  `adjustResize` já resolve".** Não resolve mais: com
  `android:windowSoftInputMode="adjustResize"` a janela roda em
  `EDGE_TO_EDGE_ENFORCED` e **não encolhe** — medido, o frame segue
  `[0,0][1080,2400]` com o teclado aberto. Quem consome os insets é o
  `KeyboardAvoidingView` de `login`, `forgot-password` e `reset-password`; sem
  ele o campo em foco fica atrás do teclado. Verifique com
  `adb shell dumpsys window windows | grep -A3 MainActivity`, comparando o
  `frame=` com teclado aberto e fechado.
- **`loading` vale só para a carga inicial.** `DesktopPageLayout` e
  `DashboardMobile` retornam **só** o spinner quando `loading` é true — descartam
  cabeçalho, filtros e tabela. Religá-lo numa recarga apaga a página com conteúdo
  já na tela. Recarga sinaliza por `refreshing` ou pelo toast da própria ação.
- **Erro de formulário num campo pode ser causado por outro** — coberto por
  inteiro em [`../CLAUDE.md`](../CLAUDE.md) ("Erro cruzado em form"), com os dois
  arquivos de exemplo.

**Medição e testes**

- **`always_finish_activities` mata o swipe injetado por `adb` — o tap continua
  funcionando.** É o flag que reproduz a recriação de Activity de forma
  determinística, mas com ele ligado o gesto de swipe simplesmente não chega ao
  app; em 05/09 gastei seis tentativas achando que o build tinha quebrado o
  gesto. A receita é ligar o flag **só na ida à câmera**: abre o modal com o flag
  em `0`, liga, dispara a foto, observa a volta, desliga. Devolva sempre para `0`
  no fim — com ele ligado o aparelho fica ruim de usar.
- **Dev build + Metro transforma build de 20 min em reload.** `eas build
--profile development`, instalar uma vez, `adb reverse tcp:8081 tcp:8081`,
  `npx expo start --dev-client` e abrir por
  `rotamestre://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`. A
  partir daí o JS servido é o da árvore de trabalho. Cuidado ao concluir: no dev
  client a recriação de Activity **recarrega o bundle inteiro**, condição mais
  dura que produção, onde o contexto JS sobrevive.
- **O Fast Refresh não aplica no dev web — recarregue antes de medir.** O Metro
  registra só o bundle inicial e a página segue executando código velho. Já
  produziu três medições contraditórias, incluindo um teste diferencial em que o
  bug foi reintroduzido de propósito e o navegador insistiu que não existia. Force
  `window.location.reload()` e espere (~10 s). Para saber qual versão está no ar:
  `curl -s "http://localhost:8082/index.ts.bundle?platform=web&dev=true" | grep -c meuSimbolo`.
- **O toast vermelho de erro e o `Unexpected text node` são do LogBox — não
  existem em produção.** Nenhum componente do app renderiza saída de log; se você
  vê `console.error` na tela, é ferramenta de dev. Armadilha de método: um
  interceptor instalado **depois** de `src/utils/configureLogBox.ts` fica acima do
  filtro e conta mensagens que nunca chegaram ao console.
- **Teste que afirma um schema inventado dá cobertura ao defeito.** Dois bugs
  sobreviveram porque os testes os _exigiam_ — um esperava `parada_id` no insert,
  outro esperava `'150.5'` citando o `toFixed` no próprio comentário. Ao testar
  escrita em tabela, confira as colunas no banco (`information_schema.columns`) antes de fixar o payload.
- **O terceiro card de estatísticas do dashboard aparece cortado de propósito.**
  É um `ScrollView horizontal` com `accessibilityHint="Deslize para ver mais
estatísticas"` — o corte é a dica de rolagem. Já foi reportado como defeito
  numa bateria de teste; não "conserte".
- **O rascunho de rota não vive no `sessionStorage`.** A fonte é a tabela
  `rascunhos_rota`, com expiração de 7 dias; o `sessionStorage` é espelho
  síncrono. Fechar o navegador **não** perde o rascunho.

- **Jest: caminho de arquivo depois de `--testPathIgnorePatterns=...` vira mais um padrão de exclusão.** A suíte inteira roda (ou o arquivo é ignorado) sem erro. Ponha o caminho **antes** das opções.
- **No Windows (Git Bash), `python - <<EOF` com heredoc vazio espera entrada para sempre** e trava a tarefa em segundo plano.
- **Teste sem rede no aparelho: o pior caso é Wi-Fi "conectado" sem internet (DNS inválido).** Modo avião não reproduz isso. Até a 1.14.6 cada consulta do postgrest-js tentava 4 vezes (~20 s) e reabrir a Início levava 60–75 s; na 1.14.7 (`src/lib/redeObservada.ts` liga o "sem rede" na primeira falha de `fetch`, e o perfil da abertura sai sem retry) leva 12 s, e o resto é o DNS do Android desistindo (4,4–7,8 s por tentativa). Melhoria possível: tempo-limite curto na verificação de sessão.
- **O preview da Vercel por PR roda em modo mock** (dados falsos, sem Supabase) e não serve para validar fluxo. Valide servindo o `dist` local (`npm run build:web` e um servidor estático).

**Infra e distribuição**

- **Distâncias em dev web não conferem com produção.** O CORS do OSRM
  self-hosted bloqueia `localhost`, então o dev web cai no demo público (cadeia
  em `../CLAUDE.md`). Antes do fallback, o otimizador caía no
  `buildHaversineMatrix` (linha reta × 1,3) **sem erro visível** — rota
  "otimizada" com distância plausível e sem roteamento por vias. Correção
  definitiva é liberar `localhost` no CORS do openresty; **CORS não é controle
  de acesso**, o endpoint já responde a qualquer um via `curl`.
- **Fonte de tiles: serviço externo degrada em silêncio.** Até 31/08/2026 o web
  usava OpenFreeMap e o nativo, Carto — assimetria não escrita em lugar nenhum.
  Quando a Carto passou a exigir chave, o endpoint respondeu **200 com PNG
  marcado "API KEY REQUIRED"**, não erro: nada quebrou, só apareceu errado para o
  motorista. Unificado em `src/lib/maplibre.ts` e **guardado por teste**
  (`maplibre-fonte-unica.test.ts`; o e2e julga o tráfego). Não refaça a análise —
  o que segue sem cobertura é tile marcado, que chega como 200 válido. **Chave de
  tiles no bundle é extraível**: se precisar de uma, vai server-side.
- **`import()` dinâmico no web depende do async-require do Metro.** O
  `metro.config.js` o resolvia como módulo vazio: o build passava, o chunk saía
  separado, o size-limit ficava verde — e em produção todo `import()` falhava
  (`require(...) is not a function`; apareceu na exportação de PDF/XLSX, que
  passou a carregar sob demanda no #664). Não devolva resolver próprio para `async-require`. Guarda:
  `src/lib/__tests__/metro-config-import-dinamico.test.ts`.
- **Play Store: precedência de trilha e `eas submit` não promove.** A Play serve
  a trilha de maior prioridade a que a conta tem direito — **internal ganha de
  closed** —, então publicar só no fechado prende o testador interno na versão
  antiga com sintoma enganoso: o link funciona, o opt-in é aceito, chega o build
  velho. Publique nas duas. `eas submit` **sempre faz upload** e falha se o
  versionCode já subiu; promover exige a API (`edits` → `PUT tracks/<track>` →
  `:commit`), já versionada em `npm run play:status` e
  `npm run play:promote -- <trilha[,trilha]> <code> [nome] --notas=<arquivo>` sobre
  `scripts/lib/play-api.mjs`. Fluxo: `eas submit` ao **interno** uma vez, depois
  `play:promote` — nunca dois `eas submit`.
- **Para testar no aparelho, atualize pela Play — não `adb install`.** O sideload
  exige desinstalar (a assinatura do EAS diverge da do Play App Signing), o que
  derruba a sessão e ainda testa um binário que **não** é o que o testador
  recebe. Publique no interno e atualize pela loja: os dados sobrevivem.
- **Trocar só o `versionName` exige `versionCode` novo.** Um versionCode já
  enviado não aceita metadados diferentes, então renomear 1.12.2 → 1.12.3 sobre
  um build já submetido não existe: é build novo. Decida o nome **antes** de
  submeter, ou aceite queimar um code.
- **Não use here-string do PowerShell (`-m @'…'@`) na ferramenta Bash.** O `@` vira texto e o
  Git toma a primeira linha como **assunto** do commit. No bash use heredoc
  (`git commit -F -`).

## Estado atual

- Caminho local canônico: `D:\rota-mestre\rotamestre-app`.
- Web: <https://app.rotamestre.tec.br> publicada e validada. Deploy automático a
  cada push na `main`.
- **Node 22** é o baseline de dev/CI/EAS/Vercel (`.nvmrc`, `engines.node`,
  matriz `22.x`). A proteção da `main` exige **quatro** checks bloqueantes:
  TypeScript & Linting, Run Tests, Visual Regression (desde 25/08) e Bundle Size
  Check (desde 21/09). Não bloqueiam: o Vercel, que aparece como _pending_, e o
  Design System Drift Check. O Bundle Size foi promovido depois de ser **o único
  que pegou** a duplicação da árvore do Sentry — 3,39 MB contra 3,9 MB, limite de
  3,5 MB, no PR #537 — enquanto era informativo e não impedia o merge.
  **Atenção ao nome exato:** o status carrega o sufixo da matriz do Node, e a
  proteção compara letra por letra. Os `scripts/setup-branch-protection.*` pediam
  a versão 20.x até 21/09; rodá-los teria exigido um status que nunca chega, o
  que **trava todos os PRs**. Hoje os dois abortam se o nome ou a versão não
  existirem nos workflows.
- Merge exige **admin override** (`gh pr merge --squash --admin`): a `main` pede
  1 review, o gestor é autor de tudo e não há segundo revisor. Histórico linear
  obrigatório, então squash — merge commit não passa. Desde 26/10/2026 o GitHub
  apaga a branch ao mesclar; branches e worktrees antigos foram removidos.
- Android: teste fechado **e** interno servem o mesmo build; produção nunca teve
  release (pend. 4). **Não anote o versionCode aqui** — ele muda a cada release e
  já deixou este documento errado. Pergunte com `npm run play:status`.
- O acompanhamento ao vivo do gestor **funciona desde 08/09/2026** (Migration 28)
  e foi verificado ponta a ponta: uma linha nova em `motorista_locations`, um
  movimento do marcador, sem recarregar. Antes disso o marcador congelava depois
  da carga inicial — ver a armadilha de publicação de realtime.
- iOS: configuração versionada, sem build (pend. 5).
- Banco: migrations 46 a 50, 52 a 66 e 68 a 75 aplicadas (a 75 em 26/10/2026); a 51 aguarda a pendência 30 e a 67 não foi feita (armadilha do RLS de `usuario_unidades`). O detalhe de cada uma está em `database/MIGRATIONS.md` e em `npx supabase migration list`. Faixas da Play: ver a pendência 12. Edge Functions (26/10): `delete-account` v10, `send-push-notification` v17, `criar-motorista` v23, `google-places-autocomplete` e `google-place-details` v16 (exigem usuário logado desde o #668). `google-directions` e `google-distance-matrix` foram despublicadas e saíram do repositório.

## Identidades e serviços

O que o produto é e quais serviços externos usa está na abertura do
[`../CLAUDE.md`](../CLAUDE.md) — não repetimos aqui. **Versão e
`androidVersionCode` saem do `package.json`**; foi duplicando isso que este
documento já ficou errado antes.

Só o que **não** está no `CLAUDE.md` (que já traz package Android, EAS project,
Firebase e o ref do Supabase):

| Item                     | Valor atual                     | Fonte de verdade            |
| ------------------------ | ------------------------------- | --------------------------- |
| Repositório              | `BadWolf1509/rotamestre-app`    | `git remote -v`             |
| Caminho local canônico   | `D:\rota-mestre\rotamestre-app` | workspace                   |
| Branch de produção       | `main`                          | Git/Vercel                  |
| Web                      | <https://app.rotamestre.tec.br> | Vercel                      |
| Site institucional/legal | <https://rotamestre.tec.br>     | repositório `lp-rotamestre` |

Não copie versões para outros documentos. Quando houver divergência, prevalecem
`package.json`, `app.config.js`, `eas.json` e o estado consultado nos consoles.

## Histórico

Snapshots datados por etapa e a tabela de mudanças por PR ficam em
[HISTORICO.md](HISTORICO.md) — foram tirados daqui em 15/08/2026 porque eram
**290 das 923 linhas** deste documento, lidas em toda sessão para responder
perguntas raras. Consulte-o para "como chegamos aqui" e "isso já foi tentado?".

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

> As **Armadilhas** acima também não podem regredir — esta seção não as repete.
> Quatro entradas saíram daqui em 27/08/2026 por serem cópia literal de lá
> (`loading` na recarga, componente aninhado no render, `src/types/database.ts`,
> OSRM no dev web). Duplicar entre as duas seções custa leitura dobrada em toda
> sessão e cria o risco de as cópias divergirem. O que entra aqui é regra que
> **não** tem armadilha correspondente.

- Nunca exponha `service_role`, chave do Google Places ou credencial do Play no
  cliente ou no Git.
- **Conta de teste nunca tem senha no repo.** As quatro antigas (`gestor@`,
  `motorista@`, `gestor.test@`, `motorista.test@`) foram excluídas em
  05/08/2026; se recriar alguma, a senha vem de variável de ambiente. Era a
  pendência 1, cuja ação já estava feita — o que sobrava era esta regra,
  ocupando um slot da lista canônica lida em toda sessão.
- Migrations de schema devem ser versionadas em `database/migrations/` e
  `supabase/migrations/` com o mesmo timestamp e conteúdo. Exceções históricas
  aplicadas manualmente precisam ser documentadas, nunca executadas novamente
  por suposição.
- `versionCode` é monotônico. Confirme o maior código no Play Console antes do
  próximo bump.
- Não altere `br.tec.rotamestre.app`, o EAS project ID ou o Firebase project sem
  um plano formal de migração.
- Dependências acopladas exigem validação nativa: Unistyles e Nitro Modules
  devem ser testados juntos em build EAS.
- **A carência de 7 dias para expirar rota `em_andamento` não é número
  arbitrário.** Expirá-la junto com as pendentes, às 22:00 do próprio dia, teria
  encerrado **67 das 604 rotas concluídas (11%)** com o motorista ainda
  entregando — 47 delas fecham no dia seguinte. Antes de mexer no predicado de
  `expire_old_pending_routes`, refaça o replay contra o histórico de
  `motorista_iniciou_rota`/`motorista_concluiu_rota`. `remind_pending_routes`
  usa o **mesmo** predicado de propósito: separá-los faz a rota expirar sem
  aviso. Ver `database/MIGRATIONS.md` (Migrations 25 e 26).
- O baseline de runtime é **Node 22** (`.nvmrc`, `engines.node`, CI e EAS). Não
  regrida para Node 20; a proteção da `main` espera `Run Tests (22.x)`.
- O mapa web só funciona com o worker do `maplibre-gl 6` servido de `public/` —
  a cadeia inteira que não pode ser quebrada (postinstall, `build:web`,
  `configureMaplibreWorker()` e o step explícito no job de visual regression)
  está em [`../CLAUDE.md`](../CLAUDE.md). O e2e `renders motorista mapa` cobre
  isso desde 25/08/2026, **mas não em PR do Dependabot**: secrets de bot são um
  store separado e vazio, e o mapa roda no job `E2E autenticado`, que o `if:` de
  job **pula** para Dependabot e fork: ele aparece cinza ("Skipped") na lista de
  checks, e o `Visual Regression (22.x)` (mesmo nome, depende dele) sai verde
  sem ter aberto o mapa (medido no #519 e no #536, os dois bumps de
  `maplibre-gl`, quando o pulo era um `exit 0` invisível). Humano sem secret
  falha. **O push na `main` roda de verdade** — então um bump quebrado
  passa verde no PR, entra, e só acende com o deploy já disparado. Para validar
  antes, rode o e2e local (`npx playwright test e2e/visual-critical.e2e.ts -g
"mapa"`, com `.env` preenchido). Como distinguir no log um step que rodou de
  um que degradou: memória `ci-verde-em-pr-do-dependabot-nao-testa-o-mapa`.
- **O bloco `ignore` do `.github/dependabot.yml` não é burocracia.** `expo`,
  `expo-*`, `@expo/*`, `@react-native/*`, `@react-native-community/*`,
  `react-native` e os demais pacotes fixados pelo SDK sobem **só** por
  `npx expo install`, em lockstep. Bump isolado quebra: em 24/08 o
  `@react-native/jest-preset` 0.87 derrubou **as 334 suítes de uma vez** (o preset
  mocka `react-native/setup-env`, ausente na 0.85.3). O preço da regra é deriva
  silenciosa — coberta pelo `expo install --check` no CI, informativo de propósito.
- **O audit de produção bloqueia merge** e mantém allowlist **por ID de advisory**
  em `scripts/audit-producao.js` (nunca por pacote, para que advisory novo no
  mesmo pacote continue quebrando). Quando falhar: suba a dependência se houver
  correção upstream; se não houver e o risco for aceitável, acrescente o ID com
  motivo e data de revisão. **Não devolva `continue-on-error`** — foi assim que 4
  advisories high do `image-size` ficaram falhando sem ninguém ver.
- `otimizacao_estado = NULL` significa **sem registro**, nunca `'manual'`. Não
  conte, filtre nem exiba rota antiga como manual: não há como saber se ela foi
  otimizada, e assumir falsearia a auditoria.
- Autoria de ações sensíveis vem de `auth.uid()` **dentro** da função
  `SECURITY DEFINER`, nunca de parâmetro enviado pelo cliente — caso contrário
  qualquer usuário autenticado pode forjá-la.
- **Número com decimal na tela passa por `formatarDecimal`** — regra completa,
  com as exceções, em [`../CLAUDE.md`](../CLAUDE.md). Estava duplicada aqui e
  lá; duas cópias de uma regra divergem no primeiro ajuste.

## Próximas ações

> As pendências ativas estão na **tabela do topo**, que é a lista canônica. Aqui
> fica só o detalhe operacional das frentes abertas. O backlog de médio prazo
> (métricas de produto, retomada do Asaas, estratégia de rollout pós-aprovação)
> saiu daqui em 25/08/2026 — não precisava ser lido em toda sessão.

### P0 — concluir distribuição móvel (detalhe das pendências 4 e 5)

1. Confirmar no Play Console a quantidade e a continuidade dos participantes com
   opt-in; divulgue o hub `/testar` para ampliar a base. Contas cadastradas sem
   opt-in não contam para o requisito.
2. Solicitar acesso à produção quando o requisito estiver satisfeito. As duas
   trilhas de teste já servem o mesmo build (alinhadas em 08/09/2026), então não
   há promoção pendente entre elas. Promoção entre trilhas é feita pela API
   (`npm run play:promote`), nunca por `eas submit`, que sempre sobe artefato
   novo; não gere um AAB só para repetir a tentativa.
3. Revisar "Conteúdo do app", Segurança de dados, classificação, público-alvo,
   acesso do revisor e URLs legais contra `play-store-metadata.md`.
4. Concluir a autenticação interativa da Apple, gerar o primeiro build iOS e
   testá-lo no TestFlight.
5. Preencher a ficha e o App Privacy no App Store Connect, anexar screenshots de
   iPhone/iPad e enviar o build para revisão.

### P1 — qualidade e acompanhamento funcional

1. Monitorar erros da Nova Entrega: recuperação de rascunho após refresh,
   importação em massa, dependências retirada/entrega, retries e duplicidade.
2. Validar o ciclo completo de um motorista **em rede instável**. Em rede boa o
   ciclo foi percorrido no Android em 05/09/2026 (iniciar, concluir com foto,
   pular, reportar incidente, finalizar, recriação de Activity) e o build de
   08/09 foi validado em aparelho para mapa nativo, decimais pt-BR, Waze com
   destino, aviso de localização, permissão de câmera e SOS nos dois ramos. O
   iOS segue sem build (pend. 5).
3. Confirmar entrega de push nos artefatos instalados pelas lojas.
4. Planejar o aviso aos usuários do app antigo sem interromper o backend
   compartilhado.

## Roteiro para a próxima sessão

1. `git status --short --branch` — espere a árvore limpa. Se aparecer
   `.claude/settings.json` modificado, é porque uma permissão foi salva no escopo
   "projeto" em vez de "local": reverta o versionado e mova para
   `.claude/settings.local.json`, que o `.gitignore` cobre.
2. Confira `package.json`, o último commit e os checks do GitHub.
3. Se houver banco no escopo, rode `npx supabase migration list` e compare o
   schema vivo antes de criar SQL.
4. Se houver release Android no escopo, consulte o Play Console e o EAS — não
   gere build só para descobrir o estado.
5. Se houver worktrees de sessões paralelas em `.claude/worktrees/`, o Jest da
   checkout principal os varre; o `jest.config.js` já os ignora por regex, então
   basta `npx jest`. **Não passe `--testPathIgnorePatterns`**: a flag de CLI
   sobrescreve a config e, rodada de dentro de um worktree, zera a suíte.
6. Execute a menor validação proporcional à mudança, e registre aqui o que for
   durável: regra que pode regredir vai para "Armadilhas" ou "Regras que não
   podem regredir"; relato datado vai para [HISTORICO.md](HISTORICO.md).

> Se abrir uma seção "Trabalho em curso", siga o contrato: estado real
> verificado, e apagada ao fechar.

## Mapa da documentação

- **Começar uma nova sessão / estado atual** — este arquivo
- **Como chegamos aqui / o que já foi tentado** — [HISTORICO.md](HISTORICO.md) — snapshots datados e mudanças por PR
- ****Isso já foi resolvido? posso reabrir?**** — [HISTORICO.md](HISTORICO.md) → "Frentes fechadas, por data": as listas "Fechadas em ..., não reabra" de 08, 15, 17 e 25/08
- ****Este fluxo já foi validado? o que foi medido?**** — [HISTORICO.md](HISTORICO.md) → "Validações e varreduras": onboarding, otimizador, massa demo, política de senha, contas órfãs, emails do Auth e guardas de precondição
- **Arquitetura, padrões e phonebook técnico** — [`../CLAUDE.md`](../CLAUDE.md)
- **Testes** — [TESTING.md](TESTING.md)
- **Histórico e processo de migrations** — [`../database/MIGRATIONS.md`](../database/MIGRATIONS.md)
- **Google Play: procedimento** — [GOOGLE_PLAY_DEPLOYMENT.md](GOOGLE_PLAY_DEPLOYMENT.md)
- **Google Play: textos, assets e declarações** — [play-store-metadata.md](play-store-metadata.md)
- **App Store / iOS: procedimento** — [APP_STORE_DEPLOYMENT.md](APP_STORE_DEPLOYMENT.md)
- **Reconstrução da identidade Android** — [REBUILD_RELAUNCH_PLAN.md](REBUILD_RELAUNCH_PLAN.md)
- **Firebase e push** — [FIREBASE_MIGRATION.md](FIREBASE_MIGRATION.md)
- **Recuperação de senha** — [PASSWORD_RECOVERY.md](PASSWORD_RECOVERY.md)
- **Templates de email do Auth** — [`../supabase/templates/README.md`](../supabase/templates/README.md) — e por que colar no painel
- **Marca e tokens** — [`../brand-guidelines.md`](../brand-guidelines.md)
- **Specs e planos de features** — [`superpowers/specs/`](superpowers/specs/) e [`superpowers/plans/`](superpowers/plans/)

Os specs e planos em `superpowers/` são **registro de decisão**, não estado
atual: leia-os quando for continuar a feature de que tratam (ex.: a Fase 2 da
auditoria). Onde eles divergirem deste documento ou do código, **o código vence** —
vários deles registram passos que a execução provou errados.

## Segurança documental

Não registre senhas, tokens, chaves, arquivos JSON de serviço, keystores ou
listas nominais de usuários/testadores. Este documento pode registrar **onde**
uma credencial é administrada e como verificar seu funcionamento, nunca seu
conteúdo.
