-- ============================================================================
-- Migration: endurecimento de RLS — view admin, escalonamento de papel,
--            notificações e incidentes_delete legado
-- Date: 2026-09-06
-- Author: Wellinton Ribeiro
-- Purpose:
--   Varredura de 06/09/2026 encontrou quatro buracos confirmados no banco vivo.
--   Os dois primeiros são exploráveis com uma chamada comum do cliente
--   Supabase, sem ferramenta especial.
--
--   A técnica usada aqui em dois dos quatro casos é REVOKE por coluna, e não
--   WITH CHECK. O motivo é uma limitação do Postgres: WITH CHECK enxerga apenas
--   a linha NOVA, então "esta coluna não pode mudar de valor" não é expressável
--   nele. Já é o raciocínio da casa — a nota sobre `unidades` no
--   PROJECT_CONTEXT registra que "RLS não restringe coluna", e lá a saída foi
--   não ter policy de UPDATE. Aqui a saída é o grant.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. `admin_dashboard_metrics` era legível SEM LOGIN
-- ---------------------------------------------------------------------------
-- A view pertence a `postgres` (rolbypassrls) e estava sem `security_invoker`,
-- logo rodava ignorando RLS; e `anon` tinha SELECT. Como a ANON_KEY vai no
-- bundle web, qualquer visitante do site podia ler MRR, churn, taxa de
-- conversão e contagens de TODOS os tenants.
--
-- Isto é reaplicação: `20260622183805_security_hardening_multitenant.sql`
-- (linhas 216-220) já continha estas instruções. As linhas irmãs do mesmo bloco
-- pegaram — `vw_rotas_resumo` e `vw_performance_motoristas` estão com
-- `security_invoker=true` e `anon` negado —, estas duas não. Causa não
-- determinada; por isso vai idempotente.
--
-- Nenhum código deste app consulta a view (conferido): ela é do painel
-- administrativo, projeto separado que acessa por service_role e não é afetado.
ALTER VIEW public.admin_dashboard_metrics SET (security_invoker = true);
REVOKE ALL ON public.admin_dashboard_metrics FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Motorista podia se promover a gestor (e a admin do painel)
-- ---------------------------------------------------------------------------
-- `usuarios_update_optimized` tem USING com o ramo `id = auth.uid()`, que não
-- depende de nenhuma outra coluna. Sem WITH CHECK, o Postgres reusa o USING
-- contra a linha NOVA — e esse ramo aprova qualquer valor novo desde que o `id`
-- não mude. Não havia GRANT de coluna barrando: `papel`, `admin_role`,
-- `unidade_id`, `ativo` e `is_gestor_principal` eram todos graváveis.
--
-- `papel` e `admin_role` NÃO são escritos por nenhum caminho deste app
-- (conferido em src/, app/, supabase/functions/ e scripts/), então revogar é
-- cirúrgico: mata o escalonamento sem quebrar fluxo. `admin_role` é a coluna do
-- painel administrativo, que compartilha este Postgres.
--
-- Quem legitimamente precisa escrever nessas colunas não é afetado: as RPCs
-- SECURITY DEFINER (onboarding) rodam como o definidor, e o painel usa
-- service_role. Os dois ignoram grants de `authenticated`.
REVOKE UPDATE (papel, admin_role) ON public.usuarios FROM authenticated;

-- `unidade_id` continua gravável porque o app escreve nela de verdade
-- (`useUnidadeAtiva.ts:197`, troca de unidade ativa). Mas passa a ser
-- restringida por WITH CHECK ao conjunto de unidades de que a pessoa participa
-- — isso É expressável, porque é propriedade do valor NOVO, não comparação com
-- o antigo. Sem isso, um motorista apontaria a própria `unidade_id` para outro
-- tenant e envenenaria as telas que ainda leem essa coluna legada.
DROP POLICY IF EXISTS usuarios_update_optimized ON public.usuarios;

CREATE POLICY usuarios_update_optimized ON public.usuarios
  FOR UPDATE
  USING (
    (id = (SELECT auth.uid()))
    OR (
      (papel)::text = 'motorista'::text
      AND EXISTS (
        SELECT 1
        FROM public.usuario_unidades my_uu
        WHERE my_uu.usuario_id = (SELECT auth.uid())
          AND (my_uu.papel)::text = 'gestor'::text
          AND my_uu.ativo = true
          AND my_uu.unidade_id IN (
            SELECT uu.unidade_id
            FROM public.usuario_unidades uu
            WHERE uu.usuario_id = usuarios.id
              AND uu.ativo = true
          )
      )
    )
  )
  WITH CHECK (
    -- Auto-edição: a unidade apontada tem de ser uma de que a pessoa participa.
    -- `get_my_unidade_ids()` já filtra por `ativo = true`.
    (
      id = (SELECT auth.uid())
      AND (unidade_id IS NULL OR unidade_id IN (SELECT public.get_my_unidade_ids()))
    )
    -- Gestor editando motorista da sua unidade: mesma condição do USING.
    OR (
      (papel)::text = 'motorista'::text
      AND EXISTS (
        SELECT 1
        FROM public.usuario_unidades my_uu
        WHERE my_uu.usuario_id = (SELECT auth.uid())
          AND (my_uu.papel)::text = 'gestor'::text
          AND my_uu.ativo = true
          AND my_uu.unidade_id IN (
            SELECT uu.unidade_id
            FROM public.usuario_unidades uu
            WHERE uu.usuario_id = usuarios.id
              AND uu.ativo = true
          )
      )
    )
  );

