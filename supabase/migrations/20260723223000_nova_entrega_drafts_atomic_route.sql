-- Nova Entrega: rascunhos protegidos + criação transacional/idempotente.
-- Canonical migration (database/migrations).

BEGIN;

-- ---------------------------------------------------------------------------
-- Idempotência da criação de rotas
-- ---------------------------------------------------------------------------
ALTER TABLE public.rotas
  ADD COLUMN IF NOT EXISTS client_request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rotas_client_request_id
  ON public.rotas(client_request_id)
  WHERE client_request_id IS NOT NULL;

COMMENT ON COLUMN public.rotas.client_request_id IS
  'Chave idempotente gerada pelo cliente para impedir rotas duplicadas em retries.';

-- ---------------------------------------------------------------------------
-- Rascunhos de rota (PII protegida por RLS, por gestor e unidade)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rascunhos_rota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE (usuario_id, unidade_id)
);

CREATE INDEX IF NOT EXISTS idx_rascunhos_rota_expira_em
  ON public.rascunhos_rota(expira_em);

ALTER TABLE public.rascunhos_rota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rascunhos_rota_select_own ON public.rascunhos_rota;
CREATE POLICY rascunhos_rota_select_own ON public.rascunhos_rota
  FOR SELECT
  USING (
    usuario_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.unidade_id = rascunhos_rota.unidade_id
        AND uu.papel = 'gestor'
        AND uu.ativo = true
    )
  );

DROP POLICY IF EXISTS rascunhos_rota_insert_own ON public.rascunhos_rota;
CREATE POLICY rascunhos_rota_insert_own ON public.rascunhos_rota
  FOR INSERT
  WITH CHECK (
    usuario_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.unidade_id = rascunhos_rota.unidade_id
        AND uu.papel = 'gestor'
        AND uu.ativo = true
    )
  );

DROP POLICY IF EXISTS rascunhos_rota_update_own ON public.rascunhos_rota;
CREATE POLICY rascunhos_rota_update_own ON public.rascunhos_rota
  FOR UPDATE
  USING (usuario_id = (SELECT auth.uid()))
  WITH CHECK (
    usuario_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND uu.unidade_id = rascunhos_rota.unidade_id
        AND uu.papel = 'gestor'
        AND uu.ativo = true
    )
  );

DROP POLICY IF EXISTS rascunhos_rota_delete_own ON public.rascunhos_rota;
CREATE POLICY rascunhos_rota_delete_own ON public.rascunhos_rota
  FOR DELETE
  USING (usuario_id = (SELECT auth.uid()));

REVOKE ALL ON public.rascunhos_rota FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rascunhos_rota TO authenticated;

