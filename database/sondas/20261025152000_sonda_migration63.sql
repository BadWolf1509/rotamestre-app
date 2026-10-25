-- ============================================================================
-- Sonda transacional da Migration 63 (log na rota pelo gestor da loja ou pelo
-- motorista da própria rota)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 63 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os casos 1, 1b, 7 e
-- 10 saem FALHOU (é o vermelho esperado).
--
-- Cenário comum (não depende de dado real): lojas A e B; motorista M, ativo
-- em A, com a rota RM; motorista C, colega ativo em A; gestor GA, gestor
-- ativo de A; gestor GB, gestor ativo só de B; motorista D, com vínculo ativo
-- em A mas desativado como pessoa (`usuarios.ativo = false`), com a rota RD;
-- motorista E, com o vínculo em A inativo, com a rota RE. Cada caso grava o
-- PRÓPRIO log e não depende do resultado de outro. As consultas rodam como
-- `authenticated` (SET LOCAL ROLE + claims do JWT). O bloco termina SEMPRE em
-- RAISE EXCEPTION, que desfaz tudo. Leia o resultado na mensagem
-- "SONDA M63 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. C grava log na rota RM (de M): recusado pela policy
--   1b. pode_registrar_log_na_rota(RM) responde false para C
--   2. M grava log na própria rota RM
--   3. GA grava log na rota RM
--   4. GB (gestor de outra loja) grava log na rota RM: recusado
--   5. D (pessoa desativada) grava log na própria rota RD: recusado
--   6. E (vínculo inativo) grava log na própria rota RE: recusado
--   7. C aciona SOS citando RM: o SOS grava, sem rota e com rota_recusada
--   8. M aciona SOS na própria rota RM: o SOS grava com a rota
--   9. C grava log sem rota
--  10. catálogo: função com a exigência da própria rota, DEFINER,
--      `search_path` vazio, dono postgres, EXECUTE para authenticated e não
--      para anon
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_m uuid := gen_random_uuid();      -- motorista de A, dono de RM
  v_c uuid := gen_random_uuid();      -- colega de A
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_gb uuid := gen_random_uuid();     -- gestor só de B
  v_d uuid := gen_random_uuid();      -- motorista desativado como pessoa
  v_e uuid := gen_random_uuid();      -- motorista com vínculo inativo
  v_rm uuid := gen_random_uuid();     -- rota de M em A
  v_rd uuid := gen_random_uuid();     -- rota de D em A
  v_re uuid := gen_random_uuid();     -- rota de E em A
  v_n int;
  v_bool boolean;
  v_rota uuid;
  v_txt text;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,  'sonda-m63-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_c,  'sonda-m63-c-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga, 'sonda-m63-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m63-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_d,  'sonda-m63-d-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_e,  'sonda-m63-e-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M63 A', 'Sonda'),
    (v_ub, 'Sonda M63 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m,  'Sonda motorista M', 'sonda-m63-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_c,  'Sonda motorista C', 'sonda-m63-c-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_ga, 'Sonda gestor A',    'sonda-m63-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gb, 'Sonda gestor B',    'sonda-m63-gb-' || v_sufixo || '@example.invalid', 'gestor',    v_ub, true),
    (v_d,  'Sonda motorista D', 'sonda-m63-d-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, false),
    (v_e,  'Sonda motorista E', 'sonda-m63-e-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,  v_ua, 'motorista', true,  true),
    (v_c,  v_ua, 'motorista', true,  true),
    (v_ga, v_ua, 'gestor',    true,  true),
    (v_gb, v_ub, 'gestor',    true,  true),
    (v_d,  v_ua, 'motorista', true,  true),
    (v_e,  v_ua, 'motorista', true,  true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_rm, v_ua, v_m, 'em_andamento'),
    (v_rd, v_ua, v_d, 'em_andamento'),
    (v_re, v_ua, v_e, 'em_andamento');

  -- O vínculo de E só fica inativo depois de a rota existir: o gatilho
  -- `trg_validar_motorista_e_loja_da_rota` exige vínculo ativo para criar a
  -- rota (e não dispara neste UPDATE de usuario_unidades).
  UPDATE public.usuario_unidades SET ativo = false
   WHERE usuario_id = v_e AND unidade_id = v_ua;

  -- ---------------------------------------------------------------------------
  -- 1. C grava log na rota RM (de M)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
      VALUES (v_c, v_rm, 'sonda_m63_caso_1', '{}'::jsonb);
    r := r || ' | 1 FALHOU: colega gravou log na rota de outro motorista';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE '%row-level security%'
      THEN ' | 1 OK: colega da loja não grava log na rota de outro motorista'
      ELSE ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- 1b. a função responde false para C
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_bool := public.pode_registrar_log_na_rota(v_rm);
  RESET ROLE;
  r := r || CASE WHEN v_bool IS FALSE
    THEN ' | 1b OK: pode_registrar_log_na_rota(RM) = false para o colega'
    ELSE ' | 1b FALHOU: pode_registrar_log_na_rota(RM) = ' || COALESCE(v_bool::text, 'NULL') || ' para o colega' END;

  -- ---------------------------------------------------------------------------
  -- 2. M grava log na própria rota
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
      VALUES (v_m, v_rm, 'sonda_m63_caso_2', '{}'::jsonb);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 2 OK: o motorista grava log na própria rota'
      ELSE ' | 2 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. GA grava log na rota RM
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
      VALUES (v_ga, v_rm, 'sonda_m63_caso_3', '{}'::jsonb);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 3 OK: o gestor da loja grava log na rota'
      ELSE ' | 3 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. GB (gestor de outra loja) grava log na rota RM
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
      VALUES (v_gb, v_rm, 'sonda_m63_caso_4', '{}'::jsonb);
    r := r || ' | 4 FALHOU: gestor de outra loja gravou log na rota';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE '%row-level security%'
      THEN ' | 4 OK: gestor de outra loja não grava log na rota'
      ELSE ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. D (pessoa desativada) grava log na própria rota
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_d, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
      VALUES (v_d, v_rd, 'sonda_m63_caso_5', '{}'::jsonb);
    r := r || ' | 5 FALHOU: pessoa desativada gravou log na rota';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE '%row-level security%'
      THEN ' | 5 OK: pessoa desativada não grava log na própria rota'
      ELSE ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. E (vínculo inativo) grava log na própria rota
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_e, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
      VALUES (v_e, v_re, 'sonda_m63_caso_6', '{}'::jsonb);
    r := r || ' | 6 FALHOU: motorista com vínculo inativo gravou log na rota';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE '%row-level security%'
      THEN ' | 6 OK: vínculo inativo não grava log na própria rota'
      ELSE ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. C aciona SOS citando RM: grava sem rota, com rota_recusada
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.registrar_sos(jsonb_build_object('descricao', 'sonda m63 caso 7'), v_rm);
    RESET ROLE;
    SELECT count(*), max(rota_id::text)::uuid, bool_and((detalhes->>'rota_recusada')::boolean)::text
      INTO v_n, v_rota, v_txt
      FROM public.logs WHERE usuario_id = v_c AND evento = 'sos_acionado';
    r := r || CASE WHEN v_n = 1 AND v_rota IS NULL AND v_txt = 'true'
      THEN ' | 7 OK: SOS do colega grava, sem a rota alheia'
      ELSE ' | 7 FALHOU: logs ' || v_n || ', rota ' || COALESCE(v_rota::text, 'NULL') || ', recusada ' || COALESCE(v_txt, 'NULL') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: o SOS levantou (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. M aciona SOS na própria rota: grava com a rota
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.registrar_sos(jsonb_build_object('descricao', 'sonda m63 caso 8'), v_rm);
    RESET ROLE;
    SELECT count(*), max(rota_id::text)::uuid INTO v_n, v_rota
      FROM public.logs WHERE usuario_id = v_m AND evento = 'sos_acionado';
    r := r || CASE WHEN v_n = 1 AND v_rota = v_rm
      THEN ' | 8 OK: SOS do motorista grava com a própria rota'
      ELSE ' | 8 FALHOU: logs ' || v_n || ', rota ' || COALESCE(v_rota::text, 'NULL') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: o SOS levantou (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. C grava log sem rota
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
      VALUES (v_c, NULL, 'sonda_m63_caso_9', '{}'::jsonb);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 9 OK: log sem rota segue passando'
      ELSE ' | 9 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 10. catálogo
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT count(*) INTO v_n FROM pg_proc
   WHERE oid = 'public.pode_registrar_log_na_rota(uuid)'::regprocedure
     AND pg_get_userbyid(proowner) = 'postgres'
     AND prosecdef
     AND proconfig = ARRAY['search_path=""']
     AND prosrc LIKE '%r.motorista_id = auth.uid()%'
     AND has_function_privilege('authenticated', oid, 'EXECUTE')
     AND NOT has_function_privilege('anon', oid, 'EXECUTE');
  r := r || CASE WHEN v_n = 1
    THEN ' | 10 OK: função exige a própria rota; DEFINER, search_path vazio, dono postgres, EXECUTE só para authenticated'
    ELSE ' | 10 FALHOU: função fora do esperado' END;

  RAISE EXCEPTION 'SONDA M63 (desfeita):%', r;
END
$$;
