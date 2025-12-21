-- Migration: Corrigir recursão infinita em políticas RLS
-- Data: 2025-12-20
-- Descrição:
--   A política usuarios_select_optimized causa recursão infinita
--   porque consulta a tabela usuarios dentro da própria política.
--   Solução: Usar função SECURITY DEFINER para obter unidade_id.

-- ============================================
-- FUNÇÃO AUXILIAR: get_my_unidade_id
-- ============================================
-- Função SECURITY DEFINER que bypassa RLS para obter unidade_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_my_unidade_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT unidade_id FROM public.usuarios WHERE id = auth.uid()
$$;

-- ============================================
-- CORRIGIR POLÍTICA: usuarios_select_optimized
-- ============================================
DROP POLICY IF EXISTS "usuarios_select_optimized" ON public.usuarios;

CREATE POLICY "usuarios_select_optimized" ON public.usuarios
FOR SELECT USING (
  id = (select auth.uid())
  OR
  unidade_id = (select public.get_my_unidade_id())
);

-- ============================================
-- CORRIGIR POLÍTICA: motorista_locations_select_optimized
-- ============================================
DROP POLICY IF EXISTS "motorista_locations_select_optimized" ON public.motorista_locations;

CREATE POLICY "motorista_locations_select_optimized" ON public.motorista_locations
FOR SELECT USING (
  motorista_id = (select auth.uid())
  OR
  motorista_id IN (
    SELECT u.id FROM public.usuarios u
    WHERE u.unidade_id = (select public.get_my_unidade_id())
  )
);

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Após executar, teste o login na aplicação para confirmar que funciona
