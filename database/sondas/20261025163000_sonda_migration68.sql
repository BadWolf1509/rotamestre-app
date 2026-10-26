-- ============================================================================
-- Sonda transacional da Migration 68 (motorista_locations: posição gravada em
-- rota em andamento, com margem para a fila offline, e por motorista com
-- cadastro ativo)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 68 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os casos 4, 5, 6, 9b
-- e 11 saem FALHOU (é o vermelho esperado; o 7 e o 8 já valem antes, porque
-- a subconsulta em `rotas` passa pelo `rotas_select` da Migration 49).
--
-- Cenário comum (não depende de dado real; nada usa a conta nem a rota do
-- motorista de teste do e2e): loja A; motorista M, ativo em A, com as rotas
-- R_and (`em_andamento`), R_conc (`concluida`, `concluida_em` = 1 hora atrás),
-- R_pend (`pendente`) e R_canc (`cancelada`); motorista C, colega ativo em A,
-- com a rota RC (`em_andamento`); motorista D, com vínculo ativo em A mas
-- desativado como pessoa (`usuarios.ativo = false`), com a rota RD
-- (`em_andamento`); motorista E, com o vínculo em A inativo (inativado depois
-- de a rota existir), com a rota RE (`em_andamento`). Cada caso grava a
-- própria posição como `authenticated` (SET LOCAL ROLE + claims do JWT), como
-- o envio da fila do app. A recusa da policy é o erro 42501
-- (`insufficient_privilege`, "new row violates row-level security policy"),
-- capturado por caso para a sonda seguir. O bloco termina SEMPRE em RAISE
-- EXCEPTION, que desfaz tudo. Leia o resultado na mensagem
-- "SONDA M68 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. M em R_and → 1 linha
--   2. M em R_conc, `timestamp` = concluida_em - 5 min → 1 linha
--   3. M em R_conc, `timestamp` = concluida_em + 5 min → 1 linha
--   4. M em R_conc, `timestamp` = now() (50 min depois da margem) → recusado
--   5. M em R_pend → recusado
--   6. M em R_canc → recusado
--   7. D (pessoa desativada) em RD → recusado
--   8. E (vínculo inativo) em RE → recusado
--   9. M sem rota → 1 linha
--   9b. D sem rota → recusado
--  10. M em RC (rota de C) → recusado
--  11. catálogo: `motorista_locations_insert_optimized` FOR INSERT TO
--      authenticated, com `usuario_atual_ativo` e `concluida_em` no
--      `with_check`, sem `now()`
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();       -- loja A
  v_m uuid := gen_random_uuid();        -- motorista ativo de A
  v_c uuid := gen_random_uuid();        -- colega de A
  v_d uuid := gen_random_uuid();        -- motorista desativado como pessoa
  v_e uuid := gen_random_uuid();        -- motorista com vínculo inativo
  v_r_and uuid := gen_random_uuid();    -- rota de M em andamento
  v_r_conc uuid := gen_random_uuid();   -- rota de M concluída há 1 hora
  v_r_pend uuid := gen_random_uuid();   -- rota de M pendente
  v_r_canc uuid := gen_random_uuid();   -- rota de M cancelada
  v_rc uuid := gen_random_uuid();       -- rota de C em andamento
  v_rd uuid := gen_random_uuid();       -- rota de D em andamento
  v_re uuid := gen_random_uuid();       -- rota de E em andamento
  v_concluida_em timestamptz := now() - interval '1 hour';
  v_n int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m, 'sonda-m68-m-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_c, 'sonda-m68-c-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_d, 'sonda-m68-d-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_e, 'sonda-m68-e-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M68 A', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m, 'Sonda motorista M', 'sonda-m68-m-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_c, 'Sonda motorista C', 'sonda-m68-c-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_d, 'Sonda motorista D', 'sonda-m68-d-' || v_sufixo || '@example.invalid', 'motorista', v_ua, false),
    (v_e, 'Sonda motorista E', 'sonda-m68-e-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m, v_ua, 'motorista', true, true),
    (v_c, v_ua, 'motorista', true, true),
    (v_d, v_ua, 'motorista', true, true),
    (v_e, v_ua, 'motorista', true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, concluida_em) VALUES
    (v_r_and,  v_ua, v_m, 'em_andamento', NULL),
    (v_r_conc, v_ua, v_m, 'concluida',    v_concluida_em),
    (v_r_pend, v_ua, v_m, 'pendente',     NULL),
    (v_r_canc, v_ua, v_m, 'cancelada',    NULL),
    (v_rc,     v_ua, v_c, 'em_andamento', NULL),
    (v_rd,     v_ua, v_d, 'em_andamento', NULL),
    (v_re,     v_ua, v_e, 'em_andamento', NULL);

  -- O vínculo de E só fica inativo depois de a rota existir: o gatilho
  -- `trg_validar_motorista_e_loja_da_rota` exige vínculo ativo para criar a
  -- rota (e não dispara neste UPDATE de usuario_unidades).
  UPDATE public.usuario_unidades SET ativo = false
   WHERE usuario_id = v_e AND unidade_id = v_ua;

  -- ---------------------------------------------------------------------------
  -- 1. M grava posição na rota em andamento
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations (motorista_id, rota_id, latitude, longitude, "timestamp")
      VALUES (v_m, v_r_and, -7.1, -34.8, now());
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 1 OK: o motorista grava posição na rota em andamento (1)'
      ELSE ' | 1 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION
    WHEN insufficient_privilege THEN
      r := r || ' | 1 FALHOU: posição na rota em andamento recusada (' || SQLERRM || ')';
    WHEN OTHERS THEN
      r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2. M grava, na rota concluída, posição medida 5 min antes da conclusão
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations (motorista_id, rota_id, latitude, longitude, "timestamp")
      VALUES (v_m, v_r_conc, -7.1, -34.8, v_concluida_em - interval '5 minutes');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 2 OK: a fila offline sobe posição medida antes da conclusão (1)'
      ELSE ' | 2 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION
    WHEN insufficient_privilege THEN
      r := r || ' | 2 FALHOU: posição medida antes da conclusão recusada (' || SQLERRM || ')';
    WHEN OTHERS THEN
      r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. M grava, na rota concluída, posição medida 5 min depois da conclusão
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations (motorista_id, rota_id, latitude, longitude, "timestamp")
      VALUES (v_m, v_r_conc, -7.1, -34.8, v_concluida_em + interval '5 minutes');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 3 OK: posição medida dentro da margem de 10 min depois da conclusão é aceita (1)'
      ELSE ' | 3 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION
    WHEN insufficient_privilege THEN
      r := r || ' | 3 FALHOU: posição dentro da margem recusada (' || SQLERRM || ')';
    WHEN OTHERS THEN
      r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. M grava, na rota concluída, posição medida agora (além da margem)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations (motorista_id, rota_id, latitude, longitude, "timestamp")
      VALUES (v_m, v_r_conc, -7.1, -34.8, now());
    r := r || ' | 4 FALHOU: posição além da margem da rota concluída foi aceita';
  EXCEPTION
    WHEN insufficient_privilege THEN
      r := r || ' | 4 OK: posição além da margem da rota concluída é recusada (42501)';
    WHEN OTHERS THEN
      r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. M grava posição na rota pendente
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations (motorista_id, rota_id, latitude, longitude, "timestamp")
      VALUES (v_m, v_r_pend, -7.1, -34.8, now());
    r := r || ' | 5 FALHOU: posição na rota pendente foi aceita';
  EXCEPTION
    WHEN insufficient_privilege THEN
      r := r || ' | 5 OK: posição na rota pendente é recusada (42501)';
    WHEN OTHERS THEN
      r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. M grava posição na rota cancelada
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations (motorista_id, rota_id, latitude, longitude, "timestamp")
      VALUES (v_m, v_r_canc, -7.1, -34.8, now());
    r := r || ' | 6 FALHOU: posição na rota cancelada foi aceita';
  EXCEPTION
    WHEN insufficient_privilege THEN
      r := r || ' | 6 OK: posição na rota cancelada é recusada (42501)';
    WHEN OTHERS THEN
      r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. D (pessoa desativada) grava posição na própria rota em andamento
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_d, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations (motorista_id, rota_id, latitude, longitude, "timestamp")
      VALUES (v_d, v_rd, -7.1, -34.8, now());
    r := r || ' | 7 FALHOU: posição da pessoa desativada foi aceita';
  EXCEPTION
    WHEN insufficient_privilege THEN
      r := r || ' | 7 OK: posição da pessoa desativada é recusada (42501)';
    WHEN OTHERS THEN
      r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. E (vínculo inativo) grava posição na própria rota em andamento
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_e, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations (motorista_id, rota_id, latitude, longitude, "timestamp")
      VALUES (v_e, v_re, -7.1, -34.8, now());
    r := r || ' | 8 FALHOU: posição com vínculo inativo foi aceita';
  EXCEPTION
    WHEN insufficient_privilege THEN
      r := r || ' | 8 OK: posição com vínculo inativo é recusada (42501)';
    WHEN OTHERS THEN
      r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. M grava posição sem rota
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations (motorista_id, rota_id, latitude, longitude, "timestamp")
      VALUES (v_m, NULL, -7.1, -34.8, now());
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 9 OK: o motorista ativo grava posição sem rota (1)'
      ELSE ' | 9 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION
    WHEN insufficient_privilege THEN
      r := r || ' | 9 FALHOU: posição sem rota do motorista ativo recusada (' || SQLERRM || ')';
    WHEN OTHERS THEN
      r := r || ' | 9 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- 9b. D (pessoa desativada) grava posição sem rota
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_d, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations (motorista_id, rota_id, latitude, longitude, "timestamp")
      VALUES (v_d, NULL, -7.1, -34.8, now());
    r := r || ' | 9b FALHOU: posição sem rota da pessoa desativada foi aceita';
  EXCEPTION
    WHEN insufficient_privilege THEN
      r := r || ' | 9b OK: posição sem rota da pessoa desativada é recusada (42501)';
    WHEN OTHERS THEN
      r := r || ' | 9b FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 10. M grava posição na rota de C
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations (motorista_id, rota_id, latitude, longitude, "timestamp")
      VALUES (v_m, v_rc, -7.1, -34.8, now());
    r := r || ' | 10 FALHOU: posição na rota de outro motorista foi aceita';
  EXCEPTION
    WHEN insufficient_privilege THEN
      r := r || ' | 10 OK: posição na rota de outro motorista é recusada (42501)';
    WHEN OTHERS THEN
      r := r || ' | 10 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 11. catálogo
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'motorista_locations'
     AND policyname = 'motorista_locations_insert_optimized'
     AND cmd = 'INSERT'
     AND roles = '{authenticated}'
     AND with_check ILIKE '%usuario_atual_ativo%'
     AND with_check ILIKE '%concluida_em%'
     AND with_check NOT ILIKE '%now()%';
  r := r || CASE WHEN v_n = 1
    THEN ' | 11 OK: policy de INSERT com cadastro ativo e margem pela conclusão, sem now()'
    ELSE ' | 11 FALHOU: ' || v_n || ' de 1 conferência de catálogo' END;

  RAISE EXCEPTION 'SONDA M68 (desfeita):%', r;
END
$$;
