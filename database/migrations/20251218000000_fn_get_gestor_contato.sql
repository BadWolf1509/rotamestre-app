-- =============================================
-- Migration: Função para obter contato do gestor
-- =============================================
-- Data: 2025-12-18
-- Descrição: Função SECURITY DEFINER que permite motoristas obterem
--            os dados de contato do gestor da sua unidade
--
-- Problema: RLS policy não permite motoristas consultarem outros usuários
-- Solução: Função com SECURITY DEFINER que bypassa RLS de forma controlada
--
-- Uso no app: const { data } = await supabase.rpc('get_gestor_contato')

-- Drop função antiga se existir
DROP FUNCTION IF EXISTS get_gestor_contato();

-- Criar função com SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_gestor_contato()
RETURNS TABLE (
  nome TEXT,
  telefone TEXT,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
  v_unidade_id UUID;
BEGIN
  -- Obter ID do usuário autenticado
  v_usuario_id := auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Obter unidade do usuário (via tabela usuarios ou usuario_unidades)
  SELECT COALESCE(
    -- Primeiro, tentar pegar da tabela usuario_unidades (multi-unidade)
    (SELECT uu.unidade_id
     FROM usuario_unidades uu
     WHERE uu.usuario_id = v_usuario_id
       AND uu.ativo = true
     ORDER BY uu.created_at DESC
     LIMIT 1),
    -- Fallback: pegar direto da tabela usuarios
    (SELECT u.unidade_id
     FROM usuarios u
     WHERE u.id = v_usuario_id)
  ) INTO v_unidade_id;

  IF v_unidade_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui unidade vinculada';
  END IF;

  -- Retornar dados do gestor (prioriza gestor principal, depois qualquer gestor)
  RETURN QUERY
  SELECT
    u.nome::TEXT,
    u.telefone::TEXT,
    u.email::TEXT
  FROM usuarios u
  WHERE u.unidade_id = v_unidade_id
    AND u.papel = 'gestor'
    AND u.ativo = true
  ORDER BY
    u.is_gestor_principal DESC NULLS LAST,  -- Gestor principal primeiro
    u.created_at ASC                         -- Mais antigo se não tiver principal
  LIMIT 1;

  -- Se não encontrou gestor, retornar vazio (não lança exceção)
  -- Isso permite que o app trate o caso de "gestor não encontrado"
END;
$$;

-- Permissão para usuários autenticados executarem a função
GRANT EXECUTE ON FUNCTION get_gestor_contato() TO authenticated;

-- Comentário da função
COMMENT ON FUNCTION get_gestor_contato IS
  'Retorna nome, telefone e email do gestor da unidade do usuário autenticado. '
  'Usa SECURITY DEFINER para bypassing RLS de forma segura.';

-- =============================================
-- VALIDAÇÃO
-- =============================================

-- Verificar que a função foi criada
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_gestor_contato'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE NOTICE '✅ Função get_gestor_contato criada com sucesso';
  ELSE
    RAISE EXCEPTION '❌ Falha ao criar função get_gestor_contato';
  END IF;
END $$;
