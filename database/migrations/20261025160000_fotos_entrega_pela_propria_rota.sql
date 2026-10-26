-- ============================================================================
-- Migration 65: bucket fotos-entrega — na pasta da loja, o gestor lê pela loja
-- e o motorista lê as fotos das próprias rotas
-- Date: 2026-10-25
-- Author: Wellinton Ribeiro
-- Purpose:
--   A policy de SELECT do bucket (`"fotos-entrega select"`, Migration 50) tem
--   um ramo por loja: o 1º segmento do path (`<loja>/<rota>/<arquivo>`) em
--   `minhas_unidades_com_acesso()`, que devolve as lojas em que a pessoa é
--   gestor ou está ativa no cadastro. Esta migration divide esse ramo para
--   seguir a mesma regra das policies de `rotas`/`paradas` da Migration 49
--   (`rotas_select`, `paradas_select`): gestor pela loja, motorista pela
--   própria rota.
--     (b1) gestor com vínculo ativo de gestor na loja do 1º segmento;
--     (b2) motorista da rota do 2º segmento, com vínculo ativo na loja da
--          rota e cadastro ativo (`usuario_atual_ativo()`), conferido pelo
--          helper novo `foto_de_rota_minha(text)`.
--   Os ramos (a) dono do objeto, (c) `perfis` e (d) `incidentes` ficam iguais.
--   O INSERT (`"fotos-entrega insert"`) e o DELETE (`"fotos-entrega delete"`)
--   não mudam; `minhas_unidades_com_acesso()` continua sendo usada pelo INSERT
--   e só o COMMENT dela é atualizado.
--
--   Por que um helper SECURITY DEFINER: o ramo (b2) precisa ler `rotas` e
--   `usuario_unidades`. Uma subconsulta direta na policy passaria pelo RLS de
--   quem lê, e o resultado dependeria de outra policy (a de `rotas`), o que
--   amarra uma regra à outra sem que ninguém veja. O helper tem dono
--   `postgres` (BYPASSRLS), lê as tabelas inteiras e responde só sobre o
--   próprio `auth.uid()`. É plpgsql para conferir o formato uuid dos dois
--   segmentos ANTES do cast: num `AND` de SQL a ordem de avaliação não é
--   garantida, e um path fora do formato (`perfis/…`, `incidentes/…`) faria o
--   cast levantar erro no meio da leitura.
--
--   Alternativas consideradas:
--     (a) dividir o ramo por loja em gestor (b1) e motorista da própria rota
--         (b2) (escolhida): mesma regra de `rotas`/`paradas`, e o motorista
--         atual continua lendo a foto da rota mesmo quando ela foi tirada por
--         outra conta (rota reatribuída, upload de outro aparelho);
--     (b) só o dono (tirar o ramo do motorista e deixar o (a) responder): dá o
--         mesmo resultado hoje para as fotos com dono, mas o motorista deixa
--         de ler a foto da própria rota tirada por outra conta, e as 71 fotos
--         sem dono em rota com motorista (abaixo) saem da leitura dele;
--     (c) mudar o helper `minhas_unidades_com_acesso()` para devolver só as
--         lojas de gestor: o INSERT do motorista, que grava em
--         `<loja>/<rota>/`, passaria a ser recusado.
--
--   Medido em 25/10/2026 (só SELECT): 2.301 objetos em pasta de loja; 2.273
--   em pasta de rota existente, todos na profundidade `<loja>/<rota>/`. Entre
--   os de rota com motorista, 0 têm dono diferente do motorista atual da
--   rota e 71 não têm dono (o motorista passa a lê-los pelo (b2)); 217 estão
--   em rota sem motorista (seguem legíveis pelo dono e pelo gestor); 13 estão
--   em pasta de loja diferente da loja da rota, todos do próprio motorista
--   (seguem pelo ramo do dono); 28 estão em rota apagada (seguem legíveis
--   pelo dono e pelo gestor).
--
--   Limites:
--     - O (b2) exige a loja do path igual à loja da rota. Foto em pasta de
--       outra loja segue legível pelo dono e pelo gestor da loja do path.
--     - Colega da mesma loja (motorista de outra rota) não lê mais a foto
--       pelo ramo por loja; segue lendo os próprios uploads pelo ramo do dono.
--
--   Efeito no app (1.14.5/1.14.6): o app lê foto só por `useSignedUrl` →
--   `createSignedUrlForFoto` (`src/lib/storage.ts`, `createSignedUrl`). No
--   motorista, os usos são o próprio avatar (`DrawerHeader`, `Avatar`,
--   `AvatarEditable`; ramo do dono); não há tela do motorista que mostre
--   comprovante (`ParadaCard*` e `IncidenteDetalhesModal` são do gestor, ramo
--   (b1)). O único `list()` do app é `deletarFotoPerfil`, em `perfis` (ramo do
--   dono). Os uploads (`fotos-entrega insert`) não mudam. Nenhuma mudança de
--   código.
--
--   Policy: DROP + CREATE dentro da transação (o mesmo caminho das Migrations
--   38 e 50 nesta tabela). Nome mantido, `TO authenticated`. O painel e as
--   Edge Functions usam a chave secreta, que ignora RLS.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Helper do ramo do motorista
-- ---------------------------------------------------------------------------

