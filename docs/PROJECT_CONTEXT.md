# Contexto operacional — Rota Mestre App

> Documento de entrada para novas sessões. Atualizado em 17/08/2026.
> Consulte o código ou o serviço responsável antes de alterar um estado externo.
>
> **O que este documento é:** estado atual, pendências, armadilhas e validações
> feitas. **O que ele não é:** histórico (está em [HISTORICO.md](HISTORICO.md)),
> arquitetura e padrões de código (em [`../CLAUDE.md`](../CLAUDE.md)), versões
> (no `package.json`) nem estado de schema (`npx supabase migration list`).
> Duplicar qualquer um deles aqui é como este arquivo já ficou desatualizado.
>
> **Para começar rápido:** leia Pendências → Armadilhas → Estado atual. Bastam
> para agir; o resto é referência sob demanda.

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
| 7   | **Proteção contra senha vazada: exige plano Pro, não dá para ligar hoje.** O advisor aponta `auth_leaked_password_protection`, mas a checagem contra o HaveIBeenPwned é **Pro ou acima** — a assinatura é por organização, não por projeto. **Não é um toggle**, é upgrade de plano. O que o free permite e vale conferir: comprimento mínimo e caracteres exigidos, em Auth → Providers → Email.                                                                        | gestor (decisão de plano; ou ajuste no Email)  | "Política de senha" abaixo                             |

**Fechadas em 08/08/2026, não reabra:** a Migration 22 foi aplicada em
07/08 e validada na tela (edição gravou no banco; `.update()` direto continua
falhando); o **primeiro build EAS sob Node 22** aconteceu — build `3025`,
que resolveu o Node pelo `.nvmrc` e passou sem ajuste; os assets da loja foram
resolvidos — `final/` versionado, `raw/` no `.gitignore`, e os 8 screenshots
mais o feature graphic v2 refeitos e commitados com a listagem já publicada.

**Fechadas em 15/08/2026, não reabra:** o decimal com ponto (`18.1 km` num app
pt-BR) foi centralizado em `formatarDecimal` e migrado em 32 pontos de exibição
(PR #375); **toda rota sob `app/` tem ErrorBoundary** (PRs #373 e #374); as
**contas órfãs em `auth.users` foram zeradas** (ver seção própria abaixo); no
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
corrigidos e passaram a ser versionados em `supabase/templates/` (PR #390) — cinco
defeitos reais, sendo o pior o link alternativo do reset, que mandava para "Link
inválido" quem copiava e colava. A proteção anti link-scanner foi **estendida ao
cadastro** (PR #396), com a lógica extraída de `confirm-reset.tsx` para
`src/lib/auth/confirmationLink.ts` + `src/components/auth/ConfirmLinkScreen.tsx`.
Os templates **já foram colados no painel** e o fluxo de cadastro foi validado
com email real (seção abaixo). O que cada defeito era e por que quebrava está em
[HISTORICO.md](HISTORICO.md); as invariantes que não podem regredir, nas
armadilhas.

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
está em "Guardas de precondição" abaixo: o projeto está bem coberto, e o único
beco aberto que ela encontrou (Nova Rota sem sede) foi fechado no PR #385.

## Validações registradas

Fluxos conferidos com dado real, não só por teste. Cada um diz o que foi medido
e onde, para não ser refeito por dúvida.

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

Duas coisas que a validação revelou e não são defeito do trabalho: depois de
confirmar, o usuário **cai no login** em vez de entrar direto — é o
`detectSessionInUrl: false` de `src/lib/supabase.web.ts`, comportamento
pré-existente e ligado à mecânica de `sessionRecovery.ts`; e **não existe
`auth.resend`** no app, então um link de cadastro genuinamente expirado não tem
como ser reenviado (a tela manda ao login, que costuma funcionar porque a conta
acaba confirmada de qualquer forma).

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

## Guardas de precondição — varredura de 15/08/2026

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
  console e com o CI verde** — nenhum teste automatizado detecta.
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

0. **Não há frente aberta nem dado de teste solto.** A sessão de 15/08 encerrou
   com a `main` limpa, nenhum PR aberto e o banco de volta ao estado anterior ao
   teste (9 unidades, 16 contas, zero órfãs). A seção "Trabalho em curso" que
   existia aqui foi apagada porque suas quatro frentes fecharam — o que ela tinha
   de durável está em "Armadilhas" e "Validações registradas". Se criar uma nova,
   siga o mesmo contrato: estado real verificado, e apagada ao fechar.
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
7. Se for validar pelo navegador, **recarregue a página antes de medir** — o
   Fast Refresh não aplica no dev web (ver armadilhas). E monte um controle
   observável que prove que a interação aconteceu; sem ele a medição passa mesmo
   com o defeito presente.

## Mapa da documentação

| Necessidade                               | Documento                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Começar uma nova sessão / estado atual    | este arquivo                                                                                     |
| Como chegamos aqui / o que já foi tentado | [HISTORICO.md](HISTORICO.md) — snapshots datados e mudanças por PR                               |
| Arquitetura, padrões e phonebook técnico  | [`../CLAUDE.md`](../CLAUDE.md)                                                                   |
| Testes                                    | [TESTING.md](TESTING.md)                                                                         |
| Histórico e processo de migrations        | [`../database/MIGRATIONS.md`](../database/MIGRATIONS.md)                                         |
| Google Play: procedimento                 | [GOOGLE_PLAY_DEPLOYMENT.md](GOOGLE_PLAY_DEPLOYMENT.md)                                           |
| Google Play: textos, assets e declarações | [play-store-metadata.md](play-store-metadata.md)                                                 |
| App Store / iOS: procedimento             | [APP_STORE_DEPLOYMENT.md](APP_STORE_DEPLOYMENT.md)                                               |
| Reconstrução da identidade Android        | [REBUILD_RELAUNCH_PLAN.md](REBUILD_RELAUNCH_PLAN.md)                                             |
| Firebase e push                           | [FIREBASE_MIGRATION.md](FIREBASE_MIGRATION.md)                                                   |
| Recuperação de senha                      | [PASSWORD_RECOVERY.md](PASSWORD_RECOVERY.md)                                                     |
| Templates de email do Auth                | [`../supabase/templates/README.md`](../supabase/templates/README.md) — e por que colar no painel |
| Marca e tokens                            | [`../brand-guidelines.md`](../brand-guidelines.md)                                               |
| Specs e planos de features                | [`superpowers/specs/`](superpowers/specs/) e [`superpowers/plans/`](superpowers/plans/)          |

Os specs e planos em `superpowers/` são **registro de decisão**, não estado
atual: leia-os quando for continuar a feature de que tratam (ex.: a Fase 2 da
auditoria). Onde eles divergirem deste documento ou do código, **o código vence** —
vários deles registram passos que a execução provou errados.

## Segurança documental

Não registre senhas, tokens, chaves, arquivos JSON de serviço, keystores ou
listas nominais de usuários/testadores. Este documento pode registrar **onde**
uma credencial é administrada e como verificar seu funcionamento, nunca seu
conteúdo.
