# Motorista com conta duplicada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que uma loja crie uma segunda conta para um motorista que já usa o RotaMestre em outra loja, e avisar o gestor quando ele lança rota para um motorista que nunca entrou no app.

**Architecture:** Três camadas. (1) Banco: função `normalizar_telefone`, função `motorista_ativo_por_telefone` (só `service_role`) e índice único parcial no telefone normalizado dos motoristas ativos. (2) Edge Function `criar-motorista` recusa (409) a criação quando o telefone já pertence a um motorista ativo; o vínculo continua sendo só pelo e-mail da conta existente. A tela de Motoristas explica isso e distingue "vinculado" de "criado". (3) Seleção de motorista (nova rota e "Trocar motorista") marca "Nunca entrou no app" (`usuarios.ultimo_login IS NULL`) e pede confirmação antes de lançar ou trocar para esse motorista.

**Tech Stack:** Postgres (Supabase), Deno Edge Function, React Native + Expo, Jest + RTL.

**Spec:** decisões aprovadas pelo usuário no chat de 20/10/2026 (caso José Inácio, João Pessoa x Cabedelo). Não há arquivo de spec. Os fatos estão aqui:

- Causa: em 26/02 a loja de Cabedelo cadastrou o motorista com o e-mail da própria loja. Isso criou uma 2ª conta com o MESMO telefone, que nunca fez login. Cinco rotas foram para ela, e quatro expiraram ou foram refeitas.
- O vínculo multi-loja já existe e funciona quando a loja cadastra com o MESMO e-mail (`criar-motorista` só insere em `usuario_unidades` e devolve `vinculado: true`).
- Os dados do José já foram consolidados no banco (fora deste plano).

## Global Constraints

- Banco único = PRODUÇÃO. Nunca `supabase db push`. A migration é aplicada pelo controlador via MCP `apply_migration`, depois da revisão. Subagente NÃO aplica nada no banco.
- Migration nova nos dois diretórios, `database/migrations/` e `supabase/migrations/`, com o prefixo `20261020200000_motorista_telefone_unico.sql` e o mesmo conteúdo. Registre em `database/MIGRATIONS.md`.
- Telefone normalizado = só dígitos; se começar com `55` e tiver 12 ou 13 dígitos, tira o `55`; menos de 10 dígitos → `NULL` (não participa da unicidade).
- Nome do índice: `usuarios_motorista_telefone_unico`. O código de erro que a Edge Function devolve: `codigo: 'telefone_ja_cadastrado'`, HTTP 409.
- Textos exatos (pt-BR):
  - outra loja: `Este motorista já usa o RotaMestre em outra loja. Cadastre-o com o e-mail da conta dele para vinculá-lo à sua loja.`
  - mesma loja: `Já existe um motorista com este telefone na sua loja.`
  - dica no formulário de cadastro: `Motorista que já usa o RotaMestre em outra loja? Cadastre com o mesmo e-mail da conta dele: ele passa a ver as rotas das duas lojas com uma conta só.`
  - sucesso de vínculo: `Motorista vinculado à sua loja. Ele já vê as rotas daqui com a mesma conta.`
  - selo: `Nunca entrou no app`
  - confirmação: título `Motorista nunca entrou no app`, mensagem `{nome} ainda não entrou no RotaMestre e não vai ver esta rota no celular. Confira se ele usa outra conta ou peça que instale o app e faça login.`, botão `Lançar mesmo assim` (nova rota) / `Trocar mesmo assim` (trocar motorista).
- A Edge Function NUNCA vincula pelo telefone (evita uma loja puxar motorista de outra empresa só pelo número) e não revela nome nem loja do motorista encontrado.
- Padrões do repo: `logger.warn(msg, err)` (máx. 2 args), sem `as any` em produção, `useAlert().showConfirm` para confirmação, nada de componente declarado dentro de render.
- Jest SEMPRE com `--testPathIgnorePatterns=worktrees --modulePathIgnorePatterns=worktrees` (há worktrees dentro do repo). TDD: o teste falha antes, pelo motivo certo.
- Pre-commit roda prettier no arquivo inteiro. Se um arquivo intocado sair reformatado, faça um commit `style:` separado antes do funcional. Nunca `--no-verify`.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Telefone em formatos diferentes, `(83) 9 8888-7777`, `+55 83 98888-7777` e `83988887777`, tem de bater como o mesmo número (normalização idêntica no SQL e na decisão da Edge Function).
2. Corrida: duas criações simultâneas com o mesmo telefone. O índice recusa a segunda com 23505, e a Edge Function tem de traduzir isso para a mesma mensagem 409, apagando o usuário do Auth recém-criado (o rollback que já existe).
3. Editar o telefone de um motorista para um número de outro motorista ativo: o índice recusa, e o toast tem de dizer algo compreensível (entrada no `errorMapping`), não "Registro duplicado" genérico.
4. Motorista sem telefone ou com telefone curto não pode ser bloqueado (`NULL` fica fora do índice e da checagem).
5. O selo e a confirmação não podem aparecer para quem já entrou (`ultimo_login` preenchido). Recarregar a lista não pode perder o campo.

