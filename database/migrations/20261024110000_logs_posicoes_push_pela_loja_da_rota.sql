-- ============================================================================
-- Migration 48: logs, posições e logs de push lidos pela loja da rota
-- Date: 2026-10-24
-- Author: Wellinton Ribeiro
-- Purpose:
--   A leitura de `logs`, `motorista_locations` e `push_notification_logs`
--   passa a seguir a loja DA ROTA de cada linha, no mesmo formato que
--   `incidentes` usa desde a Migration 42:
--
--     1. o dono lê o que é seu: o autor do log (`logs.usuario_id`) e o
--        motorista da posição (`motorista_locations.motorista_id`), em
--        qualquer loja;
--     2. o gestor lê a linha só quando a rota dela pertence a uma loja onde
--        ele é gestor ativo (`usuario_unidades`: papel gestor, ativo,
--        `unidade_id = rotas.unidade_id`). Um motorista que atende duas lojas
--        tem as linhas de cada rota lidas só pelos gestores daquela loja;
--     3. linha sem rota: só o dono (ver "Linhas sem rota" abaixo).
--
--   `push_notification_logs` não tem coluna de rota: a rota é a da
--   notificação (`notificacao_id` → `notificacoes.rota_id`). Como
--   `notificacoes` só é legível pelo destinatário, a policy consulta por um
--   helper SECURITY DEFINER, `notificacao_da_loja_do_gestor(uuid)`, que
--   devolve só um booleano (quem chama é gestor ativo da loja da rota da
--   notificação) e nada revela além disso se chamado como RPC. O dono do
--   log de push não ganha leitura: hoje o motorista não lê os seus, e
--   nenhuma tela precisa disso (quem lê é o painel, com service role).
--
--   Linhas sem rota (decisão): só o dono. Medido em 24/10/2026: 411 de 8.196
--   logs sem rota — gestão de usuários (`motorista_criado`, `_editado`,
--   `_ativado`, `_desativado`, `exportacao_rotas`) e logs de rotas já
--   apagadas (FK `ON DELETE SET NULL`); 0 posições sem rota (a FK delas é
--   `ON DELETE CASCADE`); 3 logs de push de notificação sem rota (teste e
--   atribuição antiga). Nenhuma consulta do app lê log sem rota: o histórico
--   da rota, a prévia do mapa e o marcador do motorista consultam sempre por
--   `rota_id`; o SOS chega ao gestor pela notificação do gatilho
--   `notify_sos_acionado` (SECURITY DEFINER), não pela leitura de `logs`.
--   Alternativas consideradas: (a) a loja de um vínculo ativo em comum entre
--   o gestor e o autor — a linha sem rota de um motorista de duas lojas
--   seguiria legível nas duas; (b) a loja gravada na própria linha, como a
--   Migration 43 fez em `incidentes` — exige coluna e gatilho em três
--   tabelas para um dado que nenhuma tela usa. Se uma tela vier a precisar
--   do log sem rota, o caminho é (b).
--
--   Efeito visível: o gestor passa a ler, nas rotas da sua loja, também os
--   logs sem autor (autor apagado, `logs.usuario_id` → NULL) e os de
--   motorista cujo vínculo com a loja foi desativado. São fatos da rota da
--   loja dele; medido: 1.575 logs sem autor em rotas existentes, nenhum
--   duplicando um log com autor do mesmo evento.
--
--   As policies `logs_select` e `push_notification_logs_select_scoped` passam
--   de `public` para `authenticated` (anon já não lia nada: `auth.uid()` é
--   NULL); `motorista_locations_select_optimized` já era `authenticated`.
--   `ALTER POLICY` mantém os nomes e não abre janela sem policy.
--   `logs_insert_optimized` não muda (já confere a rota por
--   `pode_registrar_log_na_rota`).
--
--   Escrita de posição: como a leitura passa a seguir `rota_id`, a posição só
--   entra numa rota do próprio motorista. `motorista_locations_insert_optimized`
--   (`public` → `authenticated`) passa a exigir, além de `motorista_id =
--   auth.uid()`, que `rota_id` seja NULL ou de uma rota cujo `motorista_id` é
--   quem grava. Medido em 24/10/2026: 59.056 posições, nenhuma fora dessa
--   regra. Posição recusada fica na fila offline do app, que reenvia até um
--   limite de tentativas (`src/lib/motorista/filaPosicoes.ts`,
--   `MAX_TENTATIVAS_POSICAO`). Alternativa considerada: exigir
--   também vínculo ativo do motorista na loja da rota. Ficou de fora porque o
--   acesso de quem tem o vínculo desativado é decidido pelo RLS de `rotas`
--   (que esta subconsulta já respeita, por rodar com o papel de quem grava),
--   e repetir a regra aqui criaria duas fontes para o mesmo critério.
--
--   Realtime: só `motorista_locations` está na publicação `supabase_realtime`
--   (não `logs`); o `postgres_changes` filtrado por `rota_id` aplica a policy
--   de SELECT a cada assinante.
--
--   Índices (conferidos com EXPLAIN em 24/10/2026, nenhum novo): as consultas
--   do app filtram por `rota_id` (`idx_logs_rota`,
--   `idx_motorista_locations_rota_timestamp`); a subconsulta usa `rotas_pkey`
--   e `usuario_unidades` (tabela pequena; `idx_uu_ativo` quando o
--   planejador o escolhe); o helper usa `notificacoes_pkey`, `rotas_pkey` e
--   `idx_uu_ativo`.
--
-- Sonda transacional: database/sondas/20261024110000_sonda_migration48.sql
-- (termina em RAISE e desfaz tudo).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Helper: quem chama é gestor ativo da loja da rota desta notificação?
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notificacao_da_loja_do_gestor(p_notificacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notificacoes n
    JOIN public.rotas r ON r.id = n.rota_id
    JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
    WHERE n.id = p_notificacao_id
      AND uu.usuario_id = auth.uid()
      AND uu.papel::text = 'gestor'
      AND uu.ativo = true
  );
