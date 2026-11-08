-- ============================================================================
-- Sonda transacional da Migration 89 (`desempenho_motorista_na_loja`)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 89 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os casos da função
-- saem FALHOU (ela não existe).
--
-- Cenário (não depende de dado real): lojas A e B; GA gestor ativo de A, GB
-- de B, GAB das duas, GX com o vínculo de gestor em A inativo; M1 motorista
-- ativo em A e em B; M2 só em B; M3 em A, desativado depois de ter rota.
-- Rotas nascem como postgres, sem sessão, já no status final.
--   M1 em A: 3 concluidas (10,50 km/30 min; 20,00 km/90 min; 5,00 km/25 h,
--            fora da média), 1 nao_executada (100 km), 1 cancelada (50 km),
--            1 em_andamento, 1 pendente → total 7, concluidas 3, taxa 75.0,
--            35.50 km, 60 min.
--   M1 em B: 2 concluidas (7,00 e 8,00 km, 45 min cada) → total 2, taxa
--            100.0, 15.00 km, 45 min.
--   M3 em A: 1 concluida (4,00 km, 20 min).
-- As chamadas rodam como `authenticated` (SET LOCAL ROLE + claims do JWT). O
-- bloco termina SEMPRE em RAISE EXCEPTION, que desfaz tudo. Leia o resultado
-- na mensagem "SONDA M89 (desfeita): N OK | N FALHOU ..." (o detalhe sai
-- antes num RAISE NOTICE). Conta só as rotas criadas aqui.
--
--    1. GA, M1 em A → só as rotas de A
--    2. GB, M1 em B → só as rotas de B
--    3. GAB (gestor das duas), M1 em A e em B → cada loja com os seus números,
--       nunca a soma; a view, para o mesmo GAB, soma as duas (o defeito)
--    4. recusa SEM_PERMISSAO, sem métrica: GB pedindo A; GX (vínculo de gestor
--       inativo); M1 (motorista da loja); sem sessão; loja nula
--    5. GA, M2 (sem vínculo nem rota em A) e um id qualquer → zeros, taxa
--       100.0, distância e tempo nulos
--    6. GA, M3 desativado → o histórico dele em A (sem o filtro de ativo da
--       view)
--    7. catálogo: DEFINER, STABLE, search_path vazio, dona postgres, jsonb,
--       sem EXECUTE de PUBLIC/anon, com EXECUTE de authenticated; COMMENT
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_gb uuid := gen_random_uuid();     -- gestor de B
  v_gab uuid := gen_random_uuid();    -- gestor de A e de B
  v_gx uuid := gen_random_uuid();     -- vínculo de gestor em A inativo
  v_m1 uuid := gen_random_uuid();     -- motorista em A e em B
  v_m2 uuid := gen_random_uuid();     -- motorista só em B
  v_m3 uuid := gen_random_uuid();     -- motorista em A, desativado depois
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_agora timestamptz := now();
  v_a jsonb;
  v_b jsonb;
  v_c jsonb;
  v_d jsonb;
  v_e jsonb;
  v_n int;
  v_ok boolean;
  v_det text;
  v_ok_n int;
  v_falhou_n int;
  v_falhas text;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_ga,  'sonda-m89-ga-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb,  'sonda-m89-gb-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gab, 'sonda-m89-gab-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gx,  'sonda-m89-gx-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m1,  'sonda-m89-m1-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m2,  'sonda-m89-m2-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m3,  'sonda-m89-m3-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M89 A', 'Sonda'),
    (v_ub, 'Sonda M89 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_ga,  'Sonda gestor A',     'sonda-m89-ga-'  || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gb,  'Sonda gestor B',     'sonda-m89-gb-'  || v_sufixo || '@example.invalid', 'gestor',    v_ub, true),
    (v_gab, 'Sonda gestor AB',    'sonda-m89-gab-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gx,  'Sonda gestor X',     'sonda-m89-gx-'  || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_m1,  'Sonda motorista M1', 'sonda-m89-m1-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_m2,  'Sonda motorista M2', 'sonda-m89-m2-'  || v_sufixo || '@example.invalid', 'motorista', v_ub, true),
    (v_m3,  'Sonda motorista M3', 'sonda-m89-m3-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_ga,  v_ua, 'gestor',    true,  true),
    (v_gb,  v_ub, 'gestor',    true,  true),
    (v_gab, v_ua, 'gestor',    true,  true),
    (v_gab, v_ub, 'gestor',    true,  false),
    (v_gx,  v_ua, 'gestor',    false, true),
    (v_m1,  v_ua, 'motorista', true,  true),
    (v_m1,  v_ub, 'motorista', true,  false),
    (v_m2,  v_ub, 'motorista', true,  true),
    (v_m3,  v_ua, 'motorista', true,  true);

  INSERT INTO public.rotas (unidade_id, motorista_id, status, data, distancia_total, iniciada_em, concluida_em) VALUES
    -- M1 em A
    (v_ua, v_m1, 'concluida',     v_hoje - 1, 10.50, v_agora - interval '2 hours',  v_agora - interval '90 minutes'),
    (v_ua, v_m1, 'concluida',     v_hoje - 2, 20.00, v_agora - interval '3 hours',  v_agora - interval '90 minutes'),
    (v_ua, v_m1, 'concluida',     v_hoje - 3,  5.00, v_agora - interval '30 hours', v_agora - interval '5 hours'),
    (v_ua, v_m1, 'nao_executada', v_hoje - 4, 100.00, NULL, NULL),
    (v_ua, v_m1, 'cancelada',     v_hoje - 5, 50.00, NULL, NULL),
    (v_ua, v_m1, 'em_andamento',  v_hoje,      1.00, v_agora - interval '10 minutes', NULL),
    (v_ua, v_m1, 'pendente',      v_hoje + 1,  1.00, NULL, NULL),
    -- M1 em B
    (v_ub, v_m1, 'concluida',     v_hoje - 1,  7.00, v_agora - interval '45 minutes', v_agora),
    (v_ub, v_m1, 'concluida',     v_hoje - 2,  8.00, v_agora - interval '45 minutes', v_agora),
    -- M3 em A
    (v_ua, v_m3, 'concluida',     v_hoje - 1,  4.00, v_agora - interval '20 minutes', v_agora);

  UPDATE public.usuarios SET ativo = false WHERE id = v_m3;

  -- ---------------------------------------------------------------------------
  -- 1. GA, M1 em A
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_a := public.desempenho_motorista_na_loja(v_m1, v_ua);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    r := r || CASE WHEN (v_a->>'success')::boolean
                    AND (v_a->>'total_rotas')::int = 7
                    AND (v_a->>'rotas_concluidas')::int = 3
                    AND (v_a->>'rotas_em_andamento')::int = 1
                    AND (v_a->>'rotas_nao_executadas')::int = 1
                    AND (v_a->>'rotas_canceladas')::int = 1
                    AND (v_a->>'taxa_execucao')::numeric = 75.0
                    AND (v_a->>'distancia_total_km')::numeric = 35.50
                    AND round((v_a->>'tempo_medio_minutos')::numeric, 2) = 60
      THEN ' | 1 OK: GA vê M1 só com as rotas de A'
      ELSE ' | 1 FALHOU: ' || coalesce(v_a::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 2. GB, M1 em B
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_a := public.desempenho_motorista_na_loja(v_m1, v_ub);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    r := r || CASE WHEN (v_a->>'success')::boolean
                    AND (v_a->>'total_rotas')::int = 2
                    AND (v_a->>'rotas_concluidas')::int = 2
                    AND (v_a->>'rotas_em_andamento')::int = 0
                    AND (v_a->>'rotas_nao_executadas')::int = 0
                    AND (v_a->>'rotas_canceladas')::int = 0
                    AND (v_a->>'taxa_execucao')::numeric = 100.0
                    AND (v_a->>'distancia_total_km')::numeric = 15.00
                    AND round((v_a->>'tempo_medio_minutos')::numeric, 2) = 45
      THEN ' | 2 OK: GB vê M1 só com as rotas de B'
      ELSE ' | 2 FALHOU: ' || coalesce(v_a::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 3. GAB, gestor das duas: cada loja com os seus números; a view soma
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gab, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_a := public.desempenho_motorista_na_loja(v_m1, v_ua);
    v_b := public.desempenho_motorista_na_loja(v_m1, v_ub);
    SELECT total_rotas INTO v_n FROM public.vw_performance_motoristas WHERE id = v_m1;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    r := r || CASE WHEN (v_a->>'total_rotas')::int = 7 AND (v_a->>'distancia_total_km')::numeric = 35.50
                    AND (v_b->>'total_rotas')::int = 2 AND (v_b->>'distancia_total_km')::numeric = 15.00
                    AND v_n = 9
      THEN ' | 3 OK: gestor das duas lojas vê 7 em A e 2 em B (a view somava 9)'
      ELSE ' | 3 FALHOU: A ' || coalesce(v_a::text, 'nulo') || ', B ' || coalesce(v_b::text, 'nulo')
           || ', view ' || coalesce(v_n::text, 'sem linha') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 4. recusa SEM_PERMISSAO, sem métrica
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_a := public.desempenho_motorista_na_loja(v_m1, v_ua);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gx, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_b := public.desempenho_motorista_na_loja(v_m1, v_ua);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_c := public.desempenho_motorista_na_loja(v_m1, v_ua);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_d := public.desempenho_motorista_na_loja(v_m1, v_ua);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_e := public.desempenho_motorista_na_loja(v_m1, NULL);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n
      FROM unnest(ARRAY[v_a, v_b, v_c, v_d, v_e]) AS x
     WHERE x->>'success' = 'false'
       AND x->>'code' = 'SEM_PERMISSAO'
       AND x ? 'error'
       AND NOT x ? 'total_rotas';
    r := r || CASE WHEN v_n = 5
      THEN ' | 4 OK: SEM_PERMISSAO (gestor de outra loja, vínculo inativo, motorista, sem sessão, loja nula), sem métrica'
      ELSE ' | 4 FALHOU: outra loja ' || coalesce(v_a::text, 'nulo') || ', inativo ' || coalesce(v_b::text, 'nulo')
           || ', motorista ' || coalesce(v_c::text, 'nulo') || ', sem sessão ' || coalesce(v_d::text, 'nulo')
           || ', loja nula ' || coalesce(v_e::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 5. motorista sem vínculo nem rota na loja, e id qualquer: zeros
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_a := public.desempenho_motorista_na_loja(v_m2, v_ua);
    v_b := public.desempenho_motorista_na_loja(gen_random_uuid(), v_ua);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n
      FROM unnest(ARRAY[v_a, v_b]) AS x
     WHERE (x->>'success')::boolean
       AND (x->>'total_rotas')::int = 0
       AND (x->>'rotas_concluidas')::int = 0
       AND (x->>'rotas_em_andamento')::int = 0
       AND (x->>'rotas_nao_executadas')::int = 0
       AND (x->>'rotas_canceladas')::int = 0
       AND (x->>'taxa_execucao')::numeric = 100.0
       AND x->'distancia_total_km' = 'null'::jsonb
       AND x->'tempo_medio_minutos' = 'null'::jsonb;
    r := r || CASE WHEN v_n = 2 AND v_a = v_b
      THEN ' | 5 OK: sem rota na loja → zeros, igual para qualquer id'
      ELSE ' | 5 FALHOU: M2 ' || coalesce(v_a::text, 'nulo') || ', id qualquer ' || coalesce(v_b::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 6. motorista desativado: o histórico dele na loja
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_a := public.desempenho_motorista_na_loja(v_m3, v_ua);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    r := r || CASE WHEN (v_a->>'success')::boolean
                    AND (v_a->>'total_rotas')::int = 1
                    AND (v_a->>'rotas_concluidas')::int = 1
                    AND (v_a->>'taxa_execucao')::numeric = 100.0
                    AND (v_a->>'distancia_total_km')::numeric = 4.00
                    AND round((v_a->>'tempo_medio_minutos')::numeric, 2) = 20
      THEN ' | 6 OK: motorista desativado mostra o que fez na loja'
      ELSE ' | 6 FALHOU: ' || coalesce(v_a::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 7. catálogo
  -- ---------------------------------------------------------------------------
  BEGIN
    v_ok := true;
    v_det := '';
    SELECT count(*) INTO v_n
      FROM pg_proc p
     WHERE p.oid = to_regprocedure('public.desempenho_motorista_na_loja(uuid, uuid)')
       AND p.prosecdef
       AND p.provolatile = 's'
       AND p.proconfig = ARRAY['search_path=""']
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.prorettype = 'jsonb'::regtype
       AND p.proacl IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
       AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
       AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
       AND obj_description(p.oid, 'pg_proc') LIKE 'Migration 89%';
    IF v_n <> 1 THEN
      v_ok := false;
      v_det := ' função ausente ou fora do esperado';
    END IF;
    r := r || CASE WHEN v_ok
      THEN ' | 7 OK: catálogo (DEFINER, STABLE, search_path vazio, dono, jsonb, ACL, COMMENT)'
      ELSE ' | 7 FALHOU:' || v_det END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- Resumo (o detalhe vai no NOTICE; a EXCEPTION desfaz tudo)
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_ok_n FROM regexp_matches(r, '\| \d+ OK:', 'g');
  SELECT count(*) INTO v_falhou_n FROM regexp_matches(r, '\| \d+ FALHOU', 'g');
  SELECT coalesce(string_agg(x[1], ' '), '') INTO v_falhas
    FROM regexp_matches(r, '(\| \d+ FALHOU[^|]*)', 'g') AS x;

  RAISE NOTICE 'SONDA M89 detalhe:%', r;
  RAISE EXCEPTION 'SONDA M89 (desfeita): % OK | % FALHOU %', v_ok_n, v_falhou_n, v_falhas;
END
$$;