COMMENT ON POLICY usuarios_update_optimized ON public.usuarios IS
  'Auto-edição + gestor edita motorista da sua unidade. O WITH CHECK prende unidade_id às unidades do próprio usuário; papel e admin_role são protegidos por REVOKE de coluna, porque WITH CHECK não enxerga a linha antiga.';

-- ---------------------------------------------------------------------------
-- 3. Dono de notificação podia reescrever o conteúdo dela
-- ---------------------------------------------------------------------------
-- `notificacoes_update_optimized` também não tem WITH CHECK e seu USING
-- (`usuario_id = auth.uid()`) não é sensível a coluna nenhuma. O app escreve
-- exatamente um campo — `lida: true`, em NotificationDataContext.tsx:227 — então
-- o grant pode ser reduzido a ele. Revogar tudo e reconceder só `lida` também
-- protege colunas futuras por padrão.
REVOKE UPDATE ON public.notificacoes FROM authenticated;
GRANT UPDATE (lida) ON public.notificacoes TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. `incidentes_delete_optimized` ainda decidia pelo `usuarios` legado
-- ---------------------------------------------------------------------------
-- Era a única policy de `incidentes` ainda apoiada em `usuarios.papel` +
-- `usuarios.unidade_id`; as irmãs `incidentes_select`/`incidentes_update` já
-- usam `usuario_unidades`. Isolado, negava gestor multi-unidade legítimo cuja
-- coluna legada aponta para a outra unidade. Combinado com o item 2, era o
-- gadget que transformava "envenenei minha própria linha em usuarios" em DELETE
-- cross-tenant — apagar incidente de outro franqueado.
--
-- A tradução é fiel de propósito: mantém a base "gestor da unidade DA ROTA" e
-- só troca a fonte da verdade para `usuario_unidades`. Quem pode apagar não
-- muda. (A `incidentes_update` usa outra base — a unidade do autor. A
-- divergência entre as duas é anterior a esta migration e fica registrada como
-- follow-up, em vez de ser resolvida em silêncio aqui.)
DROP POLICY IF EXISTS incidentes_delete_optimized ON public.incidentes;

CREATE POLICY incidentes_delete_optimized ON public.incidentes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      JOIN public.rotas r ON r.id = incidentes.rota_id
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND (uu.papel)::text = 'gestor'::text
        AND uu.ativo = true
        AND uu.unidade_id = r.unidade_id
    )
  );

COMMENT ON POLICY incidentes_delete_optimized ON public.incidentes IS
  'Gestor ativo da unidade da rota. Migrado de usuarios.papel/unidade_id (legado, envenenável) para usuario_unidades em 06/09/2026.';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- -- 1. view admin (volta a ser legível por anon — só reverta se algo do painel quebrar)
-- ALTER VIEW public.admin_dashboard_metrics RESET (security_invoker);
-- GRANT SELECT ON public.admin_dashboard_metrics TO anon, authenticated;
--
-- -- 2. usuarios
-- GRANT UPDATE (papel, admin_role) ON public.usuarios TO authenticated;
-- DROP POLICY IF EXISTS usuarios_update_optimized ON public.usuarios;
-- CREATE POLICY usuarios_update_optimized ON public.usuarios FOR UPDATE
--   USING ((id = (SELECT auth.uid())) OR ((papel)::text = 'motorista'::text AND EXISTS (
--     SELECT 1 FROM public.usuario_unidades my_uu
--     WHERE my_uu.usuario_id = (SELECT auth.uid()) AND (my_uu.papel)::text = 'gestor'::text
--       AND my_uu.ativo = true AND my_uu.unidade_id IN (
--         SELECT uu.unidade_id FROM public.usuario_unidades uu
--         WHERE uu.usuario_id = usuarios.id AND uu.ativo = true))));
--
-- -- 3. notificacoes
-- GRANT UPDATE ON public.notificacoes TO authenticated;
--
-- -- 4. incidentes
-- DROP POLICY IF EXISTS incidentes_delete_optimized ON public.incidentes;
-- CREATE POLICY incidentes_delete_optimized ON public.incidentes FOR DELETE
--   USING (EXISTS (SELECT 1 FROM public.usuarios u
--     WHERE u.id = (SELECT auth.uid()) AND (u.papel)::text = 'gestor'::text
--       AND u.unidade_id = (SELECT r.unidade_id FROM public.rotas r WHERE r.id = incidentes.rota_id)));
-- COMMIT;
