-- Migration: Create inserir_parada RPC function
-- This function inserts a new stop atomically in a single transaction
-- handling order adjustments, chegada repositioning, and normalization

CREATE OR REPLACE FUNCTION inserir_parada(
  p_rota_id UUID,
  p_tipo TEXT,
  p_endereco TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_posicao_insercao INTEGER DEFAULT NULL, -- NULL = insert at end, number = insert AT this position
  p_destinatario TEXT DEFAULT NULL,
  p_telefone TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_paradas_reais RECORD;
  v_chegada RECORD;
  v_new_ordem INTEGER;
  v_parada_count INTEGER;
  v_new_parada_id UUID;
  v_parada RECORD;
BEGIN
  -- Get count of real stops (is_checkpoint != false)
  SELECT COUNT(*) INTO v_parada_count
  FROM paradas
  WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false;

  -- Find chegada (is_checkpoint = false AND ordem > 0)
  SELECT id, ordem INTO v_chegada
  FROM paradas
  WHERE rota_id = p_rota_id AND is_checkpoint = false AND ordem > 0
  LIMIT 1;

  -- Calculate new order based on position selection
  IF p_posicao_insercao IS NULL THEN
    -- Insert at the end
    v_new_ordem := v_parada_count + 1;
  ELSE
    -- Insert AT the selected position (before the stop currently there)
    v_new_ordem := p_posicao_insercao;

    -- Move all real stops that are at or after the insertion point
    -- First move to temporary high values to avoid unique constraint conflicts
    UPDATE paradas
    SET ordem = ordem + 1000
    WHERE rota_id = p_rota_id
      AND is_checkpoint IS DISTINCT FROM false
      AND ordem >= p_posicao_insercao;

    -- Then move back with +1 offset
    UPDATE paradas
    SET ordem = ordem - 1000 + 1
    WHERE rota_id = p_rota_id
      AND is_checkpoint IS DISTINCT FROM false
      AND ordem >= 1000;
  END IF;

  -- Move chegada if it would conflict with new position
  IF v_chegada.id IS NOT NULL AND v_chegada.ordem <= v_new_ordem THEN
    UPDATE paradas
    SET ordem = GREATEST(v_chegada.ordem + 1, v_new_ordem + 1)
    WHERE id = v_chegada.id;
  END IF;

  -- Insert the new parada
  INSERT INTO paradas (
    rota_id,
    tipo,
    endereco,
    latitude,
    longitude,
    ordem,
    destinatario,
    telefone,
    observacoes,
    status,
    is_checkpoint
  ) VALUES (
    p_rota_id,
    p_tipo,
    p_endereco,
    p_latitude,
    p_longitude,
    v_new_ordem,
    p_destinatario,
    p_telefone,
    p_observacoes,
    'pendente',
    true
  )
  RETURNING id INTO v_new_parada_id;

  -- Normalize order: ensure sequential ordering (1, 2, 3, ...)
  -- Get all real stops ordered and reassign sequential numbers
  WITH ordered_paradas AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY ordem) AS new_ordem
    FROM paradas
    WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false
  )
  UPDATE paradas p
  SET ordem = op.new_ordem
  FROM ordered_paradas op
  WHERE p.id = op.id AND p.ordem != op.new_ordem;

  -- Move chegada to after all real stops
  IF v_chegada.id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_parada_count
    FROM paradas
    WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false;

    UPDATE paradas
    SET ordem = v_parada_count + 1
    WHERE id = v_chegada.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'parada_id', v_new_parada_id,
    'ordem', v_new_ordem
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION inserir_parada(UUID, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION inserir_parada IS 'Inserts a new stop atomically, handling order adjustments and normalization in a single transaction.';
