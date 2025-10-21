-- =====================================================
-- REMOVER POLÍTICAS ANTIGAS (em português)
-- =====================================================
-- Data: 2025-10-20
-- Problema: Políticas antigas coexistem com novas
-- Solução: Remover TODAS as políticas com nomes antigos
-- =====================================================

-- =====================================================
-- 1. REMOVER POLÍTICAS ANTIGAS DA TABELA USUARIOS
-- =====================================================

DROP POLICY IF EXISTS "Gestores gerenciam motoristas da sua unidade" ON usuarios;
DROP POLICY IF EXISTS "Gestores veem apenas motoristas da sua unidade" ON usuarios;
DROP POLICY IF EXISTS "Motoristas veem seu proprio registro" ON usuarios;

-- =====================================================
-- 2. REMOVER POLÍTICAS ANTIGAS DA TABELA UNIDADES
-- =====================================================

DROP POLICY IF EXISTS "Gestores veem apenas dados da sua unidade" ON unidades;
DROP POLICY IF EXISTS "Motoristas veem apenas dados da sua unidade" ON unidades;

-- =====================================================
-- 3. REMOVER POLÍTICAS ANTIGAS DA TABELA ROTAS
-- =====================================================

DROP POLICY IF EXISTS "Gestores gerenciam rotas da sua unidade" ON rotas;
DROP POLICY IF EXISTS "Motoristas atualizam apenas suas rotas" ON rotas;
DROP POLICY IF EXISTS "Motoristas veem apenas suas rotas" ON rotas;

-- =====================================================
-- 4. VERIFICAÇÃO FINAL
-- =====================================================

-- Listar políticas restantes (apenas as novas devem aparecer)
DO $$
BEGIN
  RAISE NOTICE 'Políticas restantes na tabela usuarios:';
END $$;

SELECT policyname
FROM pg_policies
WHERE tablename = 'usuarios'
ORDER BY policyname;

-- =====================================================
-- FIM DA CORREÇÃO
-- =====================================================
