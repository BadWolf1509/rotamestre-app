-- ============================================================================
-- Migration 38: endurece usuarios, fotos de perfil/incidente, incidentes e grants
-- Date: 2026-10-23
-- Author: Wellinton Ribeiro
-- Purpose: fecha cinco aberturas achadas na auditoria de segurança de 22/10/2026.
--
--   a) usuarios: a policy `usuarios_insert_optimized` só exigia que quem chama
--      fosse gestor ativo de alguma loja, sem restringir colunas — e
--      `authenticated` tem INSERT na tabela inteira (`papel`, `admin_role`,
--      `is_gestor_principal`, `unidade_id`, `id`). Um gestor criava perfil
--      arbitrário. Os únicos INSERT legítimos são da Edge Function
--      `criar-motorista` (chave secreta, ignora RLS e grants de authenticated) e
--      da RPC `criar_unidade_para_novo_gestor` (SECURITY DEFINER, roda como
--      postgres). O app não faz `.from('usuarios').insert/upsert` (conferido por
--      grep em 23/10/2026; os scripts de usuário de teste usam a chave secreta).
--
--   b) spatial_ref_sys (PostGIS): sem RLS e com INSERT/UPDATE/DELETE/TRUNCATE
--      para anon/authenticated. A tabela é de `supabase_admin`, que também é o
--      concedente dos privilégios; `postgres` os tem SEM grant option. Por isso
--      o REVOKE abaixo provavelmente NÃO tem efeito (o Postgres só avisa "no
--      privileges could be revoked") — o mesmo que aconteceu com a extensão
--      `http` na Migration 32. O bloco DO logo depois mede e avisa. Se não tiver
--      efeito, a correção é no painel: o PostGIS NÃO é usado (0 colunas
--      geometry/geography, 0 funções/views com ST_*, medido em 23/10/2026), então
--      desligar a extensão em Database → Extensions → postgis remove a tabela;
--      a alternativa conservadora é mover a extensão para o schema `extensions`.
--
--   c) fotos `perfis/` e `incidentes/` do bucket `fotos-entrega`: a policy de
--      SELECT liberava o objeto quando havia linha VISÍVEL de usuarios/incidentes
--      cujo `foto_url` casasse com ele — e o próprio usuário grava esse
--      `foto_url`. Bastava gravar no próprio perfil (ou num incidente próprio) o
--      path da foto de outra pessoa para ganhar leitura dela. Agora a linha que
--      referencia o objeto tem de ser do DONO do objeto (`owner`/`owner_id` =
--      `usuarios.id` / `incidentes.motorista_id`). O dono do objeto é quem fez o
--      upload, e o upload do app é sempre do próprio perfil (`useProfilePhoto`
--      com o id da sessão) e do próprio incidente (`useIncidentSubmit`).
--      Medido em 23/10/2026: 3/3 fotos de perfil e 9/9 de incidente têm o dono
--      do objeto igual ao dono da linha — nenhuma foto legítima deixa de abrir.
--      (Escolhido em vez de gatilho de validação de `foto_url` na escrita: não
--      mexe no caminho de gravação nem depende do formato do path — o de
--      incidente, `incidentes/incident_<ts>.jpg`, nem carrega o id do usuário.)
--
--   d) incidentes: o INSERT aceitava `rota_id`/`parada_id` de qualquer rota,
--      de qualquer empresa (a policy só exige `motorista_id = auth.uid()`).
--      Gatilho BEFORE INSERT/UPDATE: rota NULL ou do próprio motorista do
--      incidente; parada NULL ou da rota do incidente. No UPDATE cada ligação
--      só é conferida se mudou — a rota pode ser reatribuída depois, e o gestor
--      continua podendo resolver o incidente antigo — e virar NULL nunca é
--      recusado, para o ON DELETE SET NULL das FKs não bloquear o DELETE da
--      rota/parada (a ordem dos dois SET NULL não é garantida; achado do
--      rls-policy-reviewer). Medido em 23/10/2026: 0
--      incidentes com rota de outro motorista, 0 com parada fora da rota.
--
--   e) grants: EXECUTE dos helpers de RLS sai de PUBLIC/anon (fica com
--      authenticated, de que as policies dependem). Antes, as 4 policies que os
--      chamam e valiam para `public` passam a `authenticated`: sem isso, uma
--      consulta anônima a usuarios/usuario_unidades/motorista_locations passaria
--      de "0 linhas" a "permission denied for function". Com a policy só para
--      authenticated, anon continua vendo 0 linhas. Views `vw_*` perdem
--      INSERT/UPDATE/DELETE/TRUNCATE (só leitura). Índice em
--      `rascunhos_rota(unidade_id)` (FK sem índice).
--
-- Sonda transacional: database/sondas/20261023000000_sonda_migration38.sql
-- (rodar DEPOIS desta migration, no SQL Editor; termina em RAISE e desfaz tudo).
-- Tem DROP POLICY e REVOKE: o MCP recusa — aplicar pelo SQL Editor.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- a) usuarios: ninguém do lado do cliente cria perfil
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS usuarios_insert_optimized ON public.usuarios;
REVOKE INSERT ON public.usuarios FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- b) spatial_ref_sys: tira escrita de anon/authenticated (ver cabeçalho)
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.spatial_ref_sys FROM anon, authenticated;

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.spatial_ref_sys', 'INSERT')
     OR has_table_privilege('authenticated', 'public.spatial_ref_sys', 'INSERT') THEN
    RAISE WARNING 'Migration 38: o REVOKE em spatial_ref_sys não teve efeito (tabela de supabase_admin). Desligue o PostGIS no painel (não é usado) ou mova a extensão para o schema extensions.';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- c) fotos de perfil/incidente: a linha que referencia o objeto é do dono dele
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
      -- (b) fotos de entrega: 1º segmento = unidade ativa do usuário (TEXT, cast-safe)
      OR (storage.foldername(name))[1] IN (
        SELECT f.unidade_id::text
        FROM public.get_my_unidade_ids() AS f(unidade_id)
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

-- ---------------------------------------------------------------------------
-- d) incidentes: rota do próprio motorista, parada da própria rota
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.incidentes_confere_rota_parada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
DECLARE
  v_rota_mudou boolean := true;
  v_parada_mudou boolean := true;
