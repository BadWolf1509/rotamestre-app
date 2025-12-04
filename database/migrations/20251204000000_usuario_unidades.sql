-- =============================================
-- Migration: Multi-Unit User Support (usuario_unidades)
-- =============================================
-- Data: 2025-12-04
-- Descrição: Permite que um usuário (motorista/gestor) pertença a múltiplas unidades
--
-- Problema: Atualmente um motorista só pode pertencer a uma unidade
-- Solução: Criar tabela de junção N:N entre usuarios e unidades
--
-- Impacto: Motoristas podem trabalhar para múltiplas unidades

-- =============================================
-- PARTE 1: CRIAR TABELA usuario_unidades
-- =============================================

-- Tabela de junção: relacionamento N:N entre usuarios e unidades
CREATE TABLE IF NOT EXISTS public.usuario_unidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  papel VARCHAR(20) NOT NULL CHECK (papel IN ('gestor', 'motorista')),
  is_principal BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Cada usuário só pode ter um vínculo por unidade
  UNIQUE(usuario_id, unidade_id)
);

-- Comentários
COMMENT ON TABLE public.usuario_unidades IS 'Vinculações entre usuários e unidades (N:N)';
COMMENT ON COLUMN public.usuario_unidades.papel IS 'Papel do usuário NESTA unidade específica';
COMMENT ON COLUMN public.usuario_unidades.is_principal IS 'Se é o gestor principal desta unidade';
COMMENT ON COLUMN public.usuario_unidades.ativo IS 'Se o vínculo está ativo';

-- =============================================
-- PARTE 2: ÍNDICES PARA PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_uu_usuario ON public.usuario_unidades(usuario_id);
CREATE INDEX IF NOT EXISTS idx_uu_unidade ON public.usuario_unidades(unidade_id);
CREATE INDEX IF NOT EXISTS idx_uu_papel ON public.usuario_unidades(papel);
CREATE INDEX IF NOT EXISTS idx_uu_ativo ON public.usuario_unidades(usuario_id, unidade_id) WHERE ativo = true;

-- Índice para buscar gestor principal de uma unidade
CREATE INDEX IF NOT EXISTS idx_uu_principal ON public.usuario_unidades(unidade_id, is_principal) WHERE is_principal = true;

-- =============================================
-- PARTE 3: MIGRAR DADOS EXISTENTES
-- =============================================

-- Migrar vinculações existentes de usuarios.unidade_id para usuario_unidades
INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, is_principal, ativo, created_at)
SELECT
  id AS usuario_id,
  unidade_id,
  papel,
  COALESCE(is_gestor_principal, false) AS is_principal,
  ativo,
  created_at
FROM public.usuarios
WHERE unidade_id IS NOT NULL
ON CONFLICT (usuario_id, unidade_id) DO NOTHING;

-- =============================================
-- PARTE 4: HELPER FUNCTIONS
-- =============================================

-- Função: Retorna array de unidade_ids do usuário
CREATE OR REPLACE FUNCTION public.get_user_unidades(p_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY_AGG(unidade_id),
    ARRAY[]::UUID[]
  )
  FROM public.usuario_unidades
  WHERE usuario_id = p_user_id
    AND ativo = true;
$$;

COMMENT ON FUNCTION public.get_user_unidades IS 'Retorna array de unidade_ids ativas do usuário';

-- Função: Verifica se usuário pertence a uma unidade
CREATE OR REPLACE FUNCTION public.user_belongs_to_unidade(p_user_id UUID, p_unidade_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_unidades
    WHERE usuario_id = p_user_id
      AND unidade_id = p_unidade_id
      AND ativo = true
  );
$$;

COMMENT ON FUNCTION public.user_belongs_to_unidade IS 'Verifica se usuário pertence a uma unidade específica';

-- Função: Retorna o papel do usuário em uma unidade específica
CREATE OR REPLACE FUNCTION public.get_user_papel_in_unidade(p_user_id UUID, p_unidade_id UUID)
RETURNS VARCHAR(20)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT papel
  FROM public.usuario_unidades
  WHERE usuario_id = p_user_id
    AND unidade_id = p_unidade_id
    AND ativo = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_papel_in_unidade IS 'Retorna o papel do usuário em uma unidade específica';

-- Função: Verifica se usuário é gestor em alguma de suas unidades
CREATE OR REPLACE FUNCTION public.user_is_gestor_in_any_unidade(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_unidades
    WHERE usuario_id = p_user_id
      AND papel = 'gestor'
      AND ativo = true
  );
$$;

COMMENT ON FUNCTION public.user_is_gestor_in_any_unidade IS 'Verifica se usuário é gestor em alguma unidade';

