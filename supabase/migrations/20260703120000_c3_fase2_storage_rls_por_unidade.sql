-- ============================================
-- Migration: c3_fase2_storage_rls_por_unidade
-- Data: 2026-07-03
-- C3 Fase 2: isolamento por unidade nas policies de storage.objects
-- (bucket fotos-entrega).
-- ============================================
--
-- Contexto: a policy SELECT da Fase 1 permitia QUALQUER usuário autenticado
-- gerar signed URL de QUALQUER objeto do bucket (furo cross-tenant). Esta
-- migration:
--   1. Remove as 3 policies órfãs do bucket 'incidentes' (bucket nunca existiu;
--      fotos de incidente moram em fotos-entrega/incidentes/).
--   2. Recria "fotos-entrega select" com 4 ramos:
--      (a) owner do objeto (owner deprecado OU owner_id novo);
--      (b) fotos de entrega {unidadeId}/{rotaId}/{paradaId}_{ts}.jpg — 1º
--          segmento do path pertence às unidades ATIVAS do usuário (comparação
--          como TEXT; NUNCA castar segmento de path para uuid: 'perfis'/
--          'incidentes' explodem e o Postgres não garante ordem de avaliação
--          de AND/OR);
--      (c) perfis/ — objeto referenciado pelo foto_url de uma linha de usuarios
--          VISÍVEL ao caller (RLS de usuarios: próprio perfil OU usuário que
--          compartilha unidade ativa);
--      (d) incidentes/ — objeto referenciado pelo foto_url de uma linha de
--          incidentes VISÍVEL ao caller (RLS de incidentes: motorista dono OU
--          gestor de unidade compartilhada com o motorista).
--      Os ramos (c)/(d) casam foto_url em AMBAS as formas (path puro novo e
--      URL pública legada) via sufixo exato right(); não usar LIKE ('_' é
--      wildcard). Os guards de prefixo em (c)/(d) são de SEGURANÇA: impedem
--      exfiltrar foto de entrega de outra unidade plantando referência em
--      usuarios.foto_url ou incidentes.foto_url próprios.
--   3. Recria INSERT exigindo owner + prefixo válido (unidade ativa OU
--      perfis/incidentes).
--   4. Recria DELETE owner-only (owner OU owner_id).
--
-- Dependências: public.get_my_unidade_ids() (SETOF uuid, SECURITY DEFINER,
--   STABLE, search_path='', definida em 20260208000000_fix_rls_multi_unidade.sql).
--   NB: a função tem EXECUTE para anon E authenticated, mas as 4 policies abaixo
--   são TO authenticated — anon nunca alcança o ramo (b) via storage.objects.
-- INVARIANTE DOCUMENTADO: os ramos (c)/(d) delegam a visibilidade ao RLS de
--   public.usuarios e public.incidentes (subquery em policy roda sob o RLS do
--   role autenticado) — afrouxar o SELECT dessas tabelas afrouxa a leitura das
--   fotos correspondentes.
-- Aplicável como postgres: supautils.policy_grants deste projeto inclui
--   storage.objects (verificado em 2026-07-03).
-- Idempotente (DROP IF EXISTS + CREATE) e transacional (sem CONCURRENTLY) —
--   compatível com MCP apply_migration e supabase db push.

-- =============================================
-- PARTE 1: limpeza — policies órfãs do bucket 'incidentes' (não existe)
-- =============================================

DROP POLICY IF EXISTS "incidentes select" ON storage.objects;
DROP POLICY IF EXISTS "incidentes insert" ON storage.objects;
DROP POLICY IF EXISTS "incidentes delete" ON storage.objects;

-- =============================================
-- PARTE 2: SELECT por unidade
-- =============================================

DROP POLICY IF EXISTS "fotos-entrega select" ON storage.objects;

CREATE POLICY "fotos-entrega select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fotos-entrega'
    AND (
      -- (a) próprios uploads
      owner = (SELECT auth.uid())
      OR owner_id = (SELECT auth.uid())::text
      -- (b) fotos de entrega: 1º segmento = unidade ativa do usuário (TEXT, cast-safe)
      OR (storage.foldername(name))[1] IN (
        SELECT f.unidade_id::text
        FROM public.get_my_unidade_ids() AS f(unidade_id)
      )
      -- (c) avatares: referenciado por linha de usuarios visível ao caller.
      -- foto_url NULL/'' (perfil sem foto) não casa nenhum name real → não vaza.
      OR (
        (storage.foldername(name))[1] = 'perfis'
        AND EXISTS (
          SELECT 1
          FROM public.usuarios u
          WHERE u.foto_url = objects.name
             OR right(u.foto_url, length(objects.name) + 1) = '/' || objects.name
        )
      )
      -- (d) incidentes: referenciado por linha de incidentes visível ao caller
      OR (
        (storage.foldername(name))[1] = 'incidentes'
        AND EXISTS (
          SELECT 1
          FROM public.incidentes i
          WHERE i.foto_url = objects.name
             OR right(i.foto_url, length(objects.name) + 1) = '/' || objects.name
        )
      )
    )
  );

-- =============================================
-- PARTE 3: INSERT — owner + prefixo válido
-- =============================================

DROP POLICY IF EXISTS "fotos-entrega insert" ON storage.objects;

CREATE POLICY "fotos-entrega insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fotos-entrega'
    AND (owner = (SELECT auth.uid()) OR owner_id = (SELECT auth.uid())::text)
    AND (
      (storage.foldername(name))[1] IN ('perfis', 'incidentes')
      OR (storage.foldername(name))[1] IN (
        SELECT f.unidade_id::text
        FROM public.get_my_unidade_ids() AS f(unidade_id)
      )
    )
  );

-- =============================================
-- PARTE 4: DELETE — owner-only (inalterado em semântica; + owner_id)
-- =============================================

DROP POLICY IF EXISTS "fotos-entrega delete" ON storage.objects;

CREATE POLICY "fotos-entrega delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fotos-entrega'
    AND (owner = (SELECT auth.uid()) OR owner_id = (SELECT auth.uid())::text)
  );

-- =============================================
-- ROLLBACK (comentado) — restaura o estado Fase 1, texto verbatim do
-- pg_policies capturado em 2026-07-03 antes desta migration. As policies
-- órfãs "incidentes *" NÃO são restauradas (limpeza permanente aprovada).
-- =============================================
-- DROP POLICY IF EXISTS "fotos-entrega select" ON storage.objects;
-- CREATE POLICY "fotos-entrega select" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (bucket_id = 'fotos-entrega');
--
-- DROP POLICY IF EXISTS "fotos-entrega insert" ON storage.objects;
-- CREATE POLICY "fotos-entrega insert" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'fotos-entrega' AND owner = auth.uid());
--
-- DROP POLICY IF EXISTS "fotos-entrega delete" ON storage.objects;
-- CREATE POLICY "fotos-entrega delete" ON storage.objects
--   FOR DELETE TO authenticated
--   USING (bucket_id = 'fotos-entrega' AND owner = auth.uid());
