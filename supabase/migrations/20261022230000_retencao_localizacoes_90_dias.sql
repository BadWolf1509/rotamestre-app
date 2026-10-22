-- ============================================================================
-- Migration 37: retenção de motorista_locations (90 dias)
-- Date: 2026-10-22
-- Author: Wellinton Ribeiro
-- Purpose: `motorista_locations` guarda uma posição a cada ~5 s em movimento e
-- nunca era apagada (67 mil linhas em 22/10/2026, desde 18/12/2025). Ninguém lê
-- o histórico: o app só usa a posição mais recente, para o mapa ao vivo. Esta
-- função apaga as posições das rotas encerradas (concluída, cancelada, não
-- executada) cujo dia (`rotas.data`) ficou mais de N dias para trás — 90 por
-- padrão, decisão do gestor em 22/10/2026. Rota pendente ou em andamento nunca
-- perde posição, qualquer que seja a data.
--
-- Não há pg_cron no projeto: a Edge Function `expire-routes`, chamada todo dia
-- às 22:00 pelo cron do GitHub, chama esta função depois da expiração.
-- Só `service_role` executa; `anon` e `authenticated` não.
--
-- Também remove `cleanup_old_locations()` (Migration 007): sem chamador, apagava
-- tudo com mais de 24 h — contradiz esta retenção — e seguia executável por
-- PUBLIC/anon/authenticated (o RLS barrava o DELETE; achado do rls-policy-reviewer).
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.cleanup_old_locations();

CREATE OR REPLACE FUNCTION public.limpar_localizacoes_antigas(p_dias integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_apagadas integer;
BEGIN
  -- Piso de segurança: um parâmetro errado não pode zerar a semana corrente.
  IF p_dias IS NULL OR p_dias < 30 THEN
    RAISE EXCEPTION 'Retenção mínima de motorista_locations é 30 dias (recebido: %).', p_dias;
  END IF;

  DELETE FROM public.motorista_locations ml
  USING public.rotas r
  WHERE r.id = ml.rota_id
    AND r.status IN ('concluida', 'cancelada', 'nao_executada')
    AND r.data < current_date - p_dias;

  GET DIAGNOSTICS v_apagadas = ROW_COUNT;
  RETURN v_apagadas;
END;
$$;

REVOKE ALL ON FUNCTION public.limpar_localizacoes_antigas(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.limpar_localizacoes_antigas(integer) TO service_role;

COMMENT ON FUNCTION public.limpar_localizacoes_antigas(integer) IS
  'Apaga posições de rotas encerradas com data mais antiga que p_dias (padrão 90, mínimo 30). Chamada pela Edge Function expire-routes (Migration 37).';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.limpar_localizacoes_antigas(integer);
-- -- cleanup_old_locations não volta: estava morta (ver Migration 007 se precisar).
-- COMMIT;
-- (As linhas já apagadas não voltam.)
