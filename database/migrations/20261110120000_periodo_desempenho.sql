-- ============================================================================
-- Migration 90: desempenho por período (`p_de`/`p_ate`) e índices de
-- loja + data
-- Date: 2026-11-10
-- Author: Wellinton Ribeiro
-- Purpose:
--   Filtros por período (spec 2026-11-10-filtros-por-periodo, seção Banco).
--   As telas Meu Desempenho, Perfil do motorista e Histórico passam a pedir os
--   números de um intervalo de datas fechado, montado pelo app (o banco nunca
--   calcula "hoje" para o período novo; o corte em hoje é do app).
--
--   1. `desempenho_motorista_na_loja(p_motorista_id uuid, p_unidade_id uuid,
--      p_de date DEFAULT NULL, p_ate date DEFAULT NULL) RETURNS jsonb`:
--      o corpo vivo da Migration 89 (prosrc conferido por SELECT em
--      10/11/2026, igual ao arquivo) mais o recorte
--        (p_de IS NULL OR r.data >= p_de) AND (p_ate IS NULL OR r.data <= p_ate)
--      Nulo nos dois = sem limite: a chamada de dois argumentos (posicional ou
--      nomeada) responde exatamente como antes. Recusa SEM_PERMISSAO, fórmulas,
--      DEFINER, search_path vazio e ACL iguais.
--
--   2. `resumo_desempenho_motorista(p_motorista_id uuid, p_dias integer
--      DEFAULT NULL, p_de date DEFAULT NULL, p_ate date DEFAULT NULL)`:
--      o corpo vivo da Migration 55 (idem, conferido) com:
--        - período: se `p_de` OU `p_ate` não for nulo, valem eles (intervalo
--          fechado sobre `rotas.data`) e `p_dias` é IGNORADO (nem a recusa de
--          p_dias negativo roda); senão, o `p_dias` de sempre, idêntico
--          (dias corridos para trás a partir de hoje em America/Sao_Paulo;
--          NULL = desde sempre; negativo → 22023). `desde` devolve `p_de`
--          (NULL se só `p_ate` veio);
--        - retorno: a mesma TABLE mais `tempo_medio_minutos numeric`, no fim.
--      Quem pode chamar (42501 senão) e o predicado de visibilidade (o de
--      `rotas_select`) não mudam.
--
--      Tempo médio = a fórmula do cabeçalho do Histórico
--      (`src/hooks/motorista/historico/useHistoricoMetrics.ts`): média, em
--      minutos, de `concluida_em - iniciada_em` das rotas do conjunto (de
--      QUALQUER status) que têm as duas marcas e cuja diferença é > 0 e
--      < 1440 min (24 h, exclusivo). Diferente da Migration 89/view, que só
--      conta rotas `concluida`: aqui o número tem de bater com o cabeçalho do
--      Histórico, que ele substitui. O app arredonda (`Math.round`) e mostra 0
--      quando a média é NULL (nenhuma rota com tempo); a RPC devolve a média
--      sem arredondar e NULL nesse caso, como a Migration 89 faz.
--
--   3. Índices (decisão do Claude na spec): `rotas (unidade_id, data DESC,
--      id DESC)` serve a lista paginada, a exportação e o Início por loja e
--      período; `incidentes (unidade_id, created_at DESC, id DESC)` serve a
--      lista de incidentes por período. Medido em 10/11/2026 (SELECT de
--      catálogo): ~936 rotas e ~27 incidentes; existem `idx_rotas_unidade`,
--      `idx_rotas_data`, `idx_incidentes_unidade_id` e
--      `idx_incidentes_created_at`, nenhum composto. Com tabelas desse tamanho
--      o CREATE INDEX comum (dentro da transação, com lock_timeout) é
--      instantâneo; CONCURRENTLY não roda em transação.
--
--   Alternativas consideradas:
--     Assinatura: (a) DROP da antiga + CREATE com defaults (escolhida): uma
--          função só por nome, e a chamada antiga `(p_motorista_id, p_dias)`
--          — o app nativo publicado manda exatamente esses dois nomes ao
--          PostgREST — casa com a nova pelos defaults; (b) manter a antiga e
--          criar uma sobrecarga de 4 argumentos: com defaults nas duas, a
--          chamada `(uuid, integer)` fica ambígua (42725) e o PostgREST
--          recusa a resolução por nome (PGRST203); sem defaults na nova, o app
--          teria de mandar sempre os quatro, e as duas regras precisariam ser
--          mantidas em dobro até a antiga sair.
--     p_dias com p_de/p_ate: (a) o período vence e p_dias é ignorado
--          (escolhida, pedido do plano): o app novo manda só o período; (b)
--          recusar a combinação: erro para um estado que nenhuma tela produz.
--     Tempo médio: (a) a fórmula do Histórico (escolhida): é o número que o
--          cabeçalho já mostra, agora vindo do banco com o mesmo período;
--          (b) a da view/Migration 89 (só concluídas): mudaria o número que o
--          motorista vê hoje no Histórico.
--     `p_de > p_ate`: nenhum tratamento especial — o recorte não acha rota e
--          a resposta sai com zeros, igual nas duas funções; o seletor do app
--          não deixa aplicar esse intervalo.
--
--   search_path: as duas seguem com `SET search_path = ''` (o que está vivo),
--   não `public`: tudo é qualificado e o vazio é o mais estrito.
--
--   Efeito no app: o app publicado chama `resumo_desempenho_motorista` com
--   `{p_motorista_id, p_dias}` e `desempenho_motorista_na_loja` com
--   `{p_motorista_id, p_unidade_id}`; as duas respondem igual (a coluna nova
--   do resumo é ignorada por quem não a lê). DROP + CREATE na mesma transação:
--   não há instante sem a função. O PostgREST recarrega o cache de esquema
--   pelo gatilho de DDL do Supabase.
--
--   APLICAR COMO `postgres`.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

