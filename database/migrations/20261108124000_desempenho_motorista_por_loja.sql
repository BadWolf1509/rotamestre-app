-- ============================================================================
-- Migration 89: desempenho do motorista por loja
-- (`desempenho_motorista_na_loja`)
-- Date: 2026-11-08
-- Author: Wellinton Ribeiro
-- Purpose:
--   Pendências 26 e 30(h). O perfil do motorista no gestor
--   (`PerformanceKPIs`, via `src/lib/gestor/performanceMotorista.ts`) lê a
--   `vw_performance_motoristas`, que agrupa por motorista e não tem
--   `unidade_id` das rotas: o motorista que atende duas lojas aparece com as
--   rotas das duas somadas para o gestor que gerencia ambas, e a loja aberta
--   na tela não muda os números.
--
--   `desempenho_motorista_na_loja(p_motorista_id uuid, p_unidade_id uuid)
--   RETURNS jsonb`, STABLE, SECURITY DEFINER, search_path vazio:
--     - sem sessão, ou quem chama sem vínculo ativo de gestor na loja →
--       `{success: false, code: 'SEM_PERMISSAO', error}` (texto fixo, o
--       padrão de recusa da Migration 81);
--     - senão `{success: true, total_rotas, rotas_concluidas,
--       rotas_em_andamento, rotas_nao_executadas, rotas_canceladas,
--       taxa_execucao, distancia_total_km, tempo_medio_minutos}`, com as
--       MESMAS fórmulas da view (Migration 80), contando só as rotas com
--       `unidade_id = p_unidade_id`.
--
--   O que muda em relação à view, de propósito:
--     - o escopo: só a loja pedida (era a soma do que o RLS deixasse ver);
--     - sem o filtro `usuarios.ativo = true`/`papel = 'motorista'`: o número
--       é o histórico das rotas da loja, que o gestor dela já lê pelo RLS de
--       `rotas`. O motorista desativado deixa de aparecer com tudo zerado e a
--       taxa "—" e passa a mostrar o que fez na loja.
--
--   SECURITY DEFINER lê `rotas` sem o RLS de quem chama, mas a consulta é
--   presa a `unidade_id = p_unidade_id`, e só passa quem é gestor ativo
--   dessa loja: nada sai além do que esse gestor já consulta em `rotas`.
--
--   Alternativas consideradas:
--     Forma: (a) RPC com a loja no argumento (escolhida): a tela passa a loja
--          ativa, e a autorização fica explícita num lugar só; (b) view nova
--          agrupada por motorista e loja (`security_invoker`): o app filtraria
--          por `unidade_id`, mas a regra de quem vê ficaria espalhada no RLS
--          de `usuarios` e `rotas`, e a view esconderia o motorista que o RLS
--          de `usuarios` não mostra; (c) acrescentar `unidade_id` das rotas à
--          view atual: muda a granularidade de uma view publicada (uma linha
--          por motorista vira uma por loja) e quebraria o `.maybeSingle()` do
--          app publicado para quem atende duas lojas.
--     Motorista que não tem nem teve vínculo com a loja: (a) zeros
--          (escolhida): o resultado é só a contagem das rotas da loja, que o
--          gestor já lê; sem rota não há o que proteger, e responder igual
--          para qualquer id não deixa sondar quem existe; (b) recusar com um
--          `code` próprio: um ramo a mais para um estado que a tela não
--          alcança (o RLS de `usuarios` já não abre o perfil de quem não é da
--          loja) e que diria a um gestor se aquele id tem vínculo.
--     Resposta: (a) jsonb `{success, code}` (escolhida, como a Migration 81):
--          o sucesso já é um objeto, e a recusa vai junto sem virar erro do
--          PostgREST; (b) RAISE 42501: recusa esperada (troca de loja, vínculo
--          perdido) viraria erro genérico na tela.
--
--   Medido em 08/11/2026 (só SELECT de catálogo): sem
--   `desempenho_motorista_na_loja` no catálogo; definição viva da view igual
--   à da Migration 80; `rotas.distancia_total` numeric(10,2); índices
--   `idx_rotas_motorista` e `idx_rotas_unidade` existentes.
--
--   Efeito no app: o app publicado segue lendo a view (não muda). O app novo
--   chama a RPC com a loja ativa e só é mesclado depois desta migration
--   aplicada.
--
--   APLICAR COMO `postgres`.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.desempenho_motorista_na_loja(
  p_motorista_id uuid,
  p_unidade_id uuid
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

  -- As fórmulas da vw_performance_motoristas (Migration 80), só nesta loja.
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
     AND r.unidade_id = p_unidade_id;

  RETURN v_resultado;
END;
$$;

ALTER FUNCTION public.desempenho_motorista_na_loja(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.desempenho_motorista_na_loja(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desempenho_motorista_na_loja(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.desempenho_motorista_na_loja(uuid, uuid) IS
  'Migration 89: desempenho do motorista só nas rotas de uma loja, com as fórmulas da vw_performance_motoristas (Migration 80). Só gestor com vínculo ativo de gestor na loja. Devolve {success:true, total_rotas, rotas_concluidas, rotas_em_andamento, rotas_nao_executadas, rotas_canceladas, taxa_execucao, distancia_total_km, tempo_medio_minutos}; motorista sem rota na loja sai com zeros. Recusa: {success:false, code, error}; code SEM_PERMISSAO.';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT p.prosecdef, p.provolatile, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl
--   FROM pg_proc p WHERE p.oid = to_regprocedure('public.desempenho_motorista_na_loja(uuid, uuid)');
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.desempenho_motorista_na_loja(uuid, uuid);
-- COMMIT;
