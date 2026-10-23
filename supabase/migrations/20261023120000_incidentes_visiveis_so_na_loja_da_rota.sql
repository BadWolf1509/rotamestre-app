-- ============================================================================
-- Migration 42: incidentes visíveis ao gestor só na loja da rota
-- Date: 2026-10-23
-- Author: Wellinton Ribeiro
-- Purpose:
--   `incidentes_select` e `incidentes_update` liberavam ao gestor todo
--   incidente cujo motorista tivesse vínculo ativo numa loja onde ele é gestor
--   ativo. Com motorista que atende duas lojas (Migration 31), o gestor da loja
--   A lia e alterava os incidentes das rotas da loja B — e, pela policy
--   "fotos-entrega select" (ramo `incidentes/`, que depende da visibilidade do
--   incidente), também a foto deles. A `incidentes_delete_optimized` já filtrava
--   pela loja da rota; select e update passam a filtrar igual.
--
--   Regra nova (a mesma expressão em USING e WITH CHECK):
--     1. o próprio motorista continua vendo e alterando os seus;
--     2. incidente COM rota: só gestor ativo da loja DA ROTA;
--     3. incidente SEM rota (reportado fora de rota, ou rota apagada — as FKs
--        são ON DELETE SET NULL): fica a regra antiga, gestor ativo de uma loja
--        onde o motorista tem vínculo ativo. Sem rota não há como saber de que
--        loja ele é; esconder do gestor deixaria o incidente sem ninguém para
--        resolvê-lo (o app grava incidente sem rota: `rota_id: data.rotaId ||
--        null` em `useIncidentSubmit`). Medido em 23/10/2026: 3 de 26
--        incidentes sem rota (2 abertos), todos de 27/12/2025 e de motoristas
--        com 2 lojas ativas — a exposição residual é essa. A correção completa
--        é gravar a loja no próprio incidente (ver MIGRATIONS.md, Migration 42).
--
--   WITH CHECK explícito no UPDATE: o gestor não move o incidente para uma rota
--   de outra loja (o gatilho `incidentes_confere_rota_parada`, Migration 38, só
--   exige que a rota seja do motorista do incidente — e o motorista pode ser de
--   duas lojas). Sem WITH CHECK o Postgres já reaplicava o USING à linha nova;
--   explicitar deixa a regra visível e imune a uma edição futura do USING.
--
--   As duas passam de `public` para `authenticated` (anon já não via nada:
--   `auth.uid()` é NULL). `ALTER POLICY` mantém os nomes e não abre janela sem
--   policy. Índices já existem: `idx_incidentes_rota`, `idx_uu_usuario`.
--
--   App: `useIncidentesGestor` e o contador do dashboard filtram por
--   `motorista_id IN (motoristas da loja ativa)` e passam a receber só os
--   incidentes das rotas da loja (mais os sem rota); a timeline da rota consulta
--   por `rota_id` de rota da própria loja; o motorista consulta os próprios.
--   Nada do app dependia de ver incidente de rota de outra loja.
--
-- Sonda transacional: database/sondas/20261023120000_sonda_migration42.sql
-- (rodar DEPOIS desta migration, no SQL Editor; termina em RAISE e desfaz tudo).
-- ============================================================================

BEGIN;

ALTER POLICY incidentes_select ON public.incidentes
  TO authenticated
  USING (
    incidentes.motorista_id = (SELECT auth.uid())
    OR (
      incidentes.rota_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.usuario_unidades uu
        JOIN public.rotas r ON r.id = incidentes.rota_id
        WHERE uu.usuario_id = (SELECT auth.uid())
          AND uu.papel::text = 'gestor'
          AND uu.ativo = true
          AND uu.unidade_id = r.unidade_id
      )
    )
    OR (
      incidentes.rota_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.usuario_unidades my_uu
        JOIN public.usuario_unidades motorista_uu ON motorista_uu.unidade_id = my_uu.unidade_id
        WHERE my_uu.usuario_id = (SELECT auth.uid())
          AND my_uu.papel::text = 'gestor'
          AND my_uu.ativo = true
          AND motorista_uu.usuario_id = incidentes.motorista_id
          AND motorista_uu.ativo = true
      )
    )
  );

