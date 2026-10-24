-- ============================================================================
-- Migration 50: bucket fotos-entrega — comprovante vinculado é preservado e o
-- acesso por loja segue o cadastro ativo
-- Date: 2026-10-24
-- Author: Wellinton Ribeiro
-- Purpose:
--   1. DELETE ("fotos-entrega delete"): o dono continua removendo o próprio
--      upload que ainda não foi vinculado a nada — é o desfazer de
--      `uploadELinkFotoParada` (`src/lib/storage.ts`) quando o UPDATE da
--      parada não grava, e a troca da foto de perfil (`deletarFotoPerfil`).
--      O objeto referenciado em `paradas.foto_url`, `paradas.foto_comprovante`
--      ou `incidentes.foto_url` (path ou URL legada terminada em "/<path>",
--      a mesma regra de casamento da policy de SELECT) é preservado, assim
--      como o caminho registrado em `logs` pela fila offline quando a foto
--      não pôde ser ligada à parada (`evento = 'foto_comprovante_sem_vinculo'`,
--      `detalhes->>'foto_path'`, gravado como path por
--      `subirFotoDaFilaOffline`). A conferência vive no helper
--      `pode_apagar_foto_entrega(text)`. O helper precisa ter dono com
--      BYPASSRLS (`postgres`): é assim que ele lê as tabelas inteiras.
--
--      Por que um helper SECURITY DEFINER e não um NOT EXISTS na policy: na
--      policy, a subconsulta em `paradas`/`incidentes` passaria pelo RLS de
--      quem apaga, e a linha que ele não enxerga mais (vínculo com a loja
--      desativado, Migration 49) contaria como "sem vínculo". O helper lê as
--      tabelas inteiras. Para não responder sobre caminhos de terceiros, ele
--      só devolve true para um objeto do próprio `auth.uid()` no bucket.
--      Alternativas consideradas: (a) NOT EXISTS inline — depende do RLS de
--      quem chama, como acima; (b) janela de tempo (apagar só objeto recente)
--      — um objeto vinculado dentro da janela continuaria removível e um
--      desfazer atrasado (rede lenta) seria recusado.
--
--      A foto de perfil (`usuarios.foto_url`) fica fora de propósito: a troca
--      de avatar apaga a foto atual antes de subir a nova, e a imagem é do
--      próprio dono, sem papel de comprovante.
--
--      Custo: a URL legada não usa índice (sufixo), então a checagem varre
--      `paradas` — medido em 24/10/2026, 5.036 linhas, ~7 ms no pior caso
--      (objeto sem vínculo, o caso legítimo). DELETE no bucket é raro. Se a
--      tabela crescer muito, a saída é um índice de expressão no caminho
--      normalizado da foto. Em `logs` (8.196 linhas) a busca entra por
--      `idx_logs_evento`: ~0,1 ms.
--
--   2. SELECT e INSERT: o ramo por loja (1º segmento do path = loja) passa de
--      `get_my_unidade_ids()` para o helper `minhas_unidades_com_acesso()`:
--      lojas com vínculo ativo em que a pessoa é gestor, ou em que está ativa
--      no cadastro (`usuarios.ativo`, helper `usuario_atual_ativo()` da
--      Migration 49). É a mesma regra das policies de `rotas`/`paradas` da
--      Migration 49: o ramo do gestor segue pelo vínculo de gestor ativo na
--      loja. Os demais ramos ficam iguais: o dono lê os próprios uploads
--      (como em logs e posições), e perfil/incidente seguem pela linha
--      visível que referencia o objeto (Migration 38). Alternativa
--      considerada: aplicar `usuario_atual_ativo()` ao ramo inteiro — cortaria
--      também o gestor, que segue lendo rotas e paradas pela Migration 49 e
--      veria o comprovante quebrado; ou deixar para uma tarefa própria —
--      reabriria estas mesmas três policies logo depois.
--
--   Policies: DROP + CREATE dentro da transação (o mesmo caminho da Migration
--   38 nesta tabela; nenhum outro cliente vê a janela). Nomes mantidos, todas
--   `TO authenticated`. Não existe policy de UPDATE no bucket, e nenhuma é
--   criada. O painel e as Edge Functions usam a chave secreta, que ignora RLS.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------

