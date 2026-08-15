# Contexto operacional — Rota Mestre App

> Documento de entrada para novas sessões. Atualizado em 15/08/2026.
> Consulte o código ou o serviço responsável antes de alterar um estado externo.

## Pendências (comece por aqui)

Lista única e canônica. Se resolver uma, risque daqui.

| #   | Pendência                                                                                                                                                                                                                                                                                                                                                                                           | Quem pode fazer                                | Onde está o detalhe                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| 1   | **Rotacionar/desativar contas de teste com senha vazada** — `gestor@`, `motorista@`, `gestor.test@`, `motorista.test@` foram **excluídas em 05/08/2026**; se recriar qualquer conta de teste, use senha forte por variável de ambiente.                                                                                                                                                             | gestor (Supabase → Auth → Users)               | "Credenciais hardcoded" abaixo                         |
| 2   | **Furo de RLS:** motorista pode alterar `unidade_id` da própria rota. Pré-existente, exige motorista malicioso fora do app.                                                                                                                                                                                                                                                                         | requer design (o fix óbvio quebra o motorista) | Security Advisory privado `GHSA-vw63-jxg2-28vx`        |
| 3   | **Fase 2 da auditoria:** chip na tela da rota + indicador/filtro/contador na Gestão de Rotas. Plano próprio ainda não escrito — melhor depois de algumas semanas de dado acumulado.                                                                                                                                                                                                                 | qualquer sessão                                | spec `2026-08-04-auditoria-otimizacao-rotas-design.md` |
| 4   | **Play Store: produção continua vazia.** O `3025` está publicado em **teste fechado (`alpha`) e teste interno**, ambos `completed`. Falta cumprir o requisito de testadores para solicitar acesso à produção. Ampliar opt-in divulgando o hub público `/testar`.                                                                                                                                    | gestor (Play Console)                          | `GOOGLE_PLAY_DEPLOYMENT.md`                            |
| 5   | **iOS:** não existe build. Bloqueado na autenticação interativa da Apple (`npx eas-cli build --platform ios --profile production`).                                                                                                                                                                                                                                                                 | gestor (Apple ID + 2FA)                        | `APP_STORE_DEPLOYMENT.md`                              |
| 6   | **Validar o onboarding self-service — passos 1 a 4 feitos em 15/08, faltam 5 e 6.** Cadastro, confirmação, portão e **criação da unidade** confirmados com conta real, com todos os invariantes da RPC conferidos no banco. Falta criar o motorista e a rota, bloqueados porque cadastrar motorista exige definir senha de acesso. Nenhum teste automatizado cobre isso — nenhum toca o banco real. | gestor (cria conta de motorista)               | "Trabalho em curso" abaixo                             |
| 7   | **4 das 9 unidades têm `sede_endereco` com coordenadas NULL** — não conseguem gerar rota. A tela "Minha Unidade" é o caminho de conserto e desde 08/08 funciona de verdade (ver Migration 22 e a armadilha do componente aninhado). Falta passar unidade por unidade.                                                                                                                               | gestor (edita cada unidade)                    | `database/MIGRATIONS.md` (Migration 22)                |
| 8   | **Proteção contra senha vazada: exige plano Pro, não dá para ligar hoje.** O advisor aponta `auth_leaked_password_protection`, mas a checagem contra o HaveIBeenPwned é **Pro ou acima** — a assinatura é por organização, não por projeto. **Não é um toggle**, é upgrade de plano. O que o free permite e vale conferir: comprimento mínimo e caracteres exigidos, em Auth → Providers → Email.   | gestor (decisão de plano; ou ajuste no Email)  | "Política de senha" abaixo                             |

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

