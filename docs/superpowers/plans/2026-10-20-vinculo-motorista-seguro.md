# Vínculo de motorista seguro: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fechar o vínculo multi-loja sem consentimento e o apagamento de conta na `criar-motorista`, e impedir um gestor de mexer na pessoa de um motorista que também atende outra loja.

**Architecture:** a trava fica no banco (policies, trigger e RPCs SECURITY DEFINER), porque a Edge Function não é a única porta: a RLS de `usuario_unidades` aceitava o vínculo direto pelo PostgREST. A função passa a recusar todo e-mail já existente (409) e nunca apaga conta. O app troca o toggle e a lista de Motoristas por RPCs.

**Tech Stack:** Postgres/Supabase (RLS, plpgsql), Edge Function Deno, React Native + Jest.

**Spec:** decisões do usuário em 20/10/2026, repassadas pela sessão "Nova feature"; análise em `side-session-notes/.../vinculo-multiloja-seguranca.md`.

## Global Constraints

- Banco único = produção: nada de `db push`. Migration validada só por sonda transacional (`DO $$ ... RAISE EXCEPTION`), aplicada por outra sessão com o OK do usuário.
- Mensagem da trava: "Este e-mail já tem uma conta no RotaMestre. Para usar o mesmo motorista em mais de uma loja, fale com o suporte."
- Nenhuma resposta da função devolve id, nome ou telefone de outro usuário.
- "Atende outra loja" = tem vínculo ATIVO numa unidade em que quem chama não é gestor ativo.
- Para quem atende outra loja, o gestor só muda `nome` e `telefone` (e o `updated_at`, que é automático).
- Lista de Motoristas: só os campos que a tela já usa (id, nome, email, telefone, foto_url, ativo, created_at).
- Seletores de nova rota e "Trocar motorista": continuam só com vínculo ativo (não mudam).
- Jest: `--testPathIgnorePatterns=worktrees --modulePathIgnorePatterns=worktrees`.

## Review Focus

- O mesmo e-mail com maiúscula ou espaço tem de cair na trava (normalização + `ilike` escapado; `_` em e-mail não pode virar curinga).
- Conta só no Auth (gestor no meio do onboarding) → 409, nunca `deleteUser`.
- Gestor que é gestor das DUAS lojas do motorista não é "outra loja" e segue livre.
- O próprio motorista editando o próprio perfil (push_token, ultimo_login, foto) não pode ser barrado pelo trigger.
- Reativar o telefone duplicado pelo RPC continua mostrando "Telefone já cadastrado" (23505 com o nome do índice).

---

### Task 1: migration (RLS, trigger, RPCs)

**Files:** `database/migrations/20261020220000_vinculo_motorista_seguro.sql` (+ cópia idêntica em `supabase/migrations/`), `database/MIGRATIONS.md`.

- [ ] Sonda transacional VERMELHA contra o estado atual: um gestor insere vínculo de um uuid alheio (passa hoje) e muda `ativo` de motorista multi-loja (passa hoje).
- [ ] Escrever a migration:
  - `DROP POLICY usuario_unidades_insert/update/delete`; `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON usuario_unidades FROM anon, authenticated`.
  - `motorista_atende_outra_loja(p_usuario_id uuid) returns boolean`: SECURITY DEFINER, STABLE, search_path ''; sem EXECUTE para anon/authenticated.
  - Trigger `trava_motorista_outra_loja` BEFORE UPDATE em `usuarios`, com função SECURITY DEFINER. Age quando `auth.uid()` não é nulo, `auth.uid() <> OLD.id`, `OLD.papel = 'motorista'`, quem chama não tem `admin_role` e o motorista atende outra loja. Nesse caso, qualquer coluna fora de nome/telefone/updated_at que mude → `RAISE EXCEPTION` com errcode P0001 e a mensagem "Este motorista também atende outra loja: aqui só dá para mudar nome e telefone."
  - `listar_motoristas_unidade(p_unidade_id uuid)` returns table(id, nome, email, telefone, foto_url, ativo, created_at): gestor ativo da unidade, senão 42501. Linhas: vínculo papel motorista na unidade com `uu.ativo OR u.ativo`, e `u.papel = 'motorista'`; `ativo = uu.ativo AND u.ativo`; ordenado por nome.
  - `alternar_motorista_na_unidade(p_motorista_id uuid, p_unidade_id uuid, p_ativo boolean) returns text`: gestor da unidade e alvo motorista vinculado a ela (senão 42501/P0001). Se atende outra loja: muda só `usuario_unidades.ativo` e devolve `'vinculo'`; reativar com a pessoa inativa → P0001 "fale com o suporte". Senão: muda `usuarios.ativo` e devolve `'pessoa'`.
  - EXECUTE das duas RPCs só para authenticated.
- [ ] Sonda VERDE: os dois ataques falham; gestor das duas lojas passa; motorista edita a si mesmo; nome/telefone passam; listar e alternar se comportam como acima; gestor de outra loja recebe 42501.
- [ ] Agente `rls-policy-reviewer`; registrar no MIGRATIONS.md (Migration 31); commit.

### Task 2: Edge Function `criar-motorista`

**Files:** create `supabase/functions/criar-motorista/emailExistente.ts`; modify `index.ts`, `telefoneDuplicado.ts`; tests em `__tests__/`.

- [ ] Testes vermelhos:
  - `normalizarEmail(' Joao@X.com ') === 'joao@x.com'`;
  - `escaparLike('a_b%c\\d') === 'a\\_b\\%c\\\\d'`;
  - `ehEmailDuplicadoNoAuth` reconhece as mensagens do GoTrue (already been registered / already registered / duplicate / unique constraint);
  - `respostaEmailJaCadastrado()` é `{status:409, error: MSG_EMAIL_JA_CADASTRADO, codigo:'email_ja_cadastrado'}`;
  - guarda estática do `index.ts`: sem `listUsers`; `deleteUser(` só com `authData.user.id`; sem `vinculado`, sem `existingUser`; sem `insert` em `usuario_unidades` fora do caminho de criação; `MSG_TELEFONE_OUTRA_LOJA` não manda cadastrar com o e-mail.
- [ ] Implementar e deixar verde. A busca em `usuarios` usa `.ilike('email', escaparLike(email)).limit(1)`, e erro na consulta vira 500. Commit.

### Task 3: app

**Files:** `src/hooks/motoristas-gestor/useMotoristasOperations.ts`, `app/gestor/motoristas.tsx`, os testes dos dois hooks.

- [ ] Testes vermelhos: `loadMotoristas` chama `rpc('listar_motoristas_unidade', {p_unidade_id})`; o toggle chama `rpc('alternar_motorista_na_unidade', {p_motorista_id, p_unidade_id, p_ativo})`; erro P0001 mostra a mensagem do banco; sem o toast "vinculado".
- [ ] Implementar; trocar a dica da tela por "Motorista que já usa o RotaMestre em outra loja? Fale com o suporte para usar a mesma conta nas duas lojas." Commit.

### Task 4: docs + verificação

- [ ] CLAUDE.md ("Motorista em várias lojas") e pendência 21 do PROJECT_CONTEXT.
- [ ] tsc, lint, jest completo; review por subagente; push; PR; CI.
