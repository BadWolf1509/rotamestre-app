-- =====================================================
-- DIAGNÓSTICO RLS - Verificar estado atual
-- =====================================================

-- 1. Verificar se as funções helper existem
SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_user_papel', 'get_user_unidade_id')
ORDER BY routine_name;

-- 2. Listar TODAS as políticas ativas na tabela usuarios
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'usuarios'
ORDER BY policyname;

-- 3. Listar políticas na tabela unidades
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'unidades'
ORDER BY policyname;

-- 4. Listar políticas na tabela rotas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'rotas'
ORDER BY policyname;

-- 5. Verificar se RLS está ativado
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('usuarios', 'unidades', 'rotas', 'paradas')
ORDER BY tablename;

-- =====================================================
-- RESULTADO ESPERADO:
--
-- 1. Deve mostrar 2 funções: get_user_papel, get_user_unidade_id
-- 2. Deve mostrar 5 políticas em usuarios (todas com nomes novos)
-- 3. Deve mostrar 1 política em unidades
-- 4. Deve mostrar 6 políticas em rotas
-- 5. Todas as tabelas devem ter rowsecurity = true
-- =====================================================
