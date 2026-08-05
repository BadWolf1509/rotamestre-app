-- ============================================================================
-- Migration: auditoria_otimizacao_rotas
-- Date: 2026-08-04
-- Author: Wellinton Ribeiro
-- Purpose: Registrar em cada rota se ela foi otimizada pelo otimizador,
--   montada manualmente, ou otimizada e depois alterada manualmente. Base de
--   dados para a auditoria de uso do otimizador de rotas; o app grava nessas
--   colunas em tasks seguintes. Esta migration só adiciona schema + estende a
--   RPC de criação de rota para aceitar o estado inicial de otimização.
-- ============================================================================

BEGIN;

-- Auditoria de uso do otimizador de rotas.
-- NULL em otimizacao_estado significa "sem registro" (rota criada antes desta
-- migration). NUNCA interpretar NULL como 'manual'.

ALTER TABLE public.rotas
  ADD COLUMN IF NOT EXISTS otimizacao_estado text,
  ADD COLUMN IF NOT EXISTS otimizacao_distancia_antes numeric,
  ADD COLUMN IF NOT EXISTS otimizacao_distancia_depois numeric,
  ADD COLUMN IF NOT EXISTS otimizada_em timestamptz,
  ADD COLUMN IF NOT EXISTS otimizada_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.rotas
  DROP CONSTRAINT IF EXISTS rotas_otimizacao_estado_check;

ALTER TABLE public.rotas
  ADD CONSTRAINT rotas_otimizacao_estado_check
  CHECK (otimizacao_estado IS NULL OR otimizacao_estado IN ('otimizada', 'manual', 'otimizada_alterada'));

COMMENT ON COLUMN public.rotas.otimizacao_estado IS
  'otimizada | manual | otimizada_alterada. NULL = sem registro (rota anterior a esta feature).';

-- Índice para o filtro da listagem de rotas (unidade + estado).
CREATE INDEX IF NOT EXISTS idx_rotas_unidade_otimizacao
  ON public.rotas (unidade_id, otimizacao_estado);

-- FK sem índice vira scan em cascata de DELETE de usuario.
CREATE INDEX IF NOT EXISTS idx_rotas_otimizada_por
  ON public.rotas (otimizada_por);

