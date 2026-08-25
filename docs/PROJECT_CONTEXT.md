# Contexto operacional — Rota Mestre App

> Documento de entrada para novas sessões. Atualizado em 25/08/2026.
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
> cresce a um custo que ninguém vê. Ele já foi cortado duas vezes — 923→633 em
> 15/08 (histórico) e 736→534 em 17/08 (validações e varreduras). Antes de somar
> uma seção, pergunte se ela precisa ser lida **em toda sessão** ou só quando
> alguém for mexer naquele fluxo. No segundo caso, o lugar é o `HISTORICO.md` ou
> o doc do tema, com uma linha no Mapa da documentação apontando para lá.

## Pendências (comece por aqui)

Lista única e canônica. Se resolver uma, risque daqui.

| #   | Pendência                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Quem pode fazer                                | Onde está o detalhe                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------ |
| 1   | **Rotacionar/desativar contas de teste com senha vazada** — `gestor@`, `motorista@`, `gestor.test@`, `motorista.test@` foram **excluídas em 05/08/2026**; se recriar qualquer conta de teste, use senha forte por variável de ambiente.                                                                                                                                                                                                                                  | gestor (Supabase → Auth → Users)               | "Credenciais hardcoded" abaixo                         |
| 2   | **Furo de RLS:** motorista pode alterar `unidade_id` da própria rota. Pré-existente, exige motorista malicioso fora do app.                                                                                                                                                                                                                                                                                                                                              | requer design (o fix óbvio quebra o motorista) | Security Advisory privado `GHSA-vw63-jxg2-28vx`        |
| 3   | **Fase 2 da auditoria:** chip na tela da rota + indicador/filtro/contador na Gestão de Rotas. Plano próprio ainda não escrito — melhor depois de algumas semanas de dado acumulado.                                                                                                                                                                                                                                                                                      | qualquer sessão                                | spec `2026-08-04-auditoria-otimizacao-rotas-design.md` |
| 4   | **Play Store: produção continua vazia.** O `3025` está publicado em **teste fechado (`alpha`) e teste interno**, ambos `completed`. Falta cumprir o requisito de testadores para solicitar acesso à produção. Ampliar opt-in divulgando o hub público `/testar`.                                                                                                                                                                                                         | gestor (Play Console)                          | `GOOGLE_PLAY_DEPLOYMENT.md`                            |
| 5   | **iOS:** não existe build. Bloqueado na autenticação interativa da Apple (`npx eas-cli build --platform ios --profile production`).                                                                                                                                                                                                                                                                                                                                      | gestor (Apple ID + 2FA)                        | `APP_STORE_DEPLOYMENT.md`                              |
| 6   | **4 das 9 unidades têm coordenadas de sede NULL, mas só 1 está ativa** — o registro anterior dizia "4 unidades não conseguem gerar rota"; conferido no banco em 15/08, três delas estão inativas e o impacto real hoje é **uma**. A tela "Minha Unidade" é o caminho de conserto e desde 08/08 funciona de verdade (ver Migration 22 e a armadilha do componente aninhado). Desde o PR #385 a Nova Rota avisa e leva até lá, em vez de só sumir com o cartão de partida. | gestor (edita a unidade ativa)                 | `database/MIGRATIONS.md` (Migration 22)                |
| 7   | **Proteção contra senha vazada: exige plano Pro, não dá para ligar hoje.** O advisor aponta `auth_leaked_password_protection`, mas a checagem contra o HaveIBeenPwned é **Pro ou acima** — a assinatura é por organização, não por projeto. **Não é um toggle**, é upgrade de plano. O que o free permite e vale conferir: comprimento mínimo e caracteres exigidos, em Auth → Providers → Email.                                                                        | gestor (decisão de plano; ou ajuste no Email)  | "Política de senha" em [HISTORICO.md](HISTORICO.md)    |

**Fechadas em 08/08/2026, não reabra:** a Migration 22 foi aplicada em
07/08 e validada na tela (edição gravou no banco; `.update()` direto continua
falhando); o **primeiro build EAS sob Node 22** aconteceu — build `3025`,
que resolveu o Node pelo `.nvmrc` e passou sem ajuste; os assets da loja foram
resolvidos — `final/` versionado, `raw/` no `.gitignore`, e os 8 screenshots
mais o feature graphic v2 refeitos e commitados com a listagem já publicada.

