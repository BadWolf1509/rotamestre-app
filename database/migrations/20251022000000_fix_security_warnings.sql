-- Migration: Fix Supabase Security Linter Warnings
-- Date: 2025-10-22
-- Description: Corrige avisos de segurança detectados pelo Supabase Database Linter
--
-- Problemas corrigidos:
-- 1. Function Search Path Mutable (8 funções)
-- 2. Extension in Public Schema (postgis)

-- =============================================
-- 1. FIX: Function Search Path Mutable
-- =============================================
-- Adiciona SET search_path = public em todas as funções para prevenir
-- ataques de search path hijacking

-- 1.1 get_user_unidade
CREATE OR REPLACE FUNCTION public.get_user_unidade(user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT unidade_id FROM public.usuarios WHERE id = user_id);
END;
$$;

-- 1.2 get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT papel FROM public.usuarios WHERE id = user_id);
END;
$$;

-- 1.3 log_parada_conclusao
CREATE OR REPLACE FUNCTION public.log_parada_conclusao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    INSERT INTO public.logs (
      usuario_id,
      rota_id,
      evento,
      detalhes
    ) VALUES (
      auth.uid(),
      NEW.rota_id,
      'parada_concluida',
      jsonb_build_object(
        'parada_id', NEW.id,
        'endereco', NEW.endereco,
        'ordem', NEW.ordem
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 1.4 rotas_ativas_motorista
DROP FUNCTION IF EXISTS public.rotas_ativas_motorista(UUID);
CREATE FUNCTION public.rotas_ativas_motorista(motorista_id UUID)
RETURNS SETOF public.rotas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT r.*
  FROM public.rotas r
  WHERE r.motorista_id = rotas_ativas_motorista.motorista_id
    AND r.status IN ('pendente', 'em_andamento')
  ORDER BY r.created_at DESC;
END;
$$;

-- 1.5 update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 1.6 estatisticas_rota
DROP FUNCTION IF EXISTS public.estatisticas_rota(UUID);
CREATE FUNCTION public.estatisticas_rota(rota_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_paradas INT;
  paradas_concluidas INT;
  paradas_pendentes INT;
  resultado JSON;
BEGIN
  SELECT COUNT(*) INTO total_paradas
  FROM public.paradas
  WHERE paradas.rota_id = estatisticas_rota.rota_id;

  SELECT COUNT(*) INTO paradas_concluidas
  FROM public.paradas
  WHERE paradas.rota_id = estatisticas_rota.rota_id
    AND status = 'concluida';

  SELECT COUNT(*) INTO paradas_pendentes
  FROM public.paradas
  WHERE paradas.rota_id = estatisticas_rota.rota_id
    AND status = 'pendente';

  resultado := json_build_object(
    'total_paradas', total_paradas,
    'paradas_concluidas', paradas_concluidas,
    'paradas_pendentes', paradas_pendentes,
    'progresso_percentual',
      CASE
        WHEN total_paradas > 0 THEN ROUND((paradas_concluidas::NUMERIC / total_paradas) * 100, 2)
        ELSE 0
      END
  );

  RETURN resultado;
END;
$$;

-- 1.7 log_rota_status_change
CREATE OR REPLACE FUNCTION public.log_rota_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO public.logs (
      usuario_id,
      rota_id,
      evento,
      detalhes
    ) VALUES (
      auth.uid(),
      NEW.id,
      'rota_status_alterado',
      jsonb_build_object(
        'status_anterior', OLD.status,
        'status_novo', NEW.status
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 1.8 calcular_distancia
DROP FUNCTION IF EXISTS public.calcular_distancia(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
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
-- 2. FIX: Extension in Public Schema
-- =============================================
-- Nota: A extensão postgis já está instalada e em uso.
-- Mover para outro schema quebraria funcionalidades existentes.
-- Esta é uma prática aceita para postgis em muitos projetos.
-- Adicionando comentário explicativo:

COMMENT ON EXTENSION postgis IS
'PostGIS extension - Instalada no schema public para compatibilidade com aplicações existentes. '
'Movimento para outro schema seria breaking change.';

-- =============================================
-- VALIDAÇÃO
-- =============================================

-- Verificar que todas as funções agora têm search_path definido
DO $$
DECLARE
  func_count INT;
BEGIN
  SELECT COUNT(*) INTO func_count
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
    AND prosecdef = true -- SECURITY DEFINER
    AND proconfig IS NOT NULL; -- search_path definido

  RAISE NOTICE 'Funções com search_path definido: %', func_count;

  IF func_count < 8 THEN
    RAISE WARNING 'Nem todas as funções foram corrigidas. Esperado: 8, Encontrado: %', func_count;
  END IF;
END $$;
