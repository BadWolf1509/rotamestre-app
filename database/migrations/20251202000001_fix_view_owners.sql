-- =============================================
-- Migration: Fix View Owners (Security Definer Fix)
-- =============================================
-- Data: 2025-12-02
-- Descrição: Altera owner das views para authenticated
--            Views com owner superuser (postgres) são detectadas como SECURITY DEFINER
--
-- IMPORTANTE: Execute este SQL diretamente no Supabase SQL Editor
--             (Dashboard > SQL Editor > New Query)
--             A conexão pooler não tem permissão para ALTER OWNER

-- =============================================
-- ALTERAR OWNER DAS VIEWS
-- =============================================

-- 1. vw_rotas_resumo
ALTER VIEW public.vw_rotas_resumo OWNER TO authenticated;
COMMENT ON VIEW public.vw_rotas_resumo IS 'View de resumo de rotas. Owner: authenticated (não superuser).';

-- 2. vw_performance_motoristas
ALTER VIEW public.vw_performance_motoristas OWNER TO authenticated;
COMMENT ON VIEW public.vw_performance_motoristas IS 'View de performance de motoristas. Owner: authenticated (não superuser).';

-- 3. vw_paradas_com_vinculo
ALTER VIEW public.vw_paradas_com_vinculo OWNER TO authenticated;
COMMENT ON VIEW public.vw_paradas_com_vinculo IS 'View de paradas com vínculo. Owner: authenticated (não superuser).';

-- 4. admin_dashboard_metrics
ALTER VIEW public.admin_dashboard_metrics OWNER TO authenticated;
COMMENT ON VIEW public.admin_dashboard_metrics IS 'Métricas do dashboard admin. Owner: authenticated (não superuser).';

-- =============================================
-- CONCEDER PERMISSÕES
-- =============================================

-- Garantir que as roles necessárias possam acessar as views
GRANT SELECT ON public.vw_rotas_resumo TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_performance_motoristas TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_paradas_com_vinculo TO authenticated, anon, service_role;
GRANT SELECT ON public.admin_dashboard_metrics TO authenticated, anon, service_role;

-- =============================================
-- VALIDAÇÃO
-- =============================================

SELECT
  c.relname as view_name,
  pg_get_userbyid(c.relowner) as owner,
  CASE
    WHEN pg_get_userbyid(c.relowner) = 'postgres' THEN '❌ superuser'
    WHEN pg_get_userbyid(c.relowner) = 'authenticated' THEN '✅ ok'
    ELSE '⚠️ outro: ' || pg_get_userbyid(c.relowner)
  END as status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND c.relname IN ('vw_rotas_resumo', 'vw_performance_motoristas', 'vw_paradas_com_vinculo', 'admin_dashboard_metrics')
ORDER BY c.relname;

-- =============================================
-- NOTAS
-- =============================================
--
-- Por que alterar o owner?
-- - Views com owner superuser (postgres) são detectadas como SECURITY DEFINER
-- - O Database Linter alerta sobre isso como problema de segurança
-- - Alterar para 'authenticated' resolve o problema
--
-- Após executar:
-- 1. Aguarde alguns segundos
-- 2. Vá em Database > Linter
-- 3. Clique em "Run checks" ou recarregue a página
-- 4. Os erros de SECURITY DEFINER devem desaparecer