BEGIN
  -- No UPDATE, cada ligação só é conferida quando muda: a rota pode ser
  -- reatribuída a outro motorista depois, e o incidente antigo continua
  -- editável. E desligar (virar NULL) nunca é recusado: apagar a rota ou a
  -- parada dispara o ON DELETE SET NULL das FKs, em ordem não garantida — se o
  -- SET NULL da rota vier antes do da parada, a linha passa por rota NULL +
  -- parada preenchida, e recusar ali bloquearia o DELETE da rota.
  -- Rota que muda para NULL não obriga a reconferir a parada; parada que muda
  -- para outro valor é conferida contra a rota (NULL recusa).
  IF TG_OP = 'UPDATE' THEN
    v_rota_mudou := NEW.rota_id IS DISTINCT FROM OLD.rota_id
                    OR NEW.motorista_id IS DISTINCT FROM OLD.motorista_id;
    v_parada_mudou := NEW.parada_id IS DISTINCT FROM OLD.parada_id
                      OR (NEW.rota_id IS DISTINCT FROM OLD.rota_id AND NEW.rota_id IS NOT NULL);
  END IF;

  IF v_rota_mudou AND NEW.rota_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.rotas r
    WHERE r.id = NEW.rota_id
      AND r.motorista_id = NEW.motorista_id
  ) THEN
    RAISE EXCEPTION 'A rota do incidente não é deste motorista.'
      USING ERRCODE = '42501';
  END IF;

  IF v_parada_mudou AND NEW.parada_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.paradas p
    WHERE p.id = NEW.parada_id
      AND p.rota_id = NEW.rota_id
  ) THEN
    RAISE EXCEPTION 'A parada do incidente não pertence à rota informada.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.incidentes_confere_rota_parada() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS incidentes_confere_rota_parada ON public.incidentes;
CREATE TRIGGER incidentes_confere_rota_parada
  BEFORE INSERT OR UPDATE OF rota_id, parada_id, motorista_id ON public.incidentes
  FOR EACH ROW EXECUTE FUNCTION public.incidentes_confere_rota_parada();