---

### Task 1: Banco — normalização, busca e índice único

**Files:**

- Create: `database/migrations/20261020200000_motorista_telefone_unico.sql` e cópia idêntica em `supabase/migrations/`
- Modify: `database/MIGRATIONS.md`
- Modify: `src/lib/errorMapping.ts` (entrada antes da regra genérica de unique, ~linha 290)
- Test: `src/lib/__tests__/errorMapping.test.ts`

**Interfaces:**

- Produces (SQL): `public.normalizar_telefone(p text) returns text` (`IMMUTABLE`, `LANGUAGE sql`, `SET search_path = ''`); `public.motorista_ativo_por_telefone(p_telefone text) returns table(id uuid, unidade_id uuid)` (`STABLE`, `SECURITY INVOKER`, `SET search_path = ''`, `EXECUTE` revogado de `public`, `anon` e `authenticated`, concedido a `service_role`), que devolve os `usuarios` com `papel='motorista' AND ativo AND normalizar_telefone(telefone) = normalizar_telefone(p_telefone)`, e devolve vazio se o normalizado for `NULL`; índice `CREATE UNIQUE INDEX usuarios_motorista_telefone_unico ON public.usuarios (public.normalizar_telefone(telefone)) WHERE papel = 'motorista' AND ativo AND public.normalizar_telefone(telefone) IS NOT NULL`.
- Produces (TS): a entrada de `errorMapping` com `pattern: /usuarios_motorista_telefone_unico/i`, `title: 'Telefone já cadastrado'`, `message: 'Já existe um motorista ativo com este telefone. Confira se ele já tem conta.'`, `type: 'warning'`, `code: 'UNIQUE_TELEFONE_MOTORISTA'`.

- [ ] **Step 1:** Teste em `errorMapping.test.ts`: `getErrorMessage({ message: 'duplicate key value violates unique constraint "usuarios_motorista_telefone_unico"' })` devolve `code: 'UNIQUE_TELEFONE_MOTORISTA'` e o título acima. Rode, veja falhar (cai em `UNIQUE_VIOLATION`).
- [ ] **Step 2:** Acrescente a entrada antes da regra genérica. Rode, veja passar.
- [ ] **Step 3:** Escreva a migration (cabeçalho no padrão das vizinhas, comentário explicando o caso). Antes do índice, um `DO $$` que aborta com mensagem clara se já houver duplicata ativa (`SELECT normalizar_telefone(telefone) ... GROUP BY ... HAVING count(*) > 1`).
- [ ] **Step 4:** Registre em `database/MIGRATIONS.md` no formato das entradas existentes.
- [ ] **Step 5:** Commit `feat(db): telefone único entre motoristas ativos`.

### Task 2: Edge Function `criar-motorista` recusa telefone já cadastrado

**Files:**

- Create: `supabase/functions/criar-motorista/telefoneDuplicado.ts` (TS puro, sem import Deno)
- Test: `supabase/functions/criar-motorista/__tests__/telefoneDuplicado.test.ts`
- Modify: `supabase/functions/criar-motorista/index.ts`

**Interfaces:**

- Consumes: `motorista_ativo_por_telefone` (Task 1), via `supabaseAdmin.rpc`.
- Produces: `export const CODIGO_TELEFONE_JA_CADASTRADO = 'telefone_ja_cadastrado'`; `export function respostaTelefoneDuplicado(encontrados: Array<{ id: string; unidade_id: string | null }>, unidadeDoGestor: string, unidadesVinculadas: Record<string, string[]>): { status: 409; error: string; codigo: string } | null`. Devolve `null` se `encontrados` vier vazio. Se algum encontrado tiver `unidade_id === unidadeDoGestor` ou `unidadeDoGestor` em `unidadesVinculadas[id]`, devolve a mensagem "mesma loja"; senão, a de "outra loja". `export function ehViolacaoTelefoneUnico(err: { code?: string; message?: string } | null): boolean` (true para `code === '23505'` com `usuarios_motorista_telefone_unico` na mensagem).

