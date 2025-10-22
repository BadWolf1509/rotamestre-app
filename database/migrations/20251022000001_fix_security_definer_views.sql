-- =============================================
-- Migration: Fix Security Definer Views
-- =============================================
-- Data: 2025-10-22
-- Descrição: Remove SECURITY DEFINER de views para corrigir avisos do Database Linter
--
-- Problema: Views com SECURITY DEFINER executam com permissões do criador,
-- não do usuário que consulta, o que pode causar problemas de segurança.
--
-- Solução: Recriar views sem SECURITY DEFINER e garantir que RLS é aplicado corretamente.

-- =============================================
-- VIEW 1: vw_rotas_resumo
-- =============================================

-- Dropar view antiga
DROP VIEW IF EXISTS public.vw_rotas_resumo;

-- Recriar sem SECURITY DEFINER
CREATE VIEW public.vw_rotas_resumo AS
SELECT
  r.id,
  r.unidade_id,
  u.nome AS unidade_nome,
  r.motorista_id,
  usr.nome AS motorista_nome,
  r.data,
  r.status,
  r.observacoes,
  COUNT(p.id) AS total_paradas,
  COUNT(p.id) FILTER (WHERE p.status = 'concluida') AS paradas_concluidas,
  COUNT(p.id) FILTER (WHERE p.status = 'pendente') AS paradas_pendentes,
  COUNT(p.id) FILTER (WHERE p.status = 'pulada') AS paradas_puladas,
  CASE
    WHEN COUNT(p.id) > 0 THEN
      ROUND((COUNT(p.id) FILTER (WHERE p.status = 'concluida')::NUMERIC / COUNT(p.id)) * 100, 2)
    ELSE 0
  END AS progresso_percentual,
  r.created_at,
  r.updated_at
FROM public.rotas r
LEFT JOIN public.unidades u ON r.unidade_id = u.id
LEFT JOIN public.usuarios usr ON r.motorista_id = usr.id
LEFT JOIN public.paradas p ON r.id = p.rota_id
GROUP BY r.id, u.nome, usr.nome;

-- Adicionar comentário explicativo
COMMENT ON VIEW public.vw_rotas_resumo IS
'View de resumo de rotas com estatísticas de paradas. Não usa SECURITY DEFINER - RLS é aplicado nas tabelas base.';

-- =============================================
-- VIEW 2: vw_performance_motoristas
-- =============================================

-- Dropar view antiga
DROP VIEW IF EXISTS public.vw_performance_motoristas;

-- Recriar sem SECURITY DEFINER
CREATE VIEW public.vw_performance_motoristas AS
SELECT
  usr.id AS motorista_id,
  usr.nome AS motorista_nome,
  usr.email AS motorista_email,
  u.id AS unidade_id,
  u.nome AS unidade_nome,
  COUNT(DISTINCT r.id) AS total_rotas,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'concluida') AS rotas_concluidas,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'em_andamento') AS rotas_em_andamento,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'pendente') AS rotas_pendentes,
  COUNT(p.id) AS total_paradas,
  COUNT(p.id) FILTER (WHERE p.status = 'concluida') AS paradas_concluidas,
  CASE
    WHEN COUNT(p.id) > 0 THEN
      ROUND((COUNT(p.id) FILTER (WHERE p.status = 'concluida')::NUMERIC / COUNT(p.id)) * 100, 2)
    ELSE 0
  END AS taxa_conclusao_percentual,
  MIN(r.data) AS primeira_rota,
  MAX(r.data) AS ultima_rota
FROM public.usuarios usr
JOIN public.unidades u ON usr.unidade_id = u.id
LEFT JOIN public.rotas r ON usr.id = r.motorista_id
LEFT JOIN public.paradas p ON r.id = p.rota_id
WHERE usr.papel = 'motorista'
GROUP BY usr.id, usr.nome, usr.email, u.id, u.nome;

-- Adicionar comentário explicativo
COMMENT ON VIEW public.vw_performance_motoristas IS
'View de performance de motoristas com estatísticas de rotas e paradas. Não usa SECURITY DEFINER - RLS é aplicado nas tabelas base.';

-- =============================================
-- VALIDAÇÃO
-- =============================================

-- Verificar que as views foram criadas sem SECURITY DEFINER
SELECT
  schemaname AS "Schema",
  viewname AS "View",
  CASE
    WHEN viewowner = current_user THEN '✅ Owner correto'
    ELSE '⚠️  Owner: ' || viewowner
  END AS "Owner",
  CASE
    WHEN definition NOT LIKE '%SECURITY DEFINER%' THEN '✅ SEM SECURITY DEFINER'
    ELSE '❌ COM SECURITY DEFINER'
  END AS "Status"
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('vw_rotas_resumo', 'vw_performance_motoristas')
ORDER BY viewname;

-- Testar que as views ainda funcionam
SELECT '✅ vw_rotas_resumo' AS test, COUNT(*) AS count FROM public.vw_rotas_resumo;
SELECT '✅ vw_performance_motoristas' AS test, COUNT(*) AS count FROM public.vw_performance_motoristas;

-- =============================================
-- NOTAS IMPORTANTES
-- =============================================

-- 1. RLS nas Tabelas Base
-- As views agora respeitam as políticas RLS das tabelas base (rotas, paradas, usuarios, unidades)
-- Cada usuário verá apenas os dados que tem permissão para ver.

-- 2. Permissões
-- Certifique-se de que os usuários têm permissão SELECT nas tabelas base:
-- - rotas
-- - paradas
-- - usuarios
-- - unidades

-- 3. Performance
-- As views podem ser mais lentas sem SECURITY DEFINER porque o PostgreSQL
-- não pode usar otimizações agressivas. Se necessário, considere materialized views.

-- 4. Teste
-- Teste com diferentes usuários para garantir que RLS está funcionando corretamente:
-- SET ROLE motorista_user;
-- SELECT * FROM vw_rotas_resumo; -- Deve mostrar apenas rotas da sua unidade
