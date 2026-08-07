# Onboarding self-service: testador cria a própria unidade

**Data:** 06/08/2026
**Estado:** desenho aprovado, plano de implementação pendente

## Problema

O link "Solicitar acesso" da tela de login leva a `/auth/register`, e **esse
cadastro não tem como ser concluído por ninguém**.

`authService.signUp` (`src/lib/auth.ts:97`) faz duas coisas em sequência:

1. `supabase.auth.signUp()` — cria a conta no Auth;
2. `supabase.from('usuarios').insert(...)` — **bloqueado pelo RLS**.

A policy `usuarios_insert_optimized` exige que quem insere já seja gestor ativo
de alguma unidade:

```sql
EXISTS (SELECT 1 FROM usuario_unidades uu
        WHERE uu.usuario_id = auth.uid()
          AND uu.papel = 'gestor' AND uu.ativo = true)
```

Um usuário recém-criado nunca satisfaz isso. Como o `insert` vem **depois** do
`signUp`, o erro deixa uma conta órfã: existe no Auth, não existe no app.

Mesmo que o insert passasse, não haveria unidade: `unidades` **não tem policy de
INSERT** (só `SELECT`), e `usuario_unidades_insert` exige
`current_user_is_gestor_of_unidade(...)`. O ciclo é fechado — para ser gestor é
preciso ter unidade; para criar unidade é preciso ser gestor.

### O que a pessoa vê

Em `app/index.tsx:84`, sessão válida sem perfil cai em:

```ts
if (!usuario) {
  router.replace('/auth/login');
```

A pessoa confirma o e-mail, o login funciona, e ela volta para a tela de login
sem mensagem. Do lado dela, parece senha errada.

### Evidência em produção (consultado em 06/08/2026)

Cinco pessoas reais têm conta no Auth e nenhuma linha em `usuarios`; quatro
confirmaram o e-mail e chegaram a logar:

| E-mail                          | Criada     | Confirmou | Último login |
| ------------------------------- | ---------- | --------- | ------------ |
| `saulofernandes140@gmail.com`   | 28/11/2025 | sim       | 09/04/2026   |
| `kaiofelipeoliveirabardelati@…` | 06/03/2026 | sim       | 09/03/2026   |
| `jinacioloja@gmail.com`         | 10/03/2026 | sim       | 10/03/2026   |
| `suporte@aformulaal.com`        | 10/03/2026 | sim       | 10/03/2026   |
| `vitinncr12hg@gmail.com`        | 14/03/2026 | não       | —            |

Elas estão **permanentemente travadas**: recadastrar com o mesmo e-mail devolve
"already registered".

Isto também explica a pendência da Play Store. O hub `/testar` recruta (grupo,
opt-in, instalação) mas entrega a pessoa num login onde ela não entra. "2
testadores participando" de 12 provavelmente não é alcance — é o funil furado no
último passo.

## Decisões tomadas

| Decisão             | Escolha                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| Quem cria unidade   | **Self-service aberto** — sem aprovação nem convite                              |
| Campos obrigatórios | Nome da pessoa, nome da unidade, cidade/UF, **endereço da sede com coordenadas** |
| CNPJ                | **Opcional** — migration remove o `NOT NULL`                                     |
| Contas já travadas  | **Recuperadas** pelo mesmo portão, no próximo login                              |

O endereço da sede é obrigatório porque dele saem a partida e a chegada de toda
rota (`src/hooks/nova-entrega/useEnderecoUnidade.ts:43`). Unidade sem sede
produz gestor que entra e não consegue criar rota — o mesmo beco, um passo
adiante.

## Arquitetura

Trocar o `router.replace('/auth/login')` de `app/index.tsx:84` por um desvio
para onboarding:

```
login OK  →  busca perfil
              ├─ tem perfil ────────────→ /gestor ou /motorista   (hoje)
              ├─ SEM perfil ────────────→ /onboarding/criar-unidade   (novo)
              └─ primeira_senha ────────→ /onboarding/first-password  (hoje)
```

O padrão de portão já existe no projeto (`/onboarding/first-password`); este
segue o mesmo formato.

Como o portão reage a **estado** e não a evento, as contas travadas entram por
ele no próximo login. Não há código dedicado a recuperação.

### Por que RPC e não Edge Function nem trigger

O bug atual é um processo de dois passos que completa pela metade. Uma RPC
`SECURITY DEFINER` faz as três linhas numa **única transação**: ou nascem todas,
ou nenhuma. O estado órfão deixa de ser possível por construção.