$$;

COMMENT ON FUNCTION public.notificacao_da_loja_do_gestor(uuid) IS
  'true quando quem chama é gestor ativo da loja da rota da notificação. Usada pela policy push_notification_logs_select_scoped (Migration 48).';

-- A policy roda com o papel de quem consulta: authenticated precisa de
-- EXECUTE. anon não.
REVOKE ALL ON FUNCTION public.notificacao_da_loja_do_gestor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notificacao_da_loja_do_gestor(uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- logs: o autor; o gestor ativo da loja da rota
-- ----------------------------------------------------------------------------
ALTER POLICY logs_select ON public.logs
  TO authenticated
  USING (
    logs.usuario_id = (SELECT auth.uid())
    OR (
      logs.rota_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.usuario_unidades uu
        JOIN public.rotas r ON r.id = logs.rota_id
        WHERE uu.usuario_id = (SELECT auth.uid())
          AND uu.papel::text = 'gestor'
          AND uu.ativo = true
          AND uu.unidade_id = r.unidade_id
      )
    )
  );

-- ----------------------------------------------------------------------------
-- motorista_locations: o motorista; o gestor ativo da loja da rota
-- ----------------------------------------------------------------------------
ALTER POLICY motorista_locations_select_optimized ON public.motorista_locations
  TO authenticated
  USING (
    motorista_locations.motorista_id = (SELECT auth.uid())
    OR (
      motorista_locations.rota_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.usuario_unidades uu
        JOIN public.rotas r ON r.id = motorista_locations.rota_id
        WHERE uu.usuario_id = (SELECT auth.uid())
          AND uu.papel::text = 'gestor'
          AND uu.ativo = true
          AND uu.unidade_id = r.unidade_id
      )
    )
  );

-- motorista_locations (INSERT): o próprio motorista, numa rota dele ou sem rota
ALTER POLICY motorista_locations_insert_optimized ON public.motorista_locations
  TO authenticated
  WITH CHECK (
    motorista_locations.motorista_id = (SELECT auth.uid())
    AND (
      motorista_locations.rota_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.rotas r
        WHERE r.id = motorista_locations.rota_id
          AND r.motorista_id = (SELECT auth.uid())
      )
    )
  );

-- ----------------------------------------------------------------------------
-- push_notification_logs: o gestor ativo da loja da rota da notificação
-- ----------------------------------------------------------------------------
ALTER POLICY push_notification_logs_select_scoped ON public.push_notification_logs
  TO authenticated
  USING (
    push_notification_logs.notificacao_id IS NOT NULL
    AND public.notificacao_da_loja_do_gestor(push_notification_logs.notificacao_id)
  );

COMMIT;

