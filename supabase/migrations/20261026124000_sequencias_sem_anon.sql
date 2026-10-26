-- ============================================================================
-- Migration 74: sequências de public sem privilégio para `anon`
-- Date: 2026-10-26
-- Author: Wellinton Ribeiro
-- Purpose:
--   Completa a Migration 69 (que tratou funções e tabelas). Toda sequência
--   criada pelo `postgres` em public nasce com SELECT, UPDATE e USAGE para
--   `anon`, `authenticated` e `service_role` (privilégio-padrão do `postgres`
--   em public). `anon` (requisição sem sessão) não usa sequência alguma: o
--   USAGE e o UPDATE permitiriam consumir ou reposicionar o contador
--   (`nextval`, `setval`), e o SELECT mostra `last_value`, que informa quantas
--   linhas a tabela já recebeu. A partir desta migration, sequência nova do
--   `postgres` em public nasce sem nenhum privilégio para `anon`;
--   `authenticated` e `service_role` seguem com SELECT, UPDATE e USAGE.
--
--   Medido em 26/10/2026 (só SELECT):
--     - pg_default_acl do `postgres` em public, `S` =
--       `{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres}`
--       (r = SELECT, w = UPDATE, U = USAGE). O `supabase_admin` em public e o
--       `postgres` em storage têm o mesmo padrão.
--     - Não há sequência em public (nenhuma coluna `serial` nem identity), e
--       portanto nada a revogar nas existentes: a 1ª instrução não muda nada
--       hoje e fica por idempotência (cobre sequência criada entre a medição e
--       a aplicação).
--
--   Alternativas consideradas:
--     Privilégios:
--       (a) revogar ALL (SELECT, UPDATE, USAGE) — escolhida: `anon` não usa
--           nenhuma sequência, e o SELECT mostra o `last_value`;
--       (b) revogar só USAGE e UPDATE, mantendo SELECT como nas tabelas da
--           Migration 69: deixaria a contagem de linhas legível sem sessão,
--           sem benefício.
--     Alcance:
--       (a) sequências existentes + privilégio-padrão — escolhida: hoje só o
--           padrão tem efeito, e é ele que protege a tabela futura;
--       (b) só o privilégio-padrão: deixaria sequência criada antes da
--           aplicação com o padrão antigo.
--
--   Limites (ficam fora):
--     - o privilégio-padrão do `supabase_admin` em public (o `postgres` não
--       pode alterá-lo) e o do `postgres` em storage (outro schema);
--     - `authenticated` e `service_role` não mudam.
--
--   Efeito no app: nenhum. O app não usa sequência, e as telas pré-login não
--   escrevem (ver Migration 69).
-- ============================================================================

BEGIN;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- 1. nenhuma sequência de public com privilégio de anon → 0
-- SELECT count(*) FROM pg_class c
--  CROSS JOIN (VALUES ('SELECT'), ('UPDATE'), ('USAGE')) p(priv)
--  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'S'
--    AND has_sequence_privilege('anon', c.oid, p.priv);
-- 2. padrão do postgres em public para sequências → sem anon
-- SELECT defaclacl FROM pg_default_acl
--  WHERE defaclrole = 'postgres'::regrole
--    AND defaclnamespace = 'public'::regnamespace AND defaclobjtype = 'S';
-- ============================================================================

-- ROLLBACK:
-- (devolve o padrão medido em 26/10/2026; não havia sequência em public a
-- devolver a anon, então nenhuma concessão em sequência existente)
-- BEGIN;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO anon;
-- COMMIT;