-- ----------------------------------------------------------------------------
-- 1. desempenho_motorista_na_loja com período
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.desempenho_motorista_na_loja(uuid, uuid);

CREATE FUNCTION public.desempenho_motorista_na_loja(
  p_motorista_id uuid,
  p_unidade_id uuid,
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  -- Só gestor com vínculo ativo de gestor na loja pedida.
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuario_unidades uu
     WHERE uu.usuario_id = auth.uid()
       AND uu.unidade_id = p_unidade_id
       AND uu.papel::text = 'gestor'
       AND uu.ativo = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'SEM_PERMISSAO',
      'error', 'Você não tem acesso de gestor a esta loja.');
  END IF;

  -- As fórmulas da vw_performance_motoristas (Migration 80), só nesta loja e
  -- no período pedido (intervalo fechado sobre rotas.data; nulo = sem limite).
  SELECT jsonb_build_object(
    'success', true,
    'total_rotas', count(r.id),
    'rotas_concluidas', count(r.id) FILTER (WHERE r.status::text = 'concluida'),
    'rotas_em_andamento', count(r.id) FILTER (WHERE r.status::text = 'em_andamento'),
    'rotas_nao_executadas', count(r.id) FILTER (WHERE r.status::text = 'nao_executada'),
    'rotas_canceladas', count(r.id) FILTER (WHERE r.status::text = 'cancelada'),
    'taxa_execucao', CASE
      WHEN count(r.id) FILTER (WHERE r.status::text IN ('concluida', 'nao_executada')) > 0
        THEN round(
          count(r.id) FILTER (WHERE r.status::text = 'concluida')::numeric * 100::numeric
          / count(r.id) FILTER (WHERE r.status::text IN ('concluida', 'nao_executada'))::numeric,
          1
        )
      ELSE 100.0
    END,
    'distancia_total_km', sum(r.distancia_total) FILTER (WHERE r.status::text = 'concluida'),
    'tempo_medio_minutos', avg(extract(epoch FROM r.concluida_em - r.iniciada_em) / 60) FILTER (
      WHERE r.status::text = 'concluida'
        AND r.iniciada_em IS NOT NULL
        AND r.concluida_em IS NOT NULL
        AND r.concluida_em > r.iniciada_em
        AND r.concluida_em - r.iniciada_em < interval '24 hours'
    )
  )
    INTO v_resultado
    FROM public.rotas r
   WHERE r.motorista_id = p_motorista_id
     AND r.unidade_id = p_unidade_id
     AND (p_de IS NULL OR r.data >= p_de)
     AND (p_ate IS NULL OR r.data <= p_ate);

  RETURN v_resultado;
END;
$$;