Follow-ups menores (nenhum bloqueia): Timeline não narra o autor da otimização
(o dado existe em `logs.usuario_id`, falta join em `useTimelineData.ts`);
`mapLogToTimelinePreview` não exibe **6** dos eventos que `TIMELINE_LOG_EVENTS`
conta — `rota_otimizada`, `paradas_reordenadas`, `rota_reativada`,
`parada_reaberta`, `parada_retomada` e `motorista_alterado` —, então o widget
colapsado soma esses eventos e não mostra nenhum deles (o registro anterior
citava só `rota_otimizada`, era maior que isso); os dois scripts de
consulta/promoção da Play ficaram **fora do repositório** (ver "Play Store:
trilhas" nas armadilhas) — recriar custa uma investigação inteira; e falta uma
varredura por **telas com precondição forte que não verificam se ela ainda
vale** — dois casos apareceram em 15/08 (Nova Rota sem motorista, PR #381, e
criar-unidade com perfil já existente, PR #383), os dois pelo mesmo descuido, e
ninguém conferiu as demais.

## Trabalho em curso (retomar por aqui)

Sessão de 15/08/2026, encerrada com **nenhum PR aberto** e a `main` em
`c03f50b`: PRs #371 a #383 mergeados (o #380 foi fechado sem merge, ver item 4),
árvore limpa fora do `.claude/settings.json`. Tudo que segue é estado real
verificado, não plano.

### 1. Onboarding self-service validado até o passo 4 (pendência 6)

Primeira vez que o fluxo foi percorrido inteiro com conta real, do cadastro à
criação da unidade. **Passos 1 a 4 verificados no banco e no navegador:**

| Passo              | Resultado                                                                               |
| ------------------ | --------------------------------------------------------------------------------------- |
| Cadastro           | conta em `auth.users`, **sem** linha em `usuarios` — correto, o perfil nasce na RPC     |
| `nome` em metadata | gravado e íntegro                                                                       |
| Confirmação        | `email_confirmed_at` preenchido                                                         |
| Login → **portão** | caiu em `/onboarding/criar-unidade`, com sessão — **o caminho de resgate existe mesmo** |
| **Criar unidade**  | RPC gravou as três linhas atomicamente, com todos os invariantes                        |

A RPC `criar_unidade_para_novo_gestor` foi conferida linha a linha:
`origem='self_service'`, `status='trial'`, `sede_latitude`/`sede_longitude` não
nulas, `usuarios.unidade_id` com `papel='gestor'` e `is_gestor_principal=true`,
`usuario_unidades.is_principal=true`. O contador `unidades where
origem='self_service'` saiu de **0 → 1** e as contas órfãs de **1 → 0**.

Também validado depois da criação, sem motorista: a sede entra sozinha como
**partida e chegada** da rota; o autocomplete de paradas e o otimizador OSRM
funcionam (2 paradas → 14,3 km / 21 min, com a vírgula decimal correta); e o
rascunho da rota sobrevive à navegação entre telas.

**Falta:** o motorista (passo 5) e a rota (6) — ver o bloqueio no item 2.

### 2. O passo 5 exige criar conta com senha

`Motoristas → Adicionar Motorista` pede nome, e-mail e **senha inicial**: é
criação de conta de acesso, então precisa ser feita pelo gestor, não pelo
assistente. Sem pelo menos um motorista o passo 6 não existe — a tela Nova Rota
mostra "Nenhum motorista disponível nesta unidade" e o botão de criar rota fica
desabilitado.

Para retomar: criar um motorista na unidade `Transportes Epitacio Teste`, voltar
em Nova Rota (o rascunho com as 2 paradas otimizadas está salvo) e criar a rota.

### 3. Dados de teste vivos em produção

A validação deixou em produção uma **unidade real** (`Transportes Epitacio
Teste`, `origem='self_service'`, `status='trial'`) com o e-mail corporativo do
gestor como gestor principal. Não há mais conta órfã, mas há uma unidade de teste
no meio das reais — decidir se fica como massa de teste do fluxo self-service ou
se é removida junto com as paradas/rotas que vierem dela.

### 4. Os bugs da validação já foram fechados

Sete achados: **quatro corrigidos** (PGRST116 no Sentry, beco sem saída sem
motorista, cidade/UF duplicadas na sede, `PERFIL_JA_EXISTE` sem tradução) mais o
rótulo do endereço no onboarding, todos na `main` via PRs #380 (fechado, ver
abaixo) e #381. **Três não eram bugs de produto** e estão registrados em
"Armadilhas" para não voltarem: o toast vermelho e o `Unexpected text node` são
do LogBox e não existem em produção; o rascunho de rota mora no banco, não no
`sessionStorage`.

A lição que os três compartilham: **ler o arquivo inteiro antes de declarar
bug** — vieram de olhar um sintoma ou meia implementação e deduzir o resto.

O PR #380 (PGRST116) foi **fechado sem merge**: a branch das demais correções
nasceu dele, então o conteúdo subiu junto no #381 (`c7b9a85`). Mantê-lo aberto só
criaria risco de reverter o que veio depois.

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
Hoje `auth.users` e `public.usuarios` batem: **18 para 18**, zero órfãs e zero
usuários sem conta de auth. (Eram 17/17 na limpeza; a 18ª é a conta usada para
validar o onboarding, que virou gestor de verdade ao completar o passo 4.)

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
- Android: `1.12.2` / `3025` concluído em teste fechado **e** interno; produção
  nunca teve release (pend. 4).
- iOS: configuração versionada, sem build (pend. 5).

## Resumo executivo

Este repositório contém o produto operacional do Rota Mestre:

- painel web para gestores em <https://app.rotamestre.tec.br>;
- aplicativo Android para motoristas;
- backend compartilhado no Supabase;
- otimização, execução e acompanhamento de rotas;
- fotos privadas de comprovação, ocorrências, notificações e histórico.

O código local está na versão **1.12.2**, com
`androidVersionCode` **3025**. O app foi reconstruído sob uma nova identidade
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
| Versão Android no código | `1.12.2` / `3025`                      | `package.json`                         |
| EAS project              | `c6401a59-af97-484a-93b7-c75016bf331d` | `app.config.js`                        |
| Firebase                 | `rota-mestre-97084`                    | console Firebase / configuração nativa |
| Supabase project ref     | `xezslsyxjivunmhhyxtd`                 | `supabase/.temp/project-ref`           |
| Site institucional/legal | <https://rotamestre.tec.br>            | repositório `lp-rotamestre`            |
| Plataforma               | Expo 56, React Native 0.85.3, React 19 | `package.json`                         |

Não copie versões para outros documentos. Quando houver divergência, prevalecem
`package.json`, `app.config.js`, `eas.json` e o estado consultado nos consoles.

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

Sessão que começou como investigação de bugs e terminou com **doze PRs mergeados
(#371 a #383, menos o #380, fechado sem merge)**, o onboarding self-service
percorrido com conta real até a criação da unidade e a lista de bugs dessa
validação fechada. O que importa para a próxima sessão:

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
- **O onboarding self-service foi percorrido com conta real até o passo 4**, com
  os invariantes da RPC conferidos no banco. Trava no passo 5 porque cadastrar
  motorista cria conta de acesso com senha — isso é do gestor. Detalhe em
  "Trabalho em curso".
- **Três dos sete "bugs" dessa validação não eram bugs**, e os três foram
  desmentidos por medição direta, não por leitura: bundle de produção baixado da
  Vercel para o LogBox, tabela `rascunhos_rota` consultada para o rascunho. Estão
  em "Armadilhas" com a evidência, para não voltarem à lista.
- **Suíte ao fim: 332 suites, 5866 testes, exit 0**, com o CI verde nos seis
  checks. Dois detalhes de método que enganaram durante a sessão: a saída do
  `validate` trouxe `[exited with code 0]` **junto** com uma falha de lint — leia
  a saída, não confie só no código de retorno; e um teste que passa de primeira
  não prova nada, então cada guarda nova foi conferida contra a ausência da
  proteção que ela vigia (ver TESTING.md).

## Mudanças relevantes desta etapa

| Data       | Mudança                                                                                     | Referência                                   |
| ---------- | ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 23/07/2026 | Nova Entrega com rascunho persistente, importação, revisão e criação atômica/idempotente    | commit `e1f1bd5`, migration `20260723223000` |
| 23/07/2026 | Migration de segurança já aplicada foi incorporada ao histórico versionado                  | commit `de8a036`, migration `20260722195606` |
| 24/07/2026 | Correção da autenticação Android após rotação de chave                                      | commit `6dd8aa8`                             |
| 24/07/2026 | Preparação do app e da ficha para o Google Play, páginas legais e exclusão de conta         | commit `b7a39dc`                             |
| 24/07/2026 | Geometria viária persistida nos mapas; remoção dos fallbacks visuais em linha reta          | commit `3788f55`                             |
| 24/07/2026 | Configuração inicial de distribuição e conformidade iOS                                     | commit `191db5a`                             |
| 04/08/2026 | Integração de 5 PRs: `/testar`, maplibre 6, Sentry, deps e Node 22 (baseline/CI)            | PRs #341/#345/#343/#342/#344                 |
| 04/08/2026 | Correção do worker do maplibre 6 (mapa web travado em "Carregando...")                      | PR #346                                      |
| 04/08/2026 | Correções do autocomplete de endereço: interação após limpar e resposta obsoleta            | PRs #347 e #348                              |
| 05/08/2026 | Auditoria de uso do otimizador, Fase 1 (registrar): colunas, RPC de 11 params, Timeline     | PR #350, migration `20260804235500`          |
| 05/08/2026 | Histórico de migrations reconciliado + `IF NOT EXISTS` no arquivo que travava o `db push`   | PR #351                                      |
| 06/08/2026 | Onboarding self-service: RPC de criação de unidade + portão no `index.tsx` e no `login.tsx` | PR #354, migration `20260806175617`          |
| 07/08/2026 | Credenciais hardcoded removidas do repositório público                                      | PR #353                                      |
| 07/08/2026 | Tela "Minha Unidade" passa a salvar via RPC `atualizar_unidade`                             | PR #355, migration `20260807151639`          |
| 07/08/2026 | Acentuação dos rótulos da tela de rota                                                      | PR #356                                      |
| 08/08/2026 | Formulário de unidade: 7 defeitos + a causa raiz que impedia salvar a sede                  | PR #357                                      |
| 08/08/2026 | OSRM real no dev web (`src/lib/osrm/config.ts`), constante de URL unificada                 | PR #358                                      |
| 08/08/2026 | Erro de endereço que não sumia após selecionar a sugestão (nova-entrega + onboarding)       | PR #359                                      |
| 08/08/2026 | `androidVersionCode` 3024 → 3025; build EAS e publicação em teste fechado + interno         | PR #360, build `d34a88d6`                    |
| 15/08/2026 | Fallback Haversine do OSRM sinalizado (`is_estimated`) + guarda de rota com distância zero  | PR #371                                      |
| 15/08/2026 | Remontagens invisíveis (componente no render) + dashboard não desmonta na troca de filtro   | PR #372                                      |
| 15/08/2026 | `ErrorBoundary` nas 5 telas de auth                                                         | PR #373                                      |
| 15/08/2026 | `ErrorBoundary` nas 5 rotas públicas restantes — cobertura de `app/` fechada                | PR #374                                      |
| 15/08/2026 | Decimal com vírgula em 32 pontos de exibição, via `formatarDecimal`                         | PR #375                                      |
| 15/08/2026 | Equipe: ativar/desativar membro não pisca mais a tela inteira                               | PR #376                                      |
| 15/08/2026 | Lote do Dependabot: maplibre 6.3.0, supabase-js 2.112.3, web-vitals 6.1.0 e dev deps        | PRs #367/#369/#370/#368                      |
| 15/08/2026 | Onboarding: nome pré-preenchido do cadastro + cidade/UF derivadas do endereço da sede       | PR #378                                      |
| 15/08/2026 | Validação manual do onboarding até o passo 4 registrada, com os 7 achados                   | PR #379                                      |
| 15/08/2026 | Bugs da validação: PGRST116 fora do Sentry, saída sem motorista, endereço sem duplicar      | PR #381 (o #380 subiu junto e foi fechado)   |
| 15/08/2026 | Onboarding devolve ao portão quem já tem perfil, em vez de abrir um formulário condenado    | PR #383                                      |

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

0. **Se "Trabalho em curso" ainda existir neste documento, comece por ele** — o
   onboarding está validado até o passo 4 e travado no 5, que depende de uma
   conta de motorista criada pelo gestor, e há dado de teste vivo em produção. Os
   bugs da validação já foram fechados. Quando essas três frentes fecharem,
   apague a seção inteira — o que ela tem de durável já está em "Armadilhas".
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
