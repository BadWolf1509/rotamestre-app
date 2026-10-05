-- ============================================================================
-- Migration: deduplicação de `logs` passa a considerar a parada
-- Date: 2026-10-04
-- Author: Wellinton Ribeiro
-- Purpose: `prevent_duplicate_log` (BEFORE INSERT em `logs`) descartava
--   qualquer log com mesmo rota_id + evento + usuario_id nos últimos 5 s. Dois
--   eventos de paradas DIFERENTES nessa janela viravam um só: em 60 dias,
--   34 de 1.168 paradas concluídas (3%) ficaram sem `parada_concluida` na
--   auditoria — 22 delas com outra conclusão da mesma rota nos 5 s anteriores,
--   27 sendo partida/chegada, que fecham junto com outra parada. A
--   deduplicação passa a exigir também a mesma parada
--   (`detalhes->>'parada_id'`). Logs sem parada (eventos de rota, gestão)
--   comparam NULL com NULL e seguem deduplicados como antes.
--   Pendência 13 do PROJECT_CONTEXT.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Similar = mesma rota + mesmo evento + mesmo usuário + MESMA PARADA, nos
  -- últimos 5 s. Sem a parada, a segunda de duas paradas concluídas juntas
  -- (partida + primeira entrega, última entrega + chegada) sumia do histórico.
  IF EXISTS (
    SELECT 1
    FROM logs
    WHERE rota_id IS NOT DISTINCT FROM NEW.rota_id
      AND evento = NEW.evento
      AND usuario_id IS NOT DISTINCT FROM NEW.usuario_id
      AND (detalhes ->> 'parada_id') IS NOT DISTINCT FROM (NEW.detalhes ->> 'parada_id')
      AND timestamp > NOW() - INTERVAL '5 seconds'
  ) THEN
    RAISE NOTICE 'Log duplicado bloqueado: evento=%, rota_id=%, usuario_id=%, parada_id=%',
      NEW.evento, NEW.rota_id, NEW.usuario_id, NEW.detalhes ->> 'parada_id';
    RETURN NULL; -- NULL cancela a inserção
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.prevent_duplicate_log() IS
  'Descarta log igual (rota, evento, usuário e parada em detalhes->>parada_id) gravado nos últimos 5 s. Migration 29.';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- CREATE OR REPLACE FUNCTION public.prevent_duplicate_log()
-- RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
-- AS $function$
-- DECLARE
--   v_existing_count INTEGER;
-- BEGIN
--   SELECT COUNT(*) INTO v_existing_count
--   FROM logs
--   WHERE rota_id IS NOT DISTINCT FROM NEW.rota_id
--     AND evento = NEW.evento
--     AND usuario_id IS NOT DISTINCT FROM NEW.usuario_id
--     AND timestamp > NOW() - INTERVAL '5 seconds';
--   IF v_existing_count > 0 THEN
--     RAISE NOTICE 'Log duplicado bloqueado: evento=%, rota_id=%, usuario_id=%',
--       NEW.evento, NEW.rota_id, NEW.usuario_id;
--     RETURN NULL;
--   END IF;
--   RETURN NEW;
-- END;
-- $function$;
-- COMMIT;