ALTER POLICY incidentes_update ON public.incidentes
  TO authenticated
  USING (
    incidentes.motorista_id = (SELECT auth.uid())
    OR (
      incidentes.rota_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.usuario_unidades uu
        JOIN public.rotas r ON r.id = incidentes.rota_id
        WHERE uu.usuario_id = (SELECT auth.uid())
          AND uu.papel::text = 'gestor'
          AND uu.ativo = true
          AND uu.unidade_id = r.unidade_id
      )
    )
    OR (
      incidentes.rota_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.usuario_unidades my_uu
        JOIN public.usuario_unidades motorista_uu ON motorista_uu.unidade_id = my_uu.unidade_id
        WHERE my_uu.usuario_id = (SELECT auth.uid())
          AND my_uu.papel::text = 'gestor'
          AND my_uu.ativo = true
          AND motorista_uu.usuario_id = incidentes.motorista_id
          AND motorista_uu.ativo = true
      )
    )
  )
  WITH CHECK (
    incidentes.motorista_id = (SELECT auth.uid())
    OR (
      incidentes.rota_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.usuario_unidades uu
        JOIN public.rotas r ON r.id = incidentes.rota_id
        WHERE uu.usuario_id = (SELECT auth.uid())
          AND uu.papel::text = 'gestor'
          AND uu.ativo = true
          AND uu.unidade_id = r.unidade_id
      )
    )
    OR (
      incidentes.rota_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.usuario_unidades my_uu
        JOIN public.usuario_unidades motorista_uu ON motorista_uu.unidade_id = my_uu.unidade_id
        WHERE my_uu.usuario_id = (SELECT auth.uid())
          AND my_uu.papel::text = 'gestor'
          AND my_uu.ativo = true
          AND motorista_uu.usuario_id = incidentes.motorista_id
          AND motorista_uu.ativo = true
      )
    )
  );

COMMIT;

-- ============================================================================
-- Conferência pós-aplicação (só SELECT; esperado ao lado)
-- ============================================================================
-- 1. as duas policies só para authenticated, com o filtro pela loja da rota
--    → 2 linhas: roles {authenticated}, loja_da_rota true, ramo_sem_rota true
-- SELECT policyname, roles,
--        qual ~ 'uu\.unidade_id = r\.unidade_id' AS loja_da_rota,
--        qual ~ 'rota_id IS NULL' AS ramo_sem_rota
-- FROM pg_policies WHERE schemaname = 'public' AND tablename = 'incidentes'
--   AND policyname IN ('incidentes_select', 'incidentes_update');
-- 2. o UPDATE tem WITH CHECK igual ao USING → true
-- SELECT with_check = qual FROM pg_policies
-- WHERE schemaname = 'public' AND policyname = 'incidentes_update';
-- 3. incidentes sem rota (os que seguem a regra antiga) → 3 em 23/10/2026
-- SELECT count(*) FROM public.incidentes WHERE rota_id IS NULL;
-- 4. incidentes com rota cuja loja o motorista não tem em comum com o gestor
--    que os via antes: quantos saem da vista de algum gestor (informativo)
-- SELECT count(DISTINCT i.id)
-- FROM public.incidentes i
-- JOIN public.rotas r ON r.id = i.rota_id
-- JOIN public.usuario_unidades m ON m.usuario_id = i.motorista_id AND m.ativo
-- JOIN public.usuario_unidades g ON g.unidade_id = m.unidade_id
--   AND g.papel = 'gestor' AND g.ativo
-- WHERE m.unidade_id <> r.unidade_id;

-- ROLLBACK:
-- BEGIN;
-- ALTER POLICY incidentes_select ON public.incidentes
--   TO public
--   USING (
--     (motorista_id = (SELECT auth.uid()))
--     OR (EXISTS (
--       SELECT 1
--       FROM (public.usuario_unidades my_uu
--         JOIN public.usuario_unidades motorista_uu ON ((motorista_uu.unidade_id = my_uu.unidade_id)))
--       WHERE ((my_uu.usuario_id = (SELECT auth.uid())) AND ((my_uu.papel)::text = 'gestor'::text)
--         AND (my_uu.ativo = true) AND (motorista_uu.usuario_id = incidentes.motorista_id)
--         AND (motorista_uu.ativo = true))))
--   );
-- ALTER POLICY incidentes_update ON public.incidentes
--   TO public
--   USING (
--     (motorista_id = (SELECT auth.uid()))
--     OR (EXISTS (
--       SELECT 1
--       FROM (public.usuario_unidades my_uu
--         JOIN public.usuario_unidades motorista_uu ON ((motorista_uu.unidade_id = my_uu.unidade_id)))
--       WHERE ((my_uu.usuario_id = (SELECT auth.uid())) AND ((my_uu.papel)::text = 'gestor'::text)
--         AND (my_uu.ativo = true) AND (motorista_uu.usuario_id = incidentes.motorista_id)
--         AND (motorista_uu.ativo = true))))
--   )
--   -- O UPDATE não tinha WITH CHECK (o Postgres reaplicava o USING à linha
--   -- nova). ALTER POLICY não remove a cláusula; pôr nela a mesma expressão do
--   -- USING é equivalente ao estado anterior.
--   WITH CHECK (
--     (motorista_id = (SELECT auth.uid()))
--     OR (EXISTS (
--       SELECT 1
--       FROM (public.usuario_unidades my_uu
--         JOIN public.usuario_unidades motorista_uu ON ((motorista_uu.unidade_id = my_uu.unidade_id)))
--       WHERE ((my_uu.usuario_id = (SELECT auth.uid())) AND ((my_uu.papel)::text = 'gestor'::text)
--         AND (my_uu.ativo = true) AND (motorista_uu.usuario_id = incidentes.motorista_id)
--         AND (motorista_uu.ativo = true))))
--   );
-- COMMIT;