- [ ] **Step 1:** Testes: vazio → `null`; encontrado em outra unidade → 409 + texto "outra loja"; encontrado com `unidade_id` igual → texto "mesma loja"; encontrado vinculado à unidade do gestor via `unidadesVinculadas` → "mesma loja"; `ehViolacaoTelefoneUnico` true/false. Rode, veja falhar (módulo não existe).
- [ ] **Step 2:** Implemente o módulo. Rode, veja passar.
- [ ] **Step 3:** Em `index.ts`, importe com a extensão `./telefoneDuplicado.ts` (Deno exige a extensão). Depois do bloco do e-mail existente (o caminho de vínculo NÃO muda) e ANTES do `listUsers`/`createUser`: se `telefone?.trim()`, chame `supabaseAdmin.rpc('motorista_ativo_por_telefone', { p_telefone: telefone.trim() })`. Se vier linha, busque os `usuario_unidades` ativos desses ids para montar `unidadesVinculadas` e responda com `respostaTelefoneDuplicado` (status 409, body `{ error, codigo }`). Erro do rpc: `console.error` e siga (não bloqueie o cadastro por falha de checagem; o índice é a rede). No `insertError` dos `usuarios`, se `ehViolacaoTelefoneUnico(insertError)`, depois do rollback do Auth que já existe, devolva o 409 com a mensagem de "outra loja".
- [ ] **Step 4:** Confira que o módulo compila no tsc do projeto, ou que a pasta é excluída do tsc, sem quebrar o `npx tsc --noEmit`, e que o Jest acha o teste. Commit `feat(motoristas): criar-motorista recusa telefone já cadastrado`.

### Task 3: Tela de Motoristas — dica e mensagem de vínculo

**Files:**

- Modify: `app/gestor/motoristas.tsx` (formulário de criação, logo abaixo do campo de e-mail, ~linhas 118-140)
- Modify: `src/hooks/motoristas-gestor/useMotoristasOperations.ts` (`adicionarMotorista`, toast de sucesso)
- Test: `src/hooks/motoristas-gestor/__tests__/useMotoristasOperations.test.ts`

**Interfaces:**

- Consumes: resposta da Edge Function `{ success: true, vinculado?: boolean }` e `{ error, codigo }` (Task 2).

- [ ] **Step 1:** Testes no hook: resposta 200 com `vinculado: true` → `showToast` com o texto exato de sucesso de vínculo; resposta 200 sem `vinculado` → o toast atual `'Motorista adicionado com sucesso!'`; resposta 409 com `error` → toast de erro com esse texto (o caminho de erro já mostra `result.error`; o teste fixa isso). Rode, veja o primeiro falhar.
- [ ] **Step 2:** Implemente. Na tela, a dica fixa (texto exato) em estilo de texto secundário abaixo do campo de e-mail, só no formulário de CRIAÇÃO.
- [ ] **Step 3:** Commit `feat(motoristas): explica o vínculo pelo e-mail e confirma quando vinculou`.

### Task 4: Seleção de motorista avisa "Nunca entrou no app"

**Files:**

- Modify: `src/components/gestor/nova-entrega/types.ts` (`MotoristaResumo` ganha `nuncaEntrou?: boolean`)
- Modify: `src/hooks/nova-entrega/useMotoristaSelection.ts` (select acrescenta `ultimo_login`; mapeia `nuncaEntrou: u.ultimo_login == null`)
- Modify: `src/components/gestor/nova-entrega/MotoristaSeletor.tsx` (selo na linha de workload)
- Modify: `app/gestor/nova-entrega.tsx` (`openReview` ou `confirmRoute`: se `selectedDriver?.nuncaEntrou`, `showConfirm` antes de seguir; cancelar = não gera)
- Modify: `src/components/gestor/mapa-rota/ChangeDriverModal.tsx` (select com `ultimo_login`, selo na linha, confirmação em `handleConfirm` com `useAlert`, renderizando `{AlertDialog}`)
- Test: `src/hooks/nova-entrega/__tests__/useMotoristaSelection.test.ts`, `src/components/gestor/nova-entrega/__tests__/MotoristaSeletor.test.tsx`, `src/components/gestor/mapa-rota/__tests__/ChangeDriverModal.test.tsx`

**Interfaces:**

- Produces: `MotoristaResumo.nuncaEntrou?: boolean` (`true` só quando `ultimo_login` é `null`).

- [ ] **Step 1:** Testes: o hook mapeia `nuncaEntrou` true/false a partir de `ultimo_login`; `MotoristaSeletor` mostra o selo `Nunca entrou no app` só para quem tem `nuncaEntrou`; `ChangeDriverModal`: selo + confirmar um motorista `nuncaEntrou` abre a confirmação e só chama `onConfirm` depois de aceitar; cancelar não chama; motorista que já entrou confirma direto. Rode, veja falhar.
- [ ] **Step 2:** Implemente. Na nova rota, a confirmação acontece no `openReview`, antes de abrir a revisão, para o gestor poder trocar de motorista sem passar pela revisão. Texto exato das Global Constraints, `type: 'warning'`.
- [ ] **Step 3:** Rode a suíte inteira + `npx tsc --noEmit` + eslint dos arquivos tocados. Commit `feat(gestor): avisa ao lançar rota para motorista que nunca entrou no app`.