É também o padrão já usado no projeto (`criar_rota_com_paradas`,
`inserir_parada`, `reordenar_paradas`), passa pelo agente `rls-policy-reviewer`
do repositório, e dispensa deploy, CORS e segredo.

Edge Function (como `criar-motorista`) não é atômica entre os três inserts a
menos que chame uma RPC no fim — ou seja, precisaria da RPC de qualquer forma,
com uma camada a mais. Trigger `handle_new_user` receberia os dados da unidade
via `raw_user_meta_data`, que é controlado pelo client, e não devolve erro de
validação para a tela.

## Contratos

### RPC

```sql
criar_unidade_para_novo_gestor(
  p_gestor_nome     text,
  p_unidade_nome    text,
  p_cidade          text,
  p_uf              text,
  p_sede_endereco   text,
  p_sede_latitude   numeric,
  p_sede_longitude  numeric,
  p_telefone        text default null
) returns uuid              -- id da unidade criada
```

`SECURITY DEFINER`, `SET search_path = public`.
`REVOKE ALL FROM PUBLIC, anon` · `GRANT EXECUTE TO authenticated`.

**Campos que NÃO são parâmetro, deliberadamente:**

| Campo   | Origem                                | Motivo                                                  |
| ------- | ------------------------------------- | ------------------------------------------------------- |
| `papel` | literal `'gestor'` no corpo           | parâmetro deixaria o client escolher o próprio papel    |
| `email` | lido de `auth.users` via `auth.uid()` | parâmetro permitiria cadastrar perfil com e-mail alheio |

**Guardas, em ordem:**

1. `auth.uid()` não nulo — `raise exception … using errcode = '28000'`;
2. **não existe linha em `public.usuarios` com esse id** — restringe a função a
   onboarding e limita cada conta a exatamente uma unidade.
   **`errcode = 'P0001'` com `message = 'PERFIL_JA_EXISTE'`**;
3. `p_gestor_nome`, `p_unidade_nome` e `p_cidade` não vazios — `errcode = '22023'`;
4. `p_sede_latitude` e `p_sede_longitude` não nulos — `errcode = '22023'`.

`p_uf` é opcional (a coluna aceita nulo) e não entra nas guardas.

O código da guarda 2 precisa ser **estável e distinguível**: é por ele que a tela
reconhece "já existe" e trata como sucesso. Comparar texto de mensagem
quebraria na primeira mudança de redação ou tradução.

**Escrita, na transação:**

- `unidades`: nome, cidade, uf, sede_endereco, sede_latitude, sede_longitude,
  `origem = 'self_service'`, `status = 'trial'`, `ativa = true`;
- `usuarios`: id = `auth.uid()`, email da sessão, nome, `papel = 'gestor'`,
  **`unidade_id` = unidade criada**, `ativo = true`;
- `usuario_unidades`: usuario_id, unidade_id, `papel = 'gestor'`, `ativo = true`.

> `usuarios.unidade_id` é obrigatório: a Edge Function `criar-motorista` lê
> `gestorData.unidade_id` (coluna legada de unidade única). Sem ele, o gestor
> novo cria a unidade e não consegue cadastrar motorista nenhum.

### Migrations

1. `alter table public.unidades alter column cnpj drop not null;`
   O `UNIQUE (cnpj)` permanece — em Postgres, múltiplos `NULL` não colidem.
2. Criação da RPC acima, com grants.

`unidades.origem` não tem CHECK constraint; `'self_service'` entra sem alteração
de schema.

### Tela `/onboarding/criar-unidade`

Campos: nome da pessoa · nome da unidade · cidade/UF · endereço da sede via
`AddressAutocomplete` (devolve coordenadas junto).

Zod + `zodResolver` + `Controller`, erros inline por `FieldError`, submit
envolvido em `useToast.withToast()`, `ErrorBoundary` na rota — os padrões do
projeto.

### Mudanças no que já existe

- `authService.signUp` **deixa de inserir em `usuarios`**. Passa a ter uma
  responsabilidade só: criar a conta no Auth. Isso elimina a classe inteira do
  bug — não há mais um segundo passo que possa falhar depois da conta criada.
- `signUp` passa `nome` em `options.data` para a tela de onboarding
  pré-preencher. Campo editável e revalidado pela RPC, então metadata
  controlada pelo client não vira risco. Hoje o nome se perde: `signUp` recebe
  o parâmetro mas não o envia ao Auth.
- `app/auth/register.tsx` **perde o seletor "gestor ou motorista"**. Motorista
  nunca se autocadastra — é criado pelo gestor via `criar-motorista`, que já o
  vincula à unidade. Todo cadastro self-service é gestor.

## Fluxo completo

