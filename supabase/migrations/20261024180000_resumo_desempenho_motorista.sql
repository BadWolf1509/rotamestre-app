-- ============================================================================
-- Migration 55: totais de desempenho do motorista somados no servidor
-- Date: 2026-10-24
-- Author: Wellinton Ribeiro
-- Purpose: Desempenho e marcos do motorista buscavam as rotas e depois
-- `paradas ... .in('rota_id', todas)`. Com o motorista de maior volume (393
-- rotas, 2.235 paradas), o PostgREST corta a resposta em 1.000 linhas sem erro
-- (contadores errados), e a lista de ids passa de 14 KB na URL (marcos). A RPC
-- `resumo_desempenho_motorista` devolve os totais numa linha só.
--
-- Quem pode chamar (senão 42501):
--   * o próprio motorista com o cadastro ativo (`usuario_atual_ativo()`, a
--     decisão da Migration 49);
--   * o gestor com vínculo ATIVO numa loja à qual o motorista é vinculado.
-- O que entra na soma: só as rotas que a RLS de `rotas` (`rotas_select`)
-- deixaria quem chama ver — mesmo predicado, escrito aqui porque a função é
-- DEFINER: loja com vínculo ativo de quem chama E (papel gestor OU a rota é
-- de quem chama e ele está ativo). Logo o gestor da loja A vê, de um motorista
-- que atende A e B, só os números de A; gestor de outra loja é recusado.
--
-- Período (`p_dias`): dias corridos para trás, sobre `rotas.data` (`date`),
-- a partir de HOJE EM America/Sao_Paulo (a convenção da Migration 20260827190000;
-- o Brasil não tem horário de verão desde 2019):
--   v_desde = (now() AT TIME ZONE 'America/Sao_Paulo')::date - p_dias
--   entra a rota com data >= v_desde (p_dias = 7 → hoje e os 7 dias antes).
-- `p_dias` NULL = desde sempre. É o mesmo recorte que o app fazia no cliente
-- (`toLocalISODate(hoje - N)` + `gte('data', ...)`), agora fixo no fuso do
-- Brasil em vez do relógio do aparelho. `desde` volta na linha para conferência.
--
-- Paradas: partida e chegada (`is_checkpoint = false`) não contam; NULL e true
-- contam (o `.or('is_checkpoint.is.null,is_checkpoint.eq.true')` do app).
-- `entregas_em_rotas_concluidas` = paradas concluídas de rotas concluídas
-- (a base dos marcos, como `useMilestones` contava).
--
-- Alternativa comparada: paginar no cliente (lotes de 50 ids + `range`, como
-- `contarParadasDasRotas` faz na Gestão de Rotas). Acerta os totais, mas baixa
-- todas as paradas do período para contá-las (2.235 linhas em ~9 requisições
-- no celular) e repete a regra de visibilidade no app. A RPC responde com uma
-- linha. As LISTAS (cards do Histórico, gráfico da semana) seguem no cliente
-- com paginação, porque ali as linhas são necessárias de qualquer jeito; e o
-- app usa a paginação como reserva enquanto esta função não existir.
--
-- Desempenho (EXPLAIN ANALYZE do corpo, motorista de 393 rotas, 24/10/2026):
-- ~19 ms; usa idx_rotas_unidade/idx_rotas_motorista e idx_paradas_rota.
-- Nenhum índice novo.
--
-- Função nova: nada muda para o app instalado, que não a chama.
-- ============================================================================

BEGIN;

