-- =============================================
-- Remover Funções Duplicadas (versões sem search_path)
-- =============================================
-- Este script identifica e remove as versões duplicadas das funções

-- =============================================
-- PASSO 1: Identificar todas as versões
-- =============================================

-- Ver TODAS as versões de cada função
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  CASE WHEN p.prosecdef THEN 'YES' ELSE 'NO' END AS security_definer,
  CASE
    WHEN p.proconfig IS NOT NULL THEN '✅ ' || array_to_string(p.proconfig, ', ')
    ELSE '❌ SEM search_path'
  END AS search_path_status,
  p.oid AS function_oid
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('get_user_unidade', 'get_user_role', 'calcular_distancia')
ORDER BY p.proname, search_path_status;

-- =============================================
-- PASSO 2: Dropar TODAS as versões
-- =============================================
-- Vamos dropar todas as versões e recriar apenas a correta

-- get_user_unidade - Dropar todas as versões possíveis
DROP FUNCTION IF EXISTS public.get_user_unidade(UUID);
DROP FUNCTION IF EXISTS public.get_user_unidade(TEXT);
DROP FUNCTION IF EXISTS public.get_user_unidade();
-- Tentar em outros schemas possíveis
DROP FUNCTION IF EXISTS auth.get_user_unidade(UUID);
DROP FUNCTION IF EXISTS extensions.get_user_unidade(UUID);

-- get_user_role - Dropar todas as versões possíveis
DROP FUNCTION IF EXISTS public.get_user_role(UUID);
DROP FUNCTION IF EXISTS public.get_user_role(TEXT);
DROP FUNCTION IF EXISTS public.get_user_role();
-- Tentar em outros schemas possíveis
DROP FUNCTION IF EXISTS auth.get_user_role(UUID);
DROP FUNCTION IF EXISTS extensions.get_user_role(UUID);

-- calcular_distancia - Dropar todas as versões possíveis
DROP FUNCTION IF EXISTS public.calcular_distancia(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.calcular_distancia(NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.calcular_distancia(REAL, REAL, REAL, REAL);
-- Tentar em outros schemas possíveis
DROP FUNCTION IF EXISTS auth.calcular_distancia(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS extensions.calcular_distancia(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

-- =============================================
-- PASSO 3: Recriar apenas as versões corretas
-- =============================================

-- FUNÇÃO 1: get_user_unidade
CREATE FUNCTION public.get_user_unidade(user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT unidade_id FROM public.usuarios WHERE id = user_id);
END;
$$;

-- FUNÇÃO 2: get_user_role
CREATE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT papel FROM public.usuarios WHERE id = user_id);
END;
$$;

-- FUNÇÃO 3: calcular_distancia
CREATE FUNCTION public.calcular_distancia(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  r CONSTANT DOUBLE PRECISION := 6371; -- Raio da Terra em km
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  dlat := RADIANS(lat2 - lat1);
  dlon := RADIANS(lon2 - lon1);

  a := SIN(dlat/2) * SIN(dlat/2) +
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
       SIN(dlon/2) * SIN(dlon/2);

  c := 2 * ATAN2(SQRT(a), SQRT(1-a));

  RETURN r * c; -- Retorna distância em km
END;
$$;

-- =============================================
-- PASSO 4: Validação Final
-- =============================================

-- Verificar que agora existe APENAS UMA versão de cada função
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  CASE
    WHEN p.proconfig IS NOT NULL THEN '✅ ' || array_to_string(p.proconfig, ', ')
    ELSE '❌ SEM search_path'
  END AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('get_user_unidade', 'get_user_role', 'calcular_distancia')
ORDER BY p.proname;

-- =============================================
-- Resultado Esperado:
-- =============================================
-- Você deve ver EXATAMENTE 3 linhas (uma para cada função):
--
-- schema | function_name       | arguments | status
-- -------+---------------------+-----------+-------------------------
-- public | calcular_distancia  | lat1 ...  | ✅ search_path=public
-- public | get_user_role       | user_id   | ✅ search_path=public
-- public | get_user_unidade    | user_id   | ✅ search_path=public
--
-- Se ver mais de 3 linhas, ainda há duplicatas.
-- Se todas mostrarem ✅, execute o Database Linter novamente.

-- =============================================
-- PRÓXIMO PASSO
-- =============================================
-- Após executar este script com sucesso:
-- 1. Dashboard → Database → Database Linter
-- 2. Clique em "Run Linter"
-- 3. Os 3 avisos devem desaparecer ✅