-- =============================================
-- PARTE 5: TRIGGER PARA updated_at
-- =============================================

CREATE OR REPLACE FUNCTION public.update_usuario_unidades_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_usuario_unidades_updated_at ON public.usuario_unidades;
CREATE TRIGGER tr_usuario_unidades_updated_at
  BEFORE UPDATE ON public.usuario_unidades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_usuario_unidades_updated_at();

-- =============================================
-- PARTE 6: TRIGGER PARA SINCRONIZAR unidade_id (cache)
-- =============================================

-- Quando trocar unidade ativa, atualizar usuarios.unidade_id como cache
CREATE OR REPLACE FUNCTION public.sync_usuario_unidade_ativa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quando um vínculo é ativado/desativado, verificar se precisa atualizar o cache
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.ativo IS DISTINCT FROM NEW.ativo) THEN
    -- Se não há unidade_id definida no usuario, usar esta
    UPDATE public.usuarios
    SET unidade_id = NEW.unidade_id
    WHERE id = NEW.usuario_id
      AND unidade_id IS NULL
      AND NEW.ativo = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_usuario_unidade_ativa ON public.usuario_unidades;
CREATE TRIGGER tr_sync_usuario_unidade_ativa
  AFTER INSERT OR UPDATE ON public.usuario_unidades
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_usuario_unidade_ativa();

-- =============================================
-- PARTE 7: RLS PARA usuario_unidades
-- =============================================

ALTER TABLE public.usuario_unidades ENABLE ROW LEVEL SECURITY;

-- SELECT: Usuário vê seus próprios vínculos OU gestores veem vínculos da sua unidade
CREATE POLICY usuario_unidades_select ON public.usuario_unidades
  FOR SELECT
  USING (
    -- Usuário vê seus próprios vínculos
    usuario_id = (SELECT auth.uid())
    OR
    -- Gestores veem vínculos de usuários das suas unidades
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.papel = 'gestor'
        AND uu.unidade_id = usuario_unidades.unidade_id
        AND uu.ativo = true
    )
  );

-- INSERT: Apenas gestores podem criar vínculos para sua unidade
CREATE POLICY usuario_unidades_insert ON public.usuario_unidades
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.papel = 'gestor'
        AND uu.unidade_id = usuario_unidades.unidade_id
        AND uu.ativo = true
    )
  );

-- UPDATE: Gestores podem atualizar vínculos da sua unidade (exceto seus próprios vínculos de gestor)
CREATE POLICY usuario_unidades_update ON public.usuario_unidades
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.papel = 'gestor'
        AND uu.unidade_id = usuario_unidades.unidade_id
        AND uu.ativo = true
    )
    -- Não pode alterar seu próprio papel de gestor (evita lock-out)
    AND NOT (usuario_id = (SELECT auth.uid()) AND papel = 'gestor')
  );

-- DELETE: Gestores podem remover vínculos (exceto seus próprios)
CREATE POLICY usuario_unidades_delete ON public.usuario_unidades
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.papel = 'gestor'
        AND uu.unidade_id = usuario_unidades.unidade_id
        AND uu.ativo = true
    )
    AND usuario_id != (SELECT auth.uid())
  );

-- =============================================
-- PARTE 8: ATUALIZAR COMENTÁRIO NA COLUNA LEGACY
-- =============================================

COMMENT ON COLUMN public.usuarios.unidade_id IS 'LEGACY: Unidade ativa atual do usuário (cache). Usar usuario_unidades para relação completa.';

-- =============================================
-- VALIDAÇÃO
-- =============================================

-- Verificar que a migração de dados funcionou
SELECT
  'Dados migrados' AS status,
  (SELECT COUNT(*) FROM public.usuarios WHERE unidade_id IS NOT NULL) AS usuarios_com_unidade,
  (SELECT COUNT(*) FROM public.usuario_unidades) AS vinculos_criados;

-- Verificar que as funções foram criadas
SELECT
  'Funções criadas' AS status,
  COUNT(*) AS total
FROM pg_proc
WHERE proname IN ('get_user_unidades', 'user_belongs_to_unidade', 'get_user_papel_in_unidade', 'user_is_gestor_in_any_unidade');

-- =============================================
-- NOTAS
-- =============================================
--
-- Esta migration NÃO remove a coluna usuarios.unidade_id
-- Ela continua funcionando como "cache" da unidade ativa
--
-- Próximos passos (migration separada):
-- 1. Atualizar RLS policies das outras tabelas para usar usuario_unidades
-- 2. Atualizar queries do app para usar a nova estrutura
-- 3. Após estabilizar, remover coluna usuarios.unidade_id (opcional)
