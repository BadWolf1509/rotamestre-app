-- ============================================================================
-- Migration: fix inserir_parada - conflito de UNIQUE(rota_id, ordem) com a chegada
-- Date: 2026-07-13
-- Author: Wellinton Ribeiro
-- Purpose: Inserir parada NO MEIO da rota falhava com "duplicate key value
--          violates unique constraint paradas_rota_id_ordem_key". Causa raiz:
--          o shift (+1000 / -1000+1) das paradas reais empurra a última parada
--          real para cima da ordem da CHEGADA (is_checkpoint=false), que só era
--          movida DEPOIS do shift — e apenas no caso "inserir no final"
--          (v_chegada.ordem <= v_new_ordem). Reproduzido no banco vivo
--          (2026-07-13, transação com rollback).
--          Fix: estacionar a chegada em ordem alta temporária ANTES de qualquer
--          shift/INSERT; o bloco final (já existente) a reposiciona para
--          count+1. Diff mínimo sobre a versão de 20260622183805 (hardening):
--          guard de tenant e SET search_path = '' preservados.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.inserir_parada(
  p_rota_id UUID,
  p_tipo TEXT,
  p_endereco TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_posicao_insercao INTEGER DEFAULT NULL, -- NULL = inserir no final; número = inserir NESTA posição
  p_destinatario TEXT DEFAULT NULL,
  p_telefone TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chegada RECORD;
  v_new_ordem INTEGER;
  v_parada_count INTEGER;
  v_new_parada_id UUID;
BEGIN
  -- Authorization guard (mirrors paradas_insert): gestor ativo da unidade da rota
  IF NOT EXISTS (
    SELECT 1
    FROM public.rotas r
    JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
    WHERE r.id = p_rota_id
      AND uu.usuario_id = auth.uid()
      AND uu.papel = 'gestor'
      AND uu.ativo = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado: gestor da unidade da rota requerido.');
  END IF;

  SELECT COUNT(*) INTO v_parada_count
  FROM public.paradas
  WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false;

  SELECT id, ordem INTO v_chegada
  FROM public.paradas
  WHERE rota_id = p_rota_id AND is_checkpoint = false AND ordem > 0
  LIMIT 1;

  -- FIX (2026-07-13): estacionar a chegada em ordem alta ANTES de qualquer
  -- shift/INSERT. As paradas reais deslocadas ocupam no máximo ~1000+N e a
  -- inserção usa ordens baixas, então +2000 nunca colide. O bloco final desta
  -- função reposiciona a chegada para count+1 incondicionalmente.
  IF v_chegada.id IS NOT NULL THEN
    UPDATE public.paradas
    SET ordem = v_chegada.ordem + 2000
    WHERE id = v_chegada.id;
  END IF;

  IF p_posicao_insercao IS NULL THEN
    v_new_ordem := v_parada_count + 1;
  ELSE
    -- Clamp defensivo: posição mínima é 1 (ordem 0 é a partida, também checkpoint)
    v_new_ordem := GREATEST(p_posicao_insercao, 1);
    UPDATE public.paradas
    SET ordem = ordem + 1000
    WHERE rota_id = p_rota_id
      AND is_checkpoint IS DISTINCT FROM false
      AND ordem >= v_new_ordem;
    UPDATE public.paradas
    SET ordem = ordem - 1000 + 1
    WHERE rota_id = p_rota_id
      AND is_checkpoint IS DISTINCT FROM false
      AND ordem >= 1000;
  END IF;

  -- (removido o bloco antigo que movia a chegada só quando
  --  v_chegada.ordem <= v_new_ordem — chegava tarde demais no caso
  --  de inserção no meio; a chegada agora já foi estacionada acima)

  INSERT INTO public.paradas (
    rota_id, tipo, endereco, latitude, longitude, ordem,
    destinatario, telefone, observacoes, status, is_checkpoint
  ) VALUES (
    p_rota_id, p_tipo, p_endereco, p_latitude, p_longitude, v_new_ordem,
    p_destinatario, p_telefone, p_observacoes, 'pendente', true
  )
  RETURNING id INTO v_new_parada_id;

  -- Normalização: paradas reais renumeradas sequencialmente (1, 2, 3, ...)
  WITH ordered_paradas AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY ordem) AS new_ordem
    FROM public.paradas
    WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false
  )
  UPDATE public.paradas p
  SET ordem = op.new_ordem
  FROM ordered_paradas op
  WHERE p.id = op.id AND p.ordem != op.new_ordem;

  -- Chegada volta para depois de todas as paradas reais
  IF v_chegada.id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_parada_count
    FROM public.paradas
    WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false;
    UPDATE public.paradas
    SET ordem = v_parada_count + 1
    WHERE id = v_chegada.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'parada_id', v_new_parada_id, 'ordem', v_new_ordem);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.inserir_parada IS 'Inserts a new stop atomically, handling order adjustments and normalization in a single transaction. Chegada é estacionada em ordem temporária antes do shift (fix 2026-07-13).';

COMMIT;

-- ROLLBACK:
-- Re-executar o bloco "C1 - inserir_parada" de
-- database/migrations/20260622183805_security_hardening_multitenant.sql
-- (restaura a definição anterior da função; grants não são alterados por
-- CREATE OR REPLACE, nada mais a reverter).