-- Lojas em que quem chama tem vínculo ativo e é gestor, ou está ativo no
-- cadastro. Mesma forma de `get_my_unidade_ids()` (SETOF uuid, só o próprio
-- auth.uid()), para entrar no lugar dela nas policies do bucket.
CREATE OR REPLACE FUNCTION public.minhas_unidades_com_acesso()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT uu.unidade_id
  FROM public.usuario_unidades uu
  WHERE uu.usuario_id = auth.uid()
    AND uu.ativo = true
    AND (
      uu.papel::text = 'gestor'
      OR public.usuario_atual_ativo()
    );
$$;

REVOKE ALL ON FUNCTION public.minhas_unidades_com_acesso() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minhas_unidades_com_acesso() TO authenticated, service_role;

COMMENT ON FUNCTION public.minhas_unidades_com_acesso() IS
  'Lojas com vínculo ativo de quem chama, em que é gestor ou está ativo no cadastro. Usada nas policies do bucket fotos-entrega (Migration 50).';

-- O objeto é de quem chama e nada o referencia (parada, incidente ou registro
-- da fila offline em logs).
CREATE OR REPLACE FUNCTION public.pode_apagar_foto_entrega(p_nome text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
      SELECT 1
      FROM storage.objects o
      WHERE o.bucket_id = 'fotos-entrega'
        AND o.name = p_nome
        AND (o.owner = auth.uid() OR o.owner_id = auth.uid()::text)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.paradas p
      WHERE p.foto_url = p_nome
        OR right(p.foto_url, length(p_nome) + 1) = '/' || p_nome
        OR p.foto_comprovante = p_nome
        OR right(p.foto_comprovante, length(p_nome) + 1) = '/' || p_nome
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.incidentes i
      WHERE i.foto_url = p_nome
        OR right(i.foto_url, length(p_nome) + 1) = '/' || p_nome
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.logs l
      WHERE l.evento = 'foto_comprovante_sem_vinculo'
        AND l.detalhes->>'foto_path' = p_nome
    );
$$;

REVOKE ALL ON FUNCTION public.pode_apagar_foto_entrega(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_apagar_foto_entrega(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.pode_apagar_foto_entrega(text) IS
  'true quando o objeto do bucket fotos-entrega é de quem chama e não está vinculado a parada, incidente ou registro da fila offline em logs. Usada na policy de DELETE do bucket (Migration 50).';

-- ---------------------------------------------------------------------------
-- 2. Policies do bucket
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "fotos-entrega delete" ON storage.objects;

CREATE POLICY "fotos-entrega delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fotos-entrega'
    AND (owner = (SELECT auth.uid()) OR owner_id = (SELECT auth.uid())::text)
    AND public.pode_apagar_foto_entrega(name)
  );

DROP POLICY IF EXISTS "fotos-entrega select" ON storage.objects;

CREATE POLICY "fotos-entrega select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fotos-entrega'
    AND (
      -- (a) próprios uploads
      owner = (SELECT auth.uid())
      OR owner_id = (SELECT auth.uid())::text
      -- (b) fotos de entrega: 1º segmento = loja com acesso (TEXT, cast-safe)
      OR (storage.foldername(name))[1] IN (
        SELECT f.unidade_id::text
        FROM public.minhas_unidades_com_acesso() AS f(unidade_id)
      )
      -- (c) avatares: referenciado por linha de usuarios visível ao caller
      --     E essa linha é do dono do objeto (Migration 38).
      OR (
        (storage.foldername(name))[1] = 'perfis'
        AND EXISTS (
          SELECT 1
          FROM public.usuarios u
          WHERE (
              u.foto_url = objects.name
              OR right(u.foto_url, length(objects.name) + 1) = '/' || objects.name
            )
            AND (u.id = objects.owner OR u.id::text = objects.owner_id)
        )
      )
      -- (d) incidentes: referenciado por incidente visível ao caller
      --     E o incidente é do dono do objeto (Migration 38).
      OR (
        (storage.foldername(name))[1] = 'incidentes'
        AND EXISTS (
          SELECT 1
          FROM public.incidentes i
          WHERE (
              i.foto_url = objects.name
              OR right(i.foto_url, length(objects.name) + 1) = '/' || objects.name
            )
            AND (i.motorista_id = objects.owner OR i.motorista_id::text = objects.owner_id)
        )
      )
    )
  );

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
        FROM public.minhas_unidades_com_acesso() AS f(unidade_id)
      )
    )
  );

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- 1. três policies, todas authenticated; nenhuma cita get_my_unidade_ids
-- SELECT policyname, cmd, roles, qual ILIKE '%get_my_unidade_ids%' OR coalesce(with_check,'') ILIKE '%get_my_unidade_ids%' AS antigo
--   FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' ORDER BY 1;
-- 2. helpers: DEFINER, search_path vazio, dono postgres (BYPASSRLS), sem
--    EXECUTE para anon
-- SELECT proname, prosecdef, proconfig, pg_get_userbyid(proowner) AS dono,
--        has_function_privilege('anon', oid, 'EXECUTE') AS anon
--   FROM pg_proc WHERE proname IN ('minhas_unidades_com_acesso', 'pode_apagar_foto_entrega');
-- 3. quantos objetos vinculados o DELETE preserva (paradas, incidentes, logs)
-- SELECT count(*) FROM storage.objects o WHERE o.bucket_id = 'fotos-entrega'
--   AND (EXISTS (SELECT 1 FROM public.paradas p WHERE p.foto_url = o.name
--          OR right(p.foto_url, length(o.name) + 1) = '/' || o.name
--          OR p.foto_comprovante = o.name
--          OR right(p.foto_comprovante, length(o.name) + 1) = '/' || o.name)
--     OR EXISTS (SELECT 1 FROM public.incidentes i WHERE i.foto_url = o.name
--          OR right(i.foto_url, length(o.name) + 1) = '/' || o.name)
--     OR EXISTS (SELECT 1 FROM public.logs l
--          WHERE l.evento = 'foto_comprovante_sem_vinculo'
--            AND l.detalhes->>'foto_path' = o.name));
-- ============================================================================