-- ---------------------------------------------------------------------------
-- e) grants
-- ---------------------------------------------------------------------------
-- Primeiro as policies que chamam os helpers deixam de valer para anon,
-- senão a consulta anônima falharia em vez de devolver 0 linhas.
ALTER POLICY usuarios_select_optimized ON public.usuarios TO authenticated;
ALTER POLICY usuarios_update_optimized ON public.usuarios TO authenticated;
ALTER POLICY usuario_unidades_select ON public.usuario_unidades TO authenticated;
ALTER POLICY motorista_locations_select_optimized ON public.motorista_locations TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_user_is_gestor_of_unidade(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_unidade_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_unidade_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_papel() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_unidade_id() FROM PUBLIC, anon;
-- authenticated mantém EXECUTE de propósito: as policies dependem dele.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.vw_paradas_com_vinculo FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.vw_performance_motoristas FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.vw_rotas_resumo FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_rascunhos_rota_unidade_id ON public.rascunhos_rota (unidade_id);

COMMIT;

-- ============================================================================
-- Conferência pós-aplicação (só SELECT; esperado ao lado)
-- ============================================================================
-- 1. usuarios sem INSERT do cliente e sem policy de INSERT  → false, false, 0
-- SELECT has_table_privilege('authenticated','public.usuarios','INSERT'),
--        has_table_privilege('anon','public.usuarios','INSERT'),
--        (SELECT count(*) FROM pg_policies WHERE tablename='usuarios' AND cmd='INSERT');
-- 2. spatial_ref_sys → false, false (se true: desligar PostGIS no painel)
-- SELECT has_table_privilege('anon','public.spatial_ref_sys','INSERT'),
--        has_table_privilege('authenticated','public.spatial_ref_sys','INSERT');
-- 3. policy de fotos com o dono  → 2
-- SELECT (qual ~ 'u\.id = objects\.owner')::int + (qual ~ 'i\.motorista_id = objects\.owner')::int
-- FROM pg_policies WHERE schemaname='storage' AND policyname='fotos-entrega select';
-- 4. fotos legítimas continuam abrindo: dono do objeto = dono da linha → total = ok
-- WITH u AS (SELECT id, regexp_replace(split_part(foto_url,'?',1),'^.*/fotos-entrega/','') p
--            FROM public.usuarios WHERE coalesce(foto_url,'')<>'')
-- SELECT count(*) total, count(*) FILTER (WHERE o.owner=u.id OR o.owner_id=u.id::text) ok
-- FROM u LEFT JOIN storage.objects o ON o.bucket_id='fotos-entrega' AND o.name=u.p;
-- (idem para incidentes, com motorista_id)
-- 5. gatilho de incidentes → 1 linha, enabled 'O'
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgname='incidentes_confere_rota_parada';
-- 6. helpers sem anon/PUBLIC, com authenticated → para cada: false, true
-- SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE'),
--        has_function_privilege('authenticated', p.oid, 'EXECUTE')
-- FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
-- WHERE n.nspname='public' AND p.proname IN ('current_user_is_gestor_of_unidade',
--   'get_my_unidade_id','get_my_unidade_ids','get_user_papel','get_user_unidade_id');
--    (has_function_privilege considera PUBLIC: false para anon prova os dois)
-- 7. as 4 policies só para authenticated → roles = {authenticated}
-- SELECT tablename, policyname, roles FROM pg_policies WHERE policyname IN
--   ('usuarios_select_optimized','usuarios_update_optimized','usuario_unidades_select',
--    'motorista_locations_select_optimized');
-- 8. views só leitura → 0 linhas
-- SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
-- WHERE table_schema='public' AND table_name LIKE 'vw\_%' AND grantee IN ('anon','authenticated')
--   AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE');
-- 9. índice → 1 linha
-- SELECT indexname FROM pg_indexes WHERE indexname='idx_rascunhos_rota_unidade_id';

-- ROLLBACK:
-- BEGIN;
-- -- a)
-- GRANT INSERT ON public.usuarios TO anon, authenticated;
-- CREATE POLICY usuarios_insert_optimized ON public.usuarios FOR INSERT TO public
--   WITH CHECK (EXISTS (SELECT 1 FROM public.usuario_unidades uu
--     WHERE uu.usuario_id = (SELECT auth.uid()) AND uu.papel::text = 'gestor' AND uu.ativo = true));
-- -- b) (se o REVOKE teve efeito)
-- GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.spatial_ref_sys TO anon, authenticated;
-- -- c) policy anterior (sem a conferência do dono): ver 20260703120000_c3_fase2_storage_rls_por_unidade.sql
-- DROP POLICY IF EXISTS "fotos-entrega select" ON storage.objects;
-- -- (recriar com o texto da PARTE 2 daquele arquivo)
-- -- d)
-- DROP TRIGGER IF EXISTS incidentes_confere_rota_parada ON public.incidentes;
-- DROP FUNCTION IF EXISTS public.incidentes_confere_rota_parada();
-- -- e)
-- GRANT EXECUTE ON FUNCTION public.current_user_is_gestor_of_unidade(uuid) TO PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.get_my_unidade_id() TO PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.get_my_unidade_ids() TO PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.get_user_papel() TO PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.get_user_unidade_id() TO PUBLIC, anon;
-- ALTER POLICY usuarios_select_optimized ON public.usuarios TO public;
-- ALTER POLICY usuarios_update_optimized ON public.usuarios TO public;
-- ALTER POLICY usuario_unidades_select ON public.usuario_unidades TO public;
-- ALTER POLICY motorista_locations_select_optimized ON public.motorista_locations TO public;
-- GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.vw_paradas_com_vinculo TO authenticated;  -- anon não tinha
-- GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.vw_performance_motoristas TO authenticated;  -- anon não tinha
-- GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.vw_rotas_resumo TO authenticated;  -- anon não tinha
-- DROP INDEX IF EXISTS public.idx_rascunhos_rota_unidade_id;
-- COMMIT;
