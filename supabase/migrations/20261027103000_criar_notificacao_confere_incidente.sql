-- ============================================================================
-- Migration 79: criar_notificacao avisa quando não grava e confere o incidente
-- Date: 2026-10-27
-- Author: Wellinton Ribeiro
-- Purpose:
--   Duas melhorias na `criar_notificacao` (última definição na Migration 32,
--   `20261022120000_push_sem_service_role_e_http_fechado.sql`):
--
--   1. O INSERT em `notificacoes` fica num bloco `EXCEPTION WHEN OTHERS THEN
--      RETURN NULL`. O NULL é de propósito — os gatilhos `notify_*` chamam a
--      função e não podem derrubar a escrita principal (parada pulada, SOS,
--      rota concluída) por causa de um aviso —, e `avisar_gestores_do_sos`
--      conta os avisos pelo NULL. Mas nada fica registrado: uma FK, um CHECK
--      de `tipo` ou coluna nova que recuse o INSERT some sem rastro. Agora o
--      bloco faz `RAISE WARNING` com SQLSTATE e mensagem antes do RETURN NULL:
--      vai para o log do Postgres e não muda o resultado de ninguém.
--   2. Na chamada direta (RPC, `pg_trigger_depth() = 0` com usuário), a
--      função já confere o destinatário, a rota e a parada que viram
--      deep-link no push; o `p_incidente_id` passava sem conferência. Agora,
--      se vier, o incidente tem de ser de uma loja onde quem chama é gestor
--      ativo; senão 'Incidente não pertence a uma loja do gestor.'
--      (insufficient_privilege), como as outras três conferências. O caminho
--      dos gatilhos não muda (eles montam o incidente a partir da própria
--      linha).
--
--   Medido em 26/10/2026 (só SELECT): definição viva igual ao arquivo da
--   Migration 32 (DEFINER, `search_path = ''`, dono postgres, EXECUTE para
--   authenticated e service_role, sem PUBLIC/anon). O único chamador direto
--   no app é `notificarMotoristaRotaEditada` (`src/lib/routeUtils.ts`), que
--   não manda `p_incidente_id`.
--
--   Alternativas consideradas:
--     (a) WARNING e devolver NULL (escolhida): mantém o contrato dos gatilhos
--         e de `avisar_gestores_do_sos` e deixa rastro;
--     (b) relançar o erro: o gatilho que avisa o gestor derrubaria a escrita
--         do motorista (concluir/pular parada) por causa da notificação;
--     (c) gravar a recusa numa tabela de erros: tabela nova, policy nova,
--         para um evento que hoje não acontece — o log do Postgres basta.
--   Conferência do incidente pela loja do incidente (escolhida) ou pela rota
--   informada: incidente pode não ter rota (SOS sem rota), e toda linha de
--   `incidentes` tem `unidade_id` (Migration 62).
--
--   Efeito no app: nenhum — o app não manda incidente na chamada direta, e o
--   resultado da função não muda.
--
--   `SET LOCAL lock_timeout = '3s'`: pelo padrão das migrations.
--   CREATE OR REPLACE preserva a ACL; REVOKE/GRANT repetem a de hoje.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.criar_notificacao(
  p_usuario_id uuid,
  p_tipo character varying,
  p_titulo character varying,
  p_mensagem text,
  p_rota_id uuid DEFAULT NULL::uuid,
  p_parada_id uuid DEFAULT NULL::uuid,
  p_incidente_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_notificacao_id UUID;
  v_chamador UUID := auth.uid();
BEGIN
  -- Chamada direta por um usuário (RPC). De dentro de gatilho (notify_*) ou
  -- sem usuário (service/cron) a regra não se aplica.
  IF pg_trigger_depth() = 0 AND v_chamador IS NOT NULL THEN
    -- Só gestor ativo, e só para quem é ativo numa loja onde ele é gestor.
    IF NOT EXISTS (
      SELECT 1
      FROM public.usuario_unidades c
      JOIN public.usuario_unidades d
        ON d.unidade_id = c.unidade_id AND d.usuario_id = p_usuario_id AND d.ativo
      WHERE c.usuario_id = v_chamador AND c.ativo AND c.papel = 'gestor'
    ) THEN
      RAISE EXCEPTION 'Sem permissão para notificar este usuário.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- A rota, se vier, é da loja dos dois (vínculo em duas lojas não cruza).
    IF p_rota_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.rotas r
      JOIN public.usuario_unidades c
        ON c.unidade_id = r.unidade_id AND c.usuario_id = v_chamador
       AND c.ativo AND c.papel = 'gestor'
      JOIN public.usuario_unidades d
        ON d.unidade_id = r.unidade_id AND d.usuario_id = p_usuario_id AND d.ativo
      WHERE r.id = p_rota_id
    ) THEN
      RAISE EXCEPTION 'Sem permissão para notificar sobre esta rota.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- A parada, se vier, é da rota informada (o deep-link do push usa as duas).
    IF p_parada_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.paradas pa
      WHERE pa.id = p_parada_id AND pa.rota_id = p_rota_id
    ) THEN
      RAISE EXCEPTION 'Parada não pertence à rota informada.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- O incidente, se vier, é de uma loja onde quem chama é gestor ativo.
    IF p_incidente_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.incidentes i
      JOIN public.usuario_unidades c
        ON c.unidade_id = i.unidade_id AND c.usuario_id = v_chamador
       AND c.ativo AND c.papel = 'gestor'
      WHERE i.id = p_incidente_id
    ) THEN
      RAISE EXCEPTION 'Incidente não pertence a uma loja do gestor.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.notificacoes (
      usuario_id, tipo, titulo, mensagem, rota_id, parada_id, incidente_id
    ) VALUES (
      p_usuario_id, p_tipo, p_titulo, p_mensagem, p_rota_id, p_parada_id, p_incidente_id
    ) RETURNING id INTO v_notificacao_id;
  EXCEPTION WHEN OTHERS THEN
    -- O aviso nunca derruba quem o pediu (gatilhos), mas deixa rastro.
    RAISE WARNING 'criar_notificacao não gravou (tipo %, usuário %): % %', p_tipo, p_usuario_id, SQLSTATE, SQLERRM;
    RETURN NULL;
  END;

  RETURN v_notificacao_id;
