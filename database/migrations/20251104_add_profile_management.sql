-- Migration: Adiciona campos para gestão de perfil e hierarquia
-- Data: 04/11/2024
-- Descrição: Campos para primeiro acesso, gestor principal e gestão self-service

-- ============================================
-- 1. ADICIONAR COLUNAS NA TABELA USUARIOS
-- ============================================

-- Campo para controlar primeiro acesso (forçar troca de senha)
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS primeira_senha BOOLEAN DEFAULT true;

-- Campo para identificar gestor principal da unidade (owner)
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS is_gestor_principal BOOLEAN DEFAULT false;

-- Campo para armazenar URL da foto de perfil
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Campo para rastrear último login
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMP WITH TIME ZONE;

-- ============================================
-- 2. ÍNDICES PARA PERFORMANCE
-- ============================================

-- Índice para buscar gestor principal de cada unidade
CREATE INDEX IF NOT EXISTS idx_usuarios_gestor_principal
ON usuarios(unidade_id, is_gestor_principal)
WHERE is_gestor_principal = true AND ativo = true;

-- ============================================
-- 3. CONSTRAINT: APENAS 1 GESTOR PRINCIPAL POR UNIDADE
-- ============================================

-- Constraint única: garante que cada unidade tenha no máximo 1 gestor principal ativo
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_main_manager_per_unit
ON usuarios (unidade_id)
WHERE is_gestor_principal = true AND ativo = true AND papel = 'gestor';

-- ============================================
-- 4. MARCAR PRIMEIRO GESTOR DE CADA UNIDADE COMO PRINCIPAL
-- ============================================

-- Para unidades que já existem, marcar o gestor mais antigo como principal
WITH first_managers AS (
  SELECT DISTINCT ON (unidade_id)
    id,
    unidade_id
  FROM usuarios
  WHERE papel = 'gestor'
    AND ativo = true
    AND unidade_id IS NOT NULL
  ORDER BY unidade_id, created_at ASC
)
UPDATE usuarios
SET is_gestor_principal = true
WHERE id IN (SELECT id FROM first_managers);

-- ============================================
-- 5. MARCAR USUÁRIOS EXISTENTES COMO JÁ TENDO FEITO PRIMEIRO LOGIN
-- ============================================

-- Usuários que já existem não precisam trocar senha no primeiro acesso
UPDATE usuarios
SET primeira_senha = false
WHERE created_at < NOW();

-- ============================================
-- 6. COMENTÁRIOS NAS COLUNAS
-- ============================================

COMMENT ON COLUMN usuarios.primeira_senha IS 'Indica se usuário precisa trocar senha no primeiro acesso';
COMMENT ON COLUMN usuarios.is_gestor_principal IS 'Identifica o gestor principal/dono da unidade (apenas 1 por unidade)';
COMMENT ON COLUMN usuarios.foto_url IS 'URL da foto de perfil do usuário no Storage';
COMMENT ON COLUMN usuarios.ultimo_login IS 'Timestamp do último login realizado';

-- ============================================
-- 7. FUNÇÃO HELPER: OBTER GESTOR PRINCIPAL DA UNIDADE
-- ============================================

CREATE OR REPLACE FUNCTION get_gestor_principal(unidade_uuid UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  gestor_id UUID;
BEGIN
  SELECT id INTO gestor_id
  FROM usuarios
  WHERE unidade_id = unidade_uuid
    AND is_gestor_principal = true
    AND ativo = true
    AND papel = 'gestor'
  LIMIT 1;

  RETURN gestor_id;
END;
$$;

COMMENT ON FUNCTION get_gestor_principal IS 'Retorna o ID do gestor principal de uma unidade';

-- ============================================
-- 8. VALIDAÇÃO: EXECUTAR VERIFICAÇÕES
-- ============================================

-- Verificar quantas unidades têm gestor principal
DO $$
DECLARE
  total_unidades INT;
  unidades_com_gestor INT;
BEGIN
  SELECT COUNT(DISTINCT id) INTO total_unidades FROM unidades WHERE ativa = true;

  SELECT COUNT(DISTINCT unidade_id) INTO unidades_com_gestor
  FROM usuarios
  WHERE is_gestor_principal = true
    AND ativo = true
    AND papel = 'gestor'
    AND unidade_id IS NOT NULL;

  RAISE NOTICE 'Total de unidades ativas: %', total_unidades;
  RAISE NOTICE 'Unidades com gestor principal: %', unidades_com_gestor;

  IF unidades_com_gestor < total_unidades THEN
    RAISE WARNING 'Algumas unidades não têm gestor principal definido!';
  END IF;
END $$;