-- ============================================================================
-- Conferência pós-aplicação (só SELECT; esperado ao lado)
-- ============================================================================
-- 1. as três policies só para authenticated, pela loja da rota
--    → 3 linhas, roles {authenticated}, loja_da_rota true
-- SELECT tablename, policyname, roles,
--        qual ~ 'uu\.unidade_id = r\.unidade_id'
--          OR qual ~ 'notificacao_da_loja_do_gestor' AS loja_da_rota
-- FROM pg_policies WHERE schemaname = 'public'
--   AND policyname IN ('logs_select', 'motorista_locations_select_optimized',
--                      'push_notification_logs_select_scoped');
-- 2. nenhuma das três depende mais do vínculo do autor
--    → 0
-- SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
--   AND policyname IN ('logs_select', 'motorista_locations_select_optimized',
--                      'push_notification_logs_select_scoped')
--   AND (qual ~ 'log_user_uu|motorista_uu|target_uu|get_my_unidade_ids');
-- 3. helper DEFINER, search_path vazio, EXECUTE só authenticated/service_role
--    → prosecdef true, proconfig {search_path=""}, anon false, authenticated true
-- SELECT p.prosecdef, p.proconfig,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated
-- FROM pg_proc p WHERE p.oid = 'public.notificacao_da_loja_do_gestor(uuid)'::regprocedure;
-- 4. INSERT de posição só em rota do próprio motorista
--    → roles {authenticated}, confere_rota true
-- SELECT roles, with_check ~ 'r\.motorista_id = \( SELECT auth\.uid' AS confere_rota
-- FROM pg_policies WHERE schemaname = 'public'
--   AND policyname = 'motorista_locations_insert_optimized';
-- 5. nenhuma posição gravada fora da regra → 0
-- SELECT count(*) FROM public.motorista_locations ml
-- WHERE ml.rota_id IS NOT NULL AND NOT EXISTS (
--   SELECT 1 FROM public.rotas r
--   WHERE r.id = ml.rota_id AND r.motorista_id = ml.motorista_id);
-- 6. linhas sem rota (só o dono lê) → logs ~411, posições 0 (em 24/10/2026)
-- SELECT (SELECT count(*) FROM public.logs WHERE rota_id IS NULL) AS logs,
--        (SELECT count(*) FROM public.motorista_locations WHERE rota_id IS NULL) AS posicoes;

-- ROLLBACK:
-- BEGIN;
-- ALTER POLICY logs_select ON public.logs
--   TO public
--   USING (
--     (usuario_id = (SELECT auth.uid()))
--     OR (EXISTS (
--       SELECT 1
--       FROM (public.usuario_unidades my_uu
--         JOIN public.usuario_unidades log_user_uu ON ((log_user_uu.unidade_id = my_uu.unidade_id)))
--       WHERE ((my_uu.usuario_id = (SELECT auth.uid())) AND ((my_uu.papel)::text = 'gestor'::text)
--         AND (my_uu.ativo = true) AND (log_user_uu.usuario_id = logs.usuario_id)
--         AND (log_user_uu.ativo = true))))
--   );
-- ALTER POLICY motorista_locations_select_optimized ON public.motorista_locations
--   TO authenticated
--   USING (
--     (motorista_id = (SELECT auth.uid()))
--     OR (EXISTS (
--       SELECT 1
--       FROM public.usuario_unidades motorista_uu
--       WHERE ((motorista_uu.usuario_id = motorista_locations.motorista_id)
--         AND (motorista_uu.ativo = true)
--         AND (motorista_uu.unidade_id IN (SELECT public.get_my_unidade_ids())))))
--   );
-- ALTER POLICY motorista_locations_insert_optimized ON public.motorista_locations
--   TO public
--   WITH CHECK ((motorista_id = (SELECT auth.uid())));
-- ALTER POLICY push_notification_logs_select_scoped ON public.push_notification_logs
--   TO public
--   USING (
--     EXISTS (
--       SELECT 1
--       FROM (public.usuario_unidades my_uu
--         JOIN public.usuario_unidades target_uu ON ((target_uu.unidade_id = my_uu.unidade_id)))
--       WHERE ((my_uu.usuario_id = (SELECT auth.uid())) AND ((my_uu.papel)::text = 'gestor'::text)
--         AND (my_uu.ativo = true) AND (target_uu.usuario_id = push_notification_logs.usuario_id)
--         AND (target_uu.ativo = true)))
--   );
-- DROP FUNCTION IF EXISTS public.notificacao_da_loja_do_gestor(uuid);
-- COMMIT;
