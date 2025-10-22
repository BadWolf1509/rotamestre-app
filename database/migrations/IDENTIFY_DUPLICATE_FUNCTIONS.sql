-- =============================================
-- Identificar Funções Duplicadas em Detalhes
-- =============================================
-- Este script mostra TODAS as informações sobre as versões duplicadas

-- =============================================
-- 1. Listar TODAS as versões com detalhes completos
-- =============================================

SELECT
  n.nspname AS "Schema",
  p.proname AS "Função",
  pg_get_function_identity_arguments(p.oid) AS "Argumentos",
  pg_get_function_result(p.oid) AS "Retorno",
  CASE WHEN p.prosecdef THEN 'SIM' ELSE 'NÃO' END AS "SECURITY DEFINER",
  CASE WHEN p.proisstrict THEN 'SIM' ELSE 'NÃO' END AS "STRICT",
  p.provolatile AS "Volatilidade",
  CASE
    WHEN p.proconfig IS NOT NULL THEN array_to_string(p.proconfig, ', ')
    ELSE 'NÃO DEFINIDO'
  END AS "search_path",
  CASE
    WHEN p.proconfig IS NOT NULL THEN '✅'
    ELSE '❌'
  END AS "Status",
  p.oid AS "OID"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('get_user_unidade', 'get_user_role', 'calcular_distancia')
ORDER BY p.proname, p.oid;

-- =============================================
-- 2. Contar versões de cada função
-- =============================================

SELECT
  p.proname AS "Função",
  COUNT(*) AS "Número de Versões",
  CASE
    WHEN COUNT(*) = 1 THEN '✅ OK - Única versão'
    WHEN COUNT(*) = 2 THEN '⚠️  DUPLICADA - 2 versões'
    ELSE '🚨 PROBLEMA - ' || COUNT(*) || ' versões!'
  END AS "Status"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('get_user_unidade', 'get_user_role', 'calcular_distancia')
  AND n.nspname = 'public'
GROUP BY p.proname
ORDER BY p.proname;

-- =============================================
-- 3. Ver definição completa de cada versão
-- =============================================

-- get_user_unidade - Todas as versões
SELECT
  'get_user_unidade' AS function_name,
  p.oid,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_user_unidade'
  AND n.nspname = 'public';

-- get_user_role - Todas as versões
SELECT
  'get_user_role' AS function_name,
  p.oid,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_user_role'
  AND n.nspname = 'public';

-- calcular_distancia - Todas as versões
SELECT
  'calcular_distancia' AS function_name,
  p.oid,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'calcular_distancia'
  AND n.nspname = 'public';

-- =============================================
-- 4. Identificar políticas RLS que usam essas funções
-- =============================================

SELECT
  schemaname AS "Schema",
  tablename AS "Tabela",
  policyname AS "Política RLS",
  cmd AS "Comando",
  qual AS "Condição (USING)",
  with_check AS "Verificação (WITH CHECK)"
FROM pg_policies
WHERE
  qual::text LIKE '%get_user_unidade%'
  OR qual::text LIKE '%get_user_role%'
  OR with_check::text LIKE '%get_user_unidade%'
  OR with_check::text LIKE '%get_user_role%'
ORDER BY tablename, policyname;

-- =============================================
-- 5. Buscar referências às funções no código
-- =============================================

-- Buscar em triggers
SELECT
  n.nspname AS "Schema",
  t.tgname AS "Trigger",
  c.relname AS "Tabela",
  pg_get_triggerdef(t.oid) AS "Definição"
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE pg_get_triggerdef(t.oid) LIKE '%get_user%'
   OR pg_get_triggerdef(t.oid) LIKE '%calcular_distancia%'
ORDER BY c.relname, t.tgname;

-- =============================================
-- Resultado Esperado
-- =============================================
-- Query 1: Deve mostrar 6 linhas (2 versões × 3 funções)
--          - 3 com Status ✅ (com search_path)
--          - 3 com Status ❌ (sem search_path)
--
-- Query 2: Deve mostrar 3 linhas
--          - Todas com "⚠️  DUPLICADA - 2 versões"
--
-- Query 3-5: Mostra as definições completas
--
-- Query 6: Mostra políticas RLS que usam as funções
--
-- Query 7: Mostra triggers que usam as funções
