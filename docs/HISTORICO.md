# Histórico — Rota Mestre App

> Arquivo de snapshots datados e mudanças por etapa. **Não é estado atual.**
> O estado vive em [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md); este documento
> existe para responder "como chegamos aqui" e "isso já foi tentado?".
>
> Extraído do `PROJECT_CONTEXT` em 15/08/2026: eram 290 das 923 linhas do
> documento de entrada, lidas em toda sessão para servir a consultas raras.
> Onde este arquivo divergir do `PROJECT_CONTEXT` ou do código, **o código vence**.

## Snapshots datados — histórico, não estado atual

> As três seções a seguir são **fotografias** de 24/07, 04/08 e 05/08/2026.
> Foram verdade naquelas datas e continuam úteis pelo raciocínio técnico que
> registram, mas **os números envelheceram** (versões, versionCode, trilhas da
> Play). Para o estado de hoje use, no topo: **Pendências**, **Armadilhas**,
> **Estado atual** e **Identidades e serviços**. Onde divergirem, o topo vence —
> e o código vence o topo.

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

## Estado confirmado em 15/08/2026

Sessão que começou como investigação de bugs e terminou com **dezesseis PRs
mergeados (#371 a #387, menos o #380, fechado sem merge)**, o onboarding
self-service percorrido de ponta a ponta com dado real e uma migration em
produção. O que importa para a próxima sessão:

- **Três defeitos que a suíte não pegava e o console não denunciava**, todos com
  teste de regressão visto falhando antes da correção: dois de remontagem por
  componente declarado no render (filtros do gestor e configurações do
  motorista) e o desmonte da página inteira do dashboard a cada troca de filtro.
- **Verificado no navegador com o gestor e o motorista logados**, não só em
  teste: filtros, configurações do motorista, mapa com maplibre 6.3.0 e o ciclo
  de logout/login com supabase-js 2.112.3 (o login em si foi feito pelo gestor —
  o agente não digita senha). O ciclo de auth foi confirmado até a leitura sob
  RLS: as 4 rotas da Unidade Demo voltaram com o token novo.
- **maplibre 6.3.0 conferido no ponto que nenhum teste cobre**: o `postinstall`
  reescreveu os dois `.mjs` em `public/`, o Metro serve ambos com 200 e o mapa
  renderizou com contexto WebGL vivo. Atenção ao formato da armadilha: o
  `copy-maplibre-worker.cjs` sai com **código 0 e só um aviso** se não achar o
  arquivo — no dia em que o upstream renomear, o CI passa e o mapa trava.
- **O onboarding self-service foi percorrido inteiro** — cadastro, unidade,
  motorista e rota — com os invariantes conferidos no banco a cada passo. Fecha
  a pendência que estava aberta desde agosto. Detalhe em "Validações
  registradas"; os dados de teste foram removidos ao final.
- **Dois defeitos que só a passagem real revelou** (PR #387): a auditoria de
  gestão de usuários estava morta havia oito meses, porque três lugares gravavam
  uma coluna inexistente em `logs` e a falha só virava `logger.warn`; e o card
  "km Total" do dashboard exibia `15.9` num app pt-BR. Os dois eram **afirmados
  pelos testes existentes** — ver as armadilhas correspondentes.
- **Uma migration aplicada em produção** (23): `admin_logs` perdeu a FK para
  `auth.users`, porque log de auditoria precisa sobreviver ao fim da conta. Foi
  o que permitiu, no mesmo dia, excluir as contas de teste **sem** destruir o
  rastro do que elas fizeram.
- **Três dos sete "bugs" dessa validação não eram bugs**, e os três foram
  desmentidos por medição direta, não por leitura: bundle de produção baixado da
  Vercel para o LogBox, tabela `rascunhos_rota` consultada para o rascunho. Estão
  em "Armadilhas" com a evidência, para não voltarem à lista.
- **Suíte ao fim: 332 suites, 5871 testes, exit 0**, com o CI verde nos seis
  checks. Dois detalhes de método que enganaram durante a sessão: a saída do
  `validate` trouxe `[exited with code 0]` **junto** com uma falha de lint — leia
  a saída, não confie só no código de retorno; e um teste que passa de primeira
  não prova nada, então cada guarda nova foi conferida contra a ausência da
  proteção que ela vigia (ver TESTING.md).

## Estado confirmado em 17/08/2026

### Emails do Auth: do painel para o repositório

Os 6 templates existiam **só dentro do painel do Supabase** — sem histórico, sem
revisão, sem ninguém saber que estavam quebrados. A sessão começou como "ajustar
os templates" e virou uma auditoria.

O diagnóstico separou o que dispara do que não dispara: só **Confirm signup** e
**Reset password** são enviados pelo app. Magic Link, Change Email e
Reauthentication nunca saem (`signInWithOtp` não existe no código; `updateUser` é
sempre chamado com `{ password }`), e o Invite só por convite manual no painel.
O Magic Link tinha ganhado um layout caprichado que nenhum usuário jamais veria.

Cinco defeitos reais, todos corrigidos no PR #390:

1. **O link alternativo do reset não funcionava.** O `href` trazia o `#url=`, mas
   o **texto visível** não. Quem seguia a instrução "copie e cole este link"
   chegava sem fragmento e caía em "Link inválido" — ou seja, quem já não tinha
   conseguido clicar no botão era mandado para o beco sem saída.
2. **Cabeçalho invisível no Outlook**: gradiente sem `background-color` de
   fallback deixava o `<h1>` branco sobre fundo branco.
3. **Botão sem área clicável no Outlook**: `<a>` com `display:inline-block` e
   `padding`, que o engine do Word ignora. Virou `<table>`/`<td bgcolor>`.
4. **Ícones invisíveis**: `<svg>` inline é removido pelo Gmail e não é suportado
   pelo Outlook. Trocados por emoji.
5. **Assunto em português, corpo em inglês** em três templates — pior que estar
   tudo em inglês, porque atrai numa língua e entrega noutra.

Mais dark mode (`meta color-scheme`), avisos migrados de `<div>` para `<table>`,
`padding` movido para o `<td>` externo, `max-width` no mobile, preheader e
`{{ .Email }}` identificando a conta.

### A proteção anti-scanner chegou ao cadastro (PR #396)

O reset já passava pela página intermediária desde `43d3352`. O cadastro não. O
levantamento mostrou que **o efeito ali é diferente e pior**: o verify de signup
redireciona com **tokens de sessão** na URL, então o scanner que faz prefetch não
só confirma a conta antes do usuário — recebe uma sessão válida. O usuário, esse,
não trava: como a conta acaba confirmada, o login funciona. O problema não era
atrito, era sessão vazando.

Em vez de duplicar as 298 linhas de `confirm-reset.tsx`, a lógica saiu para
`src/lib/auth/confirmationLink.ts` e o layout para
`src/components/auth/ConfirmLinkScreen.tsx`. O `confirm-reset` caiu para 52
linhas. **O critério de segurança do refactor foi explícito: os 16 testes dele
passam sem uma linha alterada no arquivo de teste** — é um fluxo já consertado
duas vezes, e a suíte existente foi a rede.

Decisão registrada: o estado de link inválido do cadastro oferece **só "Ir para o
login"**. Implementar `auth.resend` puxaria rate limit, anti-enumeração e telas
novas, e o login costuma ser a saída certa justamente porque o scanner deixou a
conta confirmada.

### Validação com email real, não só com teste

Cadastro às 13:33:31, confirmação às **13:35:41**, `token_consumido = true`. Os
dois minutos provam que o OTP atravessou o envio e a caixa de entrada intacto.
Testado pelo caminho que estava quebrado: copiar e colar o link alternativo.

A infraestrutura de envio foi conferida por DNS e está correta (SPF cobrindo o IP,
DKIM no selector `mail`, DMARC em `p=quarantine`, PTR com FCrDNS, SMTP próprio e
200 emails/h). O detalhe está em PROJECT_CONTEXT.md.

Três coisas de método que valem para a próxima sessão:

- **HTTP 200 no Expo web não prova que uma rota existe** — o SPA devolve o mesmo
  HTML para qualquer caminho. A tela nova só foi dada como pronta depois de
  renderizar os quatro cenários no navegador, produção incluída.
- **Um "tudo verde" foi reportado sem valer.** Ao estender o script de invariantes
  dos templates via `replace`, a substituição falhou em silêncio e a checagem do
  cadastro nunca rodou — só apareceu porque a seção foi conferida na saída.
  Verde de script que você mesmo acabou de editar merece uma conferência.
- **Ler o painel antes de teorizar.** Duas hipóteses levantadas com confiança —
  `site_url` local vazado para produção e assuntos em inglês — caíram assim que os
  screenshots chegaram. Ambas eram plausíveis e nenhuma era verdade.

### O reenvio da confirmação (PR #398)

A validação deixou aparente o beco: quem se cadastrava e não confirmava dentro
de 1h recebia do login um "Verifique sua caixa de entrada" — conselho inútil
para um link que já expirou. `auth.resend` não existia no app.

A decisão de onde colocar o botão veio da pergunta "onde sabemos o email?". Na
tela `confirm-signup` com link inválido **não sabemos**: o fragmento quebrado
não diz quem é a pessoa, e pedir o endereço num campo reabriria a necessidade de
anti-enumeração. No login sabemos — e, mais que isso, o Supabase acabou de
revelar o estado da conta a quem acertou a senha. Por isso o botão vive no
diálogo de erro do login, e a `confirm-signup` apenas encaminha para lá.

Detalhe que salvou trabalho: `resend` com `type: 'signup'` reusa o template
Confirm signup, então o email reenviado já nasceu com a proteção do #396.

O tratamento de erro que mais importa é o do **429**: não é falha, o email saiu.
Tratá-lo como erro faria a pessoa clicar de novo achando que não funcionou.

Validado com conta real no dev server: o diálogo trouxe o botão, o clique
respondeu "Email enviado!", e o banco registrou `confirmation_sent_at` 64s após
`created_at` — a prova de que o segundo email saiu, e não só de que a UI disse
que sim. A conta de teste foi removida depois, com as dependências conferidas.

Duas notas de método desta etapa:

- **`gh` falhou com HTTP 503 e saiu com código 0.** O GitHub estava em "Partial
  System Outage" e a API GraphQL — usada por `gh pr create` e `gh pr checks` —
  estava fora. O PR foi aberto e os checks acompanhados **pela REST**, que
  continuava de pé. Confiar no código de retorno teria feito reportar sucesso
  sem nada ter sido consultado.
- **A branch `feat/resend-confirmation` já existia** (era onde a sessão começou).
  Antes de commitar, stash, reflog e diff foram conferidos para descartar
  sobrescrita de trabalho anterior: não havia commit exclusivo nem nada guardado.

### `rotamestre://reset-password` era do Android, e por isso saiu

Investigado a pedido: a entrada na allow-list **era** o caminho do app nativo, e
foi removida do código no PR #244 porque **estava quebrada** — o scheme existe em
`app.config.js`, mas `detectSessionInUrl` é `false` no nativo e não há handler de
deep link, então o link abria o app e nada acontecia.

O achado que inverte a intuição: manter a entrada na allow-list **piora** o caso
de um build antigo. Com ela, o Supabase aceita o redirect e o app engole o
callback; sem ela, cai no Site URL e o fluxo web **funciona**. Não há cenário em
que manter ajude.

## Estado confirmado em 25/08/2026

### Varredura de dependências: 5 PRs do Dependabot viraram 13 commits

Os cinco PRs abertos eram todos do Dependabot. Um deles, o grupo
`development-dependencies` (#409), estava com **334 de 334 suítes falhando** — e
nenhum teste chegara a executar: o `@react-native/jest-preset` 0.87 mocka
`react-native/setup-env`, arquivo que não existe na RN 0.85.3 fixada pelo SDK 56.

A causa estrutural era o `ignore` do `.github/dependabot.yml` cobrir
`react-native` mas não a família `@react-native/*`, publicada do mesmo monorepo.
Corrigido no #414 — e o Dependabot **fechou o #409 cinco segundos depois do
merge**, recriando-o como #416 sem os dois pacotes, com os testes verdes.

O mesmo padrão reapareceu logo em seguida: o #415 trazia
`@react-native-community/slider`, fixado pelo SDK em `bundledNativeModules`.
Em vez de tapar buraco a buraco, cruzei o `bundledNativeModules` inteiro com o
`package.json` e o `ignore`: das 40 dependências fixadas pelo SDK, **3 estavam
descobertas**, todas em `@react-native-community/*` (slider, datetimepicker,
netinfo). Fechadas no #417 com uma entrada de namespace.

### maplibre 6.5.0 — e um falso positivo que quase virou relatório

Validei o bump com um harness reproduzindo a config de produção (worker servido
da raiz, style Liberty). Na primeira rodada, **a candidata "falhou" exatamente
como o bug clássico do worker** — `loadFired: false`, canvas em branco, console
limpo. Só o controle 6.3.0 falhando **igual** revelou que o quebrado era o
ambiente: o painel do Browser não compõe frames quando não está visível, sem
`requestAnimationFrame` o loop de render nunca roda. Refeito no Chromium headless
do Playwright, as duas versões renderizaram idênticas.

Depois, com credenciais de E2E, o mapa do motorista travou em "Carregando mapa…"
no dev server local — mas **funciona em produção**, com rota e paradas
renderizadas. E a baseline commitada do teste (de 09/01/2026) é justamente um
screenshot do estado travado.

### nitro 0.37.0: análise estática confirmada pelo compilador

O `react-native-nitro-modules` está no projeto só como peer do
`react-native-unistyles`, sem import direto. Não há asserção de versão em lugar
nenhum — `NITRO_VERSION` só é reportado ao JS, nunca comparado —, então o
acoplamento é de compilação e sem rede de proteção.

Comparando header a header, o delta 0.36.5 → 0.37.0 são **7 arquivos, todos em
`cpp/views/` e `cpp/templates/`**. O Unistyles gera só HybridObjects e **zero
Nitro Views**; dos 6 headers que inclui, 5 são byte-idênticos e o 6º difere só na
string de versão. Previsão: compila. O build EAS `85e60844` confirmou.

### A deriva do Expo, e o acoplamento que a separação revelou

`expo install --check` acusava 15 pacotes atrasados, alguns em 7 patches — o
custo previsto do `ignore`, que ninguém pagava porque nada avisava. Corrigido
no #421.

Ao separar o `react-native-screens` num PR próprio (#423), apareceu que os dois
eram **acoplados**: o `expo-router` 56.2.19 exige `screens ^4.26.0`, enquanto o
56.2.12 exigia `^4.25.2`. Com a raiz em 4.25.2 o npm não conseguia deduplicar e
instalava uma **segunda cópia aninhada** do módulo nativo — 1 cópia antes, 2 com
o #421 sozinho, 1 de volta com o #423 + `npm dedupe`. Validado pelo build EAS
`26f2b0e9`, cujo fingerprint difere do anterior, provando recompilação real.

### Os testes de mapa: dois defeitos, um deles meu

A correção dos testes de mapa (#428) trocou o screenshot mascarado por asserção
funcional, e pareceu resolvido: verificado localmente que removendo
`public/maplibre-gl-worker.mjs` o teste falhava. Só que verificar em CI mostrou
outra coisa.

**Defeito 1 — a asserção passava vazia.** Com o worker quebrado de propósito num
branch descartável, o job ficou VERDE. O diagnóstico explicou:
`{"overlays":0,"canvases":0,"mapDivs":0,"mapaView":false}` — a tela estava em
"Sem rota no momento". Sem rota atribuída o componente renderiza
`motorista-mapa-empty` e nenhum mapa é criado, então o `toHaveCount(0)` sobre o
overlay de carregamento era trivialmente verdadeiro. A correção foi de ordem:
exigir que o mapa exista antes de assertar que carregou.

**Defeito 2 — o mapa nunca funcionou em CI.** Corrigida a ordem, o teste ficou
vermelho com o worker íntegro. Causa: os jobs instalam com
`npm ci --ignore-scripts`, que pula o `postinstall` — quem roda o
`copy-maplibre-worker.cjs` —, e o job de visual regression não executa
`build:web`. O arquivo nunca existiu em CI. Passou despercebido porque o único
teste de mapa era screenshot que mascarava o mapa.

Isso também corrigiu uma imprecisão do dia anterior: o run em que "quebrei o
worker para provar a detecção" teria falhado de qualquer forma, porque o arquivo
já faltava. O teste detecta mapa quebrado — só que a quebra em CI era real.

Fechado no #429: ordem das asserções + step explícito de cópia do worker, com
verificação nos dois sentidos em CI (quebrado → failure, íntegro → passa).

### Verificar as três redes: duas escondiam defeito

Depois dos testes de mapa, as outras duas redes de CI criadas no mesmo dia
(`expo install --check` e o audit de produção) foram verificadas pelo mesmo
método — branch descartável com quebra deliberada, PR aberto só para disparar
o `quality.yml`, que não tem `workflow_dispatch`.

Resultado das quebras: retirar `GHSA-5p2g-fcmc-qvqq` da allowlist deixou o
`TypeScript & Linting` vermelho nomeando exatamente aquele advisory — e **só**
ele, o que prova que a allowlist é por ID e não por pacote disfarçado. Fixar
`expo-linking` em 56.0.14 produziu `expected version: ~56.0.17` /
`Found outdated dependencies`, com exit 1 engolido pelo `continue-on-error`.

Detalhe útil para leitura futura: um step `continue-on-error` que falha aparece
como `success` na API de steps do Actions. Quem olhar só o status não vê nada;
o sinal está no log e no summary do job.

**O defeito que a verificação achou** foi de ordem. Com o audit bloqueante
falhando, os três steps seguintes ficaram `skipped` — typecheck e lint incluídos.
Corrigido no #432 movendo o audit para o fim do job.

Placar do método nesta leva: três redes verificadas quebrando de propósito,
duas esconderam defeito que o caminho feliz nunca mostraria.

### O cadastro pelo Android estava morto havia nove meses

Investigando o link "Solicitar acesso" da tela de login, no aparelho: a navegação
funcionava — cabeçalho virava "Criar Conta", botão de voltar aparecia — e o corpo
da tela ficava **completamente vazio**. Sem formulário, sem erro no logcat, sem
crash. Dois screenshots com 15 s de intervalo saíram byte a byte idênticos, então
não era render lento.

A causa: `ResponsiveContainer` é um `View` com `width: 100%` e padding, **sem
`flex`**. Envolvendo um `ScrollView` com `flex: 1`, o Yoga dimensiona o pai pelo
conteúdo, e um filho `flex: 1` em pai de altura automática contribui zero para
essa altura — os dois terminam com altura 0. Na web, o React Native Web mapeia
para CSS e o sintoma não aparece.

Três evidências fecharam o diagnóstico: `login.tsx` não usa o container e
renderiza bem no Android; `criar-unidade.tsx` usa com a aninhagem invertida, que
é a correta; e o teste público `renders auth register` passa em CI a cada push.
Mesmo código, web renderiza, Android vazio.

Introduzido em `ccce2d9` (05/11/2025, migração para Unistyles) — cerca de **nove
meses** durante os quais ninguém conseguiu criar conta pelo app. Não foi
detectado porque toda a cobertura daquela tela é web.

A correção (#436) inverteu a aninhagem sem tocar em nenhum componente ou estilo,
de propósito: assim a baseline do `renders auth register` virou a verificação de
que o layout web não regrediu — e passou. Validado no build EAS `e9eea465`,
instalado num moto g15: o formulário aparece completo.

**A lição que vale além deste bug:** tela compartilhada web+nativo precisa ser
vista nas duas plataformas. Layout é justamente a categoria onde o React Native
Web mais diverge do Yoga, e é onde um teste verde numa plataforma dá a impressão
mais convincente de cobertura.

### Três checks de CI que não existiam ou não funcionavam

- **`expo install --check`** (#424), informativo, escrevendo no summary do job.
  Detalhe aprendido testando: ele valida o que está **instalado**, não os ranges
  do `package.json` — mexer só no manifesto não o faz acusar nada.
- **Audit de produção com allowlist por advisory** (#425). O `npm audit` cru
  ficava vermelho para sempre por advisory sem correção upstream, e o
  `continue-on-error` escondia: **4 high do `image-size` falhavam havia tempo** e
  o comentário do step ainda afirmava que ele passava. O `image-size` não tem
  correção — o advisory diz literalmente "Patched versions: None", a 2.0.2 é a
  última publicada e o range vulnerável é `<=2.0.2`. Chega via metro, que é
  bundler e não vai para o bundle do app; risco aceito e datado para 01/11/2026.
- **Audit tornado bloqueante** (#426), possível só depois da allowlist: antes,
  bloquear significaria travar merge para sempre.

### A 1.12.3 saiu de um teste no aparelho, não de um relatório

Depois de publicar a 3026, o app foi percorrido num moto g15 com a versão
instalada **pela Play** — não sideload. Cinco coisas foram levantadas; **três
eram defeitos** e viraram o PR #439.

O mais caro era o avatar exibindo `G(`. A regra de iniciais estava **duplicada**
em `Avatar` e `AvatarEditable`, byte a byte, e as duas cópias pegavam a primeira
letra da última palavra sem descartar pontuação. Como os nomes de demonstração
terminam em `(Avaliacao)`, a última palavra era `(Avaliacao)`. Com nome comum o
defeito some — o que significa que ele aparecia **exatamente na conta que o
revisor da Play usa**. Virou `src/lib/initials.ts`, que trata sufixo entre
parênteses como anotação e não como sobrenome.

Os outros dois: "1 motorista **cadastrados**" (o substantivo era pluralizado, o
particípio não) e marcadores do mapa nascendo atrás da coluna de botões
flutuantes. Este último tinha causa mais interessante do que "sobreposição":
existiam **dois** `fitBounds` — um na carga, outro no botão "ajustar" — cada um
com o padding escrito à mão, e ambos com `right: 50`, menor que a coluna. O
teste que existia afirmava apenas que `fitBounds` **fora chamado**, nunca o
argumento; por isso os valores puderam divergir do tamanho real do botão sem
ninguém ver. O novo padding sai dos mesmos tokens que dimensionam os FABs, e o
teste afirma a relação. Foi verificado quebrando: falha com 50, passa com 88.

No caminho, o `mockTheme` do Jest revelou-se incompleto — tinha só os apelidos
de `spacing` (`xs`…`xl`) enquanto o código usa a escala numérica —, então
asserções sobre tamanho liam `undefined` e passavam por acidente. A escala foi
adicionada; as 335 suítes seguiram verdes.

**Dois dos cinco itens não eram defeitos, e conferir isso valeu mais do que
"corrigir".** O terceiro card do dashboard aparece cortado porque é um
`ScrollView horizontal` deliberado, com `accessibilityHint="Deslize para ver mais
estatísticas"` — o corte é a dica. E o teclado no login: a leitura inicial foi
"compensação dupla entre `adjustResize` e `KeyboardAvoidingView`", e o dump da
janela desmentiu — `EDGE_TO_EDGE_ENFORCED` com `frame=[0,0][1080,2400]`
inalterado de teclado aberto. Sem encolhimento, não há duplicação: o
`KeyboardAvoidingView` é a **única** coisa tratando o teclado, e removê-lo —
que era a correção pretendida — deixaria o campo em foco atrás dele. Virou
armadilha no documento de entrada.

Duas lições operacionais ficaram. A primeira: **atualizar pela Play preserva a
sessão**, enquanto `adb install` exige desinstalar (assinaturas divergem) e
derruba o login — além de testar um binário que não é o que o testador recebe.
A segunda: **trocar só o `versionName` custa um versionCode**. A 3027 já tinha
subido como 1.12.2 quando se decidiu por 1.12.3, e um versionCode enviado não
aceita metadados novos; foi preciso a 3028, idêntica exceto pelo rótulo.

## Estado confirmado em 31/08/2026

A sessão começou como "analise os PRs abertos" — seis do Dependabot — e terminou
com o v1.12.5 nas trilhas interna e fechada. O que puxou a linha foi olhar a
tela do aparelho.

### O que o verde dos PRs escondia

Seis PRs do Dependabot, cinco verdes e um vermelho. O vermelho (#450,
`@sentry/browser` 10.70→10.71) estourava o limite de bundle em 344 KB — mas não
por crescimento do Sentry: subir **só** o `browser`, com `@sentry/react` parado
em 10.70, fazia o npm instalar uma segunda cópia de `@sentry/core` aninhada. O
#452, que subia o `react`, resolvia os dois para 10.71 numa cópia só e ficava em
3,33 MB. Mergeado o #452, o Dependabot fechou o #450 sozinho: _"Looks like
@sentry/browser is up-to-date now"_.

Mais grave que o vermelho: **os testes de mapa não rodam em PR do Dependabot.**
O step sai com `exit 0` e um warning quando faltam os `E2E_*`, e o store de
secrets do Dependabot está **vazio** (`gh secret list --app dependabot` não
retorna nada) — os secrets do repositório não valem para ele. Confirmado no log
do #453, justamente o bump do `maplibre-gl`. O `Visual Regression` verde ali não
significava mapa testado. Em PR de branch do próprio repositório os secrets
existem e o teste roda; a distinção é essa, e eu a errei uma vez nesta mesma
sessão antes de conferir.

Achado de contabilidade: a `main` tinha `package.json` em 1.12.4 e
`package-lock.json` em **1.12.2**. O commit de release `3630980` editou só o
primeiro. Os PRs do Dependabot corrigiram de carona.

### O mapa do motorista estava marcado, e nenhum check via

Instalado o APK de validação e aberta a tela, o mapa aparecia com **"API KEY
REQUIRED / carto.com/basemaps/apikey"** atravessado. Reproduzido fora do app:
`curl` no tile `12/1580/2100` devolve **200 com um PNG de 5095 bytes que É a
marca d'água**. Mudança de política da Carto, não regressão do código.

A causa de ninguém ver: **web e nativo usavam fontes diferentes** — o web já
estava em OpenFreeMap, o nativo seguia na Carto — e essa assimetria não estava
escrita em lugar nenhum. Como o e2e de mapa roda só a build web, o lado quebrado
nunca foi exercitado. E o e2e parava no evento `load`, que dispara mesmo com
tile falhando.

Eram **seis** componentes nativos, não os dois que a primeira leitura sugeriu.
Unificado em `src/lib/maplibre.ts` como fonte única (#454). Descartada chave da
Carto: viajaria no bundle, de onde é extraível.

### O replay que reprovou o pedido literal

A rota demo estava `em_andamento` havia 23 dias sem expirar. Causa:
`expire_old_pending_routes` filtrava `status = 'pendente'` e nada mais — rota
iniciada e abandonada era **imortal**. Em todo o schema `public`, só duas
funções mencionam `nao_executada`, e nenhuma alcançava `em_andamento`.

O pedido foi "expira junto com as pendentes". **O replay contra o histórico real
reprovou:** 67 das 604 rotas concluídas (**11%**) foram fechadas depois das
22:00 da própria data — teriam sido marcadas "não executada" com o motorista
ainda entregando, o incidente de 27/08 em escala 33×. Rota em andamento não é
rota esquecida: das 67, só 1 fechou antes da meia-noite e 47 fecharam no dia
seguinte; mediana 10,1h após as 22:00.

Falsos positivos por carência, sobre 604 rotas: 0 dias → 67; 1 dia → 19; 2 dias
→ 19; 3 dias → 4; **7 dias → 2**; 14 dias → 0. Escolhido 7 (#455).

A lacuna era **latente, não ativa**: das 641 rotas da base, exatamente uma
estava `em_andamento` — a demo, semeada nesse estado (`created_at` =
`updated_at`).

### Uma sonda que se enganou sozinha

O #456 fez o lembrete acompanhar a expiração — sem ele a rota passaria a expirar
**sem nunca ter recebido aviso**. Como `remind_pending_routes` não tem
`p_dry_run`, a verificação foi sonda transacional desfeita por
`RAISE EXCEPTION`.

**A primeira sonda mentiu.** Ela capturava a notificação com
`ORDER BY created_at DESC LIMIT 1`. Dentro de uma transação o `now()` é
**fixo**, então as duas inserções compartilham o mesmo `created_at` e a
ordenação não as distingue: o bloco "normal" exibiu o texto do "final", e o ramo
das 16:00 ficou **sem verificação nenhuma parecendo verificado**. A v2 identifica
por `id`. Em sonda transacional, nunca ordene por tempo.

Horas depois, o lembrete disparou em produção pela primeira vez — texto da
variante das 16:00 chegando no horário do slot das 20:00. Não era bug: o
histórico do workflow mostra que rodou o job das 16:00, com os das 20:00 e 22:00
pulados. O evento das 19:00 UTC foi entregue às 23:06 UTC, **4h06 atrasado** — o
mesmo comportamento que a migration de 27/08 documenta.

### O tipo mentia, e o typecheck não podia reclamar

`StatusRota` declarava 4 valores; o CHECK `rotas_status_check` aceita **5**.
Faltava `nao_executada`, que o banco já tinha em 17 linhas. O typecheck nunca
acusou porque os componentes tipavam `status?: string` — com a union alargada
para `string`, a ausência ficou invisível.

A consequência real: `validStatusRota` repetia a lista de 4, então
`isStatusRota('nao_executada')` era `false` e `isRota()` **rejeitaria toda rota
expirada**. Mina, não incêndio — nenhuma das guardas é consumida em produção
hoje, só em teste.

Corrigido o tipo (#457) e a causa: a lista virou `Record<StatusRota, true>`, em
que esquecer um valor é erro de compilação. Depois os consumidores foram
apertados de `string` para `StatusRota` (#458), incluindo o `Rota` local de
`mapa-rota/types.ts`, que era a origem do alargamento. As defesas de runtime
ficaram: o tipo é afirmação sobre o que o Supabase devolve, não garantia —
`queries/rotas.ts` faz `as StatusRota` sobre string crua do Postgres.

Descoberto no caminho: os testes **não são type-checkados** — `**/__tests__` e
`**/*.test.tsx` estão na lista de `exclude` do `tsconfig`. Por isso os que
passam string inválida de propósito seguem compilando.

### Duas ferramentas que envelheceram, e um erro meu de 30 minutos

O `eas-cli` global estava em 22.6.0 com a 23.1.0 publicada — **uma major atrás
em 4 dias**. O modo de falha é o registrado: "Build request failed" **depois** de
subir 85 MB, com mensagem que não aponta para o CLI. Rodado por
`npx eas-cli@latest` e depois atualizado o global.

O erro foi meu: lancei o primeiro build como `... --wait 2>&1 | tail -40`. O
`tail` segura o stream inteiro até o fim, então o arquivo de saída ficou vazio,
o monitor não teve o que casar, e eu fiquei cego por **30 minutos** — até o
`build:list` mostrar que **nenhum build havia sido criado**. O silêncio não era
o build correndo bem; era eu tendo tapado a única janela que tinha.

### v1.12.5, e o rollout que o doc pedia sem ferramenta

Release v1.12.5 / versionCode 3030, conferido no Play Console **antes** de
incrementar. Desta vez `npm version patch --no-git-tag-version` sincronizou
`package.json` e `package-lock.json` — a defasagem do 1.12.4 veio de editar o
`package.json` à mão.

Submetido à trilha interna e promovido à fechada, ambas em 3030. Produção segue
vazia por decisão: o requisito de testadores não está cumprido, e o
`play-promote.mjs` fixava `status: 'completed'` — 100% de imediato, contra a
seção "Rollout recomendado" do próprio doc. Quem seguisse o doc **não tinha
ferramenta**. Corrigido no #461, com `--rollout=N`, `--dry-run` e 8 testes sobre
`montarRelease` — a primeira coisa em `scripts/` coberta por teste.

`--rollout=100` é recusado de propósito: rollout encerrado e rollout em curso a
100% são estados diferentes na Play.

### O que a cobertura de mapa fecha, e o que não

O #462 fechou a parte determinística: teste estático sobre os 8 componentes
(quebra se um lado embutir outro provedor, verificado reproduzindo o bug
histórico) e o e2e passou a exigir tile de dados buscado, sem resposta `>= 400`,
só do provedor esperado.

A prova de que o `load` não bastava veio de quebrar: apontando a constante para
outro provedor, **o mapa carregou normalmente e todas as asserções antigas
passaram** — só a nova pegou.

**Não fechado, e escrito na pendência 8 em vez de riscado:** mapa nativo em CI
exigiria emulador Android + app compilado (~25 min por execução); e tile com
marca d'água chega como **200 com PNG válido**, indistinguível de tile bom sem
análise de imagem. Se a fonte atual degradar igual à Carto, estes testes seguem
verdes.

## Frentes fechadas, por data

> Vieram do `PROJECT_CONTEXT` em 25/08/2026: eram **86 linhas** lidas em toda
> sessão para responder "isso já foi resolvido?", que é pergunta rara. O texto
> é o que estava lá, salvo o episódio do Sentry — já detalhado neste arquivo,
> com a tabela de medição, e por isso descartado em vez de duplicado.
>
> **Consulte antes de reabrir uma frente.** O que virou regra durável está nas
> Armadilhas do `PROJECT_CONTEXT`, não aqui.

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

A varredura por **telas com precondição forte** foi feita em 15/08 e o resultado
está em "Guardas de precondição", hoje em [HISTORICO.md](HISTORICO.md): o projeto está bem coberto, e o único
beco aberto que ela encontrou (Nova Rota sem sede) foi fechado no PR #385.

**Fechadas em 25/08/2026, não reabra:** a **1.12.3 está publicada** em teste
interno e fechado, validada no aparelho. Fecha o cadastro morto no Android
(#436) e três defeitos achados testando o próprio build num moto g15 (#439):
avatar exibindo `G(`, "1 motorista **cadastrados**" e marcadores do mapa atrás
da coluna de botões. Os dois primeiros só aparecem com parênteses no nome — ou
seja, **na conta que o revisor da Play usa**.

Dois itens da mesma bateria **não eram defeitos**: o terceiro card do dashboard
sai cortado porque é `ScrollView horizontal` deliberado, e o teclado no login é
consequência do edge-to-edge (virou armadilha). Não os "conserte".

**Para testar no aparelho, atualize pela Play, não por `adb install`:** preserva
a sessão (o sideload exige desinstalar, porque a assinatura diverge) e exercita
o binário que o testador realmente recebe. O relato completo está em
[HISTORICO.md](HISTORICO.md).

## Validações e varreduras registradas

Fluxos conferidos com dado real, não só por teste. Cada um diz o que foi medido
e onde, para não ser refeito por dúvida.

> **Movido do `PROJECT_CONTEXT` em 17/08/2026.** Estas 201 linhas viviam no
> documento de entrada e eram lidas em **toda** sessão, para servir a consultas
> que só importam quando alguém vai mexer naquele fluxo específico. O conteúdo
> está preservado sem alteração, e o `PROJECT_CONTEXT` aponta para cá pelo Mapa
> da documentação. O que envelhece aqui são os números, não o método.

### Onboarding self-service — completo em 15/08/2026

Percorrido de ponta a ponta com conta e dados reais, do cadastro à rota criada.
Fecha a pendência 6, que nenhum teste automatizado cobre — nenhum toca o banco.

| Passo                 | O que foi conferido                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1–3 Cadastro → portão | conta em `auth.users` **sem** linha em `usuarios`, `nome` íntegro no metadata, login caindo em `/onboarding/criar-unidade`                                         |
| 4 Criar unidade       | RPC gravou as três linhas atomicamente: `origem='self_service'`, `status='trial'`, coordenadas não nulas, gestor com `is_gestor_principal`, vínculo `is_principal` |
| 5 Cadastrar motorista | `papel='motorista'`, ativo, **`primeira_senha=true`** — o motorista troca a senha no 1º acesso                                                                     |
| 6 Criar rota          | `status='pendente'`, geometria viária real, notificação `nova_rota_atribuida` entregue                                                                             |

A auditoria de otimização registrou **18,23 km → 15,92 km** com carimbo em
`otimizada_em`. As 4 paradas nasceram na ordem 0–3, com a sede como partida e
chegada (`is_checkpoint=false`) e as duas entregas como checkpoints.

**Um limite do assistente que reaparece a cada validação:** o passo 5 cria conta
de acesso e pede senha inicial, então é o gestor quem faz. O login também. Todo o
resto do fluxo o assistente percorre sozinho.

Os dados de teste foram **removidos ao final** — banco de volta a 9 unidades, 16
contas, zero órfãs e `self_service = 0`. A ordem importou: `usuarios.unidade_id`
é `SET NULL`, então apagar a unidade primeiro deixaria os perfis vivos e sem
unidade — estado pior que conta órfã, porque nem o portão do onboarding recolhe.
Apague as contas de auth primeiro (cascateiam os perfis), a unidade depois.

### Emails do Auth — fluxo de cadastro validado em 17/08/2026

Medido com email real, do cadastro até o banco. Cadastro às 13:33:31,
`confirmation_sent_at` no mesmo segundo, `email_confirmed_at` às **13:35:41** —
os dois minutos de intervalo são a prova de que o OTP **sobreviveu ao trânsito e
à caixa de entrada** e só foi consumido no clique. Testado pelo caminho que
estava quebrado: **copiar e colar o link alternativo**, não clicar no botão.

Infraestrutura de envio conferida no mesmo dia, e está correta:

| Item                | Estado                                                                 |
| ------------------- | ---------------------------------------------------------------------- |
| SMTP                | próprio, `no-reply@rotamestre.tec.br` via `mail.rotamestre.tec.br:587` |
| Rate limit de email | **200/h** (não é o limite apertado do serviço embutido)                |
| SPF                 | `v=spf1 mx a ip4:72.60.148.143 ~all` — cobre o IP que envia            |
| DKIM                | selector `mail`, RSA/SHA-256                                           |
| DMARC               | `p=quarantine` com `rua`/`ruf` — não é `p=none` decorativo             |
| PTR                 | resolve para `mail.rotamestre.tec.br`, com FCrDNS completo             |
| Confirm email       | **ligado** — o template de cadastro realmente dispara                  |
| `otp_expiry`        | 3600s, batendo com o "expira em 1 hora" escrito nos templates          |

A validação revelou uma coisa que não é defeito do trabalho e continua valendo:
depois de confirmar, o usuário **cai no login** em vez de entrar direto — é o
`detectSessionInUrl: false` de `src/lib/supabase.web.ts`, comportamento
pré-existente e ligado à mecânica de `sessionRecovery.ts`.

Revelou também que **não havia como reenviar** um link de cadastro expirado.
Isso foi resolvido no mesmo dia (PR #398): o login, ao recusar com
`AUTH_EMAIL_NOT_CONFIRMED`, agora oferece **"Reenviar email"**. Validado com
conta real — `confirmation_sent_at` avançou 64s em relação ao `created_at`,
provando que o segundo email saiu.

### Reenvio da confirmação — onde vive e por quê

O botão fica **no login**, não em tela própria, porque é o único ponto onde
sabemos o email (a pessoa acabou de digitar), sabemos que a conta existe sem
confirmação (o Supabase acabou de dizer) e a pessoa está travada. Isso dispensa
a anti-enumeração do `forgot-password`: lá o cuidado existe porque um estranho
pode sondar endereços; aqui o estado da conta já foi revelado a quem acertou a
senha. **Uma tela pública com campo de email reintroduziria o problema** sem
resolver nada a mais — se alguém propuser isso, é este o motivo de não fazer.

`authService.resendConfirmation` não passa `emailRedirectTo` (igual ao `signUp`),
então o email reenviado usa o template **Confirm signup**, que já carrega a
proteção anti link-scanner. Quatro desfechos são tratados em separado, e o
segundo é o que engana: **429 do Supabase não é falha** — o email saiu, e tratar
como erro faria a pessoa tentar de novo à toa. Os outros: limite local (não
chega a chamar o Supabase), conta confirmada no meio-tempo (o cenário do scanner
que abre o link) e falha de SMTP.

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

### Massa demo criada por SQL em 08/08/2026

A Unidade Demo (`aaaa0000-0000-4000-8000-000000000001`) tem 4 rotas inseridas
**direto por SQL**, fora do fluxo do app, para servirem de cenário nos
screenshots da loja. UUIDs fixos e reconhecíveis:

| id (sufixo) | data  | status       | conteúdo                             |
| ----------- | ----- | ------------ | ------------------------------------ |
| `…020`      | 08/08 | em_andamento | 3 entregas: 1 concluída, 2 pendentes |
| `…021`      | 07/08 | concluída    | 3 entregas, todas concluídas         |
| `…022`      | 06/08 | concluída    | 3 entregas, todas concluídas         |
| `…023`      | 05/08 | concluída    | 3 entregas, todas concluídas         |

Endereços reais de João Pessoa, destinatários fictícios, distância e duração
coerentes com o trajeto. Respeitam o invariante de partida/chegada
(`is_checkpoint = false` na primeira e na última ordem).

**Limitação conhecida:** as paradas concluídas **não têm `foto_url`**, então a
tela mostra o placeholder "Sem foto registrada". Preencher exigiria upload real
ao bucket privado `fotos-entrega`, que só acontece pelo app com sessão
autenticada — não dá por SQL.

Para remover: `delete from public.rotas where id in (…020, …021, …022, …023)`
(as paradas caem por cascade). Não confunda com dado de cliente: nada disso
existe fora da unidade de avaliação.

### Política de senha — o que o plano free permite

Verificado na doc oficial em 15/08/2026
([Password security](https://supabase.com/docs/guides/auth/password-security)):
a rejeição de senha vazada via HaveIBeenPwned é **Pro ou acima**. O advisor
`auth_leaked_password_protection` aponta o problema sem dizer isso, e o registro
inicial desta sessão descreveu o item como "um toggle no dashboard" — **estava
errado**, corrigido antes de entrar na `main`.

No plano free dá para endurecer, em Auth → Providers → Email:

- comprimento mínimo (nada abaixo de 8);
- caracteres exigidos — dígitos, minúsculas, maiúsculas e símbolos.

Vale conferir o que está configurado no servidor: o app já exige 8 caracteres
com maiúscula, número e especial em `src/lib/schemas/auth.ts`, mas isso é
validação de **cliente** e não protege quem chama a API direto.

Se um dia endurecerem a política: usuários existentes continuam entrando com a
senha atual, porém recebem `WeakPasswordError` no `signInWithPassword`. Hoje
esse erro cairia no `getErrorMessage` genérico — trate antes de mexer, ou a
pessoa recebe uma mensagem que não explica nada.

### Contas órfãs zeradas em 15/08/2026

O indicador de saúde
(`select au.email from auth.users au left join public.usuarios u on u.id = au.id where u.id is null;`)
retornava **9 linhas** — resíduo do `signUp` em dois passos, que criava a conta
no Auth e falhava no insert em `usuarios`. Todas foram excluídas a pedido do
gestor, depois de conferido que nenhuma tinha rota, vínculo de unidade ou
registro em `admin_logs`, e que nenhuma havia se recadastrado com sucesso.
Hoje `auth.users` e `public.usuarios` batem: **16 para 16**, zero órfãs e zero
usuários sem conta de auth. (Foram 17/17 logo após a limpeza; as contas usadas
para validar o onboarding entraram e saíram no mesmo dia — ver "Validações
registradas".)

Seis eram **pessoas reais**, presas desde março de 2026 — uma delas voltou em
abril, autenticou e não conseguiu usar o app, porque o perfil nunca existiu. A
lista nominal foi entregue ao gestor **fora do repositório** (a seção "Segurança
documental" proíbe registrá-la aqui) para eventual convite de volta; os e-mails
ficaram livres para cadastro novo.

Antes de apagar, vale saber: `admin_logs.admin_id` referencia `auth.users` com
`NO ACTION` e **bloquearia** o delete se houvesse linha; todo o resto cascateia.
A consulta de FKs pelo `information_schema` volta **vazia** por privilégio e
levaria a concluir que não existe FK nenhuma — use `pg_constraint`, que mostra
as 10 reais.

### Guardas de precondição — varredura de 15/08/2026

Duas telas quebraram no mesmo padrão em 15/08: **assumir um estado sem verificar
se ele ainda vale**. Nova Rota assumia "existe motorista" (PR #381) e
criar-unidade assumia "não existe perfil" (PR #383). A varredura das demais
mostrou que o resto está coberto:

| Onde                                           | Precondição                            | Como é garantida                                        |
| ---------------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| `gestor/`, `motorista/`, `perfil/`, `unidade/` | autenticado + papel + `primeira_senha` | `useRequireAuth` no `_layout` de cada grupo             |
| `onboarding/first-password`                    | `primeira_senha === true`              | checa e redireciona ao destino certo                    |
| `onboarding/criar-unidade`                     | sessão **sem** perfil                  | checa e devolve ao portão `/` (PR #383)                 |
| `unidade/transferir`                           | é gestor principal                     | renderiza tela explicativa no lugar do formulário       |
| `auth/*`                                       | não autenticado                        | **não verifica** — nada trava e reautenticar é legítimo |

**`useRequireAuth` ignora de propósito os grupos `auth` e `onboarding`**
(`src/hooks/useRequireAuth.ts:46`) — é por isso que as telas de onboarding
precisam da própria checagem, e foi essa exceção que deixou o criar-unidade
aberto por meses.

O único beco que a varredura encontrou foi a Nova Rota **sem sede geocodificada**
(PR #385): o cartão de partida sumia sem explicação e o erro só aparecia no
submit, num toast de 5 segundos, dizendo "sede geocodificada" — jargão que não
indica ação. Hoje o aviso é fixo, em português direto, e leva a Minha Unidade.

Ao criar uma tela com precondição forte, a pergunta é sempre a mesma: **o que
acontece com quem chega aqui por URL, ou com a precondição já quebrada?**

### O episódio do Sentry: um diagnóstico errado corrigido pela medição

Cinco PRs do Dependabot chegaram em 17/08. Dois foram mergeados sem história
(#393, #394) e um foi fechado (#391) porque sobe `@react-native/jest-preset` para
0.87 enquanto o projeto está em react-native 0.85.3, fixado pelo Expo 56 — o
preset novo procura `react-native/setup-env`, que não existe nessa versão, e a
suíte inteira morre com `Could not locate module`.

Os dois do Sentry (#392 `@sentry/react`, #395 `@sentry/browser`) renderam a
lição.

**O erro.** O #395 sozinho estourava o limite de bundle em 338 kB. Eu li isso
como crescimento real da biblioteca — "+338 kB gzipped num bump minor é muito" —
e recomendei subir o teto de 3.5 MB para 4 MB, o que virou o PR #403. **Não abri
o `package-lock` antes de recomendar.**

**A causa real.** `@sentry/react@10.69.0` depende de `@sentry/browser` em versão
**exata**, não em range. Subir só o browser faz o npm aninhar uma segunda cópia
do Sentry inteiro dentro do react. O lock do #395 mostrava isso à vista:
`+147/-19` linhas, adicionando
`@sentry/react/node_modules/@sentry/{browser,replay,replay-canvas,feedback}` e
várias cópias de `@sentry/core`. O #392 sozinho tinha `+35/-35` e **zero**
aninhamento. Os 338 kB nunca foram o custo da versão: eram o custo de mergear
separado.

**A medição que fechou.** Com os dois em 10.70, o CI reportou **3.33 MB** —
abaixo até do teto original de 3.5 MB:

| Estado                                    | Bundle      |
| ----------------------------------------- | ----------- |
| #395 sozinho (browser 10.70, react 10.69) | 3.84 MB     |
| ambos em 10.70                            | **3.33 MB** |

O limite voltou a 3.5 MB no PR #407, junto com o alinhamento do `package.json`
(`@sentry/browser: ^10.70.0`) e a regeneração do lock.

**O desfecho.** Nem foi preciso mergear os dois: o merge do #392 já levou o
`browser` a 10.70 no lock, porque o `react` novo o exige, e o Dependabot fechou o
#395 sozinho — _"Looks like @sentry/browser is up-to-date now"_.

**O bot estava travado por labels.** O `@dependabot rebase` ficou horas sem
resposta. Ele havia reclamado às 12:10 que as labels `dependencies` e `npm` não
existiam no repositório; criadas por volta das 18h, rebaseou os dois PRs em
minutos. A reclamação falava em _aplicar labels_, não em rebasear — a conexão só
apareceu ao testar.

Três coisas para levar adiante:

- **Pacotes do mesmo scope que se fixam por versão exata precisam subir juntos.**
  A regra de dependência acoplada já estava registrada desde 04/08, mas só como
  recomendação; agora tem o mecanismo e o número.
- **Um número anômalo merece a apuração antes da decisão.** "+338 kB num bump
  minor" era estranho o bastante para abrir o lock, e a resposta estava no
  primeiro `grep`.
- **Se o Dependabot ignorar comandos, confira as labels que ele pede.**

## Mudanças relevantes desta etapa

| Data       | Mudança                                                                                        | Referência                                   |
| ---------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 23/07/2026 | Nova Entrega com rascunho persistente, importação, revisão e criação atômica/idempotente       | commit `e1f1bd5`, migration `20260723223000` |
| 23/07/2026 | Migration de segurança já aplicada foi incorporada ao histórico versionado                     | commit `de8a036`, migration `20260722195606` |
| 24/07/2026 | Correção da autenticação Android após rotação de chave                                         | commit `6dd8aa8`                             |
| 24/07/2026 | Preparação do app e da ficha para o Google Play, páginas legais e exclusão de conta            | commit `b7a39dc`                             |
| 24/07/2026 | Geometria viária persistida nos mapas; remoção dos fallbacks visuais em linha reta             | commit `3788f55`                             |
| 24/07/2026 | Configuração inicial de distribuição e conformidade iOS                                        | commit `191db5a`                             |
| 04/08/2026 | Integração de 5 PRs: `/testar`, maplibre 6, Sentry, deps e Node 22 (baseline/CI)               | PRs #341/#345/#343/#342/#344                 |
| 04/08/2026 | Correção do worker do maplibre 6 (mapa web travado em "Carregando...")                         | PR #346                                      |
| 04/08/2026 | Correções do autocomplete de endereço: interação após limpar e resposta obsoleta               | PRs #347 e #348                              |
| 05/08/2026 | Auditoria de uso do otimizador, Fase 1 (registrar): colunas, RPC de 11 params, Timeline        | PR #350, migration `20260804235500`          |
| 05/08/2026 | Histórico de migrations reconciliado + `IF NOT EXISTS` no arquivo que travava o `db push`      | PR #351                                      |
| 06/08/2026 | Onboarding self-service: RPC de criação de unidade + portão no `index.tsx` e no `login.tsx`    | PR #354, migration `20260806175617`          |
| 07/08/2026 | Credenciais hardcoded removidas do repositório público                                         | PR #353                                      |
| 07/08/2026 | Tela "Minha Unidade" passa a salvar via RPC `atualizar_unidade`                                | PR #355, migration `20260807151639`          |
| 07/08/2026 | Acentuação dos rótulos da tela de rota                                                         | PR #356                                      |
| 08/08/2026 | Formulário de unidade: 7 defeitos + a causa raiz que impedia salvar a sede                     | PR #357                                      |
| 08/08/2026 | OSRM real no dev web (`src/lib/osrm/config.ts`), constante de URL unificada                    | PR #358                                      |
| 08/08/2026 | Erro de endereço que não sumia após selecionar a sugestão (nova-entrega + onboarding)          | PR #359                                      |
| 08/08/2026 | `androidVersionCode` 3024 → 3025; build EAS e publicação em teste fechado + interno            | PR #360, build `d34a88d6`                    |
| 15/08/2026 | Fallback Haversine do OSRM sinalizado (`is_estimated`) + guarda de rota com distância zero     | PR #371                                      |
| 15/08/2026 | Remontagens invisíveis (componente no render) + dashboard não desmonta na troca de filtro      | PR #372                                      |
| 15/08/2026 | `ErrorBoundary` nas 5 telas de auth                                                            | PR #373                                      |
| 15/08/2026 | `ErrorBoundary` nas 5 rotas públicas restantes — cobertura de `app/` fechada                   | PR #374                                      |
| 15/08/2026 | Decimal com vírgula em 32 pontos de exibição, via `formatarDecimal`                            | PR #375                                      |
| 15/08/2026 | Equipe: ativar/desativar membro não pisca mais a tela inteira                                  | PR #376                                      |
| 15/08/2026 | Lote do Dependabot: maplibre 6.3.0, supabase-js 2.112.3, web-vitals 6.1.0 e dev deps           | PRs #367/#369/#370/#368                      |
| 15/08/2026 | Onboarding: nome pré-preenchido do cadastro + cidade/UF derivadas do endereço da sede          | PR #378                                      |
| 15/08/2026 | Validação manual do onboarding até o passo 4 registrada, com os 7 achados                      | PR #379                                      |
| 15/08/2026 | Bugs da validação: PGRST116 fora do Sentry, saída sem motorista, endereço sem duplicar         | PR #381 (o #380 subiu junto e foi fechado)   |
| 15/08/2026 | Onboarding devolve ao portão quem já tem perfil, em vez de abrir um formulário condenado       | PR #383                                      |
| 15/08/2026 | Nova Rota avisa e leva a Minha Unidade quando a unidade não tem sede geocodificada             | PR #385                                      |
| 15/08/2026 | `admin_logs` perde a FK para `auth.users`: auditoria sobrevive à exclusão da conta             | PR #386, migration `20260815200000`          |
| 15/08/2026 | Auditoria de usuários volta a gravar (coluna inexistente no insert) + decimal do dashboard     | PR #387                                      |
| 17/08/2026 | Templates de email do Auth: 5 defeitos corrigidos e versionados em `supabase/templates/`       | PR #390                                      |
| 17/08/2026 | Proteção anti link-scanner estendida ao cadastro; lógica e layout extraídos do confirm-reset   | PR #396                                      |
| 17/08/2026 | Reenvio da confirmação de cadastro a partir do login, com rate limiter próprio                 | PR #398                                      |
| 17/08/2026 | Template do Magic Link removido do repo — nunca é enviado (o app não usa `signInWithOtp`)      | PR #400                                      |
| 17/08/2026 | Consolidação: 201 linhas saem do documento de entrada; contexto por sessão cai 863 → 672       | PR #402                                      |
| 17/08/2026 | Dependabot triado: 2 mergeados, #391 fechado (jest-preset 0.87 × RN 0.85.3)                    | PRs #393/#394/#404                           |
| 17/08/2026 | Permissão do gestor sai do `settings.json` versionado; árvore de trabalho fica limpa           | PR #405                                      |
| 17/08/2026 | Sentry 10.70; bundle 3.84 → 3.33 MB ao alinhar versões; limite volta a 3.5 MB                  | PRs #392/#403/#406/#407                      |
| 25/08/2026 | Cadastro pelo Android abria tela vazia havia nove meses (`ResponsiveContainer` × `ScrollView`) | PR #436                                      |
| 25/08/2026 | Iniciais do avatar (`G(`), concordância de plural e enquadramento do mapa fora dos FABs        | PR #439                                      |
| 25/08/2026 | 1.12.3 publicada em teste interno e fechado, validada no aparelho pela Play                    | PRs #438/#440/#441                           |

O histórico completo do rebuild está em
[REBUILD_RELAUNCH_PLAN.md](REBUILD_RELAUNCH_PLAN.md), agora tratado como
registro de decisão e rollout — não como checklist inicial ainda não executado.

## Cortes do PROJECT_CONTEXT.md

O contrato de tamanho do [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) cita esta
cronologia, que mora aqui por ser histórico. Em linhas:

| Data  | Corte   | O que saiu                                                                  |
| ----- | ------- | --------------------------------------------------------------------------- |
| 15/08 | 923→633 | histórico e snapshots datados (vieram para cá)                              |
| 17/08 | 736→534 | validações e varreduras (vieram para cá)                                    |
| 25/08 | 612→508 | a narrativa das armadilhas, mantendo só a regra                             |
| 25/08 | 563→491 | as listas "Fechadas em ...", que respondiam a pergunta rara                 |
| 27/08 | 495→…   | duplicação com o `CLAUDE.md` e entre as próprias seções Armadilhas e Regras |

O padrão que a série mostra: o arquivo **volta a crescer entre um corte e o
seguinte**, sempre por acréscimo legítimo. O corte de 27/08 foi o primeiro por
**duplicação** em vez de excesso — quatro fatos apareciam duas vezes dentro do
próprio arquivo, e outros seis também estavam no `CLAUDE.md`, que é lido na
mesma sessão.
