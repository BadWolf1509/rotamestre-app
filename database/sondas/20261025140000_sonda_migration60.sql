-- ============================================================================
-- Sonda transacional da Migration 60 (medidas da posição em numeric(8,2))
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar ANTES da migration (sai FALHOU: é
-- o defeito medido no aparelho em 25/10/2026) e DEPOIS dela (sai 100% OK).
-- O bloco monta um cenário próprio dentro da transação (não depende de dado
-- real): uma loja, um motorista e uma rota em andamento dele. O insert do caso
-- 1 sai como `authenticated` (SET LOCAL ROLE + claims do JWT), pelo mesmo
-- caminho do app e da policy `motorista_locations_insert_optimized`. O bloco
-- termina SEMPRE em RAISE EXCEPTION, que desfaz tudo. Não tem DELETE. Leia o
-- resultado na mensagem "SONDA M60 (desfeita): ...".
--
--   1. o motorista grava, na rota dele, a posição com precisão 1500,5 (a
--      medida que o banco recusava), velocidade 1200,25 e heading 359,99; os
--      três valores voltam iguais
--   2. o teto do tipo novo é o teto do app (`TETO_MEDIDA_POSICAO`):
--      999999,99 entra e 1000000 é recusado com 22003
--   3. a escala continua 2: 12,345 arredonda para 12,35
--   4. catálogo: as três colunas são numeric(8,2)
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_falhou boolean := false;
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_u uuid := gen_random_uuid();
  v_m uuid := gen_random_uuid();
  v_rota uuid := gen_random_uuid();
  v_pos uuid := gen_random_uuid();
  v_state text;
  v_msg text;
  v_vel numeric;
  v_prec numeric;
  v_head numeric;
  v_n int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres, antes de trocar de papel)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (v_m, 'sonda-m60-m-' || v_sufixo || '@example.invalid',
          'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade)
  VALUES (v_u, 'Sonda M60', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id)
  VALUES (v_m, 'Sonda m', 'sonda-m60-m-' || v_sufixo || '@example.invalid',
          'motorista', v_u);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal)
  VALUES (v_m, v_u, 'motorista', true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, data, status)
  VALUES (v_rota, v_u, v_m, current_date, 'em_andamento');

  -- ---------------------------------------------------------------------------
  -- 1. o motorista grava a posição com precisão 1500,5
  -- ---------------------------------------------------------------------------
  v_state := NULL; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations
      (id, motorista_id, rota_id, latitude, longitude, velocidade, precisao,
       heading, fonte)
    VALUES
      (v_pos, v_m, v_rota, -7.1, -34.8, 1200.25, 1500.5, 359.99, 'foreground');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;
  RESET ROLE;
  SELECT velocidade, precisao, heading INTO v_vel, v_prec, v_head
  FROM public.motorista_locations WHERE id = v_pos;
  IF v_state IS NULL AND v_prec = 1500.5 AND v_vel = 1200.25 AND v_head = 359.99 THEN
    r := r || ' | 1 OK: precisão 1500,5, velocidade 1200,25 e heading 359,99 gravados pelo motorista';
  ELSE
    v_falhou := true;
    r := r || ' | 1 FALHOU: state=' || COALESCE(v_state, '-')
         || ' erro=' || COALESCE(v_msg, '-')
         || ' precisao=' || COALESCE(v_prec::text, 'NULL');
  END IF;

  -- ---------------------------------------------------------------------------
  -- 2. teto: 999999,99 entra, 1000000 é recusado com 22003
  -- ---------------------------------------------------------------------------
  v_state := NULL; v_msg := NULL; v_n := 0;
  BEGIN
    INSERT INTO public.motorista_locations
      (motorista_id, rota_id, latitude, longitude, velocidade, precisao, heading)
    VALUES (v_m, v_rota, -7.1, -34.8, 999999.99, 999999.99, 999999.99);
    v_n := 1;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
  END;
  BEGIN
    INSERT INTO public.motorista_locations
      (motorista_id, rota_id, latitude, longitude, precisao)
    VALUES (v_m, v_rota, -7.1, -34.8, 1000000);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
  END;
  IF v_n = 1 AND v_state = '22003' THEN
    r := r || ' | 2 OK: 999999,99 entra e 1000000 é recusado (22003), o teto do app';
  ELSE
    v_falhou := true;
    r := r || ' | 2 FALHOU: teto_entrou=' || v_n::text
         || ' erro_teto=' || COALESCE(v_msg, '-')
         || ' state_acima=' || COALESCE(v_state, '-');
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3. a escala continua 2
  -- ---------------------------------------------------------------------------
  v_vel := NULL;
  BEGIN
    INSERT INTO public.motorista_locations
      (motorista_id, rota_id, latitude, longitude, velocidade)
    VALUES (v_m, v_rota, -7.1, -34.8, 12.345)
    RETURNING velocidade INTO v_vel;
  EXCEPTION WHEN OTHERS THEN
    v_vel := NULL;
  END;
  IF v_vel = 12.35 THEN
    r := r || ' | 3 OK: 12,345 arredonda para 12,35';
  ELSE
    v_falhou := true;
    r := r || ' | 3 FALHOU: velocidade=' || COALESCE(v_vel::text, 'NULL');
  END IF;

  -- ---------------------------------------------------------------------------
  -- 4. catálogo
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_n
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'motorista_locations'
    AND column_name IN ('velocidade', 'precisao', 'heading')
    AND data_type = 'numeric'
    AND numeric_precision = 8
    AND numeric_scale = 2;
  IF v_n = 3 THEN
    r := r || ' | 4 OK: velocidade, precisao e heading são numeric(8,2)';
  ELSE
    v_falhou := true;
    r := r || ' | 4 FALHOU: colunas numeric(8,2)=' || v_n::text || ' de 3';
  END IF;

  RAISE EXCEPTION 'SONDA M60 (desfeita): %',
    CASE WHEN v_falhou THEN 'FALHOU' ELSE '100% OK' END || r;
END
$$;
