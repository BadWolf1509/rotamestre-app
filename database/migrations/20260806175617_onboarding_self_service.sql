-- ============================================================================
-- Migration: onboarding self-service (testador cria a própria unidade)
-- Date: 2026-08-06
-- Purpose: hoje nenhum usuário novo consegue concluir cadastro. `signUp` cria a
--          conta no Auth e depois tenta inserir em `usuarios`, insert que a
--          policy `usuarios_insert_optimized` bloqueia porque exige que o autor
--          já seja gestor de alguma unidade. Como o erro vem DEPOIS da conta
--          criada, sobra conta órfã (5 pessoas reais nesse estado).
--          Esta RPC cria unidade + perfil + vínculo em transação única.
-- ============================================================================

BEGIN;

-- 1. CNPJ deixa de ser obrigatório.
--    O UNIQUE permanece: em Postgres, múltiplos NULL não colidem.
ALTER TABLE public.unidades ALTER COLUMN cnpj DROP NOT NULL;

-- 2. RPC de onboarding
CREATE OR REPLACE FUNCTION public.criar_unidade_para_novo_gestor(
  p_gestor_nome     text,
  p_unidade_nome    text,
  p_cidade          text,
  p_uf              text,
  p_sede_endereco   text,
  p_sede_latitude   numeric,
  p_sede_longitude  numeric,
  p_telefone        text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_email      text;
  v_unidade_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000';
  END IF;

  -- Guarda central: restringe a função a onboarding e limita cada conta a
  -- exatamente uma unidade. Sem ela, qualquer gestor criaria unidades à vontade.
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_uid) THEN
    RAISE EXCEPTION 'PERFIL_JA_EXISTE' USING ERRCODE = 'P0001';
  END IF;

  IF coalesce(btrim(p_gestor_nome), '') = ''
     OR coalesce(btrim(p_unidade_nome), '') = ''
     OR coalesce(btrim(p_cidade), '') = '' THEN
    RAISE EXCEPTION 'CAMPOS_OBRIGATORIOS' USING ERRCODE = '22023';
  END IF;

  -- Sem coordenadas a unidade nasce incapaz de gerar rota: partida e chegada
  -- saem de sede_latitude/sede_longitude (src/hooks/nova-entrega/useEnderecoUnidade.ts).
  IF p_sede_latitude IS NULL OR p_sede_longitude IS NULL THEN
    RAISE EXCEPTION 'COORDENADAS_OBRIGATORIAS' USING ERRCODE = '22023';
  END IF;

  -- E-mail vem da sessão, nunca de parâmetro: parâmetro permitiria cadastrar
  -- perfil com e-mail alheio.
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO public.unidades (
    nome, cidade, uf, sede_endereco, sede_latitude, sede_longitude,
    origem, status, ativa
  )
  VALUES (
    btrim(p_unidade_nome),
    btrim(p_cidade),
    nullif(btrim(coalesce(p_uf, '')), ''),
    nullif(btrim(coalesce(p_sede_endereco, '')), ''),
    p_sede_latitude,
    p_sede_longitude,
    'self_service',
    'trial',
    true
  )
  RETURNING id INTO v_unidade_id;

  -- papel é literal, nunca parâmetro: parâmetro deixaria o client escolher o
  -- próprio papel.
  -- primeira_senha = false: o default da coluna é TRUE e mandaria o gestor
  -- recém-criado para /onboarding/first-password trocar a senha que ele acabou
  -- de escolher.
  -- is_gestor_principal = true: quem cria a unidade é o titular. Sem isso ele
  -- não gerencia a própria equipe (app/unidade/equipe.tsx, transferir.tsx).
  INSERT INTO public.usuarios (
    id, email, nome, papel, unidade_id, telefone,
    ativo, primeira_senha, is_gestor_principal
  )
  VALUES (
    v_uid,
    v_email,
    btrim(p_gestor_nome),
    'gestor',
    v_unidade_id,
    nullif(btrim(coalesce(p_telefone, '')), ''),
    true, false, true
  );

  INSERT INTO public.usuario_unidades (
    usuario_id, unidade_id, papel, ativo, is_principal
  )
  VALUES (v_uid, v_unidade_id, 'gestor', true, true);

  RETURN v_unidade_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_unidade_para_novo_gestor(
  text, text, text, text, text, numeric, numeric, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.criar_unidade_para_novo_gestor(
  text, text, text, text, text, numeric, numeric, text
) TO authenticated;

COMMENT ON FUNCTION public.criar_unidade_para_novo_gestor(
  text, text, text, text, text, numeric, numeric, text
) IS 'Onboarding self-service. Só executa para auth.uid() SEM linha em usuarios; cria unidade + perfil de gestor + vínculo em transação única.';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.criar_unidade_para_novo_gestor(
--   text, text, text, text, text, numeric, numeric, text);
-- -- ATENÇÃO: reverter o NOT NULL de cnpj só é possível se nenhuma unidade
-- -- tiver cnpj nulo. Rode antes:
-- --   select count(*) from public.unidades where cnpj is null;
-- -- ALTER TABLE public.unidades ALTER COLUMN cnpj SET NOT NULL;
-- COMMIT;
