-- =====================================================
-- SOLUÇÃO TEMPORÁRIA: DESABILITAR RLS
-- =====================================================
-- Problema: Funções helper causam recursão infinita
-- Solução temporária: Desabilitar RLS até criar seed data
-- =====================================================

-- DESABILITAR RLS em todas as tabelas
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE unidades DISABLE ROW LEVEL SECURITY;
ALTER TABLE rotas DISABLE ROW LEVEL SECURITY;
ALTER TABLE paradas DISABLE ROW LEVEL SECURITY;

-- Dropar todas as políticas
DROP POLICY IF EXISTS "usuarios_select_own" ON usuarios;
DROP POLICY IF EXISTS "usuarios_select_same_unit" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_motorista" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_motorista" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_own" ON usuarios;
DROP POLICY IF EXISTS "unidades_select_own" ON unidades;
DROP POLICY IF EXISTS "rotas_select_gestor" ON rotas;
DROP POLICY IF EXISTS "rotas_select_motorista" ON rotas;
DROP POLICY IF EXISTS "rotas_insert_gestor" ON rotas;
DROP POLICY IF EXISTS "rotas_update_gestor" ON rotas;
DROP POLICY IF EXISTS "rotas_update_motorista" ON rotas;
DROP POLICY IF EXISTS "rotas_delete_gestor" ON rotas;

-- Dropar funções helper
DROP FUNCTION IF EXISTS public.get_user_papel();
DROP FUNCTION IF EXISTS public.get_user_unidade_id();

-- =====================================================
-- NOTA IMPORTANTE
-- =====================================================
--
-- ⚠️  RLS FOI DESABILITADO TEMPORARIAMENTE
--
-- Próximos passos:
-- 1. Criar dados de teste (unidade + usuário)
-- 2. Testar app sem RLS
-- 3. Re-habilitar RLS com abordagem correta depois
--
-- Para re-habilitar RLS no futuro:
-- ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
--
-- =====================================================
