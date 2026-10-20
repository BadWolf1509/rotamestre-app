-- ============================================================================
-- Migration: vínculo de motorista só pelo servidor + trava do motorista que
--   atende outra loja
-- Date: 2026-10-21
-- Author: Wellinton Ribeiro
-- Purpose: qualquer gestor vinculava QUALQUER usuário à própria loja — pela
--   Edge Function criar-motorista (bastava saber o e-mail) e também direto pelo
--   PostgREST, porque a policy de INSERT de usuario_unidades só conferia a
--   unidade de destino, nunca o usuario_id. Depois de vinculado, a policy de
--   UPDATE de usuarios deixava esse gestor desativar a pessoa, trocar o e-mail
--   ou a unidade principal de um motorista de outra empresa.
--   - usuario_unidades: sem INSERT/UPDATE/DELETE para anon/authenticated. O app
--     não escreve nessa tabela; quem escreve é a Edge Function (service_role) e
--     RPCs SECURITY DEFINER (onboarding e as duas abaixo).
--   - motorista_atende_outra_loja: tem vínculo (ativo OU NÃO) numa unidade em
--     que quem chama não é gestor ativo. Conta o inativo de propósito: a outra
--     loja pode reativá-lo, e sem isso a última loja a desativar caía no ramo
--     "pessoa" e desativava o motorista para todas. Só para uso interno.
--   - trava_motorista_outra_loja (BEFORE UPDATE em usuarios): para motorista
--     que atende outra loja, o gestor só muda nome e telefone.
--   - listar_motoristas_unidade: a lista da tela Motoristas, incluindo o
--     vínculo INATIVO da própria loja (para dar para reativar), que a RLS de
--     usuarios esconde.
--   - alternar_motorista_na_unidade: o toggle da tela. Quem atende outra loja
--     é desativado só nesta loja (o vínculo); quem atende uma só, a pessoa,
--     como antes.
-- ============================================================================

BEGIN;

-- 1. usuario_unidades: escrita só pelo servidor -------------------------------

DROP POLICY IF EXISTS usuario_unidades_insert ON public.usuario_unidades;
DROP POLICY IF EXISTS usuario_unidades_update ON public.usuario_unidades;
DROP POLICY IF EXISTS usuario_unidades_delete ON public.usuario_unidades;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.usuario_unidades
  FROM anon, authenticated;

-- 2. "Atende outra loja", relativo a quem chama -------------------------------

CREATE OR REPLACE FUNCTION public.motorista_atende_outra_loja(p_usuario_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_unidades uu
    WHERE uu.usuario_id = p_usuario_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_unidades g
        WHERE g.usuario_id = auth.uid()
          AND g.unidade_id = uu.unidade_id
          AND g.papel = 'gestor'
          AND g.ativo
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.motorista_atende_outra_loja(uuid)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.motorista_atende_outra_loja(uuid) IS
  'Vínculo (ativo ou não) numa unidade em que auth.uid() não é gestor ativo. Uso interno.';

-- 3. Trava do UPDATE em usuarios ----------------------------------------------

CREATE OR REPLACE FUNCTION public.trava_motorista_outra_loja()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Service role (Edge Function, painel admin) chega sem auth.uid(); o próprio
  -- motorista edita o próprio perfil (foto, push_token, ultimo_login).
  IF auth.uid() IS NULL OR auth.uid() = OLD.id OR OLD.papel <> 'motorista' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.usuarios a
    WHERE a.id = auth.uid() AND a.admin_role IS NOT NULL
  ) THEN
    RETURN NEW;
  END IF;

  IF NOT public.motorista_atende_outra_loja(OLD.id) THEN
    RETURN NEW;
  END IF;

  -- unidade_id NULL -> valor é o sync_usuario_unidade_ativa preenchendo o
  -- cache ao reativar um vínculo (roda com o auth.uid() do gestor); só
  -- preencher o vazio não tira o motorista de loja nenhuma.
  IF (to_jsonb(NEW) - 'nome' - 'telefone' - 'updated_at'
        - CASE WHEN OLD.unidade_id IS NULL THEN 'unidade_id' ELSE '' END)
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'nome' - 'telefone' - 'updated_at'
        - CASE WHEN OLD.unidade_id IS NULL THEN 'unidade_id' ELSE '' END) THEN
    RAISE EXCEPTION
      'Este motorista também atende outra loja: aqui só dá para mudar nome e telefone.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.trava_motorista_outra_loja()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trava_motorista_outra_loja ON public.usuarios;