ALTER FUNCTION public.desempenho_motorista_na_loja(uuid, uuid, date, date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.desempenho_motorista_na_loja(uuid, uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desempenho_motorista_na_loja(uuid, uuid, date, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.desempenho_motorista_na_loja(uuid, uuid, date, date) IS
  'Migration 90 (sobre a 89): desempenho do motorista só nas rotas de uma loja, com as fórmulas da vw_performance_motoristas (Migration 80), no período p_de..p_ate (intervalo fechado sobre rotas.data; nulo = sem limite, a chamada de dois argumentos responde como antes). Só gestor com vínculo ativo de gestor na loja. Devolve {success:true, total_rotas, rotas_concluidas, rotas_em_andamento, rotas_nao_executadas, rotas_canceladas, taxa_execucao, distancia_total_km, tempo_medio_minutos}; motorista sem rota na loja sai com zeros. Recusa: {success:false, code, error}; code SEM_PERMISSAO.';

-- ----------------------------------------------------------------------------
-- 2. resumo_desempenho_motorista com período e tempo médio
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.resumo_desempenho_motorista(uuid, integer);

CREATE FUNCTION public.resumo_desempenho_motorista(
  p_motorista_id uuid,
  p_dias integer DEFAULT NULL,
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL
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
  entregas_em_rotas_concluidas integer,
  tempo_medio_minutos numeric
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
  v_ate date;
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

  -- Período: p_de/p_ate (intervalo fechado) vencem p_dias, que é ignorado.
  IF p_de IS NOT NULL OR p_ate IS NOT NULL THEN
    v_desde := p_de;
    v_ate := p_ate;
  ELSIF p_dias IS NOT NULL THEN
    IF p_dias < 0 THEN
      RAISE EXCEPTION 'Período inválido: p_dias não pode ser negativo.'
        USING ERRCODE = '22023';
    END IF;
    v_desde := (now() AT TIME ZONE 'America/Sao_Paulo')::date - p_dias;
  END IF;

  RETURN QUERY
  WITH rv AS (
    SELECT r.id, r.status AS st, r.distancia_total AS km,
           r.iniciada_em AS ini, r.concluida_em AS fim
    FROM public.rotas r
    WHERE r.motorista_id = p_motorista_id
      AND (v_desde IS NULL OR r.data >= v_desde)
      AND (v_ate IS NULL OR r.data <= v_ate)
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
      COALESCE(sum(rv.km), 0)::numeric AS km,
      -- A fórmula do cabeçalho do Histórico (useHistoricoMetrics): qualquer
      -- status, as duas marcas, 0 < diferença < 1440 min. Sem arredondar.
      (avg(extract(epoch FROM rv.fim - rv.ini) / 60) FILTER (
        WHERE rv.ini IS NOT NULL
          AND rv.fim IS NOT NULL
          AND rv.fim > rv.ini
          AND rv.fim - rv.ini < interval '1440 minutes'
      ))::numeric AS tempo
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
  SELECT v_desde, tr.n, tr.conc, tr.canc, tr.km, tp.n, tp.conc, tp.pul, tp.entregas, tr.tempo
  FROM tr CROSS JOIN tp;
END;
$$;

ALTER FUNCTION public.resumo_desempenho_motorista(uuid, integer, date, date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resumo_desempenho_motorista(uuid, integer, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_desempenho_motorista(uuid, integer, date, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.resumo_desempenho_motorista(uuid, integer, date, date) IS
  'Migration 90 (sobre a 55): totais de desempenho do motorista (rotas, km, paradas sem partida/chegada, entregas em rotas concluídas, tempo médio). Chama: o próprio motorista ativo ou gestor ativo de loja dele (42501 senão); soma só rotas que a RLS de rotas mostraria a quem chama. Período: p_de/p_ate (intervalo fechado sobre rotas.data) quando um dos dois vier, e p_dias é ignorado; senão p_dias = dias corridos para trás a partir de hoje em America/Sao_Paulo, NULL = desde sempre. tempo_medio_minutos = média de concluida_em - iniciada_em, em minutos, das rotas do conjunto (qualquer status) com as duas marcas e diferença > 0 e < 1440 min (a fórmula de useHistoricoMetrics), sem arredondar; NULL sem rota com tempo.';

-- ----------------------------------------------------------------------------
-- 3. índices de loja + data
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rotas_unidade_data_id
  ON public.rotas (unidade_id, data DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_incidentes_unidade_created_id
  ON public.incidentes (unidade_id, created_at DESC, id DESC);

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT p.oid::regprocedure, p.prosecdef, p.provolatile, p.proconfig,
--        pg_get_userbyid(p.proowner) AS dono, p.proacl, pg_get_function_result(p.oid)
--   FROM pg_proc p
--  WHERE p.pronamespace = 'public'::regnamespace
--    AND p.proname IN ('resumo_desempenho_motorista', 'desempenho_motorista_na_loja');
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE indexname IN ('idx_rotas_unidade_data_id', 'idx_incidentes_unidade_created_id');
-- Comportamento: database/sondas/20261110120000_sonda_migration90.sql
-- ============================================================================

-- ROLLBACK:
-- (volta às assinaturas e aos corpos das Migrations 55 e 89; o app que manda
-- p_de/p_ate passa a receber PGRST202)
-- BEGIN;
-- SET LOCAL lock_timeout = '3s';
-- DROP INDEX IF EXISTS public.idx_incidentes_unidade_created_id;
-- DROP INDEX IF EXISTS public.idx_rotas_unidade_data_id;
-- DROP FUNCTION IF EXISTS public.resumo_desempenho_motorista(uuid, integer, date, date);
-- DROP FUNCTION IF EXISTS public.desempenho_motorista_na_loja(uuid, uuid, date, date);
-- CREATE FUNCTION public.resumo_desempenho_motorista(
--   p_motorista_id uuid,
--   p_dias integer DEFAULT NULL
-- )
-- RETURNS TABLE (
--   desde date,
--   total_rotas integer,
--   rotas_concluidas integer,
--   rotas_canceladas integer,
--   distancia_total numeric,
--   total_paradas integer,
--   paradas_concluidas integer,
--   paradas_puladas integer,
--   entregas_em_rotas_concluidas integer
-- )
-- LANGUAGE plpgsql
-- STABLE
-- SECURITY DEFINER
-- SET search_path = ''
-- AS $$
-- DECLARE
--   v_uid uuid := auth.uid();
--   v_ativo boolean := public.usuario_atual_ativo();
--   v_desde date;
-- BEGIN
--   IF v_uid IS NULL OR p_motorista_id IS NULL OR NOT (
--     (v_uid = p_motorista_id AND v_ativo)
--     OR EXISTS (
--       SELECT 1
--       FROM public.usuario_unidades g
--       JOIN public.usuario_unidades m
--         ON m.unidade_id = g.unidade_id
--        AND m.usuario_id = p_motorista_id
--        AND m.papel = 'motorista'
--       WHERE g.usuario_id = v_uid
--         AND g.papel = 'gestor' AND g.ativo
--     )
--   ) THEN
--     RAISE EXCEPTION 'Sem permissão para ver os números deste motorista.'
--       USING ERRCODE = '42501';
--   END IF;
--
--   IF p_dias IS NOT NULL THEN
--     IF p_dias < 0 THEN
--       RAISE EXCEPTION 'Período inválido: p_dias não pode ser negativo.'
--         USING ERRCODE = '22023';
--     END IF;
--     v_desde := (now() AT TIME ZONE 'America/Sao_Paulo')::date - p_dias;
--   END IF;
--
--   RETURN QUERY
--   WITH rv AS (
--     SELECT r.id, r.status AS st, r.distancia_total AS km
--     FROM public.rotas r
--     WHERE r.motorista_id = p_motorista_id
--       AND (v_desde IS NULL OR r.data >= v_desde)
--       AND EXISTS (
--         SELECT 1
--         FROM public.usuario_unidades uu
--         WHERE uu.usuario_id = v_uid AND uu.unidade_id = r.unidade_id AND uu.ativo AND (uu.papel = 'gestor' OR (r.motorista_id = v_uid AND v_ativo))
--       )
--   ),
--   pr AS (
--     SELECT p.status AS st, rv.st AS st_rota
--     FROM rv
--     JOIN public.paradas p ON p.rota_id = rv.id
--     WHERE p.is_checkpoint IS DISTINCT FROM false
--   ),
--   tr AS (
--     SELECT
--       count(*)::integer AS n,
--       (count(*) FILTER (WHERE rv.st = 'concluida'))::integer AS conc,
--       (count(*) FILTER (WHERE rv.st = 'cancelada'))::integer AS canc,
--       COALESCE(sum(rv.km), 0)::numeric AS km
--     FROM rv
--   ),
--   tp AS (
--     SELECT
--       count(*)::integer AS n,
--       (count(*) FILTER (WHERE pr.st = 'concluida'))::integer AS conc,
--       (count(*) FILTER (WHERE pr.st = 'pulada'))::integer AS pul,
--       (count(*) FILTER (WHERE pr.st = 'concluida' AND pr.st_rota = 'concluida'))::integer AS entregas
--     FROM pr
--   )
--   SELECT v_desde, tr.n, tr.conc, tr.canc, tr.km, tp.n, tp.conc, tp.pul, tp.entregas
--   FROM tr CROSS JOIN tp;
-- END;
-- $$;
-- ALTER FUNCTION public.resumo_desempenho_motorista(uuid, integer) OWNER TO postgres;
-- REVOKE ALL ON FUNCTION public.resumo_desempenho_motorista(uuid, integer) FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.resumo_desempenho_motorista(uuid, integer) TO authenticated, service_role;
-- COMMENT ON FUNCTION public.resumo_desempenho_motorista(uuid, integer) IS
--   'Totais de desempenho do motorista (rotas, km, paradas sem partida/chegada, entregas em rotas concluídas). Chama: o próprio motorista ativo ou gestor ativo de loja dele; soma só rotas que a RLS de rotas mostraria a quem chama. p_dias = dias corridos para trás sobre rotas.data, a partir de hoje em America/Sao_Paulo; NULL = desde sempre. Migration 55.';
-- CREATE FUNCTION public.desempenho_motorista_na_loja(
--   p_motorista_id uuid,
--   p_unidade_id uuid
-- )
-- RETURNS jsonb
-- LANGUAGE plpgsql
-- STABLE
-- SECURITY DEFINER
-- SET search_path = ''
-- AS $$
-- DECLARE
--   v_resultado jsonb;
-- BEGIN
--   IF auth.uid() IS NULL OR NOT EXISTS (
--     SELECT 1 FROM public.usuario_unidades uu
--      WHERE uu.usuario_id = auth.uid()
--        AND uu.unidade_id = p_unidade_id
--        AND uu.papel::text = 'gestor'
--        AND uu.ativo = true
--   ) THEN
--     RETURN jsonb_build_object('success', false, 'code', 'SEM_PERMISSAO',
--       'error', 'Você não tem acesso de gestor a esta loja.');
--   END IF;
--
--   SELECT jsonb_build_object(
--     'success', true,
--     'total_rotas', count(r.id),
--     'rotas_concluidas', count(r.id) FILTER (WHERE r.status::text = 'concluida'),
--     'rotas_em_andamento', count(r.id) FILTER (WHERE r.status::text = 'em_andamento'),
--     'rotas_nao_executadas', count(r.id) FILTER (WHERE r.status::text = 'nao_executada'),
--     'rotas_canceladas', count(r.id) FILTER (WHERE r.status::text = 'cancelada'),
--     'taxa_execucao', CASE
--       WHEN count(r.id) FILTER (WHERE r.status::text IN ('concluida', 'nao_executada')) > 0
--         THEN round(
--           count(r.id) FILTER (WHERE r.status::text = 'concluida')::numeric * 100::numeric
--           / count(r.id) FILTER (WHERE r.status::text IN ('concluida', 'nao_executada'))::numeric,
--           1
--         )
--       ELSE 100.0
--     END,
--     'distancia_total_km', sum(r.distancia_total) FILTER (WHERE r.status::text = 'concluida'),
--     'tempo_medio_minutos', avg(extract(epoch FROM r.concluida_em - r.iniciada_em) / 60) FILTER (
--       WHERE r.status::text = 'concluida'
--         AND r.iniciada_em IS NOT NULL
--         AND r.concluida_em IS NOT NULL
--         AND r.concluida_em > r.iniciada_em
--         AND r.concluida_em - r.iniciada_em < interval '24 hours'
--     )
--   )
--     INTO v_resultado
--     FROM public.rotas r
--    WHERE r.motorista_id = p_motorista_id
--      AND r.unidade_id = p_unidade_id;
--
--   RETURN v_resultado;
-- END;
-- $$;
-- ALTER FUNCTION public.desempenho_motorista_na_loja(uuid, uuid) OWNER TO postgres;
-- REVOKE ALL ON FUNCTION public.desempenho_motorista_na_loja(uuid, uuid) FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.desempenho_motorista_na_loja(uuid, uuid) TO authenticated, service_role;
-- COMMENT ON FUNCTION public.desempenho_motorista_na_loja(uuid, uuid) IS
--   'Migration 89: desempenho do motorista só nas rotas de uma loja, com as fórmulas da vw_performance_motoristas (Migration 80). Só gestor com vínculo ativo de gestor na loja. Devolve {success:true, total_rotas, rotas_concluidas, rotas_em_andamento, rotas_nao_executadas, rotas_canceladas, taxa_execucao, distancia_total_km, tempo_medio_minutos}; motorista sem rota na loja sai com zeros. Recusa: {success:false, code, error}; code SEM_PERMISSAO.';
-- COMMIT;