-- ROLLBACK:
-- -- Policies no estado vivo de 24/10/2026 (pg_policies antes desta migration).
-- BEGIN;
-- DROP POLICY IF EXISTS "fotos-entrega delete" ON storage.objects;
-- CREATE POLICY "fotos-entrega delete" ON storage.objects
--   FOR DELETE TO authenticated
--   USING (
--     bucket_id = 'fotos-entrega'
--     AND (owner = (SELECT auth.uid()) OR owner_id = (SELECT auth.uid())::text)
--   );
-- DROP POLICY IF EXISTS "fotos-entrega select" ON storage.objects;
-- CREATE POLICY "fotos-entrega select" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (
--     bucket_id = 'fotos-entrega'
--     AND (
--       owner = (SELECT auth.uid())
--       OR owner_id = (SELECT auth.uid())::text
--       OR (storage.foldername(name))[1] IN (
--         SELECT f.unidade_id::text
--         FROM public.get_my_unidade_ids() AS f(unidade_id)
--       )
--       OR (
--         (storage.foldername(name))[1] = 'perfis'
--         AND EXISTS (
--           SELECT 1
--           FROM public.usuarios u
--           WHERE (
--               u.foto_url = objects.name
--               OR right(u.foto_url, length(objects.name) + 1) = '/' || objects.name
--             )
--             AND (u.id = objects.owner OR u.id::text = objects.owner_id)
--         )
--       )
--       OR (
--         (storage.foldername(name))[1] = 'incidentes'
--         AND EXISTS (
--           SELECT 1
--           FROM public.incidentes i
--           WHERE (
--               i.foto_url = objects.name
--               OR right(i.foto_url, length(objects.name) + 1) = '/' || objects.name
--             )
--             AND (i.motorista_id = objects.owner OR i.motorista_id::text = objects.owner_id)
--         )
--       )
--     )
--   );
-- DROP POLICY IF EXISTS "fotos-entrega insert" ON storage.objects;
-- CREATE POLICY "fotos-entrega insert" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (
--     bucket_id = 'fotos-entrega'
--     AND (owner = (SELECT auth.uid()) OR owner_id = (SELECT auth.uid())::text)
--     AND (
--       (storage.foldername(name))[1] IN ('perfis', 'incidentes')
--       OR (storage.foldername(name))[1] IN (
--         SELECT f.unidade_id::text
--         FROM public.get_my_unidade_ids() AS f(unidade_id)
--       )
--     )
--   );
-- DROP FUNCTION IF EXISTS public.pode_apagar_foto_entrega(text);
-- DROP FUNCTION IF EXISTS public.minhas_unidades_com_acesso();
-- COMMIT;