```
1. /auth/register    →  signUp(email, senha, nome)     → conta no Auth + metadata.nome
2. e-mail de confirmação  →  usuário confirma  →  login
3. app/index.tsx     →  sessão ok, getUsuario() = null →  /onboarding/criar-unidade
4. formulário        →  nome · unidade · cidade/UF · endereço (autocomplete → lat/lng)
5. submit            →  rpc('criar_unidade_para_novo_gestor', {...})  ← transação única
6. sucesso           →  /gestor/inicio
```

O passo 3 é idêntico para quem acabou de se cadastrar e para quem está travado
desde março.

## Erros e abuso

**Por que "aberto" não vira porta escancarada:** a guarda 2 da RPC limita cada
conta a **uma unidade, para sempre** — criar 50 unidades exige 50 contas. E
conta exige e-mail confirmado, senão a pessoa nem loga e nem chega ao portão.
Somado ao `signupRateLimiter` já existente em `register.tsx`, o custo de criação
em massa fica alto o suficiente para a fase atual.

**Rastro para limpeza:** `origem = 'self_service'` e `status = 'trial'` separam
testador de cliente real com um `where`, quando o teste fechado terminar.

| Situação                              | Comportamento                                                                                                                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perfil já existe (duplo submit, back) | RPC lança `PERFIL_JA_EXISTE`; **a tela trata como sucesso** e vai para `/gestor/inicio`. O reconhecimento é pela mensagem-sentinela retornada pelo PostgREST, nunca por texto livre |
| Rede cai no meio                      | Transação desfeita por inteiro; nova tentativa funciona                                                                                                                             |
| Endereço sem coordenadas              | Submit bloqueado, erro inline no campo                                                                                                                                              |
| Pessoa abandona o formulário          | Conta sem perfil; o portão a recebe no próximo login (auto-curável)                                                                                                                 |
| E-mail não confirmado                 | Não passa do login; nunca chega ao portão                                                                                                                                           |
| `auth.uid()` nulo                     | RPC recusa (o `GRANT` já é só para `authenticated`)                                                                                                                                 |

Tratar "já existe" como sucesso é o que torna a tela idempotente: duplo clique
não vira mensagem de erro.

## Testes

**Limite honesto:** nenhum teste do projeto toca o banco real. A RPC e as
policies — onde o erro seria mais caro — não são cobertas pela suíte. A
cobertura vem em três camadas de naturezas diferentes.

### 1. Jest

| Teste                                                                            | Trava                                        |
| -------------------------------------------------------------------------------- | -------------------------------------------- |
| `signUp` **não** chama `from('usuarios').insert`                                 | o bug desta spec, se alguém reintroduzir     |
| Sessão válida + `getUsuario() === null` → `replace('/onboarding/criar-unidade')` | o retorno ao beco silencioso                 |
| RPC com erro "já existe" → navega para `/gestor/inicio`                          | a idempotência do duplo submit               |
| Submit bloqueado sem coordenadas                                                 | unidade incapaz de gerar rota                |
| Payload da RPC **sem** `papel` e **sem** `email`                                 | reintrodução de campo controlado pelo client |

O último testa uma _ausência_ — o tipo de coisa que revisão humana deixa passar.

### 2. `rls-policy-reviewer`

A migration passa pelo agente antes de tocar produção: `SECURITY DEFINER` com
`search_path`, grants revogados de `anon`, e a guarda de "não tem perfil"
realmente inescapável.

### 3. Validação no fluxo real (exige o gestor)

Cadastro com e-mail descartável, conferindo no banco que as **três** linhas
nasceram e que `usuarios.unidade_id` ficou preenchido. Em seguida, **criar um
motorista com a conta nova** — é o que prova que o self-service produz um gestor
funcional, não só linhas no banco.

### Indicador pós-deploy

```sql
select au.email from auth.users au
left join public.usuarios u on u.id = au.id
where u.id is null;
```

Se cadastros novos continuarem aparecendo aí, o desenho falhou. Hoje esta query
acusa 7 linhas.

## Fora de escopo

- Aprovação, convite ou código de acesso (decidido: self-service aberto).
- Trigger `handle_new_user` como rede de segurança adicional — vale considerar
  depois, não é o mecanismo principal.
- Recuperar o **nome** das 5 contas travadas: nunca foi persistido em lugar
  nenhum. Elas informam o nome no onboarding, como qualquer cadastro novo.
- Cobrança, planos e limites por plano.
- Migrar `criar-motorista` para as helpers multi-unidade em vez de
  `usuarios.unidade_id`. A spec apenas garante que a coluna legada seja
  preenchida; a dívida continua registrada.
