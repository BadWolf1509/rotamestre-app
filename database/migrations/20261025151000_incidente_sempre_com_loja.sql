-- ============================================================================
-- Migration 62: todo incidente tem loja
-- Date: 2026-10-25
-- Author: Wellinton Ribeiro
-- Purpose:
--   Desde a Migration 43 a loja do incidente (`incidentes.unidade_id`) é
--   gravada pelo gatilho `incidentes_define_unidade`: no INSERT, pela rota ou,
--   sem rota, pelo vínculo ativo do motorista (`unidade_do_incidente`); no
--   UPDATE, a loja só muda junto com a rota. É pela loja que o gestor enxerga,
--   resolve e apaga o incidente (`incidentes_select`, `incidentes_update`,
--   `incidentes_delete_optimized`). A coluna, porém, ainda aceitava NULL:
--   quando o cálculo não acha loja (motorista sem vínculo ativo e sem rota),
--   o incidente era gravado sem loja e nenhum gestor o via. Esta migration
--   torna a coluna NOT NULL; esse INSERT passa a ser recusado (23502) em vez
--   de gravar um registro que ninguém da gestão enxerga.
--
--   Alternativas consideradas:
--     (a) `ALTER COLUMN unidade_id SET NOT NULL` (escolhida): a regra fica no
--         catálogo, onde o planner e quem lê o esquema a enxergam; a tabela é
--         pequena (26 linhas em 25/10/2026), então a varredura sob ACCESS
--         EXCLUSIVE dura milissegundos;
--     (b) `CHECK (unidade_id IS NOT NULL) NOT VALID` seguido de `VALIDATE`:
--         serve para tabela grande, em que a validação precisa de lock mais
--         fraco; aqui só acrescenta um objeto com o mesmo efeito;
--     (c) RAISE dentro do `incidentes_define_unidade` quando a loja sai nula:
--         daria mensagem própria, mas reescreve uma função que roda em todo
--         INSERT e UPDATE de incidentes (a criação pelo app passa por ela), e
--         a coluna continuaria anulável para quem escreve sem gatilho.
--
--   Efeito no que já existe:
--     - Dados: nenhum incidente sem loja (medido em 25/10/2026: 26 de 26 com
--       loja). A migration confere de novo antes de alterar e para, sem mudar
--       nada, se encontrar algum — não há backfill aqui.
--     - App: a criação (`createIncidente`) depende do gatilho; motorista com
--       vínculo ativo, ou incidente com rota, continua gravando com loja. Só o
--       motorista sem vínculo ativo nenhum, abrindo incidente sem rota, passa
--       a receber erro — hoje 0 motoristas ativos sem vínculo ativo.
--     - `incidentes_define_unidade`: o ramo `OLD.unidade_id IS NULL` deixa de
--       ser alcançável; a função não é reescrita.
--     - FK `incidentes_unidade_id_fkey` é ON DELETE CASCADE: apagar a loja
--       apaga os incidentes dela, nunca grava NULL.
-- ============================================================================

BEGIN;

-- O ALTER pede ACCESS EXCLUSIVE: se houver transação longa em incidentes, a
-- migration falha limpa em vez de enfileirar a criação de incidentes atrás
-- dela. Basta repetir.
SET LOCAL lock_timeout = '3s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.incidentes WHERE unidade_id IS NULL) THEN
    RAISE EXCEPTION 'Há incidente sem loja; a coluna não foi alterada.'
      USING ERRCODE = '23502';
  END IF;
END
$$;

ALTER TABLE public.incidentes ALTER COLUMN unidade_id SET NOT NULL;

COMMENT ON COLUMN public.incidentes.unidade_id IS
  'Loja do incidente, gravada pelo gatilho incidentes_define_unidade (rota ou vínculo ativo do motorista). NOT NULL desde a Migration 62.';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT attnotnull FROM pg_attribute
--  WHERE attrelid = 'public.incidentes'::regclass AND attname = 'unidade_id';
--   → true
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- ALTER TABLE public.incidentes ALTER COLUMN unidade_id DROP NOT NULL;
-- COMMIT;
