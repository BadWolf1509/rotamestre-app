-- ============================================================================
-- Migration 76: status da rota pelo gestor (o motorista só inicia e conclui)
-- Date: 2026-10-27
-- Author: Wellinton Ribeiro
-- Purpose:
--   A policy `rotas_update` deixa o gestor ativo da loja e o motorista ativo
--   da rota atualizarem a linha, sem olhar a transição de status. Cancelar e
--   reativar são do gestor (RPCs das Migrations 70 e 71); o motorista inicia
--   e conclui. A Migration 75 cuidou da saída de rota encerrada; esta cuida
--   da entrada: o motorista não leva a rota a `cancelada` nem a
--   `nao_executada` (a expiração é do cron), e depois da Migration 75 uma
--   rota cancelada não se desfaz.
--
--   Regra nova: o gatilho `trg_rota_status_pelo_gestor` (BEFORE UPDATE OF
--   status, por linha, WHEN o status muda), com a função
--   `public.rota_status_pelo_gestor()`:
--     - sessão sem usuário (`auth.uid()` nulo: cron, chave secreta, CLI)
--       passa, como nas Migrations 58/59;
--     - gestor ativo da loja da rota passa;
--     - quem mais pedir só faz `pendente → em_andamento` (iniciar) e
--       `em_andamento → concluida`; o resto é P0001 'ROTA_TRANSICAO_RECUSADA'.
--   `em_andamento → concluida` fica aberto de propósito: é o que a
--   `finalizar_rota` faz (SECURITY DEFINER, mas com a sessão do motorista, e
--   `auth.uid()` segue sendo ele) e o que o app até a 1.14.2 faz por UPDATE
--   direto (a RPC entrou no app em 23/10/2026, #630). Fechar essa transição
--   pede antes confirmar que nenhuma instalação anterior à 1.14.3 segue em uso.
--
--   Troca de loja: fora desta migration. O papel `authenticated` não tem
--   UPDATE na coluna `rotas.unidade_id` — os privilégios de UPDATE em `rotas`
--   são por coluna e `unidade_id` está fora (has_column_privilege = false;
--   information_schema.column_privileges lista as 18 outras colunas). Pela
--   API, qualquer UPDATE que toque `unidade_id` recebe 42501 "permission
--   denied for table rotas" antes de policy ou gatilho. A sonda prova isso
--   antes e depois desta migration.
--
--   Por que `auth.uid()` e não `current_user` (como a Migration 75): aqui a
--   regra depende de QUEM é a pessoa (gestor ou não da loja), e a função
--   precisa ler `usuario_unidades` sem depender do RLS — por isso SECURITY
--   DEFINER, e dentro dela `current_user` é sempre o dono. As RPCs que mudam
--   status de rota continuam passando: `cancelar_rota` e `reativar_rota`
--   rodam com a sessão de um gestor ativo da loja (conferido nelas antes);
--   `finalizar_rota` faz `em_andamento → concluida`; `expire_old_pending_routes`
--   roda sem usuário (cron com a chave secreta).
--
--   Medido em 26/10/2026 (só SELECT):
--     - `rotas_update`: USING = vínculo ativo na loja da rota E (gestor OU
--       motorista da rota com `usuario_atual_ativo()`); WITH CHECK nulo;
--     - gatilhos de `rotas`: BEFORE `trg_recusa_apagar_rota_em_andamento`,
--       `trg_rota_encerrada_nao_volta` (M75), `trg_validar_motorista_e_loja_da_rota`,
--       `update_rotas_updated_at`; nenhum confere a transição de entrada. Na
--       ordem alfabética dos BEFORE, o novo roda depois do da M75; como só
--       recusa ou deixa passar sem mudar NEW, a ordem não muda o resultado;
--     - app (todas as versões no git): o motorista só grava em `rotas`
--       `status: 'em_andamento'` + `iniciada_em` (`startRoute`) e, até a
--       1.14.2, `status: 'concluida'` + `concluida_em` (finalizar). O gestor
--       muda status pelas RPCs (1.14.8) ou, na 1.14.7, por UPDATE direto —
--       como gestor ativo, segue passando;
--     - e2e (`garantir-rota-do-mapa.ts`): só muda rota aberta para
--       `em_andamento` (ou mantém), como gestor ou como o app — passa.
--
--   Alternativas consideradas:
--     (a) gatilho BEFORE UPDATE OF status, DEFINER com `auth.uid()`
--         (escolhida): mesma forma das Migrations 58/59, erro explícito, lê
--         o vínculo sem depender do RLS;
--     (b) WITH CHECK na `rotas_update`: não vê a linha antiga (a transição),
--         e a recusa sairia como erro genérico de policy;
--     (c) tirar o UPDATE da coluna `status` do `authenticated`: recusaria
--         também o início da rota pelo motorista e o gestor 1.14.7;
--     (d) restringir também as outras colunas para o motorista (data, nome,
--         motorista_id...): fecha mais, mas não há registro completo do que
--         as versões antigas gravam em `rotas` — fica para quando a 1.14.2 e
--         anteriores saírem de uso.
--
--   Efeito no app:
--     - motorista (qualquer versão): nenhum — iniciar e finalizar continuam;
--     - gestor (qualquer versão): nenhum — é gestor ativo da loja da rota;
--     - quem receber 'ROTA_TRANSICAO_RECUSADA' é UPDATE que o app não faz.
--
--   `SET LOCAL lock_timeout = '3s'`: o DROP TRIGGER IF EXISTS pede ACCESS
--   EXCLUSIVE em `rotas` e o CREATE TRIGGER pede SHARE ROW EXCLUSIVE;
--   enquanto esperam, seguram leituras e escritas do app. Se a trava não vier
--   em 3 s, a migration para sem efeito e é repetida.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.rota_status_pelo_gestor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Cron, chave secreta e CLI não têm usuário.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.usuario_unidades uu
     WHERE uu.usuario_id = v_uid
       AND uu.unidade_id = OLD.unidade_id
       AND uu.ativo = true
       AND uu.papel::text = 'gestor'
  ) THEN
    RETURN NEW;
  END IF;

  IF (OLD.status = 'pendente' AND NEW.status = 'em_andamento')
     OR (OLD.status = 'em_andamento' AND NEW.status = 'concluida') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'ROTA_TRANSICAO_RECUSADA'
    USING ERRCODE = 'P0001',
          DETAIL = format('A rota %s não passa de %s a %s por este usuário.', OLD.id, OLD.status, NEW.status),
          HINT = 'Recarregue a rota.';
END;
$$;

ALTER FUNCTION public.rota_status_pelo_gestor() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rota_status_pelo_gestor() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.rota_status_pelo_gestor() IS
  'Migration 76: gatilho BEFORE UPDATE OF status de rotas. Quem não é gestor ativo da loja da rota só leva o status de pendente a em_andamento e de em_andamento a concluida (P0001 ROTA_TRANSICAO_RECUSADA). Sessão sem usuário passa.';

DROP TRIGGER IF EXISTS trg_rota_status_pelo_gestor ON public.rotas;
CREATE TRIGGER trg_rota_status_pelo_gestor
  BEFORE UPDATE OF status ON public.rotas
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.rota_status_pelo_gestor();

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT pg_get_triggerdef(t.oid), t.tgenabled FROM pg_trigger t
--  WHERE t.tgrelid = 'public.rotas'::regclass AND t.tgname = 'trg_rota_status_pelo_gestor';
-- SELECT p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl
--   FROM pg_proc p WHERE p.oid = to_regprocedure('public.rota_status_pelo_gestor()');
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_rota_status_pelo_gestor ON public.rotas;
-- DROP FUNCTION IF EXISTS public.rota_status_pelo_gestor();
-- COMMIT;
