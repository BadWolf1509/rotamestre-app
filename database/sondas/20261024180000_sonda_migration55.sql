-- ============================================================================
-- Sonda transacional da Migration 55 (rodar DEPOIS de aplicá-la)
-- ============================================================================
-- Banco único = produção, sem pgTAP. O bloco monta um cenário próprio dentro da
-- transação e termina SEMPRE em RAISE EXCEPTION, que desfaz tudo (inclusive
-- logs e notificações dos gatilhos). Não tem DELETE. As chamadas saem como
-- `authenticated` (SET LOCAL ROLE + claims do JWT). Leia o resultado na
-- mensagem "SONDA M55 (desfeita): ...". Esperado: todas as linhas com OK.
-- Rodada ANTES da migration, todos os casos de chamada saem FALHOU (a função
-- não existe).
--
-- "Hoje" = (now() AT TIME ZONE 'America/Sao_Paulo')::date, como na função.
--
-- Cenário:
--   lojas U, U2 e U3; G gestor ativo de U; G2 gestor ativo de U2; G3 gestor
--   de U com o vínculo INATIVO; GX gestor ativo só de U3 (sem relação com M)
--   M   motorista em U e U2:
--       U : rA concluída (hoje-1, 10 km): partida + concluída(true) +
--                concluída(NULL) + pulada(true) + chegada
--           rB cancelada (hoje-8, 5 km): 1 pendente(NULL)
--           rC pendente  (hoje-7, km NULL): 2 pendentes
--       U2: rD concluída (hoje-2, 20 km): 2 concluídas
--   N   outro motorista em U;  MI motorista de U com o cadastro inativo;
--   M0  motorista de U sem nenhuma rota
--
--   1. M, desde sempre: 4 rotas, 2 concl., 1 canc., 35 km, 8 paradas (partida e
--      chegada fora), 4 concl., 1 pulada, 4 entregas; e bate com a RLS (o que
--      M vê em `rotas` com SELECT direto)
--   2. M, p_dias = 7: rB (hoje-8) sai, rC (hoje-7) entra; desde = hoje-7
--   3. G (loja U) vê M só com os números de U, e bate com a RLS de G
--   4. G2 (loja U2) vê M só com os números de U2
--   5. GX (gestor de outra loja) é recusado: 42501
--   6. G3 (vínculo de gestor inativo) é recusado: 42501
--   7. N (outro motorista) pedindo os números de M é recusado: 42501
--   8. MI (cadastro inativo) pedindo os próprios números é recusado: 42501
--   9. M com o vínculo de U2 desativado vê só U (Migration 49)
--  10. M0 sem rotas: uma linha com zeros (não NULL)
--  11. p_dias negativo: 22023
--  12. grants (authenticated sim, anon não), DEFINER e search_path vazio
--  13. Review Focus 3: o motorista REAL de maior volume (achado por SELECT):
--      a RPC, chamada por ele e por um gestor ativo da loja dele, bate com o
--      COUNT direto (rotas, paradas sem partida/chegada, concluídas, puladas,
--      entregas, km)
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_u uuid := gen_random_uuid();
  v_u2 uuid := gen_random_uuid();
  v_u3 uuid := gen_random_uuid();
  v_g uuid := gen_random_uuid();
  v_g2 uuid := gen_random_uuid();
  v_g3 uuid := gen_random_uuid();
  v_gx uuid := gen_random_uuid();
  v_m uuid := gen_random_uuid();
  v_n uuid := gen_random_uuid();
  v_mi uuid := gen_random_uuid();
  v_m0 uuid := gen_random_uuid();
  v_ra uuid := gen_random_uuid();
  v_rb uuid := gen_random_uuid();
  v_rc uuid := gen_random_uuid();
  v_rd uuid := gen_random_uuid();
  v_j jsonb;  -- a linha da RPC (NULL quando a chamada falha)
  v_rls integer;
  v_state text;
  v_msg text;
  -- caso 13
  v_top uuid;
  v_top_loja uuid;
  v_top_gestor uuid;
  d_rotas integer;
  d_conc integer;
  d_km numeric;
  d_par integer;
  d_pconc integer;
  d_pul integer;
  d_ent integer;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres, antes de trocar de papel)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role)
  SELECT id, 'sonda-m55-' || rotulo || '-' || v_sufixo || '@example.invalid',
         'authenticated', 'authenticated'
  FROM (VALUES (v_g, 'g'), (v_g2, 'g2'), (v_g3, 'g3'), (v_gx, 'gx'), (v_m, 'm'),
               (v_n, 'n'), (v_mi, 'mi'), (v_m0, 'm0')) AS t(id, rotulo);

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_u, 'Sonda M55', 'Sonda'),
    (v_u2, 'Sonda M55 dois', 'Sonda'),
    (v_u3, 'Sonda M55 três', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id)
  SELECT id, 'Sonda ' || rotulo,
         'sonda-m55-' || rotulo || '-' || v_sufixo || '@example.invalid',
         papel, loja
  FROM (VALUES (v_g, 'g', 'gestor', v_u), (v_g2, 'g2', 'gestor', v_u2),
               (v_g3, 'g3', 'gestor', v_u), (v_gx, 'gx', 'gestor', v_u3),
               (v_m, 'm', 'motorista', v_u), (v_n, 'n', 'motorista', v_u),
               (v_mi, 'mi', 'motorista', v_u), (v_m0, 'm0', 'motorista', v_u))
       AS t(id, rotulo, papel, loja);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_g,  v_u,  'gestor',    true,  true),
    (v_g2, v_u2, 'gestor',    true,  true),
    (v_g3, v_u,  'gestor',    false, true),
    (v_gx, v_u3, 'gestor',    true,  true),
    (v_m,  v_u,  'motorista', true,  true),
    (v_m,  v_u2, 'motorista', true,  false),
    (v_n,  v_u,  'motorista', true,  true),
    (v_mi, v_u,  'motorista', true,  true),
    (v_m0, v_u,  'motorista', true,  true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, data, status, distancia_total) VALUES
    (v_ra, v_u,  v_m, v_hoje - 1, 'concluida', 10),
    (v_rb, v_u,  v_m, v_hoje - 8, 'cancelada', 5),
    (v_rc, v_u,  v_m, v_hoje - 7, 'pendente',  NULL),
    (v_rd, v_u2, v_m, v_hoje - 2, 'concluida', 20);
  INSERT INTO public.rotas (unidade_id, motorista_id, data, status)
  VALUES (v_u, v_mi, v_hoje - 1, 'concluida');

  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_ra, 'entrega', 'Partida',     -7.1, -34.8, 0, 'concluida', false),
    (v_ra, 'entrega', 'Rua A, 1',    -7.2, -34.8, 1, 'concluida', true),
    (v_ra, 'entrega', 'Rua A, 2',    -7.3, -34.8, 2, 'concluida', NULL),
    (v_ra, 'entrega', 'Rua A, 3',    -7.4, -34.8, 3, 'pulada',    true),
    (v_ra, 'entrega', 'Chegada',     -7.1, -34.8, 4, 'concluida', false),
    (v_rb, 'entrega', 'Rua B, 1',    -7.5, -34.8, 1, 'pendente',  NULL),
    (v_rc, 'entrega', 'Rua C, 1',    -7.6, -34.8, 1, 'pendente',  true),
    (v_rc, 'retirada', 'Rua C, 2',   -7.7, -34.8, 2, 'pendente',  true),
    (v_rd, 'entrega', 'Rua D, 1',    -7.8, -34.8, 1, 'concluida', true),
    (v_rd, 'entrega', 'Rua D, 2',    -7.9, -34.8, 2, 'concluida', NULL);

  UPDATE public.usuarios SET ativo = false WHERE id = v_mi;

  -- ---------------------------------------------------------------------------
  -- 1. M, desde sempre (+ RLS de M)
  -- ---------------------------------------------------------------------------
  v_j := NULL; v_msg := NULL; v_rls := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT to_jsonb(t) INTO v_j FROM public.resumo_desempenho_motorista(v_m, NULL) t;
    SELECT count(*) INTO v_rls FROM public.rotas WHERE motorista_id = v_m;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_msg IS NULL AND v_j ? 'desde' AND v_j->>'desde' IS NULL AND (v_j->>'total_rotas')::numeric = 4
      AND (v_j->>'rotas_concluidas')::numeric = 2 AND (v_j->>'rotas_canceladas')::numeric = 1 AND (v_j->>'distancia_total')::numeric = 35
      AND (v_j->>'total_paradas')::numeric = 8 AND (v_j->>'paradas_concluidas')::numeric = 4 AND (v_j->>'paradas_puladas')::numeric = 1
      AND (v_j->>'entregas_em_rotas_concluidas')::numeric = 4 AND v_rls = (v_j->>'total_rotas')::numeric
    THEN ' | 1 OK: M desde sempre 4 rotas/35 km/8 paradas/4 concl./1 pulada/4 entregas = RLS'
    ELSE ' | 1 FALHOU: ' || COALESCE(v_j::text, '-') || ' rls=' || COALESCE(v_rls::text, '-')
         || ' erro=' || COALESCE(v_msg, '-') END;

  -- ---------------------------------------------------------------------------
  -- 2. M, últimos 7 dias
  -- ---------------------------------------------------------------------------
  v_j := NULL; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT to_jsonb(t) INTO v_j FROM public.resumo_desempenho_motorista(v_m, 7) t;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_msg IS NULL AND (v_j->>'desde')::date = v_hoje - 7 AND (v_j->>'total_rotas')::numeric = 3
      AND (v_j->>'rotas_canceladas')::numeric = 0 AND (v_j->>'distancia_total')::numeric = 30 AND (v_j->>'total_paradas')::numeric = 7
      AND (v_j->>'paradas_concluidas')::numeric = 4 AND (v_j->>'entregas_em_rotas_concluidas')::numeric = 4
    THEN ' | 2 OK: 7 dias (fuso SP) tira a rota de hoje-8 e mantém a de hoje-7'
    ELSE ' | 2 FALHOU: ' || COALESCE(v_j::text, '-') || ' erro=' || COALESCE(v_msg, '-') END;

  -- ---------------------------------------------------------------------------
  -- 3. G (loja U) vê só U (+ RLS de G)
  -- ---------------------------------------------------------------------------
  v_j := NULL; v_msg := NULL; v_rls := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT to_jsonb(t) INTO v_j FROM public.resumo_desempenho_motorista(v_m, NULL) t;
    SELECT count(*) INTO v_rls FROM public.rotas WHERE motorista_id = v_m;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_msg IS NULL AND (v_j->>'total_rotas')::numeric = 3 AND (v_j->>'rotas_concluidas')::numeric = 1
      AND (v_j->>'rotas_canceladas')::numeric = 1 AND (v_j->>'distancia_total')::numeric = 15 AND (v_j->>'total_paradas')::numeric = 6
      AND (v_j->>'paradas_concluidas')::numeric = 2 AND (v_j->>'paradas_puladas')::numeric = 1
      AND (v_j->>'entregas_em_rotas_concluidas')::numeric = 2 AND v_rls = 3
    THEN ' | 3 OK: gestor de U vê M só com os números de U (= RLS)'
    ELSE ' | 3 FALHOU: ' || COALESCE(v_j::text, '-') || ' rls=' || COALESCE(v_rls::text, '-')
         || ' erro=' || COALESCE(v_msg, '-') END;

  -- ---------------------------------------------------------------------------
  -- 4. G2 (loja U2) vê só U2
  -- ---------------------------------------------------------------------------
  v_j := NULL; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT to_jsonb(t) INTO v_j FROM public.resumo_desempenho_motorista(v_m, NULL) t;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_msg IS NULL AND (v_j->>'total_rotas')::numeric = 1 AND (v_j->>'distancia_total')::numeric = 20
      AND (v_j->>'total_paradas')::numeric = 2 AND (v_j->>'paradas_concluidas')::numeric = 2
      AND (v_j->>'entregas_em_rotas_concluidas')::numeric = 2
    THEN ' | 4 OK: gestor de U2 vê M só com os números de U2'
    ELSE ' | 4 FALHOU: ' || COALESCE(v_j::text, '-') || ' erro=' || COALESCE(v_msg, '-') END;

  -- ---------------------------------------------------------------------------
  -- 5 a 8. recusados com 42501
  -- ---------------------------------------------------------------------------
  v_state := NULL; v_j := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gx, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT to_jsonb(t) INTO v_j FROM public.resumo_desempenho_motorista(v_m, NULL) t;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_state = '42501' THEN ' | 5 OK: gestor de outra loja recusado (42501)'
    ELSE ' | 5 FALHOU: state=' || COALESCE(v_state, '-') || ' ' || COALESCE(v_j::text, '-') END;

  v_state := NULL; v_j := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g3, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT to_jsonb(t) INTO v_j FROM public.resumo_desempenho_motorista(v_m, NULL) t;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_state = '42501' THEN ' | 6 OK: gestor com vínculo inativo recusado (42501)'
    ELSE ' | 6 FALHOU: state=' || COALESCE(v_state, '-') || ' ' || COALESCE(v_j::text, '-') END;

  v_state := NULL; v_j := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_n, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT to_jsonb(t) INTO v_j FROM public.resumo_desempenho_motorista(v_m, NULL) t;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_state = '42501' THEN ' | 7 OK: outro motorista recusado (42501)'
    ELSE ' | 7 FALHOU: state=' || COALESCE(v_state, '-') || ' ' || COALESCE(v_j::text, '-') END;

  v_state := NULL; v_j := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_mi, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT to_jsonb(t) INTO v_j FROM public.resumo_desempenho_motorista(v_mi, NULL) t;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_state = '42501' THEN ' | 8 OK: motorista com cadastro inativo recusado (42501)'
    ELSE ' | 8 FALHOU: state=' || COALESCE(v_state, '-') || ' ' || COALESCE(v_j::text, '-') END;

  -- ---------------------------------------------------------------------------
  -- 9. M sem o vínculo de U2 vê só U
  -- ---------------------------------------------------------------------------
  UPDATE public.usuario_unidades SET ativo = false
  WHERE usuario_id = v_m AND unidade_id = v_u2;
  v_j := NULL; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT to_jsonb(t) INTO v_j FROM public.resumo_desempenho_motorista(v_m, NULL) t;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_msg IS NULL AND (v_j->>'total_rotas')::numeric = 3 AND (v_j->>'distancia_total')::numeric = 15
    THEN ' | 9 OK: com o vínculo de U2 inativo, M vê só U'
    ELSE ' | 9 FALHOU: ' || COALESCE(v_j::text, '-') || ' erro=' || COALESCE(v_msg, '-') END;

  -- ---------------------------------------------------------------------------
  -- 10. M0 sem rotas: zeros
  -- ---------------------------------------------------------------------------
  v_j := NULL; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m0, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT to_jsonb(t) INTO v_j FROM public.resumo_desempenho_motorista(v_m0, 30) t;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_msg IS NULL AND (v_j->>'total_rotas')::numeric = 0 AND (v_j->>'distancia_total')::numeric = 0
      AND (v_j->>'total_paradas')::numeric = 0 AND (v_j->>'entregas_em_rotas_concluidas')::numeric = 0
    THEN ' | 10 OK: sem rotas, uma linha de zeros'
    ELSE ' | 10 FALHOU: ' || COALESCE(v_j::text, '-') || ' erro=' || COALESCE(v_msg, '-') END;

  -- ---------------------------------------------------------------------------
  -- 11. p_dias negativo
  -- ---------------------------------------------------------------------------
  v_state := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT to_jsonb(t) INTO v_j FROM public.resumo_desempenho_motorista(v_m, -1) t;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_state = '22023' THEN ' | 11 OK: p_dias negativo recusado (22023)'
    ELSE ' | 11 FALHOU: state=' || COALESCE(v_state, '-') END;

  -- ---------------------------------------------------------------------------
  -- 12. grants e configuração
  -- ---------------------------------------------------------------------------
  -- to_regprocedure: sem a função (antes da migration) dá FALHOU, não erro.
  IF to_regprocedure('public.resumo_desempenho_motorista(uuid,integer)') IS NULL THEN
    r := r || ' | 12 FALHOU: a função não existe';
  ELSE
    r := r || CASE WHEN has_function_privilege('authenticated',
          'public.resumo_desempenho_motorista(uuid,integer)', 'EXECUTE')
        AND NOT has_function_privilege('anon',
          'public.resumo_desempenho_motorista(uuid,integer)', 'EXECUTE')
        AND (SELECT p.prosecdef AND p.proconfig = ARRAY['search_path=""']
             FROM pg_proc p
             WHERE p.oid = 'public.resumo_desempenho_motorista(uuid,integer)'::regprocedure)
      THEN ' | 12 OK: EXECUTE só para authenticated; DEFINER com search_path vazio'
      ELSE ' | 12 FALHOU: grants ou configuração' END;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 13. Review Focus 3: o motorista real de maior volume x COUNT direto
  -- ---------------------------------------------------------------------------
  SELECT ro.motorista_id INTO v_top
  FROM public.rotas ro
  WHERE ro.motorista_id IS NOT NULL
  GROUP BY ro.motorista_id
  ORDER BY count(*) DESC
  LIMIT 1;

  SELECT ro.unidade_id INTO v_top_loja
  FROM public.rotas ro WHERE ro.motorista_id = v_top
  GROUP BY ro.unidade_id ORDER BY count(*) DESC LIMIT 1;

  SELECT uu.usuario_id INTO v_top_gestor
  FROM public.usuario_unidades uu
  WHERE uu.unidade_id = v_top_loja AND uu.papel = 'gestor' AND uu.ativo
  ORDER BY uu.usuario_id LIMIT 1;

  -- COUNT direto, sem RPC (como postgres, sem RLS)
  SELECT count(*), count(*) FILTER (WHERE ro.status = 'concluida'),
         COALESCE(sum(ro.distancia_total), 0)
  INTO d_rotas, d_conc, d_km
  FROM public.rotas ro WHERE ro.motorista_id = v_top;

  SELECT count(*), count(*) FILTER (WHERE pa.status = 'concluida'),
         count(*) FILTER (WHERE pa.status = 'pulada'),
         count(*) FILTER (WHERE pa.status = 'concluida' AND ro.status = 'concluida')
  INTO d_par, d_pconc, d_pul, d_ent
  FROM public.paradas pa JOIN public.rotas ro ON ro.id = pa.rota_id
  WHERE ro.motorista_id = v_top AND pa.is_checkpoint IS DISTINCT FROM false;

  v_j := NULL; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_top, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT to_jsonb(t) INTO v_j FROM public.resumo_desempenho_motorista(v_top, NULL) t;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_msg IS NULL AND (v_j->>'total_rotas')::numeric = d_rotas AND (v_j->>'rotas_concluidas')::numeric = d_conc
      AND (v_j->>'distancia_total')::numeric = d_km AND (v_j->>'total_paradas')::numeric = d_par
      AND (v_j->>'paradas_concluidas')::numeric = d_pconc AND (v_j->>'paradas_puladas')::numeric = d_pul
      AND (v_j->>'entregas_em_rotas_concluidas')::numeric = d_ent
    THEN ' | 13a OK: maior volume, pelo próprio motorista: ' || d_rotas || ' rotas, '
         || d_par || ' paradas (sem partida/chegada), ' || d_pconc || ' concl., '
         || d_pul || ' puladas = COUNT direto'
    ELSE ' | 13a FALHOU: rpc=' || COALESCE(v_j::text, '-') || ' direto=' || d_rotas || '/'
         || d_conc || '/' || d_km || '/' || d_par || '/' || d_pconc || '/' || d_pul || '/' || d_ent
         || ' erro=' || COALESCE(v_msg, '-') END;

  IF v_top_gestor IS NULL THEN
    r := r || ' | 13b FALHOU: a loja do motorista de maior volume não tem gestor ativo';
  ELSE
    v_j := NULL; v_msg := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_top_gestor, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      SELECT to_jsonb(t) INTO v_j FROM public.resumo_desempenho_motorista(v_top, NULL) t;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
    END;
    RESET ROLE;
    -- O motorista de maior volume roda numa loja só (24/10: 393 rotas em uma);
    -- se um dia rodar em duas, o gestor de uma vê menos — o caso 3 cobre isso.
    r := r || CASE WHEN v_msg IS NULL AND (v_j->>'total_rotas')::numeric = d_rotas
        AND (v_j->>'total_paradas')::numeric = d_par AND (v_j->>'paradas_concluidas')::numeric = d_pconc
      THEN ' | 13b OK: pelo gestor da loja, os mesmos totais'
      ELSE ' | 13b FALHOU: rpc=' || COALESCE(v_j::text, '-')
           || ' direto=' || d_rotas || '/' || d_par || '/' || d_pconc
           || ' erro=' || COALESCE(v_msg, '-') END;
  END IF;

  RAISE EXCEPTION 'SONDA M55 (desfeita):%', r;
END
$$;
