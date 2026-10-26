-- ============================================================================
-- Migration 80: desempenho do motorista pelo realizado
-- (`vw_performance_motoristas`)
-- Date: 2026-10-27
-- Author: Wellinton Ribeiro
-- Purpose:
--   O perfil do motorista (`PerformanceKPIs`) mostra "Tempo Médio" e
--   "Distância Total" da view `vw_performance_motoristas`. A view calculava
--   `avg(r.tempo_total)` — o tempo ESTIMADO pelo OSRM na criação — e
--   `sum(r.distancia_total)` de todas as rotas, inclusive canceladas,
--   pendentes e não executadas. O gestor lê como desempenho, e o dashboard da
--   mesma pessoa mostra outro tempo médio, o real.
--
--   Regra nova, só nas duas colunas (as demais não mudam):
--     - `distancia_total_km`: soma da distância só das rotas `concluida`;
--     - `tempo_medio_minutos`: média de `concluida_em - iniciada_em`, em
--       minutos, das rotas `concluida` com os dois horários, maior que zero e
--       menor que 24 h — o critério de `calcularTempoMedio` no dashboard
--       (`src/components/gestor/dashboard/_hooks/useDashboardData.ts`). Rota
--       esquecida aberta de um dia para o outro não entra na média. Sem rota
--       que sirva, NULL (a tela mostra "sem dado").
--
--   CREATE OR REPLACE VIEW exige as mesmas colunas, na mesma ordem e com os
--   mesmos tipos: as duas continuam `numeric` (`sum` de numeric; `avg` de
--   `extract(epoch ...)`, numeric desde o Postgres 14 — o banco é o 17). A
--   view segue com `security_invoker = true` (lida com o RLS de quem
--   consulta). CREATE OR REPLACE preserva os privilégios; REVOKE/GRANT
--   repetem os de hoje (SELECT para authenticated, nada para anon).
--
--   Medido em 26/10/2026 (só SELECT): definição viva igual à desta migration
--   fora as duas colunas; `reloptions = {security_invoker=true}`; nenhuma
--   view depende dela; tempo médio de três motoristas: planejado 59, 47 e 52
--   min (o que a view mostrava); real sem teto 224, 376 e 242; real com o
--   teto de 24 h da view 204, 230 e 174 (o que ela passa a mostrar); um
--   motorista sem rota concluída aparecia com 226,1 km (3 rotas
--   canceladas/não executadas).
--
--   Alternativas consideradas:
--     (a) mudar a view (escolhida): o número passa a servir para avaliar, e o
--         perfil e o dashboard falam a mesma coisa;
--     (b) só trocar o rótulo no app ("Tempo estimado médio", "Distância
--         planejada"): o número continua sem servir para avaliar desempenho;
--     (c) colunas novas ao lado das antigas: duplicaria o significado na tela,
--         e ninguém mais usa as antigas.
--
--   Efeito no app: nenhum código muda; o perfil passa a mostrar o tempo real
--   e a distância percorrida. Os tipos (`number | null`) já cobrem o NULL.
--
--   `SET LOCAL lock_timeout = '3s'`: CREATE OR REPLACE VIEW pede ACCESS
--   EXCLUSIVE na view; se não vier em 3 s, a migration para sem efeito.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE VIEW public.vw_performance_motoristas
WITH (security_invoker = true)
AS
SELECT
  u.id,
  u.nome,
  u.unidade_id,
  un.nome AS unidade_nome,
  count(r.id) AS total_rotas,
  count(r.id) FILTER (WHERE r.status::text = 'concluida') AS rotas_concluidas,
  count(r.id) FILTER (WHERE r.status::text = 'em_andamento') AS rotas_em_andamento,
  count(r.id) FILTER (WHERE r.status::text = 'nao_executada') AS rotas_nao_executadas,
  count(r.id) FILTER (WHERE r.status::text = 'cancelada') AS rotas_canceladas,
  CASE
    WHEN count(r.id) FILTER (WHERE r.status::text IN ('concluida', 'nao_executada')) > 0
      THEN round(
        count(r.id) FILTER (WHERE r.status::text = 'concluida')::numeric * 100::numeric
        / count(r.id) FILTER (WHERE r.status::text IN ('concluida', 'nao_executada'))::numeric,
        1
      )
    ELSE 100.0
  END AS taxa_execucao,
  sum(r.distancia_total) FILTER (WHERE r.status::text = 'concluida') AS distancia_total_km,
  avg(extract(epoch FROM r.concluida_em - r.iniciada_em) / 60) FILTER (
    WHERE r.status::text = 'concluida'
      AND r.iniciada_em IS NOT NULL
      AND r.concluida_em IS NOT NULL
      AND r.concluida_em > r.iniciada_em
      AND r.concluida_em - r.iniciada_em < interval '24 hours'
  ) AS tempo_medio_minutos
FROM public.usuarios u
LEFT JOIN public.rotas r ON r.motorista_id = u.id
LEFT JOIN public.unidades un ON u.unidade_id = un.id
WHERE u.papel::text = 'motorista' AND u.ativo = true
GROUP BY u.id, u.nome, u.unidade_id, un.nome;

REVOKE ALL ON public.vw_performance_motoristas FROM PUBLIC, anon;
GRANT SELECT ON public.vw_performance_motoristas TO authenticated;

COMMENT ON VIEW public.vw_performance_motoristas IS
  'Migration 80: desempenho por motorista. distancia_total_km soma só rotas concluidas; tempo_medio_minutos é a média real (concluida_em - iniciada_em, entre 0 e 24 h) das concluidas, como o dashboard. security_invoker: lida com o RLS de quem consulta.';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT c.reloptions, pg_get_viewdef(c.oid, true)
--   FROM pg_class c WHERE c.oid = 'public.vw_performance_motoristas'::regclass;
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- CREATE OR REPLACE VIEW public.vw_performance_motoristas
-- WITH (security_invoker = true)
-- AS
-- SELECT
--   u.id,
--   u.nome,
--   u.unidade_id,
--   un.nome AS unidade_nome,
--   count(r.id) AS total_rotas,
--   count(r.id) FILTER (WHERE r.status::text = 'concluida') AS rotas_concluidas,
--   count(r.id) FILTER (WHERE r.status::text = 'em_andamento') AS rotas_em_andamento,
--   count(r.id) FILTER (WHERE r.status::text = 'nao_executada') AS rotas_nao_executadas,
--   count(r.id) FILTER (WHERE r.status::text = 'cancelada') AS rotas_canceladas,
--   CASE
--     WHEN count(r.id) FILTER (WHERE r.status::text IN ('concluida', 'nao_executada')) > 0
--       THEN round(
--         count(r.id) FILTER (WHERE r.status::text = 'concluida')::numeric * 100::numeric
--         / count(r.id) FILTER (WHERE r.status::text IN ('concluida', 'nao_executada'))::numeric,
--         1
--       )
--     ELSE 100.0
--   END AS taxa_execucao,
--   sum(r.distancia_total) AS distancia_total_km,
--   avg(r.tempo_total) AS tempo_medio_minutos
-- FROM public.usuarios u
-- LEFT JOIN public.rotas r ON r.motorista_id = u.id
-- LEFT JOIN public.unidades un ON u.unidade_id = un.id
-- WHERE u.papel::text = 'motorista' AND u.ativo = true
-- GROUP BY u.id, u.nome, u.unidade_id, un.nome;
-- COMMIT;
