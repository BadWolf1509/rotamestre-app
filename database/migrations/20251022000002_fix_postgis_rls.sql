-- =============================================
-- Migration: Fix PostGIS spatial_ref_sys RLS Warning
-- =============================================
-- Data: 2025-10-22
-- Descrição: Resolve aviso de RLS desabilitado na tabela spatial_ref_sys do PostGIS
--
-- Problema: spatial_ref_sys é uma tabela de sistema do PostGIS que não deve ter RLS.
-- O Database Linter detecta como erro porque está no schema public sem RLS.
--
-- Soluções possíveis:
-- 1. Mover para schema extensions (RECOMENDADO)
-- 2. Adicionar política RLS permissiva (não recomendado para tabela de sistema)
-- 3. Ignorar o aviso (aceitável para PostGIS)

-- =============================================
-- SOLUÇÃO 1: Mover PostGIS para schema extensions (RECOMENDADO)
-- =============================================

-- Criar schema extensions se não existir
CREATE SCHEMA IF NOT EXISTS extensions;

-- Comentário sobre o schema
COMMENT ON SCHEMA extensions IS 'Schema para extensões do PostgreSQL (PostGIS, etc)';

-- Mover a extensão PostGIS para o schema extensions
-- NOTA: Isso pode quebrar queries existentes que usam geometry/geography sem qualificação
-- DROP EXTENSION IF EXISTS postgis CASCADE;
-- CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;

-- ⚠️  CUIDADO: A linha acima está comentada porque pode quebrar funcionalidades existentes.
-- Antes de executar, verifique se alguma query usa tipos PostGIS sem qualificação de schema.

-- =============================================
-- SOLUÇÃO 2: Adicionar comentário explicativo (ESCOLHIDA)
-- =============================================

-- Como spatial_ref_sys é uma tabela de sistema do PostGIS que armazena
-- definições de sistemas de referência espacial (SRID), ela não deve ter RLS.
-- É seguro e esperado que todos os usuários possam ler esta tabela.

-- Adicionar comentário explicando por que RLS não é necessário
COMMENT ON TABLE public.spatial_ref_sys IS
'Tabela de sistema do PostGIS com definições de SRID (Spatial Reference System Identifier). '
'RLS não é necessário - dados são públicos e somente leitura. '
'Aviso do Database Linter pode ser ignorado.';

-- Grant SELECT para todos (já deve estar assim por padrão)
GRANT SELECT ON TABLE public.spatial_ref_sys TO PUBLIC;

-- =============================================
-- SOLUÇÃO 3: Habilitar RLS com política permissiva (ALTERNATIVA)
-- =============================================

-- Se você REALMENTE quer que o linter pare de reclamar, pode habilitar RLS
-- com uma política que permite tudo (efetivamente não faz nada).

-- Habilitar RLS
-- ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

-- Criar política permissiva (permite SELECT para todos)
-- CREATE POLICY spatial_ref_sys_select_policy ON public.spatial_ref_sys
--   FOR SELECT
--   USING (true);

-- ⚠️  ATENÇÃO: Esta abordagem está comentada porque:
-- 1. Adiciona overhead desnecessário
-- 2. Não melhora a segurança (política permite tudo)
-- 3. É uma tabela de sistema que não deve ter RLS

-- =============================================
-- VALIDAÇÃO
-- =============================================

-- Verificar estado da tabela spatial_ref_sys
SELECT
  schemaname AS "Schema",
  tablename AS "Tabela",
  CASE
    WHEN rowsecurity THEN '✅ RLS Habilitado'
    ELSE '❌ RLS Desabilitado'
  END AS "RLS Status",
  obj_description((schemaname || '.' || tablename)::regclass, 'pg_class') AS "Comentário"
FROM pg_tables
WHERE tablename = 'spatial_ref_sys'
  AND schemaname = 'public';

-- Verificar número de SRIDs cadastrados
SELECT
  '✅ spatial_ref_sys' AS test,
  COUNT(*) AS total_srids,
  'Tabela funcionando normalmente' AS status
FROM public.spatial_ref_sys;

-- Listar alguns SRIDs comuns (EPSG:4326 WGS84, EPSG:3857 Web Mercator)
SELECT
  srid,
  auth_name,
  auth_srid,
  srtext AS definition
FROM public.spatial_ref_sys
WHERE srid IN (4326, 3857)
ORDER BY srid;

-- =============================================
-- RECOMENDAÇÃO FINAL
-- =============================================

-- Para o projeto RotaMestre:
--
-- ✅ OPÇÃO ESCOLHIDA: Manter como está (SOLUÇÃO 2)
--    - spatial_ref_sys é uma tabela de sistema do PostGIS
--    - Não contém dados sensíveis (apenas definições de SRID)
--    - RLS não melhora a segurança
--    - Aviso do linter pode ser ignorado
--    - Comentário explicativo adicionado
--
-- ❌ NÃO RECOMENDADO: Mover para schema extensions (SOLUÇÃO 1)
--    - Pode quebrar código existente
--    - Requer atualização de todas as queries que usam geometry/geography
--    - Benefício mínimo
--
-- ❌ NÃO RECOMENDADO: Habilitar RLS com política permissiva (SOLUÇÃO 3)
--    - Overhead de performance desnecessário
--    - Não melhora a segurança
--    - Complexidade adicional sem benefício

-- Se você quiser que o aviso desapareça do Database Linter,
-- descomente e execute a SOLUÇÃO 3 (RLS com política permissiva).
-- Mas saiba que é apenas "cosmético" - não melhora a segurança real.
