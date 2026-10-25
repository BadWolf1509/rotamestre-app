-- ============================================================================
-- Migration 64: API sem privilégios de manutenção nas tabelas
-- Date: 2026-10-25
-- Author: Wellinton Ribeiro
-- Purpose:
--   Os papéis da API do Supabase, `anon` e `authenticated`, recebem por padrão
--   ALL nas tabelas de public (privilégios-padrão do `postgres`:
--   `arwdDxtm`). Além de SELECT/INSERT/UPDATE/DELETE, que o PostgREST usa e
--   o RLS filtra, isso inclui TRUNCATE (D), TRIGGER (t), REFERENCES (x) e,
--   desde o Postgres 17, MAINTAIN (m: VACUUM, ANALYZE, REINDEX, CLUSTER,
--   REFRESH MATERIALIZED VIEW, LOCK TABLE). Nenhum dos quatro é usado pelo
--   app nem pela API, e TRUNCATE não passa pelo RLS. Esta migration tira os
--   quatro de `anon` e `authenticated` em todas as tabelas e visões de public
--   e nos privilégios-padrão do `postgres`, para que tabela nova já nasça sem
--   eles. `service_role` e `postgres` não mudam.
--
--   Medido em 25/10/2026 (has_table_privilege): unidades, incidentes, logs,
--   paradas, rotas, usuarios, motorista_locations, notificacoes,
--   push_notification_logs, plan_prices e admin_logs com os quatro para anon e
--   authenticated; rascunhos_rota com os quatro para authenticated;
--   usuario_unidades e as visões vw_* com TRIGGER, REFERENCES e MAINTAIN.
--   Nenhuma função de public executa TRUNCATE nem CREATE TRIGGER. Todas essas
--   concessões têm o `postgres` como grantor (aclexplode), então o REVOKE
--   rodado como `postgres` as alcança; nenhuma vem de PUBLIC.
--
--   Alternativas consideradas:
--     (a) REVOKE dos quatro em ALL TABLES IN SCHEMA public + ALTER DEFAULT
--         PRIVILEGES do postgres (escolhida): fecha a classe inteira de uma
--         vez, inclusive para as tabelas que vierem;
--     (b) REVOKE TRUNCATE, TRIGGER só em `unidades`: resolve a tabela em que
--         isso foi notado e deixa as outras onze iguais, além de toda tabela
--         nova;
--     (c) REVOKE ALL e GRANT SELECT/INSERT/UPDATE/DELETE tabela a tabela:
--         reescreveria os privilégios de coluna já ajustados (rotas, usuarios,
--         notificacoes, push_tokens, preferencias_notificacao) e quebraria o
--         app em qualquer tabela esquecida.
--
--   Limites:
--     - Os privilégios-padrão do `supabase_admin` (tabelas criadas pela
--       plataforma) não são alterados aqui: o `postgres` não pode mudá-los.
--       Hoje todas as tabelas de public são do `postgres`.
--     - Privilégio de coluna: hoje não há ACL de coluna com nenhum dos quatro
--       (as de rotas e usuarios são só UPDATE), e o REVOKE na tabela já
--       remove o REFERENCES de coluna correspondente.
--
--   Efeito no que já existe: nenhum fluxo do app, das Edge Functions (chave
--   secreta = service_role) nem do painel usa esses privilégios com `anon` ou
--   `authenticated`.
-- ============================================================================

BEGIN;

REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLES FROM anon, authenticated;

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- 1. nenhuma tabela/visão de public com os quatro para a API → 0
-- SELECT count(*) FROM pg_class c
--  CROSS JOIN (VALUES ('anon'), ('authenticated')) g(papel)
--  CROSS JOIN (VALUES ('TRUNCATE'), ('TRIGGER'), ('REFERENCES'), ('MAINTAIN')) p(priv)
--  WHERE c.relnamespace = 'public'::regnamespace
--    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
--    AND has_table_privilege(g.papel, c.oid, p.priv);
-- 2. privilégios-padrão do postgres em public → anon/authenticated com arwd
-- SELECT defaclacl FROM pg_default_acl
--  WHERE defaclrole = 'postgres'::regrole
--    AND defaclnamespace = 'public'::regnamespace AND defaclobjtype = 'r';
-- ============================================================================

-- ROLLBACK:
-- (devolve exatamente o que foi medido em 25/10/2026, tabela a tabela; tabela
-- criada depois disso continua sem os quatro)
-- BEGIN;
-- GRANT TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON public.admin_logs, public.incidentes, public.logs, public.motorista_locations, public.notificacoes, public.paradas, public.plan_prices, public.push_notification_logs, public.rotas, public.unidades, public.usuarios TO anon, authenticated;
-- GRANT TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON public.rascunhos_rota TO authenticated;
-- GRANT TRIGGER, REFERENCES, MAINTAIN ON public.usuario_unidades TO anon, authenticated;
-- GRANT TRIGGER, REFERENCES, MAINTAIN ON public.vw_paradas_com_vinculo, public.vw_performance_motoristas, public.vw_rotas_resumo TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLES TO anon, authenticated;
-- COMMIT;