-- p_nome = '<unidade>/<rota>/<arquivo>'; true quando a rota é de quem chama,
-- com vínculo ativo na loja da rota e cadastro ativo (a regra de paradas_select).
CREATE OR REPLACE FUNCTION public.foto_de_rota_minha(p_nome text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_partes text[] := storage.foldername(p_nome);
BEGIN
  IF array_length(v_partes, 1) IS DISTINCT FROM 2
     OR v_partes[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR v_partes[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  RETURN public.usuario_atual_ativo() AND EXISTS (
    SELECT 1 FROM public.rotas r
      JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
     WHERE r.id = v_partes[2]::uuid
       AND r.unidade_id = v_partes[1]::uuid
       AND r.motorista_id = auth.uid()
       AND uu.usuario_id = auth.uid()
       AND uu.ativo = true);
END;
$$;

ALTER FUNCTION public.foto_de_rota_minha(text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.foto_de_rota_minha(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_de_rota_minha(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.foto_de_rota_minha(text) IS
  'true quando o path <loja>/<rota>/<arquivo> é de rota de quem chama, na loja da rota, com vínculo ativo nela e cadastro ativo (a regra de paradas_select). Usada na policy de SELECT do bucket fotos-entrega (Migration 65).';

COMMENT ON FUNCTION public.minhas_unidades_com_acesso() IS
  'Lojas com vínculo ativo de quem chama, em que é gestor ou está ativo no cadastro. Usada na policy de INSERT do bucket fotos-entrega (Migration 50); desde a Migration 65 a de SELECT segue gestor pela loja e motorista pela própria rota.';

-- ---------------------------------------------------------------------------
-- 2. Policy de SELECT do bucket
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "fotos-entrega select" ON storage.objects;

CREATE POLICY "fotos-entrega select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fotos-entrega'
    AND (
      -- (a) próprios uploads
      owner = (SELECT auth.uid())
      OR owner_id = (SELECT auth.uid())::text
      -- (b1) gestor com vínculo ativo de gestor na loja do 1º segmento (TEXT, cast-safe)
      OR (storage.foldername(name))[1] IN (
        SELECT uu.unidade_id::text
        FROM public.usuario_unidades uu
        WHERE uu.usuario_id = (SELECT auth.uid())
          AND uu.ativo = true
          AND uu.papel::text = 'gestor'
      )
      -- (b2) motorista: foto de rota dele (2º segmento), como paradas_select
      OR public.foto_de_rota_minha(name)
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

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- 1. a policy de SELECT não cita os helpers por loja e usa o helper novo
-- SELECT policyname, roles,
--        qual ILIKE '%minhas_unidades_com_acesso%' OR qual ILIKE '%get_my_unidade_ids%' AS por_loja,
--        qual ILIKE '%foto_de_rota_minha%' AS rota_propria
--   FROM pg_policies
--  WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'fotos-entrega select';
-- 2. INSERT e DELETE seguem como estavam (INSERT ainda com o helper da loja)
-- SELECT policyname, cmd, coalesce(with_check, qual) ILIKE '%minhas_unidades_com_acesso%' AS helper_loja
--   FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' ORDER BY 1;
-- 3. helper: DEFINER, search_path vazio, dono postgres, sem EXECUTE para anon
-- SELECT proname, prosecdef, proconfig, pg_get_userbyid(proowner) AS dono,
--        has_function_privilege('anon', oid, 'EXECUTE') AS anon,
--        has_function_privilege('authenticated', oid, 'EXECUTE') AS authenticated
--   FROM pg_proc WHERE oid = 'public.foto_de_rota_minha(text)'::regprocedure;
-- ============================================================================

-- ROLLBACK:
-- -- Policy no estado vivo de 25/10/2026 (pg_policies antes desta migration) e
-- -- o COMMENT antigo do helper da loja. A policy volta antes de a função sair,
-- -- porque a policy nova depende dela.
-- BEGIN;
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
--         FROM public.minhas_unidades_com_acesso() AS f(unidade_id)
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
-- DROP FUNCTION IF EXISTS public.foto_de_rota_minha(text);
-- COMMENT ON FUNCTION public.minhas_unidades_com_acesso() IS
--   'Lojas com vínculo ativo de quem chama, em que é gestor ou está ativo no cadastro. Usada nas policies do bucket fotos-entrega (Migration 50).';
-- COMMIT;