-- ---------------------------------------------------------------------------
-- Estende public.criar_rota_com_paradas (definida originalmente em
-- supabase/migrations/20260723223000_nova_entrega_drafts_atomic_route.sql)
-- com 4 parâmetros novos, todos DEFAULT NULL, para registrar o estado de
-- otimização já no momento da criação da rota.
--
-- Corpo copiado da definição original. As únicas três mudanças em relação ao
-- original são:
--   1) os 4 parâmetros novos, acrescentados no fim da assinatura;
--   2) as colunas/valores correspondentes no INSERT INTO public.rotas;
--   3) o log opcional 'rota_otimizada', logo após o log 'rota_criada'.
-- A lógica de validação/idempotência (locks, checagens de gestor/motorista,
-- validação de paradas/checkpoints/vínculos) NÃO foi tocada.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_rota_com_paradas(
  p_request_id UUID,
  p_unidade_id UUID,
  p_motorista_id UUID,
  p_data DATE,
  p_distancia_total NUMERIC,
  p_tempo_total INTEGER,
  p_polyline TEXT,
  p_paradas JSONB,
  p_otimizacao_estado text DEFAULT NULL,
  p_otimizacao_distancia_antes numeric DEFAULT NULL,
  p_otimizacao_distancia_depois numeric DEFAULT NULL,
  p_otimizada_por uuid DEFAULT NULL
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
    client_request_id,
    otimizacao_estado,
    otimizacao_distancia_antes,
    otimizacao_distancia_depois,
    otimizada_em,
    otimizada_por
  ) VALUES (
    p_unidade_id,
    p_motorista_id,
    'pendente',
    p_data,
    p_distancia_total,
    p_tempo_total,
    NULLIF(p_polyline, ''),
    p_request_id,
    p_otimizacao_estado,
    p_otimizacao_distancia_antes,
    p_otimizacao_distancia_depois,
    CASE WHEN p_otimizacao_estado = 'otimizada' THEN now() ELSE NULL END,
    CASE WHEN p_otimizacao_estado = 'otimizada' THEN p_otimizada_por ELSE NULL END
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

  IF p_otimizacao_estado = 'otimizada' THEN
    INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
    VALUES (
      p_otimizada_por,
      v_rota_id,
      'rota_otimizada',
      jsonb_build_object(
        'distancia_antes', p_otimizacao_distancia_antes,
        'distancia_depois', p_otimizacao_distancia_depois
      )
    );
  END IF;

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

-- ATENÇÃO — achado desta migration, NÃO resolvido aqui (ver task-1-report.md
-- para o detalhe completo; decisão fica para quem rodar o Step 5/rls-policy-
-- reviewer antes de aplicar):
--
-- Os 4 parâmetros novos mudam a lista de tipos da assinatura da função. No
-- Postgres, CREATE OR REPLACE FUNCTION com parâmetros adicionados (mesmo que
-- todos DEFAULT) NÃO substitui o overload existente — cria um OVERLOAD NOVO,
-- porque a identidade da função é (nome + lista de tipos dos parâmetros).
-- Confirmado: https://www.postgresql.org/docs/current/sql-createfunction.html
--
-- Duas consequências práticas:
--   1) O overload de 8 parâmetros (uuid, uuid, uuid, date, numeric, integer,
--      text, jsonb) listado no REVOKE/GRANT abaixo continua existindo como
--      objeto separado no catálogo, com a MESMA lógica de antes. Chamadas
--      antigas com 8 argumentos posicionais continuam caindo nele, não no
--      overload novo de 12 parâmetros — o que é inofensivo aqui porque as
--      duas versões produzem o mesmo resultado para esses argumentos (colunas
--      novas ficam NULL em ambas), mas passa a existir a MESMA lógica crítica
--      duplicada em dois objetos que podem divergir em edições futuras.
--   2) O REVOKE/GRANT abaixo (copiado do arquivo original de
--      20260723223000_nova_entrega_drafts_atomic_route.sql, sem alteração —
--      não fazia parte das 3 mudanças autorizadas pelo brief desta task) só
--      cobre a assinatura de 8 parâmetros. O overload NOVO de 12 parâmetros
--      não recebe REVOKE/GRANT explícito nesta migration e herda o privilégio
--      default do schema public deste projeto — que é exatamente a classe de
--      furo (SECURITY DEFINER executável por anon/PUBLIC) já fechada duas
--      vezes neste repositório: ver
--      supabase/migrations/20260622195500_security_revoke_definer_anon.sql e
--      supabase/migrations/20260722195606_security_revoke_definer_anon_param.sql.
--
-- Isto não foi corrigido aqui por estar fora do escopo desta task (Steps 1-4,
-- só os 3 changes especificados no brief). Precisa de decisão explícita antes
-- do Step 6 (aplicar) — plausivelmente um REVOKE/GRANT adicional cobrindo a
-- assinatura de 12 parâmetros.
REVOKE EXECUTE ON FUNCTION public.criar_rota_com_paradas(
  uuid, uuid, uuid, date, numeric, integer, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_rota_com_paradas(
  uuid, uuid, uuid, date, numeric, integer, text, jsonb
) TO authenticated;

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- -- Remove só o overload NOVO de 12 parâmetros (o overload de 8 parâmetros
-- -- original não foi tocado por esta migration e não precisa ser restaurado).
-- DROP FUNCTION IF EXISTS public.criar_rota_com_paradas(
--   uuid, uuid, uuid, date, numeric, integer, text, jsonb,
--   text, numeric, numeric, uuid
-- );
-- ALTER TABLE public.rotas DROP CONSTRAINT IF EXISTS rotas_otimizacao_estado_check;
-- DROP INDEX IF EXISTS public.idx_rotas_otimizada_por;
-- DROP INDEX IF EXISTS public.idx_rotas_unidade_otimizacao;
-- ALTER TABLE public.rotas
--   DROP COLUMN IF EXISTS otimizacao_estado,
--   DROP COLUMN IF EXISTS otimizacao_distancia_antes,
--   DROP COLUMN IF EXISTS otimizacao_distancia_depois,
--   DROP COLUMN IF EXISTS otimizada_em,
--   DROP COLUMN IF EXISTS otimizada_por;
-- COMMIT;