END;
$$;

ALTER FUNCTION public.criar_notificacao(uuid, character varying, character varying, text, uuid, uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.criar_notificacao(uuid, character varying, character varying, text, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_notificacao(uuid, character varying, character varying, text, uuid, uuid, uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.criar_notificacao(uuid, character varying, character varying, text, uuid, uuid, uuid) IS
  'Migration 79 (sobre a 32): grava a notificação e devolve o id, ou NULL (com WARNING no log) quando o INSERT não grava. Na chamada direta confere destinatário, rota, parada e incidente pela loja de quem chama (gestor ativo).';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl,
--        position('RAISE WARNING' in p.prosrc) > 0 AS avisa
--   FROM pg_proc p
--  WHERE p.oid = to_regprocedure('public.criar_notificacao(uuid, character varying, character varying, text, uuid, uuid, uuid)');
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- CREATE OR REPLACE FUNCTION public.criar_notificacao(
--   p_usuario_id uuid,
--   p_tipo character varying,
--   p_titulo character varying,
--   p_mensagem text,
--   p_rota_id uuid DEFAULT NULL::uuid,
--   p_parada_id uuid DEFAULT NULL::uuid,
--   p_incidente_id uuid DEFAULT NULL::uuid
-- )
-- RETURNS uuid
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = ''
-- AS $$
-- DECLARE
--   v_notificacao_id UUID;
--   v_chamador UUID := auth.uid();
-- BEGIN
--   IF pg_trigger_depth() = 0 AND v_chamador IS NOT NULL THEN
--     IF NOT EXISTS (
--       SELECT 1
--       FROM public.usuario_unidades c
--       JOIN public.usuario_unidades d
--         ON d.unidade_id = c.unidade_id AND d.usuario_id = p_usuario_id AND d.ativo
--       WHERE c.usuario_id = v_chamador AND c.ativo AND c.papel = 'gestor'
--     ) THEN
--       RAISE EXCEPTION 'Sem permissão para notificar este usuário.'
--         USING ERRCODE = 'insufficient_privilege';
--     END IF;
--     IF p_rota_id IS NOT NULL AND NOT EXISTS (
--       SELECT 1
--       FROM public.rotas r
--       JOIN public.usuario_unidades c
--         ON c.unidade_id = r.unidade_id AND c.usuario_id = v_chamador
--        AND c.ativo AND c.papel = 'gestor'
--       JOIN public.usuario_unidades d
--         ON d.unidade_id = r.unidade_id AND d.usuario_id = p_usuario_id AND d.ativo
--       WHERE r.id = p_rota_id
--     ) THEN
--       RAISE EXCEPTION 'Sem permissão para notificar sobre esta rota.'
--         USING ERRCODE = 'insufficient_privilege';
--     END IF;
--     IF p_parada_id IS NOT NULL AND NOT EXISTS (
--       SELECT 1 FROM public.paradas pa
--       WHERE pa.id = p_parada_id AND pa.rota_id = p_rota_id
--     ) THEN
--       RAISE EXCEPTION 'Parada não pertence à rota informada.'
--         USING ERRCODE = 'insufficient_privilege';
--     END IF;
--   END IF;
--   BEGIN
--     INSERT INTO public.notificacoes (
--       usuario_id, tipo, titulo, mensagem, rota_id, parada_id, incidente_id
--     ) VALUES (
--       p_usuario_id, p_tipo, p_titulo, p_mensagem, p_rota_id, p_parada_id, p_incidente_id
--     ) RETURNING id INTO v_notificacao_id;
--   EXCEPTION WHEN OTHERS THEN
--     RETURN NULL;
--   END;
--   RETURN v_notificacao_id;
-- END;
-- $$;
-- ALTER FUNCTION public.criar_notificacao(uuid, character varying, character varying, text, uuid, uuid, uuid) OWNER TO postgres;
-- REVOKE ALL ON FUNCTION public.criar_notificacao(uuid, character varying, character varying, text, uuid, uuid, uuid) FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.criar_notificacao(uuid, character varying, character varying, text, uuid, uuid, uuid) TO authenticated, service_role;
-- COMMIT;
