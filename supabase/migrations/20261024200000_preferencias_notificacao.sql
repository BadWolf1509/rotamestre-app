-- ============================================================================
-- Migration 47: preferências de push por conta, que só o dono lê e grava
-- Date: 2026-10-24
-- Author: Wellinton Ribeiro
--
-- RODAR PELO SQL EDITOR (tem REVOKE, que o MCP recusa). Uma transação só:
-- falhou uma parte, nada muda. Depois, a sonda
-- `database/sondas/20261024200000_sonda_migration47.sql`.
--
-- Purpose (AN3, 1.14.6): os interruptores de notificação das Configurações
-- (motorista: "Notificações Push"; gestor: push geral, incidentes, rotas e
-- resumo diário) só gravavam no AsyncStorage do aparelho, e ninguém lia: o
-- push chegava do mesmo jeito. Agora a preferência mora no banco e a Edge
-- Function `send-push-notification` a consulta antes de enviar.
--
-- Tabela `preferencias_notificacao (usuario_id PK, push_ativo, incidentes,
-- rotas, resumo_diario, atualizado_em)`: uma linha por conta, tudo ligado por
-- default. Sem linha também vale tudo ligado (a função e o app tratam a
-- ausência assim), então não há backfill. RLS: SELECT, INSERT e UPDATE só da
-- própria linha; sem DELETE (a linha some com o usuário, pelo CASCADE). A
-- função lê com a chave secreta (ignora a RLS).
--
-- DECISÃO: tabela própria, e não uma coluna `jsonb` em `usuarios`.
--  - A policy `usuarios_select_optimized` mostra a linha a toda a loja, e a
--    `usuarios_update_optimized` deixa o gestor alterar a linha do motorista
--    (conferido no catálogo em 24/10/2026): com a coluna, o gestor leria e
--    desligaria o push do motorista. Fechar isso exigiria mexer na RLS de
--    `usuarios` — e afrouxar ou reescrever essa RLS mexe também na leitura
--    das fotos de perfil (invariante do CLAUDE.md).
--  - Desde a Migration 45, o UPDATE de `authenticated` em `usuarios` é por
--    coluna; a coluna nova exigiria outro GRANT e passaria pelo gatilho
--    `trava_motorista_outra_loja`.
--  - A tabela própria tem RLS de uma linha só (o dono), sem tocar em nada
--    disso. Custo: uma consulta a mais na função, por chave primária.
--  Dentro da tabela, colunas boolean em vez de um `jsonb`: tipo e default
--  garantidos pelo banco, e a função não precisa validar chave por chave.
--
-- Índice da FK: a própria PK (`usuario_id`) serve; não há índice extra.
--
-- ORDEM: pode ir antes ou depois da função e do app. A função publicada antes
-- da tabela envia tudo (consulta que falha = envia); o app sem a tabela grava
-- só no aparelho e tenta de novo depois.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE TABLE public.preferencias_notificacao (
  usuario_id uuid PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  push_ativo boolean NOT NULL DEFAULT true,
  incidentes boolean NOT NULL DEFAULT true,
  rotas boolean NOT NULL DEFAULT true,
  resumo_diario boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.preferencias_notificacao ENABLE ROW LEVEL SECURITY;

-- O Supabase concede tudo à API em tabela nova do schema public.
REVOKE ALL ON public.preferencias_notificacao FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.preferencias_notificacao TO authenticated;

CREATE POLICY preferencias_notificacao_select_dono ON public.preferencias_notificacao
  FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

CREATE POLICY preferencias_notificacao_insert_dono ON public.preferencias_notificacao
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (SELECT auth.uid()));

CREATE POLICY preferencias_notificacao_update_dono ON public.preferencias_notificacao
  FOR UPDATE TO authenticated
  USING (usuario_id = (SELECT auth.uid()))
  WITH CHECK (usuario_id = (SELECT auth.uid()));

COMMENT ON TABLE public.preferencias_notificacao IS
  'Preferências de push por conta (sem linha = tudo ligado). Só o dono lê e grava; a Edge Function send-push-notification consulta antes de enviar, e o SOS ignora a preferência. Migration 47.';

COMMIT;

-- ============================================================================
-- CONFERÊNCIA (só SELECT, depois do COMMIT)
-- ============================================================================
-- 1. RLS ligada:
--    SELECT relrowsecurity FROM pg_class
--     WHERE oid = 'public.preferencias_notificacao'::regclass;   -- true
-- 2. Três policies, todas do dono:
--    SELECT policyname, cmd, qual, with_check FROM pg_policies
--     WHERE schemaname = 'public' AND tablename = 'preferencias_notificacao';
-- 3. Grants da API (authenticated: SELECT, INSERT, UPDATE; anon: nada):
--    SELECT grantee, privilege_type FROM information_schema.role_table_grants
--     WHERE table_schema = 'public' AND table_name = 'preferencias_notificacao'
--     ORDER BY grantee, privilege_type;
-- 4. Ninguém com linha ainda (o app cria ao mexer no interruptor):
--    SELECT count(*) FROM public.preferencias_notificacao;
--
-- ROLLBACK:
-- BEGIN;
-- DROP TABLE IF EXISTS public.preferencias_notificacao;
-- COMMIT;
-- (A função publicada continua funcionando sem a tabela: a consulta falha e
-- ela envia tudo. O app volta a gravar só no aparelho.)
