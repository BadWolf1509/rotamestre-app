# Conta, login e senha

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:**

- excluir a conta não deixa loja sem gestor nem rota sem dono, e preserva incidentes;
- quem está desativado em todas as lojas não entra;
- o logout desliga o que roda em nome da conta;
- a troca e a redefinição de senha seguem uma regra só e encerram as outras sessões.

**Origem (spec):** a varredura de 24/10/2026, relatórios `auth-notificacoes.md` (AN1, AN2, AN4, AN7–AN11), `backend.md` (B3) e `testes-ci.md` (TC7). Inclui também a correção "o Sair não para o rastreamento", achada na revisão final da 1.14.5.

**Decisões do usuário (24/10):**

- Excluir conta: **bloquear com motivo**.
  - O último gestor da loja precisa promover outro gestor antes.
  - O motorista com rota em andamento precisa finalizar, ou o gestor reatribuir.
  - Os incidentes ficam preservados, com o motorista anonimizado, como a tela promete.
- Desativado em **todas** as lojas não entra no app, com mensagem clara. O corte por loja fica no plano de permissões do banco.

**Tech Stack:** Supabase Auth, Edge Functions (Deno), React Native/Expo Router, Zod, Jest + RNTL.

## Global Constraints

- Tudo em PT-BR, nos padrões do `CLAUDE.md`. Os formulários de senha usam Zod (`src/lib/schemas/auth.ts`) + `FieldError`. Erro de servidor vai em `Dialog`/`useAlert`.
- **Banco único = produção.** Implementador não escreve no banco. A migration vai em `database/migrations/` e entra em `MIGRATIONS.md` (número **56** reservado), com sonda. Quem aplica a migration e publica a Edge Function é o controlador.
- Nunca digitar senha nem criar conta em teste manual. O login é sempre do usuário.
- TDD com vermelho visto. Antes de declarar pronto: jest completo (`npx jest --testPathIgnorePatterns=worktrees`), `tsc`, `eslint app src e2e --max-warnings=0` e `scan:morto:arquivos`.

## Review Focus

1. O único gestor ativo da loja tenta excluir a conta: é recusado com a instrução de promover outro gestor, e nada é apagado.
2. Motorista com rota em andamento tenta excluir: é recusado; depois de finalizar, consegue.
3. Motorista excluído com incidentes: os incidentes continuam visíveis ao gestor, sem o nome dele.
4. Motorista com vínculo inativo em todas as lojas faz login com a senha certa: vê a mensagem de conta desativada e não entra. Com um vínculo ativo, entra.
5. Logout com rota em andamento: o rastreamento para, o lembrete diário some, e uma posição que estava em voo não recria nada no aparelho.

---

### Task 1: excluir conta com guardas e incidentes preservados (B3, AN2, TC7)

`supabase/functions/delete-account/index.ts:58,99-101` apaga qualquer Bearer válido. `incidentes.motorista_id` é `ON DELETE CASCADE`, contra o texto de `app/exclusao-de-conta.tsx`.

- Edge Function: antes de apagar, recusar com código e mensagem em PT-BR:
  - quando quem chama é o único gestor ativo de alguma loja;
  - quando tem rota `em_andamento`.
    As mensagens dizem o que fazer.
- Migration 56: `incidentes.motorista_id` passa a `ON DELETE SET NULL`. Anonimizar os campos pessoais que o texto da tela promete. Confira a tela e liste os campos.
- Confirmação forte na tela, por exemplo digitar "EXCLUIR". Compare com reautenticar por senha e decida; lembre que a senha nunca é digitada por automação.
- Testes da função (Deno test ou no padrão do repo, se já houver): único gestor recusado; rota em andamento recusada; caso válido segue. Sonda da FK. Testes da tela.

### Task 2: login de desativado e logout que desliga tudo (AN1, AN4, logout×rastreamento)

- **AN1:** `src/lib/auth.ts:79` e `app/index.tsx:176` não conferem se a conta está ativa.
  - Motorista sem nenhum vínculo ativo, ou com `usuarios.ativo = false`, faz logout local e vê "Sua conta está desativada. Fale com o gestor."
  - Gestor com vínculo ativo não é afetado.
  - Offline com o perfil conhecido, manter o comportamento atual, que é o modo offline da 1.14.4.
- **Logout × rastreamento:** `signOut` não para o rastreamento.
  - Antes de `limparEstadoLocalDoUsuario`, parar a task de segundo plano (`stopBackgroundTracking`) e o modo navegação (`LocationTrackingService.stopTracking`).
  - O comentário de `limparEstadoLocal.ts` lista o contexto do rastreamento como algo que "não pode sumir" (PR #629). Revise isso, porque o `useGarantirRastreamentoDaRota` religa o rastreamento na próxima abertura com rota em andamento. Documente a decisão.
- **AN4:** o lembrete diário "Bom dia!" (`src/lib/notifications.ts:208,673`) continua agendado depois do logout e vale também para gestor. Cancelar no logout e agendar só para motorista.
- Testes: desativado não entra; ativo entra; logout para os dois rastreamentos e cancela o lembrete; lembrete não é agendado para gestor.

### Task 3: senha com regra única e sessões encerradas (AN7, AN8, AN9, AN10, AN11)

- **AN8:** a regra de senha diverge: o motorista aceita 6 caracteres, e as telas de troca não usam Zod (`app/motorista/perfil/senha.tsx:32`, `app/perfil/trocar-senha.tsx:96`).
  - Uma regra só em `src/lib/schemas/auth.ts`, igual à do cadastro e da redefinição.
  - As duas telas de troca passam para Zod + `FieldError`.
- **AN7:** a troca de senha do gestor diz "Senha atual incorreta" para qualquer falha. Distinguir senha errada, falta de rede e erro do servidor, como a tela do motorista já faz (1.14.4).
- **AN9:** trocar ou redefinir a senha encerra as outras sessões com `signOut({ scope: 'others' })` (`src/lib/auth.ts:263`, `app/auth/reset-password.tsx:67`).
- **AN10:** o limite de cadastro (`app/auth/register.tsx:55`) conta erro de rede e senha fraca como tentativa. Contar só tentativas que chegaram ao servidor e foram recusadas por abuso ou por e-mail.
- **AN11:** faltam acentos em `app/perfil/trocar-senha.tsx:130,133,194,369` ("Senha media", "Senha valida", "Minimo", "maiuscula", "Numero"). Corrigir e incluir esse arquivo na guarda `src/lib/__tests__/texto-visivel-com-acento.test.ts`. A guarda também precisa pegar "Suas informacoes" com maiúscula, minor adiado da 1.14.5.
- Testes para cada item.
