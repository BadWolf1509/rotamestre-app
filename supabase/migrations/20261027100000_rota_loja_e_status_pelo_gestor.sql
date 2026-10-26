-- ============================================================================
-- Migration 76: rota muda de loja e de status pelo gestor
-- Date: 2026-10-27
-- Author: Wellinton Ribeiro
-- Purpose:
--   A policy `rotas_update` deixa o gestor ativo da loja e o motorista ativo
--   da rota atualizarem a linha, e o WITH CHECK nulo repete o USING sobre a
--   linha nova. Duas regras do produto passam a valer também no banco:
--
--   1. Loja. A troca de rota entre lojas, para a parada e para o incidente,
--      já é só do gestor das duas lojas (Migrations 58 e 59). Para a própria
--      rota, o gatilho `validar_motorista_e_loja_da_rota` confere apenas o
--      vínculo do motorista na loja nova. A rota passa a seguir a mesma regra
--      da parada e do incidente.
--   2. Status. Cancelar e reativar são do gestor (RPCs das Migrations 70 e
--      71); o motorista inicia e conclui. A Migration 75 cuidou da saída de
--      rota encerrada; esta cuida da entrada: o motorista não leva a rota a
--      `cancelada` nem a `nao_executada` (a expiração é do cron).
--
--   Regra nova: o gatilho `trg_rotas_loja_e_status_pelo_gestor` (BEFORE UPDATE
--   OF unidade_id, status, por linha, WHEN uma das duas muda), com a função
--   `public.rotas_loja_e_status_pelo_gestor()`:
--     - sessão sem usuário (`auth.uid()` nulo: cron, chave secreta, CLI)
--       passa, como nas Migrations 58/59;
--     - `unidade_id` muda: exige vínculo ativo de gestor na loja antiga E na
--       nova; senão 42501;
--     - `status` muda e quem pede não é gestor ativo da loja da rota: só
--       `pendente → em_andamento` (iniciar) e `em_andamento → concluida`
--       passam; o resto é P0001 'ROTA_TRANSICAO_RECUSADA'.
--   `em_andamento → concluida` fica aberto de propósito: é o que a
--   `finalizar_rota` faz (SECURITY DEFINER, mas com a sessão do motorista, e
--   `auth.uid()` segue sendo ele) e o que o app até a 1.14.2 faz por UPDATE
--   direto (a RPC entrou no app em 23/10/2026, #630). Fechar essa transição
--   pede antes confirmar que nenhuma instalação anterior à 1.14.3 segue em uso.
--
--   Por que `auth.uid()` e não `current_user` (como a Migration 75): aqui a
--   regra depende de QUEM é a pessoa (gestor ou não da loja), e a função
--   precisa ler `usuario_unidades` sem depender do RLS — por isso SECURITY
--   DEFINER, e dentro dela `current_user` é sempre o dono. As RPCs que mudam
--   status de rota continuam passando: `cancelar_rota` e `reativar_rota`
--   rodam com a sessão de um gestor ativo da loja (conferido nelas antes);
--   `finalizar_rota` faz `em_andamento → concluida`; `expire_old_pending_routes`
--   roda sem usuário (cron com a chave secreta). Nenhuma RPC muda
--   `unidade_id`.
--
--   Medido em 26/10/2026 (só SELECT):
--     - `rotas_update`: USING = vínculo ativo na loja da rota E (gestor OU
--       motorista da rota com `usuario_atual_ativo()`); WITH CHECK nulo;
--     - gatilhos de `rotas`: BEFORE `trg_recusa_apagar_rota_em_andamento`,
--       `trg_rota_encerrada_nao_volta` (M75), `trg_validar_motorista_e_loja_da_rota`,
--       `update_rotas_updated_at`; nenhum confere quem muda a loja nem a
--       transição de entrada. Na ordem alfabética dos BEFORE, o novo roda
--       depois do da M75 e antes do de validação; como só recusa ou deixa
--       passar sem mudar NEW, a ordem não muda o resultado;
--     - app (todas as versões no git): o motorista só grava em `rotas`
--       `status: 'em_andamento'` + `iniciada_em` (`startRoute`) e, até a
--       1.14.2, `status: 'concluida'` + `concluida_em` (finalizar); nunca
--       `unidade_id`. O gestor muda status pelas RPCs (1.14.8) ou, na 1.14.7,
--       por UPDATE direto — como gestor ativo, segue passando;
--     - e2e (`garantir-rota-do-mapa.ts`): só muda rota aberta para
--       `em_andamento` (ou mantém), como gestor ou como o app — passa.
--
--   Alternativas consideradas:
--     (a) gatilho único para loja e status, DEFINER com `auth.uid()`
--         (escolhida): mesma forma das Migrations 58/59, erro explícito,
--         lê o vínculo sem depender do RLS, um só lugar para a regra da rota;
--     (b) só a parte da loja, dentro de `validar_motorista_e_loja_da_rota`:
--         o mínimo, mas não cobre a regra de status, e depois da Migration 75
--         uma rota cancelada não se desfaz;
--     (c) WITH CHECK na `rotas_update`: não vê a linha antiga (nem a loja de
--         origem nem a transição), e a recusa sairia como erro genérico de
--         policy, sem dizer o porquê;
--     (d) restringir também as outras colunas para o motorista (data, nome,
--         motorista_id...): fecha mais, mas não há registro completo do que
--         as versões antigas gravam em `rotas` — fica para quando a 1.14.2 e
--         anteriores saírem de uso.
--
--   Efeito no app:
--     - motorista (qualquer versão): nenhum — iniciar e finalizar continuam;
--     - gestor (qualquer versão): nenhum — é gestor ativo da loja da rota;
--       trocar a loja de uma rota não existe no app;
--     - quem receber 'ROTA_TRANSICAO_RECUSADA' é UPDATE que o app não faz.
--
--   `SET LOCAL lock_timeout = '3s'`: o DROP TRIGGER IF EXISTS pede ACCESS
--   EXCLUSIVE em `rotas` e o CREATE TRIGGER pede SHARE ROW EXCLUSIVE;
--   enquanto esperam, seguram leituras e escritas do app. Se a trava não vier
--   em 3 s, a migration para sem efeito e é repetida.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.rotas_loja_e_status_pelo_gestor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_gestor_origem boolean;
BEGIN
  -- Cron, chave secreta e CLI não têm usuário.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  v_gestor_origem := EXISTS (
    SELECT 1
      FROM public.usuario_unidades uu
     WHERE uu.usuario_id = v_uid
       AND uu.unidade_id = OLD.unidade_id
       AND uu.ativo = true
       AND uu.papel::text = 'gestor'
  );

  IF NEW.unidade_id IS DISTINCT FROM OLD.unidade_id THEN
    IF NOT (v_gestor_origem AND EXISTS (
      SELECT 1
        FROM public.usuario_unidades uu
       WHERE uu.usuario_id = v_uid
         AND uu.unidade_id = NEW.unidade_id
         AND uu.ativo = true
         AND uu.papel::text = 'gestor'
    )) THEN
      RAISE EXCEPTION 'A rota só muda de loja pelo gestor das duas lojas.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT v_gestor_origem THEN
    IF NOT (
         (OLD.status = 'pendente' AND NEW.status = 'em_andamento')
      OR (OLD.status = 'em_andamento' AND NEW.status = 'concluida')
    ) THEN
      RAISE EXCEPTION 'ROTA_TRANSICAO_RECUSADA'
        USING ERRCODE = 'P0001',
              DETAIL = format('A rota %s não passa de %s a %s por este usuário.', OLD.id, OLD.status, NEW.status),
              HINT = 'Recarregue a rota.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.rotas_loja_e_status_pelo_gestor() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rotas_loja_e_status_pelo_gestor() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.rotas_loja_e_status_pelo_gestor() IS
  'Migration 76: gatilho BEFORE UPDATE OF unidade_id, status de rotas. A rota só muda de loja pelo gestor ativo das duas lojas (42501). Quem não é gestor ativo da loja da rota só leva o status de pendente a em_andamento e de em_andamento a concluida (P0001 ROTA_TRANSICAO_RECUSADA). Sessão sem usuário passa.';

DROP TRIGGER IF EXISTS trg_rotas_loja_e_status_pelo_gestor ON public.rotas;
CREATE TRIGGER trg_rotas_loja_e_status_pelo_gestor
  BEFORE UPDATE OF unidade_id, status ON public.rotas
  FOR EACH ROW
  WHEN (OLD.unidade_id IS DISTINCT FROM NEW.unidade_id OR OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.rotas_loja_e_status_pelo_gestor();

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT pg_get_triggerdef(t.oid), t.tgenabled FROM pg_trigger t
--  WHERE t.tgrelid = 'public.rotas'::regclass AND t.tgname = 'trg_rotas_loja_e_status_pelo_gestor';
-- SELECT p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl
--   FROM pg_proc p WHERE p.oid = to_regprocedure('public.rotas_loja_e_status_pelo_gestor()');
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_rotas_loja_e_status_pelo_gestor ON public.rotas;
-- DROP FUNCTION IF EXISTS public.rotas_loja_e_status_pelo_gestor();
-- COMMIT;
