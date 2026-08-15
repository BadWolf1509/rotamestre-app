-- ============================================================================
-- Migration: admin_logs sobrevive à exclusão da conta
-- Date: 2026-08-15
-- Author: Wellinton Ribeiro
-- Purpose: `admin_logs.admin_id` referenciava `auth.users(id)` com NO ACTION,
--          e a coluna é NOT NULL. A combinação tornava impossível excluir uma
--          conta que já tivesse agido: a FK bloqueava o DELETE e não havia como
--          anular a coluna. As duas saídas eram ruins — apagar o log (destruir
--          justamente o que se quer auditar) ou deixar a conta órfã viva em
--          `auth.users`, ainda capaz de autenticar e, sem perfil, cair no portão
--          do onboarding e criar unidade.
--
--          O log de auditoria deve sobreviver ao fim da conta. Soltando a FK,
--          `admin_id` e `admin_email` (já NOT NULL e desnormalizado na própria
--          tabela) passam a ser registro histórico: dizem quem agiu mesmo depois
--          de a conta deixar de existir.
--
--          Caso concreto que motivou: uma conta de teste de motorista teve o
--          perfil excluído em 15/08, mas os 7 registros de 23/07 travavam a
--          remoção da conta de auth correspondente.
-- ============================================================================

BEGIN;

-- 1. Schema changes
-- Solta apenas a FK. `admin_id` continua NOT NULL: todo registro segue exigindo
-- autor, o que muda é que o autor não precisa mais existir em `auth.users`.
ALTER TABLE public.admin_logs
  DROP CONSTRAINT IF EXISTS admin_logs_admin_id_fkey;

-- 2. Indexes (especially FKs)
-- `idx_admin_logs_admin_id` já existe e é independente da constraint (o
-- Postgres não cria nem remove índice junto com FK). Recriado com IF NOT EXISTS
-- só para o caso de esta migration rodar sobre um banco onde ele não exista:
-- sem ele, filtrar log por autor vira seq scan.
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id
  ON public.admin_logs (admin_id);

-- 3. RLS
-- Sem alteração. A tabela mantém as policies que já tinha; soltar uma FK não
-- afeta visibilidade de linha.

-- 4. Functions / triggers
-- Nenhuma.

-- 5. Realtime
-- Não se aplica.

-- 6. Comments / documentation
COMMENT ON COLUMN public.admin_logs.admin_id IS
  'Autor da ação. Propositalmente SEM foreign key para auth.users: o log precisa '
  'sobreviver à exclusão da conta, senão auditoria e limpeza de contas viram '
  'objetivos opostos. Use admin_email (NOT NULL, na própria linha) para '
  'identificar o autor quando a conta não existir mais. NÃO recrie a FK.';

COMMIT;

-- ROLLBACK:
-- Recriar a FK só é possível se toda linha de admin_logs ainda tiver conta
-- correspondente em auth.users. Se alguma conta já foi excluída depois desta
-- migration, o ALTER falha — e é exatamente o cenário que ela existe para
-- permitir.
-- BEGIN;
-- ALTER TABLE public.admin_logs
--   ADD CONSTRAINT admin_logs_admin_id_fkey
--   FOREIGN KEY (admin_id) REFERENCES auth.users(id);
-- COMMIT;
