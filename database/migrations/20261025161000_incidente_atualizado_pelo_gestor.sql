-- ============================================================================
-- Migration 66: incidente atualizado só pelo gestor da loja
-- Date: 2026-10-25
-- Author: Wellinton Ribeiro
-- Purpose:
--   O incidente é aberto pelo motorista no INSERT (`incidentes_insert`,
--   `motorista_id = auth.uid()`) e atualizado pelo gestor da loja (status,
--   observações da gestão, resolução), como a Migration 61 documenta. A
--   policy `incidentes_update` ainda aceitava, em USING e em WITH CHECK, um
--   segundo ramo: `motorista_id = auth.uid()`. Esta migration tira esse ramo:
--   o UPDATE passa a exigir vínculo ativo de gestor na loja do incidente
--   (`incidentes.unidade_id`), a mesma condição de `incidentes_select` (ramo
--   do gestor) e de `incidentes_delete_optimized`. O motorista segue
--   registrando (INSERT) e lendo os próprios incidentes (SELECT); SELECT,
--   INSERT e DELETE não mudam, e os gatilhos de `incidentes` (Migrations 57,
--   59, 61 e 62) ficam como estão.
--
--   Alternativas consideradas:
--     (a) tirar o ramo do motorista da policy (escolhida): nenhum fluxo do
--         app atualiza incidente como motorista, então a regra mais simples
--         é a que cabe; a policy fica com uma só condição, igual nas duas
--         cláusulas;
--     (b) manter o ramo e acrescentar um gatilho de colunas que deixe o
--         motorista mudar só `descricao` com `status = 'aberto'`: guardaria
--         uma edição que ninguém usa, com função nova, ordem de gatilhos a
--         conferir e uma lista de colunas a manter a cada coluna nova da
--         tabela (YAGNI); se um dia o app oferecer "editar o relato", esse
--         é o caminho;
--     (c) privilégio de coluna (UPDATE só em `descricao` para
--         `authenticated`): quebraria o UPDATE do gestor, que grava
--         `status`, `observacoes_gestao` e `resolvido_em`, e toda coluna
--         nova passaria a exigir GRANT.
--
--   Limites:
--     - O gestor com vínculo de gestor inativo na loja também não atualiza
--       (a condição exige `uu.ativo = true`), como já vale no SELECT.
--     - A chave secreta (painel e Edge Functions) ignora RLS e não muda.
--
--   Efeito no app (1.14.5/1.14.6): o motorista só faz INSERT
--   (`createIncidente`, `src/lib/queries/incidentes.ts:253`, chamado por
--   `src/hooks/useIncidentSubmit.ts:212`, que já envia `foto_url` no INSERT).
--   `updateIncidente` e `updateIncidenteStatus` (`:277`, `:313`) não têm
--   chamador fora de `src/lib/queries/index.ts`; o UPDATE do gestor é
--   `src/hooks/incidentes-gestor/useIncidentesModals.ts:133` (ramo mantido).
--   Nenhuma mudança de código.
--
--   Policy: DROP + CREATE dentro da transação (o mesmo caminho das Migrations
--   50 e 65). Nome mantido, `TO authenticated`.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS incidentes_update ON public.incidentes;

CREATE POLICY incidentes_update ON public.incidentes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuario_unidades uu
       WHERE uu.usuario_id = (SELECT auth.uid())
         AND uu.papel::text = 'gestor'
         AND uu.ativo = true
         AND uu.unidade_id = incidentes.unidade_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuario_unidades uu
       WHERE uu.usuario_id = (SELECT auth.uid())
         AND uu.papel::text = 'gestor'
         AND uu.ativo = true
         AND uu.unidade_id = incidentes.unidade_id
    )
  );

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- 1. a policy de UPDATE sem o ramo do motorista, em USING e WITH CHECK
-- SELECT policyname, cmd, roles,
--        qual ILIKE '%motorista_id%' AS usa_motorista_no_using,
--        with_check ILIKE '%motorista_id%' AS usa_motorista_no_check
--   FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'incidentes' ORDER BY 1;
-- ============================================================================

-- ROLLBACK:
-- -- Policy no estado vivo de 25/10/2026 (pg_policies antes desta migration).
-- BEGIN;
-- DROP POLICY IF EXISTS incidentes_update ON public.incidentes;
-- CREATE POLICY incidentes_update ON public.incidentes
--   FOR UPDATE TO authenticated
--   USING (
--     (motorista_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
--        FROM usuario_unidades uu
--       WHERE ((uu.usuario_id = ( SELECT auth.uid() AS uid)) AND ((uu.papel)::text = 'gestor'::text) AND (uu.ativo = true) AND (uu.unidade_id = incidentes.unidade_id))))
--   )
--   WITH CHECK (
--     (motorista_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
--        FROM usuario_unidades uu
--       WHERE ((uu.usuario_id = ( SELECT auth.uid() AS uid)) AND ((uu.papel)::text = 'gestor'::text) AND (uu.ativo = true) AND (uu.unidade_id = incidentes.unidade_id))))
--   );
-- COMMIT;
