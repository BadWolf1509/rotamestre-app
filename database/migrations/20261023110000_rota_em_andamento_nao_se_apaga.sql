-- ============================================================================
-- Migration 41: rota em andamento não se apaga
-- Date: 2026-10-23
-- Author: Wellinton Ribeiro
-- Purpose: a política `rotas_delete` deixa o gestor ativo da loja apagar
-- QUALQUER rota dela, inclusive a que um motorista está fazendo agora — e o
-- DELETE leva em cascata paradas, comprovantes (registros), notificações e
-- posições. Até o PR #631 o dashboard desktop fazia exatamente isso. O app
-- agora reconsulta o status e condiciona o DELETE (`.neq('status',
-- 'em_andamento')`), mas isso é só o cliente: outra tela, um cliente antigo ou
-- uma chamada direta à API ainda apagariam. Este gatilho é a trava no banco.
--
-- Regra: BEFORE DELETE em public.rotas recusa com a sentinela
-- 'ROTA_EM_ANDAMENTO' (ERRCODE P0001) quando OLD.status = 'em_andamento' e há
-- usuário autenticado (`auth.uid()` não nulo).
--
-- Sem usuário (`auth.uid()` nulo) segue livre, de propósito:
-- - chave secreta / service_role (painel admin, Edge Functions de manutenção);
-- - o DELETE em cascata de `unidades` (FK rotas_unidade_id_fkey ON DELETE
--   CASCADE). Nenhuma política deixa `authenticated` apagar unidade (medido em
--   23/10/2026: `unidades` não tem política de DELETE), então essa cascata só
--   acontece por service_role, sem JWT de usuário — e não é barrada.
--   Ressalva: se um dia uma Edge Function apagar unidade com o JWT do usuário
--   repassado, a cascata pararia na primeira rota em andamento — é o desejável.
-- - SQL Editor / postgres (manutenção).
--
-- Alternativa descartada: acrescentar `status <> 'em_andamento'` à política
-- `rotas_delete`. A RLS recusa DELETE sem erro (0 linhas), então o gestor não
-- saberia por quê; e trocar política exige DROP POLICY (o MCP recusa).
--
-- SECURITY DEFINER com search_path vazio: tudo qualificado (auth.uid()). A
-- função só é chamada pelo gatilho; ninguém executa direto.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.recusa_apagar_rota_em_andamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'em_andamento' AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'ROTA_EM_ANDAMENTO: a rota está em andamento e não pode ser excluída.'
      USING ERRCODE = 'P0001',
            HINT = 'Aguarde a conclusão ou cancele a rota antes de excluir.';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recusa_apagar_rota_em_andamento() FROM PUBLIC, anon, authenticated;

-- CREATE OR REPLACE (PG14+) em vez de DROP + CREATE: idempotente sem DROP TRIGGER.
CREATE OR REPLACE TRIGGER trg_recusa_apagar_rota_em_andamento
  BEFORE DELETE ON public.rotas
  FOR EACH ROW
  EXECUTE FUNCTION public.recusa_apagar_rota_em_andamento();

COMMENT ON FUNCTION public.recusa_apagar_rota_em_andamento() IS
  'Recusa (sentinela ROTA_EM_ANDAMENTO, P0001) o DELETE de rota em andamento por usuário autenticado; service_role e cascata administrativa seguem livres (Migration 41).';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_recusa_apagar_rota_em_andamento ON public.rotas;
-- DROP FUNCTION IF EXISTS public.recusa_apagar_rota_em_andamento();
-- COMMIT;
