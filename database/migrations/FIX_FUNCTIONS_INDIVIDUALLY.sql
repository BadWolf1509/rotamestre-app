-- =============================================
-- Correção Individual das 3 Funções Problemáticas
-- =============================================
-- Execute cada função separadamente e verifique o resultado

-- =============================================
-- FUNÇÃO 1: get_user_unidade
-- =============================================

-- Dropar se existir
DROP FUNCTION IF EXISTS public.get_user_unidade(UUID);

-- Recriar com search_path
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

-- Verificar
SELECT
  p.proname,
  array_to_string(p.proconfig, ', ') AS search_path_config
FROM pg_proc p
WHERE p.proname = 'get_user_unidade'
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- =============================================
-- FUNÇÃO 2: get_user_role
-- =============================================

-- Dropar se existir
DROP FUNCTION IF EXISTS public.get_user_role(UUID);

-- Recriar com search_path
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

-- Verificar
SELECT
  p.proname,
  array_to_string(p.proconfig, ', ') AS search_path_config
FROM pg_proc p
WHERE p.proname = 'get_user_role'
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- =============================================
-- FUNÇÃO 3: calcular_distancia
-- =============================================

-- Dropar se existir (com todos os argumentos)
DROP FUNCTION IF EXISTS public.calcular_distancia(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

-- Recriar com search_path
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

-- Verificar
SELECT
  p.proname,
  array_to_string(p.proconfig, ', ') AS search_path_config
FROM pg_proc p
WHERE p.proname = 'calcular_distancia'
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- =============================================
-- VALIDAÇÃO FINAL
-- =============================================

-- Verificar todas as 3 funções de uma vez
SELECT
  p.proname AS "Função",
  CASE
    WHEN p.proconfig IS NOT NULL THEN '✅ ' || array_to_string(p.proconfig, ', ')
    ELSE '❌ SEM search_path'
  END AS "Status"
FROM pg_proc p
WHERE p.proname IN ('get_user_unidade', 'get_user_role', 'calcular_distancia')
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY p.proname;

-- Se todas as 3 funções mostrarem ✅, execute o Database Linter novamente:
-- Dashboard → Database → Database Linter → Run Linter
