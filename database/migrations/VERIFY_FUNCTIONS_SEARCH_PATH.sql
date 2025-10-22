-- =============================================
-- Verificar se as funções têm search_path definido
-- =============================================
-- Execute este SQL no Supabase Dashboard para verificar o estado das funções

-- 1. Verificar configuração das funções
SELECT
  p.proname AS "Função",
  CASE WHEN p.prosecdef THEN 'SIM' ELSE 'NÃO' END AS "SECURITY DEFINER",
  CASE
    WHEN p.proconfig IS NOT NULL THEN array_to_string(p.proconfig, ', ')
    ELSE '❌ NÃO DEFINIDO'
  END AS "search_path",
  CASE
    WHEN p.proconfig IS NOT NULL THEN '✅'
    ELSE '❌'
  END AS "Status"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_user_unidade',
    'get_user_role',
    'log_parada_conclusao',
    'rotas_ativas_motorista',
    'update_updated_at_column',
    'estatisticas_rota',
    'log_rota_status_change',
    'calcular_distancia'
  )
ORDER BY p.proname;

-- =============================================
-- 2. Ver definição completa das funções problemáticas
-- =============================================

\echo '\n--- Definição de get_user_unidade ---'
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'get_user_unidade'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

\echo '\n--- Definição de get_user_role ---'
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'get_user_role'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

\echo '\n--- Definição de calcular_distancia ---'
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'calcular_distancia'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- =============================================
-- 3. Diagnóstico: Por que os avisos persistem?
-- =============================================

-- Verificar se há múltiplas versões da mesma função
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  CASE
    WHEN p.proconfig IS NOT NULL THEN '✅ TEM'
    ELSE '❌ NÃO TEM'
  END AS search_path_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('get_user_unidade', 'get_user_role', 'calcular_distancia')
ORDER BY n.nspname, p.proname;