CREATE FUNCTION public.resumo_desempenho_motorista(
  p_motorista_id uuid,
  p_dias integer DEFAULT NULL
)
RETURNS TABLE (
  desde date,
  total_rotas integer,
  rotas_concluidas integer,
  rotas_canceladas integer,
  distancia_total numeric,
  total_paradas integer,
  paradas_concluidas integer,
  paradas_puladas integer,
  entregas_em_rotas_concluidas integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ativo boolean := public.usuario_atual_ativo();
  v_desde date;
BEGIN
  IF v_uid IS NULL OR p_motorista_id IS NULL OR NOT (
    (v_uid = p_motorista_id AND v_ativo)
    OR EXISTS (
      SELECT 1
      FROM public.usuario_unidades g
      JOIN public.usuario_unidades m
        ON m.unidade_id = g.unidade_id
       AND m.usuario_id = p_motorista_id
       AND m.papel = 'motorista'
      WHERE g.usuario_id = v_uid
        AND g.papel = 'gestor' AND g.ativo
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ver os números deste motorista.'
      USING ERRCODE = '42501';
  END IF;

  IF p_dias IS NOT NULL THEN
    IF p_dias < 0 THEN
      RAISE EXCEPTION 'Período inválido: p_dias não pode ser negativo.'
        USING ERRCODE = '22023';
    END IF;
    v_desde := (now() AT TIME ZONE 'America/Sao_Paulo')::date - p_dias;
  END IF;

  RETURN QUERY
  WITH rv AS (
    SELECT r.id, r.status AS st, r.distancia_total AS km
    FROM public.rotas r
    WHERE r.motorista_id = p_motorista_id
      AND (v_desde IS NULL OR r.data >= v_desde)
      AND EXISTS (
        SELECT 1
        FROM public.usuario_unidades uu
        WHERE uu.usuario_id = v_uid AND uu.unidade_id = r.unidade_id AND uu.ativo AND (uu.papel = 'gestor' OR (r.motorista_id = v_uid AND v_ativo))
      )
  ),
  pr AS (
    SELECT p.status AS st, rv.st AS st_rota
    FROM rv
    JOIN public.paradas p ON p.rota_id = rv.id
    WHERE p.is_checkpoint IS DISTINCT FROM false
  ),
  tr AS (
    SELECT
      count(*)::integer AS n,
      (count(*) FILTER (WHERE rv.st = 'concluida'))::integer AS conc,
      (count(*) FILTER (WHERE rv.st = 'cancelada'))::integer AS canc,
      COALESCE(sum(rv.km), 0)::numeric AS km
    FROM rv
  ),
  tp AS (
    SELECT
      count(*)::integer AS n,
      (count(*) FILTER (WHERE pr.st = 'concluida'))::integer AS conc,
      (count(*) FILTER (WHERE pr.st = 'pulada'))::integer AS pul,
      (count(*) FILTER (WHERE pr.st = 'concluida' AND pr.st_rota = 'concluida'))::integer AS entregas
    FROM pr
  )
  SELECT v_desde, tr.n, tr.conc, tr.canc, tr.km, tp.n, tp.conc, tp.pul, tp.entregas
  FROM tr CROSS JOIN tp;
END;
$$;

REVOKE ALL ON FUNCTION public.resumo_desempenho_motorista(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_desempenho_motorista(uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.resumo_desempenho_motorista(uuid, integer) IS
  'Totais de desempenho do motorista (rotas, km, paradas sem partida/chegada, entregas em rotas concluídas). Chama: o próprio motorista ativo ou gestor ativo de loja dele; soma só rotas que a RLS de rotas mostraria a quem chama. p_dias = dias corridos para trás sobre rotas.data, a partir de hoje em America/Sao_Paulo; NULL = desde sempre. Migration 55.';

COMMIT;

-- Conferência (só SELECT), depois de aplicar:
--   SELECT has_function_privilege('authenticated',
--     'public.resumo_desempenho_motorista(uuid,integer)', 'EXECUTE');  -- true
--   SELECT has_function_privilege('anon',
--     'public.resumo_desempenho_motorista(uuid,integer)', 'EXECUTE');  -- false
-- Comportamento: database/sondas/20261024180000_sonda_migration55.sql

-- ROLLBACK:
-- (função nova: nada a restaurar; o app cai no caminho paginado — PGRST202)
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.resumo_desempenho_motorista(uuid, integer);
-- COMMIT;