**Fechadas em 15/08/2026, não reabra:** o decimal com ponto (`18.1 km` num app
pt-BR) foi centralizado em `formatarDecimal` e migrado em 32 pontos de exibição
(PR #375); **toda rota sob `app/` tem ErrorBoundary** (PRs #373 e #374); as
**contas órfãs em `auth.users` foram zeradas** (detalhe em [HISTORICO.md](HISTORICO.md)); no
onboarding, o **nome do cadastro chega pré-preenchido** e **cidade e UF saem do
endereço** da sede, com os campos reordenados (PR #378) — ambos validados no
navegador com o Places real. E, fechando a lista de bugs da validação manual
(PR #381): o **`PGRST116` deixou de virar erro no Sentry** a cada cadastro
bem-sucedido (`.single()` → `.maybeSingle()`), a Nova Rota **dá saída ao gestor
sem motorista**, o endereço da sede **não repete mais cidade e UF**, o campo de
endereço do onboarding **ganhou rótulo** e `PERFIL_JA_EXISTE` **ganhou mensagem
própria**. Por fim, a tela de criar unidade **devolve ao portão quem já tem
perfil** (PR #383): ela abria por URL para qualquer um, e o layout do onboarding
desliga o botão e o gesto de voltar — a única saída visível era o "Sair", que
desloga.

**Fechadas em 17/08/2026, não reabra:** os **6 templates de email do Auth** foram
corrigidos, e **5 deles** passaram a ser versionados em `supabase/templates/`
(PR #390; o Magic Link saiu depois no #400, ver abaixo) — cinco
defeitos reais, sendo o pior o link alternativo do reset, que mandava para "Link
inválido" quem copiava e colava. A proteção anti link-scanner foi **estendida ao
cadastro** (PR #396), com a lógica extraída de `confirm-reset.tsx` para
`src/lib/auth/confirmationLink.ts` + `src/components/auth/ConfirmLinkScreen.tsx`.
Ainda em 17/08, a leva do Dependabot foi triada: **#393** (`@hookform/resolvers`)
e **#394** (`react-hook-form`) mergeados; **#391** (8 dev dependencies) **fechado**
porque sobe `@react-native/jest-preset` para 0.87 e o projeto está em
react-native 0.85.3 (fixado pelo Expo 56) — o preset novo procura
`react-native/setup-env`, que não existe nessa versão, e a suíte inteira morre
com `Could not locate module`. Alinhar exigiria subir Expo, que é migração e não
bump. As outras sete atualizações do lote não têm problema conhecido: o que as
bloqueava era estarem no mesmo PR.

**O Sentry foi para 10.70 e o episódio do bundle fechou com uma lição medida.**
O #395 (`@sentry/browser` sozinho) estourava o teto em 338 kB, o que foi lido
como crescimento real da biblioteca — e o limite subiu para 4 MB (PR #403) por
causa disso. **Estava errado.** `@sentry/react@10.69.0` fixa `@sentry/browser`
em exatamente 10.69.0, então subir só um faz o npm aninhar **uma segunda cópia
do Sentry inteiro**; os 338 kB eram duplicação, não tamanho.

A prova veio do próprio CI: com os dois em 10.70, o bundle mediu **3.33 MB** —
abaixo até do teto original. O merge do #392 levou o `browser` a 10.70 no lock
(o `react` novo o exige), e o Dependabot fechou o #395 sozinho dizendo
_"@sentry/browser is up-to-date now"_. O limite voltou a **3.5 MB**, o
`package.json` passou a declarar `^10.70.0` nos dois, e o lock não tem nenhuma
cópia aninhada de `@sentry/*`.

Duas coisas para levar adiante: **pacotes do mesmo scope que se fixam por versão
exata precisam subir juntos** — é a regra de dependência acoplada, agora com o
mecanismo; e o Dependabot ficou horas sem processar `@dependabot rebase` porque
as labels `dependencies` e `npm` não existiam no repositório. **Criá-las
destravou o bot na hora** — elas agora existem.

Os templates **já foram colados no painel** e o fluxo de cadastro foi validado
com email real (seção abaixo). Fechando a sequência, o login passou a oferecer
**reenvio da confirmação** quando recusa por email não confirmado (PR #398) — o
beco sem saída de quem não confirmava a tempo. O que cada defeito era e por que
quebrava está em [HISTORICO.md](HISTORICO.md); as invariantes que não podem
regredir, nas armadilhas.

Follow-ups menores (nenhum bloqueia): Timeline não narra o autor da otimização
(o dado existe em `logs.usuario_id`, falta join em `useTimelineData.ts`);
`mapLogToTimelinePreview` não exibe **6** dos eventos que `TIMELINE_LOG_EVENTS`
conta — `rota_otimizada`, `paradas_reordenadas`, `rota_reativada`,
`parada_reaberta`, `parada_retomada` e `motorista_alterado` —, então o widget
colapsado soma esses eventos e não mostra nenhum deles (o registro anterior
citava só `rota_otimizada`, era maior que isso); os dois scripts de
consulta/promoção da Play ficaram **fora do repositório** (ver "Play Store:
trilhas" nas armadilhas) — recriar custa uma investigação inteira.

A varredura por **telas com precondição forte** foi feita em 15/08 e o resultado
está em "Guardas de precondição", hoje em [HISTORICO.md](HISTORICO.md): o projeto está bem coberto, e o único
beco aberto que ela encontrou (Nova Rota sem sede) foi fechado no PR #385.

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
- **Editar `supabase/templates/*.html` NÃO muda o email enviado.** Os arquivos são
  versionados desde 17/08/2026, mas o Supabase lê **só do painel** (Auth → Emails):
  é preciso colar. Não há MCP para isso, e `supabase config push` **sobrescreveria
  a produção** com o `site_url = http://127.0.0.1:3000` do `config.toml`. Duas
  invariantes vivem nesses arquivos e quebram em silêncio se alguém "simplificar":
  o link de `reset-password.html` e `confirm-signup.html` precisa ser
  `{{ .SiteURL }}/auth/confirm-{reset,signup}#url={{ .ConfirmationURL }}` **no
  `href` e no texto visível** — trocar pelo `{{ .ConfirmationURL }}` direto
  devolve o OTP ao scanner corporativo (e, no cadastro, entrega junto os **tokens
  de sessão** que o verify carrega). Detalhe em `supabase/templates/README.md`.
- **São 5 arquivos para 6 abas do painel, e isso é intencional.** O **Magic Link**
  foi removido do repositório em 17/08/2026 (PR #400): o app nunca chama
  `signInWithOtp`, então aquele email jamais é enviado, e versioná-lo custaria as
  mesmas correções de Outlook e dark mode a cada rodada, para nada. A aba
  **continua existindo no painel** com o layout antigo — inofensivo só enquanto
  nada dispara o envio. Se o login sem senha entrar no produto, recupere
  `supabase/templates/magic-link.html` do histórico do git **antes** de usar, ou o
  template volta a viver só no painel, que é o problema que o #390 resolveu.
- **Worker do maplibre 6** servido de `public/`: se sumir, o mapa trava em
  "Carregando..." **sem erro no console e com o CI verde**. Detalhe do que não
  pode ser removido em "Regras que não podem regredir".
- **OSRM no dev web usa outro servidor (desde 08/08/2026, PR #358).** O nosso
  `osrm.rotamestre.tec.br` responde
  `Access-Control-Allow-Origin: https://app.rotamestre.tec.br` **fixo**, então o
  browser bloqueava toda chamada a partir de `localhost` e o otimizador caía no
  `buildHaversineMatrix` (linha reta × 1,3) **sem erro visível** — a rota
  "otimizava" com distância plausível e ninguém percebia a ausência de
  roteamento por vias. `src/lib/osrm/config.ts` agora resolve a URL nesta
  ordem: `EXPO_PUBLIC_OSRM_URL` → demo público (**só em dev web**) →
  self-hosted. Produção e dev nativo **não mudaram**. Duas consequências: o
  demo público cobre o planeta em vez do extrato do Nordeste, então as
  distâncias em dev **não conferem exatamente** com produção; e a correção
  definitiva continua sendo liberar `localhost` no CORS do nosso openresty —
  **CORS não é controle de acesso**, o endpoint já responde a qualquer um via
  `curl`, o header só restringe browser.
- **O Fast Refresh não aplica no dev web — recarregue antes de medir.** Em
  15/08/2026, validando pelo `preview_start`/`expo-web`, as edições de código
  **não chegavam ao navegador**: o Metro registrava só o bundle inicial e a
  página seguia executando a versão antiga. Isso produziu três medições
  contraditórias, incluindo um teste diferencial em que o bug foi reintroduzido
  de propósito e o navegador insistiu que ele não existia — quase virou
  conclusão errada no relatório. Antes de medir qualquer coisa pelo navegador,
  force `window.location.reload()` e espere o bundle voltar (~10 s até o
  dashboard reaparecer). Se duas medições se contradisserem, suspeite do Fast
  Refresh antes de suspeitar do código. Para ter certeza de qual versão está
  sendo servida, baixe o bundle e procure o símbolo:
  `curl -s "http://localhost:8082/index.ts.bundle?platform=web&dev=true" | grep -c meuSimbolo`.
- **O toast vermelho de erro e o `Unexpected text node` são do LogBox — não
  existem em produção.** Os dois foram registrados como bug em 15/08 e depois
  desmentidos por medição: no bundle de produção servido pela Vercel,
  `LogBoxNotification`, `LogBoxInspector`, `LogBoxData` e `LogBoxLog` aparecem
  **zero** vezes, e a string "Unexpected text node" também. Nenhum componente do
  app renderiza saída de log — se você vê texto de `console.error` na tela, é
  ferramenta de desenvolvimento. O aviso de text node ainda por cima **já é
  suprimido** em dev por `src/utils/configureLogBox.ts`, que substitui
  `console.error`. A armadilha de método: um interceptor de console instalado
  **depois** desse arquivo fica **acima** do filtro e conta mensagens que nunca
  chegam ao console. Ao instrumentar console, verifique se alguém já o
  substituiu, e confirme o achado no console real (`read_console_messages`)
  antes de chamá-lo de bug.
- **O rascunho de rota não vive no `sessionStorage`.** A fonte é a tabela
  **`rascunhos_rota`**, com expiração de 7 dias; o `sessionStorage`
  (`rotamestre:nova-entrega:<gestor>:<unidade>`) é espelho síncrono, e
  `useNovaEntregaDraft` compara os dois carimbos e usa o mais recente. Ver a
  chave local e concluir "morre com a aba" foi um falso positivo em 15/08 —
  fechar o navegador **não** perde o rascunho.
- **A tabela `logs` não tem coluna `parada_id` — a parada vai em `detalhes`.** O
  schema real é `id, usuario_id, rota_id, evento, detalhes, timestamp`. Três
  lugares mandavam `parada_id` no insert (`queries/logs.ts`, `queries/paradas.ts`,
  `services/locationTracking.ts`); o PostgREST recusa com **400** e a falha só
  virava `logger.warn` — em `logParadaAction` nem isso, porque o supabase-js
  **devolve** o erro em vez de lançar, e o `try/catch` não pegava nada. Resultado
  medido: `motorista_criado` ficou parado em **04/12/2025**, oito meses de
  auditoria de gestão de usuários perdidos sem um sinal. Corrigido no PR #387.
  Duas coisas para não errar de novo: o padrão certo (`parada_id` dentro de
  `detalhes`) já existia em `useAddStopForm`, `useEditStopForm` e `routeUtils`; e
  os eventos de **rota e parada continuam cobertos por triggers no banco**
  (`log_parada_status`, `log_rota_status`) — foi por isso que `parada_concluida`
  tinha 3039 registros e o estrago pareceu maior do que era.
- **Teste que afirma um schema inventado dá cobertura ao defeito.** Os dois bugs
  do PR #387 sobreviveram porque os testes os _exigiam_: `logs.test.ts` esperava
  `parada_id` no insert, e `DashboardMobile.test.tsx` esperava `'150.5'` citando
  o `toFixed` no próprio comentário. Um teste escrito a partir do código, e não
  do contrato real, transforma o bug em requisito. Ao testar escrita em tabela,
  confira as colunas no banco (`information_schema.columns`) antes de fixar o
  payload esperado.
- **Não use here-string do PowerShell (`-m @'…'@`) na ferramenta Bash.** O bash
  não conhece essa sintaxe: o `@` vira texto e o Git toma essa primeira linha
  como **assunto** do commit. Foi o que produziu `ca8ebc3` na `main`, registrado
  como `@ (#379)` — a mensagem inteira ficou no corpo, só o assunto virou lixo.
  Os outros PRs escaparam porque o GitHub usa o título do PR ao fazer squash; o
  #379 tinha um único commit e herdou o assunto dele. No bash use heredoc
  (`git commit -F -`); a sintaxe `@'…'@` só vale na ferramenta PowerShell.
- **`loading` que troca a página inteira pelo spinner.** `DesktopPageLayout`
  (linha 109) e `DashboardMobile` (441) retornam **só** o `ActivityIndicator`
  quando `loading` é true — descartam cabeçalho, filtros, tabela e qualquer
  seletor aberto. Isso é correto na carga inicial e vira defeito quando
  `loading` volta a `true` com conteúdo já na tela. Dois casos corrigidos em
  15/08: o dashboard religava em **toda troca de filtro** (medido: 843 ms de
  tela em branco por filtro, em dev com base vazia — PR #372) e a Equipe
  religava depois de ativar/desativar um membro, logo após o toast de sucesso
  (PR #376). A regra: **`loading` só na carga inicial**; recarga sinaliza por
  `refreshing` ou pelo toast da própria ação. `useGestaoRotas` já fazia certo
  desde sempre ("only show loading if no cache") e `motorista-perfil.tsx`
  também — foram a referência.
- **Componente declarado dentro do render remonta a subárvore a cada tecla.**
  `const Form = () => (...)` usado como `<Form />` ganha identidade nova a cada
  renderização, e identidade nova é **tipo** novo para o React. Custou caro na
  tela "Minha Unidade": o autocomplete da sede **nunca funcionou** ali, porque
  cada caractere destruía o nó do DOM, perdia o foco e zerava o
  `hasUserInteracted` do `AddressAutocomplete`
  (`src/components/AddressAutocomplete.tsx:135`), matando o debounce antes de
  disparar. Sem sugestão não há coordenadas, e sem coordenadas a sede não salva
  — o gestor não estava mal orientado, a operação era **impossível**. Correção:
  chamar como função (`{renderForm()}`), nunca como componente. Diagnóstico
  rápido: marque o nó (`el.dataset.x = '1'`) e digite uma letra; se a marca
  sumir, remontou.
  **Mais dois casos em 15/08 (PR #372):** `FilterContent` no `RouteFilters` e
  `SettingsContent` no `NavigationSettings` — este último destruía o `Slider` de
  raio de proximidade **no meio do arrasto**, já que cada tick dispara
  `setSettings`. Onde a tela tem vários returns (as 5 de auth somam 11), o
  boundary/invólucro vai **em volta** do componente de conteúdo, não return a
  return: envolver um a um deixa algum de fora e os returns futuros nascem
  descobertos. Duas lições sobre **medir** essa remontagem: o teste unitário usa
  contador de montagens num filho mockado; no navegador, guarde a referência do
  nó e cheque `node.isConnected` — e, acima de tudo, **prove que o pai
  re-renderizou** (um controle observável, como o ✓ migrando de opção). Sem esse
  controle a medição passa mesmo com o defeito presente: aconteceu três vezes
  nesta sessão, por cliques que não registravam e por leitura errada do estado.
- **Erro de formulário num campo pode ser causado por outro.** Nos schemas de
  endereço, o `refine`/`superRefine` pendura a mensagem em `endereco` mas quem a
  causa é a ausência de `latitude`/`longitude`. Como `setValue` sem opções **não
  revalida** e a revalidação assíncrona do `onChange` perde a corrida, o erro
  ficava preso na tela ao lado do badge verde "Validado" — dois sinais opostos
  no mesmo campo. Reordenar as chamadas e `trigger()` explícito **não
  resolveram**; só `clearErrors('endereco')` é determinístico. Vale para
  `nova-entrega` e `onboarding`; `AddStopModal`/`EditStopModal` são imunes
  (usam `useState` puro e já limpam o erro).
- **Play Store: precedência de trilha e `eas submit` não promove.** A Play serve
  sempre a trilha de maior prioridade a que a conta tem direito —
  **internal ganha de closed**. Publicar só no teste fechado deixa os testadores
  internos presos na versão antiga, e o sintoma engana: o link de teste fechado
  funciona, o opt-in é aceito, e mesmo assim chega o build velho (aconteceu em
  08/08 — link de `alpha`, aparelho recebeu o `3021` da internal). Publique nas
  duas. E `eas submit` **sempre faz upload**, então falha com
  "You've already submitted this version" quando o versionCode já subiu:
  promover entre trilhas exige a API (`edits` → `PUT tracks/<track>` →
  `:commit`). O padrão de autenticação pronto está em
  `scripts/publish-play-listing.mjs` — JWT RS256 com `node:crypto`, sem
  dependências.
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
- **Cadastro público quebrado — o portão já está aplicado desde o PR #354.**
  `signUp` criava a conta no Auth e depois inseria em `usuarios` — insert que o
  RLS bloqueia porque exige que o autor já seja gestor. O erro vinha DEPOIS da
  conta criada: pessoas reais ficaram com conta órfã, e `app/index.tsx` as
  devolvia ao login sem mensagem. Hoje `index.tsx` **e** `login.tsx` mandam
  sessão-sem-perfil para `/onboarding/criar-unidade`, então deixou de ser beco
  sem saída. **Validado com conta real em 15/08 até a criação da unidade**: o
  portão leva à tela certa e a RPC grava as três linhas atomicamente (pendência 6
  segue aberta só nos passos de motorista e rota).
  _(Até 15/08 esta entrada dizia "correção ainda não aplicada", o que contradizia
  a própria tabela de mudanças e o código; corrigido após conferir o
  `login.tsx`.)_
  Lição: **operação que precisa de mais de uma linha vira RPC em transação**,
  nunca dois passos no client. Indicador de saúde — hoje retorna **zero**, ver
  "Contas órfãs zeradas":
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
- Android: o build **`3025`** está concluído em teste fechado **e** interno;
  produção nunca teve release (pend. 4). A versão do código sai do
  `package.json`.
- iOS: configuração versionada, sem build (pend. 5).

## Resumo executivo

Este repositório contém o produto operacional do Rota Mestre:

- painel web para gestores em <https://app.rotamestre.tec.br>;
- aplicativo Android para motoristas;
- backend compartilhado no Supabase;
- otimização, execução e acompanhamento de rotas;
- fotos privadas de comprovação, ocorrências, notificações e histórico.

O app foi reconstruído sob uma nova identidade Android após a perda das contas de
distribuição originais; o Supabase e os dados dos usuários foram preservados.
**Versão e `androidVersionCode` saem do `package.json`** — não os repita aqui,
foi assim que este documento já ficou desatualizado antes.

## Identidades e serviços

| Item                     | Valor atual                            | Fonte de verdade                       |
| ------------------------ | -------------------------------------- | -------------------------------------- |
| Repositório              | `BadWolf1509/rotamestre-app`           | `git remote -v`                        |
| Caminho local canônico   | `D:\rota-mestre\rotamestre-app`        | workspace                              |
| Branch de produção       | `main`                                 | Git/Vercel                             |
| Web                      | <https://app.rotamestre.tec.br>        | Vercel                                 |
| Android package          | `br.tec.rotamestre.app`                | `app.config.js`                        |
| Versão Android no código | leia de `package.json`                 | `package.json` (não duplique aqui)     |
| EAS project              | `c6401a59-af97-484a-93b7-c75016bf331d` | `app.config.js`                        |
| Firebase                 | `rota-mestre-97084`                    | console Firebase / configuração nativa |
| Supabase project ref     | `xezslsyxjivunmhhyxtd`                 | `supabase/.temp/project-ref`           |
| Site institucional/legal | <https://rotamestre.tec.br>            | repositório `lp-rotamestre`            |
| Plataforma               | Expo 56, React Native 0.85.3, React 19 | `package.json`                         |

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
  console** — nenhum teste **de screenshot** detecta, porque os que existiam
  mascaravam justamente a região do mapa.
  **O job de visual regression precisa copiar o worker explicitamente**
  (`.github/workflows/test.yml`): ele instala com `npm ci --ignore-scripts`, que
  pula o `postinstall`, e não roda `build:web`. Sem esse step o arquivo não
  existe em CI e o mapa trava lá — foi assim de sempre até 25/08/2026, quando o
  teste funcional expôs. Cobertura hoje: `renders motorista mapa` assere que o
  mapa monta **e** que terminou de carregar (`mapa-web-carregando` some só no
  evento `load`), e roda em CI desde que os secrets `E2E_*` existam.
- **Step bloqueante de CI vai no fim do job.** Quando um step sem
  `continue-on-error` falha, o Actions **pula todos os seguintes** — eles
  aparecem como `skipped`, não como falha. Em 25/08/2026 o audit de produção
  estava antes do typecheck e do lint, e um advisory escondia o resultado dos
  dois: quem abrisse o PR via só o audit vermelho. Vale para qualquer step novo
  que você torne bloqueante.
- **Asserção de ausência nunca vem sozinha.** `toHaveCount(0)`,
  `not.toBeVisible()` e afins são satisfeitas tanto pelo sucesso quanto por "a
  tela nem chegou lá" — precisam vir **depois** de uma asserção de presença que
  estabeleça o contexto. Em 25/08/2026 o teste do mapa foi escrito assim e ficou
  verde com o worker do maplibre destruído de propósito: sem rota atribuída a
  tela renderiza `motorista-mapa-empty`, nenhum mapa é criado, e o
  `toHaveCount(0)` sobre o overlay de carregamento era trivialmente verdadeiro.
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
- Não existe `src/types/database.ts`. Os tipos de domínio são curados à mão em
  `src/types/`; não introduza tipos gerados sem decidir isso para o projeto todo.
- **Não declare componente dentro do render de outro componente.** Se precisar
  quebrar um JSX grande, use função de render chamada como `{renderX()}`. Como
  `<X />`, o React remonta a subárvore a cada renderização — quebra foco, zera
  refs e mata debounce, tudo sem erro no console e com o CI verde.
- **Toda rota sob `app/` tem `ErrorBoundary`** (desde 15/08, PRs #373 e #374).
  Auth e `index` são os mais críticos: são a porta de entrada, sem tela anterior
  para onde voltar. Ao criar rota nova, inclua o boundary. Verificação:
  `for f in $(find app -name "*.tsx" -not -path "*__tests__*" -not -name "_layout.tsx" -not -name "+*"); do grep -q ErrorBoundary "$f" || echo "$f"; done`
  — as 4 tabs em `app/motorista/(tabs)/` aparecem nessa busca e são **falso
  positivo**: re-exportam de `_screens/`, que já têm.
- **Número com decimal na tela passa por `formatarDecimal`**
  (`src/lib/formatNumber.ts`), nunca `toFixed` cru: o app é pt-BR e vírgula é o
  separador. **Não troque por `Intl.NumberFormat('pt-BR')`** — o Hermes pode ser
  compilado sem os dados de locale do ICU, e nesse caso `Intl` aceita o locale e
  devolve en-US calado: sairia certo na web e errado no aparelho. Chave de
  cache, coordenada, valor que vai para o banco e célula numérica de planilha
  continuam com `toFixed` — não são exibição.
- **`loading` vale só para a carga inicial.** Religá-lo numa recarga faz
  `DesktopPageLayout`/`DashboardMobile` descartarem a página inteira. Recarga
  sinaliza por `refreshing` ou pelo toast da própria ação.
- O default do `OSRM_BASE_URL` em produção e em dev **nativo** é o self-hosted.
  Só o dev **web** cai no demo público, e só porque o CORS bloqueia. Não
  generalize a troca para as outras plataformas.

## Próximas ações

> As pendências ativas estão na **tabela do topo deste documento**, que é a lista
> canônica. Esta seção guarda só o detalhe operacional de cada frente e o
> backlog de médio prazo — não repita itens aqui.

### P0 — concluir distribuição móvel (detalhe das pendências 4 e 5)

1. Confirmar no Play Console a quantidade e a continuidade dos participantes
   com opt-in; divulgue o hub `/testar` para ampliar a base. Contas cadastradas
   sem opt-in não contam para o requisito.
2. Solicitar acesso à produção quando o requisito mostrado pelo Console estiver
   satisfeito e **promover** o build `3025` — já publicado em teste fechado e
   interno. Promoção entre trilhas é feita pela API, não por `eas submit`; não
   gere um AAB novo só para repetir a tentativa.
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

0. **Não há frente aberta nem dado de teste solto.** A sessão de **17/08**
   encerrou com a `main` limpa, nenhum PR aberto, nenhuma branch órfã no remoto e
   a conta de teste do fluxo de email removida do banco. Se abrir uma seção
   "Trabalho em curso", siga o contrato da que existia aqui: estado real
   verificado, e apagada ao fechar — o que ela tiver de durável vai para
   "Armadilhas" (aqui) ou "Validações registradas" (em
   [HISTORICO.md](HISTORICO.md)).
1. Leia, **nesta ordem**, as três primeiras seções deste documento: Pendências,
   Armadilhas e Estado atual. Elas bastam para começar; o resto é referência sob
   demanda.
2. `git status --short --branch`. **Espere a árvore limpa.** Até 17/08 havia um
   `.claude/settings.json` permanentemente modificado — a permissão local do
   gestor, que `git reset --hard` destruiu três vezes. Ela foi movida para
   `.claude/settings.local.json`, que o `.gitignore` cobre e o `reset --hard`
   não toca (ele só mexe em arquivo rastreado). **Se esse diff reaparecer**, é
   porque uma permissão foi salva no escopo "projeto" em vez de "local":
   reverta o versionado e confira se a permissão está no `settings.local.json`.
3. Confira `package.json`, o último commit e os checks do GitHub.
4. Se houver banco no escopo, rode `npx supabase migration list` e compare o
   schema vivo antes de criar SQL. Releia "Armadilhas" antes de aplicar.
5. Se houver release Android no escopo, consulte primeiro o Play Console e o
   EAS; não gere build só para descobrir o estado.
6. Execute a menor validação proporcional à mudança e registre aqui qualquer
   nova decisão, estado externo ou pendência.
7. Se for validar pelo navegador, **recarregue a página antes de medir** — o
   Fast Refresh não aplica no dev web (ver armadilhas). E monte um controle
   observável que prove que a interação aconteceu; sem ele a medição passa mesmo
   com o defeito presente.

## Mapa da documentação

| Necessidade                                       | Documento                                                                                                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Começar uma nova sessão / estado atual            | este arquivo                                                                                                                                                           |
| Como chegamos aqui / o que já foi tentado         | [HISTORICO.md](HISTORICO.md) — snapshots datados e mudanças por PR                                                                                                     |
| **Este fluxo já foi validado? o que foi medido?** | [HISTORICO.md](HISTORICO.md) → "Validações e varreduras": onboarding, otimizador, massa demo, política de senha, contas órfãs, emails do Auth e guardas de precondição |
| Arquitetura, padrões e phonebook técnico          | [`../CLAUDE.md`](../CLAUDE.md)                                                                                                                                         |
| Testes                                            | [TESTING.md](TESTING.md)                                                                                                                                               |
| Histórico e processo de migrations                | [`../database/MIGRATIONS.md`](../database/MIGRATIONS.md)                                                                                                               |
| Google Play: procedimento                         | [GOOGLE_PLAY_DEPLOYMENT.md](GOOGLE_PLAY_DEPLOYMENT.md)                                                                                                                 |
| Google Play: textos, assets e declarações         | [play-store-metadata.md](play-store-metadata.md)                                                                                                                       |
| App Store / iOS: procedimento                     | [APP_STORE_DEPLOYMENT.md](APP_STORE_DEPLOYMENT.md)                                                                                                                     |
| Reconstrução da identidade Android                | [REBUILD_RELAUNCH_PLAN.md](REBUILD_RELAUNCH_PLAN.md)                                                                                                                   |
| Firebase e push                                   | [FIREBASE_MIGRATION.md](FIREBASE_MIGRATION.md)                                                                                                                         |
| Recuperação de senha                              | [PASSWORD_RECOVERY.md](PASSWORD_RECOVERY.md)                                                                                                                           |
| Templates de email do Auth                        | [`../supabase/templates/README.md`](../supabase/templates/README.md) — e por que colar no painel                                                                       |
| Marca e tokens                                    | [`../brand-guidelines.md`](../brand-guidelines.md)                                                                                                                     |
| Specs e planos de features                        | [`superpowers/specs/`](superpowers/specs/) e [`superpowers/plans/`](superpowers/plans/)                                                                                |

Os specs e planos em `superpowers/` são **registro de decisão**, não estado
atual: leia-os quando for continuar a feature de que tratam (ex.: a Fase 2 da
auditoria). Onde eles divergirem deste documento ou do código, **o código vence** —
vários deles registram passos que a execução provou errados.

## Segurança documental

Não registre senhas, tokens, chaves, arquivos JSON de serviço, keystores ou
listas nominais de usuários/testadores. Este documento pode registrar **onde**
uma credencial é administrada e como verificar seu funcionamento, nunca seu
conteúdo.