-- ---------------------------------------------------------------------------
-- Cria a rota, checkpoints, paradas e vínculos na mesma transação.
-- A função só retorna sucesso depois que toda a estrutura está consistente.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_rota_com_paradas(
  p_request_id UUID,
  p_unidade_id UUID,
  p_motorista_id UUID,
  p_data DATE,
  p_distancia_total NUMERIC,
  p_tempo_total INTEGER,
  p_polyline TEXT,
  p_paradas JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rota_id UUID;
  v_item JSONB;
  v_parada_id UUID;
  v_temp_id TEXT;
  v_vinculo_temp_id TEXT;
  v_id_map JSONB := '{}'::jsonb;
  v_real_stop_count INTEGER;
  v_linked_order INTEGER;
  v_current_order INTEGER;
  v_linked_type TEXT;
  v_checkpoint_count INTEGER;
  v_distinct_order_count INTEGER;
  v_distinct_temp_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuario_unidades uu
    WHERE uu.usuario_id = auth.uid()
      AND uu.unidade_id = p_unidade_id
      AND uu.papel = 'gestor'
      AND uu.ativo = true
  ) THEN
    RAISE EXCEPTION 'Gestor não autorizado para a unidade selecionada.';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Chave idempotente obrigatória.';
  END IF;

  -- Serializa chamadas concorrentes com a mesma chave.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

  SELECT id INTO v_rota_id
  FROM public.rotas
  WHERE client_request_id = p_request_id
    AND unidade_id = p_unidade_id;

  IF v_rota_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'rota_id', v_rota_id,
      'reused', true
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuario_unidades uu
    JOIN public.usuarios u ON u.id = uu.usuario_id
    WHERE uu.usuario_id = p_motorista_id
      AND uu.unidade_id = p_unidade_id
      AND uu.papel = 'motorista'
      AND uu.ativo = true
      AND u.ativo = true
  ) THEN
    RAISE EXCEPTION 'Motorista indisponível para a unidade selecionada.';
  END IF;

  IF p_data < (now() AT TIME ZONE 'America/Fortaleza')::date THEN
    RAISE EXCEPTION 'A data da rota não pode estar no passado.';
  END IF;

  IF p_distancia_total IS NOT NULL AND p_distancia_total < 0 THEN
    RAISE EXCEPTION 'Distância total inválida.';
  END IF;

  IF p_tempo_total IS NOT NULL AND p_tempo_total < 0 THEN
    RAISE EXCEPTION 'Tempo total inválido.';
  END IF;

  IF p_paradas IS NULL OR jsonb_typeof(p_paradas) <> 'array' THEN
    RAISE EXCEPTION 'Lista de paradas inválida.';
  END IF;

  SELECT count(*) INTO v_real_stop_count
  FROM jsonb_array_elements(p_paradas) item
  WHERE COALESCE((item->>'is_checkpoint')::boolean, true) IS DISTINCT FROM false;

  IF v_real_stop_count < 1 OR v_real_stop_count > 50 THEN
    RAISE EXCEPTION 'A rota deve conter entre 1 e 50 paradas reais.';
  END IF;

  SELECT
    count(*) FILTER (
      WHERE COALESCE((item->>'is_checkpoint')::boolean, true) = false
    ),
    count(DISTINCT (item->>'ordem')::integer) FILTER (
      WHERE COALESCE((item->>'is_checkpoint')::boolean, true) IS DISTINCT FROM false
    ),
    count(DISTINCT NULLIF(item->>'_temp_id', '')) FILTER (
      WHERE COALESCE((item->>'is_checkpoint')::boolean, true) IS DISTINCT FROM false
    )
  INTO v_checkpoint_count, v_distinct_order_count, v_distinct_temp_count
  FROM jsonb_array_elements(p_paradas) item;

  IF jsonb_array_length(p_paradas) <> v_real_stop_count + 2
    OR v_checkpoint_count <> 2 THEN
    RAISE EXCEPTION 'A rota deve conter os checkpoints de saída e chegada.';
  END IF;

  IF v_distinct_order_count <> v_real_stop_count
    OR v_distinct_temp_count <> v_real_stop_count
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_paradas) item
      WHERE COALESCE((item->>'is_checkpoint')::boolean, true) IS DISTINCT FROM false
        AND (
          (item->>'ordem')::integer < 1
          OR (item->>'ordem')::integer > v_real_stop_count
          OR item->>'tipo' NOT IN ('entrega', 'retirada')
          OR NULLIF(btrim(item->>'endereco'), '') IS NULL
          OR NULLIF(btrim(item->>'destinatario'), '') IS NULL
          OR length(
            regexp_replace(COALESCE(item->>'telefone', ''), '\D', '', 'g')
          ) NOT IN (10, 11)
          OR (item->>'latitude')::double precision NOT BETWEEN -90 AND 90
          OR (item->>'longitude')::double precision NOT BETWEEN -180 AND 180
        )
    ) THEN
    RAISE EXCEPTION 'Uma ou mais paradas possuem dados inválidos.';
  END IF;

  IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_paradas) item
      WHERE COALESCE((item->>'is_checkpoint')::boolean, true) = false
        AND (item->>'ordem')::integer = 0
    )
    OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_paradas) item
      WHERE COALESCE((item->>'is_checkpoint')::boolean, true) = false
        AND (item->>'ordem')::integer = v_real_stop_count + 1
    ) THEN
    RAISE EXCEPTION 'Ordem dos checkpoints inválida.';
  END IF;

  -- Validação defensiva das dependências antes de qualquer INSERT.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_paradas)
  LOOP
    v_vinculo_temp_id := NULLIF(v_item->>'_temp_vinculo_id', '');
    IF v_vinculo_temp_id IS NOT NULL THEN
      IF COALESCE((v_item->>'is_checkpoint')::boolean, true) = false
        OR v_item->>'tipo' <> 'entrega' THEN
        RAISE EXCEPTION 'Apenas entregas podem depender de retiradas.';
      END IF;

      v_current_order := (v_item->>'ordem')::integer;

      SELECT
        (linked->>'ordem')::integer,
        linked->>'tipo'
      INTO v_linked_order, v_linked_type
      FROM jsonb_array_elements(p_paradas) linked
      WHERE linked->>'_temp_id' = v_vinculo_temp_id
        AND COALESCE((linked->>'is_checkpoint')::boolean, true) IS DISTINCT FROM false
      LIMIT 1;

      IF v_linked_order IS NULL OR v_linked_type <> 'retirada' THEN
        RAISE EXCEPTION 'Dependência aponta para uma retirada inexistente.';
      END IF;

      IF v_linked_order >= v_current_order THEN
        RAISE EXCEPTION 'A retirada vinculada deve ocorrer antes da entrega.';
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.rotas (
    unidade_id,
    motorista_id,
    status,
    data,
    distancia_total,
    tempo_total,
    polyline,
    client_request_id
  ) VALUES (
    p_unidade_id,
    p_motorista_id,
    'pendente',
    p_data,
    p_distancia_total,
    p_tempo_total,
    NULLIF(p_polyline, ''),
    p_request_id
  )
  RETURNING id INTO v_rota_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_paradas)
  LOOP
    INSERT INTO public.paradas (
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
      v_rota_id,
      v_item->>'tipo',
      v_item->>'endereco',
      (v_item->>'latitude')::double precision,
      (v_item->>'longitude')::double precision,
      (v_item->>'ordem')::integer,
      NULLIF(v_item->>'destinatario', ''),
      NULLIF(v_item->>'telefone', ''),
      NULLIF(v_item->>'observacoes', ''),
      'pendente',
      COALESCE((v_item->>'is_checkpoint')::boolean, true)
    )
    RETURNING id INTO v_parada_id;

    v_temp_id := NULLIF(v_item->>'_temp_id', '');
    IF v_temp_id IS NOT NULL THEN
      v_id_map := jsonb_set(v_id_map, ARRAY[v_temp_id], to_jsonb(v_parada_id::text), true);
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_paradas)
  LOOP
    v_temp_id := NULLIF(v_item->>'_temp_id', '');
    v_vinculo_temp_id := NULLIF(v_item->>'_temp_vinculo_id', '');

    IF v_temp_id IS NOT NULL AND v_vinculo_temp_id IS NOT NULL THEN
      UPDATE public.paradas
      SET vinculo_parada_id = (v_id_map->>v_vinculo_temp_id)::uuid
      WHERE id = (v_id_map->>v_temp_id)::uuid
        AND rota_id = v_rota_id;
    END IF;
  END LOOP;

  INSERT INTO public.logs (
    usuario_id,
    rota_id,
    evento,
    detalhes
  ) VALUES (
    auth.uid(),
    v_rota_id,
    'rota_criada',
    jsonb_build_object(
      'total_paradas', v_real_stop_count,
      'motorista_id', p_motorista_id,
      'criacao_atomica', true,
      'request_id', p_request_id
    )
  );

  DELETE FROM public.rascunhos_rota
  WHERE usuario_id = auth.uid()
    AND unidade_id = p_unidade_id;

  RETURN jsonb_build_object(
    'success', true,
    'rota_id', v_rota_id,
    'reused', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_rota_com_paradas(
  uuid, uuid, uuid, date, numeric, integer, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_rota_com_paradas(
  uuid, uuid, uuid, date, numeric, integer, text, jsonb
) TO authenticated;

COMMIT;