CREATE TRIGGER trava_motorista_outra_loja
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.trava_motorista_outra_loja();

-- 4. Lista da tela Motoristas -------------------------------------------------

CREATE OR REPLACE FUNCTION public.listar_motoristas_unidade(p_unidade_id uuid)
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  telefone text,
  foto_url text,
  ativo boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.current_user_is_gestor_of_unidade(p_unidade_id) THEN
    RAISE EXCEPTION 'Apenas gestores da unidade podem listar os motoristas.'
      USING ERRCODE = '42501';
  END IF;

  -- Vínculo e pessoa inativos ao mesmo tempo = fora da loja (como antes, em que
  -- a lista só trazia vínculo ativo). Só um dos dois inativo = aparece inativo.
  RETURN QUERY
  SELECT u.id, u.nome::text, u.email::text, u.telefone::text, u.foto_url,
         (coalesce(uu.ativo, false) AND coalesce(u.ativo, false)), u.created_at
  FROM public.usuario_unidades uu
  JOIN public.usuarios u ON u.id = uu.usuario_id
  WHERE uu.unidade_id = p_unidade_id
    AND uu.papel = 'motorista'
    AND u.papel = 'motorista'
    AND (coalesce(uu.ativo, false) OR coalesce(u.ativo, false))
  ORDER BY u.nome;
END;
$function$;

REVOKE ALL ON FUNCTION public.listar_motoristas_unidade(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_motoristas_unidade(uuid)
  TO authenticated;

-- 5. Toggle da tela Motoristas ------------------------------------------------

CREATE OR REPLACE FUNCTION public.alternar_motorista_na_unidade(
  p_motorista_id uuid,
  p_unidade_id uuid,
  p_ativo boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_pessoa_ativa boolean;
BEGIN
  IF NOT public.current_user_is_gestor_of_unidade(p_unidade_id) THEN
    RAISE EXCEPTION 'Apenas gestores da unidade podem alterar o motorista.'
      USING ERRCODE = '42501';
  END IF;

  SELECT u.ativo INTO v_pessoa_ativa
  FROM public.usuarios u
  JOIN public.usuario_unidades uu
    ON uu.usuario_id = u.id
   AND uu.unidade_id = p_unidade_id
   AND uu.papel = 'motorista'
  WHERE u.id = p_motorista_id
    AND u.papel = 'motorista'
  -- Serializa dois toggles do mesmo motorista (duas lojas ao mesmo tempo).
  FOR UPDATE OF u;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Motorista não encontrado nesta loja.'
      USING ERRCODE = 'P0001';
  END IF;

  IF public.motorista_atende_outra_loja(p_motorista_id) THEN
    IF p_ativo AND NOT v_pessoa_ativa THEN
      RAISE EXCEPTION
        'Este motorista também atende outra loja e está desativado. Para reativá-lo, fale com o suporte.'
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.usuario_unidades
    SET ativo = p_ativo
    WHERE usuario_id = p_motorista_id
      AND unidade_id = p_unidade_id;

    RETURN 'vinculo';
  END IF;

  UPDATE public.usuarios SET ativo = p_ativo WHERE id = p_motorista_id;

  -- Reativar também reabre o vínculo desta loja: se a outra loja tirou o dela,
  -- este deixou de ser "outra loja" e cairia aqui com o vínculo ainda inativo.
  IF p_ativo THEN
    UPDATE public.usuario_unidades
    SET ativo = true
    WHERE usuario_id = p_motorista_id
      AND unidade_id = p_unidade_id
      AND NOT ativo;
  END IF;

  RETURN 'pessoa';
END;
$function$;

REVOKE ALL ON FUNCTION public.alternar_motorista_na_unidade(uuid, uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alternar_motorista_na_unidade(uuid, uuid, boolean)
  TO authenticated;

COMMIT;
