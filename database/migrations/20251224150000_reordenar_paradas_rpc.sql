-- Migration: Create reordenar_paradas RPC function
-- This function reorders stops atomically in a single transaction
-- avoiding unique constraint violations and reducing round-trips

CREATE OR REPLACE FUNCTION reordenar_paradas(
  p_parada_ids UUID[],
  p_novas_ordens INTEGER[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_rota_id UUID;
  v_i INTEGER;
BEGIN
  -- Validate input arrays have same length
  IF array_length(p_parada_ids, 1) != array_length(p_novas_ordens, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Arrays must have same length');
  END IF;

  v_count := array_length(p_parada_ids, 1);

  IF v_count IS NULL OR v_count = 0 THEN
    RETURN jsonb_build_object('success', true, 'updated', 0);
  END IF;

  -- Get rota_id from first parada (all should belong to same rota)
  SELECT rota_id INTO v_rota_id FROM paradas WHERE id = p_parada_ids[1];

  IF v_rota_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parada not found');
  END IF;

  -- STEP 1: Move all paradas to temporary high values (1000+)
  -- This avoids unique constraint conflicts
  FOR v_i IN 1..v_count LOOP
    UPDATE paradas
    SET ordem = 1000 + v_i
    WHERE id = p_parada_ids[v_i] AND rota_id = v_rota_id;
  END LOOP;

  -- STEP 2: Assign the correct target values
  FOR v_i IN 1..v_count LOOP
    UPDATE paradas
    SET ordem = p_novas_ordens[v_i]
    WHERE id = p_parada_ids[v_i] AND rota_id = v_rota_id;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'updated', v_count);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION reordenar_paradas(UUID[], INTEGER[]) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION reordenar_paradas IS 'Reorders stops atomically to avoid unique constraint violations. Used by route editing feature.';
