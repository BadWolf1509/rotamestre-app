-- ============================================================================
-- Migration 36: remove get_gestor_principal (morta e quebrada)
-- Date: 2026-10-22
-- Author: Wellinton Ribeiro
-- Purpose:
--   `get_gestor_principal(uuid)` (Migration de 20251104, profile management)
--   estava executável por PUBLIC e `anon`, apontada pelo `rls-policy-reviewer`
--   na revisão da Migration 35. Medido em produção (22/10/2026):
--   - não é SECURITY DEFINER: roda com o privilégio de quem chama;
--   - está QUEBRADA: tem `search_path ''` e lê `usuarios` sem o prefixo
--     `public.`, então toda chamada falha com `relation "usuarios" does not
--     exist` — inclusive como `postgres`. Hoje não expõe nada; só erra;
--   - ninguém a usa: nenhum chamador no repositório (app, Edge Functions, e2e),
--     em outra função, policy ou view, e nenhuma chamada pela API nos logs das
--     últimas 24 h. Se o painel admin a chamasse, já estaria recebendo erro.
--
--   Consertá-la publicaria uma consulta de "quem é o gestor principal da loja
--   X" que ninguém pede. O conceito segue em `get_gestor_contato` (contato do
--   gestor para o motorista) e `transferir_gestao_principal`, que não dependem
--   dela.
--
-- APLICAR PELO SQL EDITOR (DROP FUNCTION; o MCP recusa). Depois, registrar a
-- versão `20261022220000` em `supabase_migrations.schema_migrations`.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_gestor_principal(uuid);

COMMIT;

-- ROLLBACK (versão consertada, só para service_role):
-- BEGIN;
-- CREATE OR REPLACE FUNCTION public.get_gestor_principal(unidade_uuid uuid)
--  RETURNS uuid LANGUAGE plpgsql STABLE SET search_path TO ''
-- AS $function$
-- DECLARE
--   gestor_id UUID;
-- BEGIN
--   SELECT id INTO gestor_id
--   FROM public.usuarios
--   WHERE unidade_id = unidade_uuid
--     AND is_gestor_principal = true
--     AND ativo = true
--     AND papel = 'gestor'
--   LIMIT 1;
--   RETURN gestor_id;
-- END;
-- $function$;
-- REVOKE EXECUTE ON FUNCTION public.get_gestor_principal(uuid) FROM PUBLIC, anon, authenticated;
-- COMMIT;
