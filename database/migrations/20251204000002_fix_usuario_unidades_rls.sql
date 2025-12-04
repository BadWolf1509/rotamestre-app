-- =============================================
-- Migration: Fix usuario_unidades RLS (Infinite Recursion)
-- =============================================
-- Data: 2025-12-04
-- Descrição: Corrige recursão infinita nas policies de usuario_unidades
--
-- Problema: As policies SELECT/INSERT/UPDATE/DELETE fazem referência
--           à própria tabela usuario_unidades, causando loop infinito
--
-- Solução: Usar funções SECURITY DEFINER que bypassam RLS

-- =============================================
-- DROP POLÍTICAS PROBLEMÁTICAS
-- =============================================

DROP POLICY IF EXISTS usuario_unidades_select ON public.usuario_unidades;
DROP POLICY IF EXISTS usuario_unidades_insert ON public.usuario_unidades;
DROP POLICY IF EXISTS usuario_unidades_update ON public.usuario_unidades;
DROP POLICY IF EXISTS usuario_unidades_delete ON public.usuario_unidades;

-- =============================================
-- CRIAR FUNÇÃO HELPER PARA VERIFICAR SE É GESTOR
-- =============================================

-- Função que verifica se o usuário atual é gestor de uma unidade específica
-- Usa SECURITY DEFINER para bypassar RLS
CREATE OR REPLACE FUNCTION public.current_user_is_gestor_of_unidade(p_unidade_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_unidades
    WHERE usuario_id = (SELECT auth.uid())
      AND unidade_id = p_unidade_id
      AND papel = 'gestor'
      AND ativo = true
  );
$$;

COMMENT ON FUNCTION public.current_user_is_gestor_of_unidade IS 'Verifica se usuário atual é gestor de uma unidade (bypassa RLS)';

-- =============================================
-- NOVAS POLÍTICAS SEM RECURSÃO
-- =============================================

-- SELECT: Usuário vê seus próprios vínculos OU gestores veem vínculos da sua unidade
CREATE POLICY usuario_unidades_select ON public.usuario_unidades
  FOR SELECT
  USING (
    -- Usuário sempre vê seus próprios vínculos
    usuario_id = (SELECT auth.uid())
    OR
    -- Gestores veem vínculos de outros usuários na mesma unidade (usa função SECURITY DEFINER)
    public.current_user_is_gestor_of_unidade(unidade_id)
  );

-- INSERT: Apenas gestores podem criar vínculos para sua unidade
CREATE POLICY usuario_unidades_insert ON public.usuario_unidades
  FOR INSERT
  WITH CHECK (
    -- Usa função SECURITY DEFINER para verificar
    public.current_user_is_gestor_of_unidade(unidade_id)
  );

-- UPDATE: Gestores podem atualizar vínculos da sua unidade (exceto seus próprios de gestor)
CREATE POLICY usuario_unidades_update ON public.usuario_unidades
  FOR UPDATE
  USING (
    -- É gestor desta unidade
    public.current_user_is_gestor_of_unidade(unidade_id)
    -- Não pode alterar seu próprio papel de gestor (evita lock-out)
    AND NOT (usuario_id = (SELECT auth.uid()) AND papel = 'gestor')
  );

-- DELETE: Gestores podem remover vínculos (exceto seus próprios)
CREATE POLICY usuario_unidades_delete ON public.usuario_unidades
  FOR DELETE
  USING (
    -- É gestor desta unidade
    public.current_user_is_gestor_of_unidade(unidade_id)
    -- Não pode deletar seu próprio vínculo
    AND usuario_id != (SELECT auth.uid())
  );

-- =============================================
-- VALIDAÇÃO
-- =============================================

-- Verificar que as policies foram criadas
SELECT
  tablename AS "Tabela",
  policyname AS "Policy",
  cmd AS "Operação"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'usuario_unidades'
ORDER BY policyname;

-- =============================================
-- NOTAS
-- =============================================
--
-- PROBLEMA ORIGINAL:
-- A policy fazia: EXISTS (SELECT 1 FROM usuario_unidades WHERE ...)
-- Isso disparava a própria policy recursivamente
--
-- SOLUÇÃO:
-- Usar função SECURITY DEFINER que bypassa RLS ao consultar a tabela
-- Isso quebra o ciclo de recursão
