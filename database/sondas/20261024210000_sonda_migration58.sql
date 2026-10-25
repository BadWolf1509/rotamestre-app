-- ============================================================================
-- Sonda transacional da Migration 58 (parada só muda de rota pelo gestor das
-- lojas das duas rotas)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 58 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os casos 1, 1b, 2 e
-- 2b saem FALHOU (é o vermelho esperado); no caso 2d o RLS de
-- `paradas_update` também recusa, com outra mensagem, e ele sai FALHOU (só a
-- mensagem do gatilho conta como OK).
--
-- Cenário comum (não depende de dado real): lojas A e B; motorista M com
-- vínculo ativo nas duas; gestor GA, gestor ativo de A e motorista ativo de
-- B; gestor GAB, gestor ativo de A e de B; gestor GX, gestor ativo de A e com
-- vínculo de gestor INATIVO em B. Cada caso monta as PRÓPRIAS rotas e paradas
-- (como postgres, sem sessão) e não depende do resultado de outro caso. As
-- consultas rodam como `authenticated` (SET LOCAL ROLE + claims do JWT). O
-- bloco termina SEMPRE em RAISE EXCEPTION, que desfaz tudo. Leia o resultado
-- na mensagem "SONDA M58 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. motorista M (vínculo ativo em A e B): não move a parada da rota dele
--      em A para a rota dele em B; a parada continua na rota de origem
--   2. gestor GA (gestor só de A, motorista em B): não move a parada para a
--      rota que ele dirige em B; a parada continua na rota de origem
--   2c. gestor GA: move a parada entre duas rotas da loja A
--   2d. gestor GX (vínculo de gestor inativo em B): não move para B
--   3. gestor GAB (gestor ativo das duas lojas): move a parada para B
--   4. RPCs: `inserir_parada` (gestor GA) e `reordenar_paradas`
--      (motorista M) continuam com success = true e gravam
--   5. motorista M: UPDATE comum (status, concluida_em e foto) passa
--   6. motorista M: SET com a mesma rota (rota_id = rota atual) passa
--   7. sem sessão (chave secreta, jobs): a troca de rota passa
--   8. catálogo: gatilho habilitado; função com dono postgres, DEFINER,
--      `search_path` vazio e sem EXECUTE para anon/authenticated
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_m uuid := gen_random_uuid();      -- motorista em A e B
  v_ga uuid := gen_random_uuid();     -- gestor de A, motorista em B
  v_gab uuid := gen_random_uuid();    -- gestor de A e de B
  v_gx uuid := gen_random_uuid();     -- gestor ativo em A, inativo em B
  v_ra uuid;                          -- rota de origem em A (por caso)
  v_dest uuid;                        -- rota de destino (por caso)
  v_pm uuid;                          -- a parada do caso
  v_p1 uuid;
  v_p2 uuid;
  v_res jsonb;
  v_n int;
  v_rota uuid;
  v_o1 int;
  v_o2 int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,   'sonda-m58-m-'   || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga,  'sonda-m58-ga-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gab, 'sonda-m58-gab-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gx,  'sonda-m58-gx-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M58 A', 'Sonda'),
    (v_ub, 'Sonda M58 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m,   'Sonda motorista', 'sonda-m58-m-'   || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_ga,  'Sonda gestor A',  'sonda-m58-ga-'  || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gab, 'Sonda gestor AB', 'sonda-m58-gab-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gx,  'Sonda gestor AX', 'sonda-m58-gx-'  || v_sufixo || '@example.invalid', 'gestor',    v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,   v_ua, 'motorista', true,  true),
    (v_m,   v_ub, 'motorista', true,  false),
    (v_ga,  v_ua, 'gestor',    true,  true),
    (v_ga,  v_ub, 'motorista', true,  false),
    (v_gab, v_ua, 'gestor',    true,  true),
    (v_gab, v_ub, 'gestor',    true,  false),
    (v_gx,  v_ua, 'gestor',    true,  true),
    (v_gx,  v_ub, 'gestor',    false, false);

  -- ---------------------------------------------------------------------------
  -- 1. motorista M: não move a parada da loja A para a rota dele na loja B
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_dest := gen_random_uuid(); v_pm := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra,   v_ua, v_m, 'em_andamento'),
    (v_dest, v_ub, v_m, 'em_andamento');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint)
    VALUES (v_pm, v_ra, 'entrega', 'Sonda caso 1', -7.1, -34.8, 1, 'pendente', true);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET rota_id = v_dest WHERE id = v_pm;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 1 FALHOU: motorista mudou a parada de rota (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE 'A parada só muda de rota%'
      THEN ' | 1 OK: motorista com vínculo nas duas lojas não muda a parada de rota'
      ELSE ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;
  SELECT rota_id INTO v_rota FROM public.paradas WHERE id = v_pm;
  r := r || CASE WHEN v_rota = v_ra
    THEN ' | 1b OK: a parada do motorista continua na rota de origem'
    ELSE ' | 1b FALHOU: a parada do motorista saiu da rota de origem' END;

  -- ---------------------------------------------------------------------------
  -- 2. gestor só de A (motorista em B): não move a parada para a rota dele em B
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_dest := gen_random_uuid(); v_pm := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra,   v_ua, v_m,  'em_andamento'),
    (v_dest, v_ub, v_ga, 'em_andamento');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint)
    VALUES (v_pm, v_ra, 'entrega', 'Sonda caso 2', -7.1, -34.8, 1, 'pendente', true);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET rota_id = v_dest WHERE id = v_pm;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 2 FALHOU: gestor de uma loja só mudou a parada de rota (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE 'A parada só muda de rota%'
      THEN ' | 2 OK: gestor de uma loja só não muda a parada para outra loja'
      ELSE ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;
  SELECT rota_id INTO v_rota FROM public.paradas WHERE id = v_pm;
  r := r || CASE WHEN v_rota = v_ra
    THEN ' | 2b OK: a parada continua na rota de origem'
    ELSE ' | 2b FALHOU: a parada saiu da rota de origem' END;

  -- ---------------------------------------------------------------------------
  -- 2c. gestor só de A: move a parada entre duas rotas da loja A
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_dest := gen_random_uuid(); v_pm := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra,   v_ua, v_m, 'em_andamento'),
    (v_dest, v_ua, v_m, 'em_andamento');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint)
    VALUES (v_pm, v_ra, 'entrega', 'Sonda caso 2c', -7.1, -34.8, 1, 'pendente', true);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET rota_id = v_dest WHERE id = v_pm;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    SELECT rota_id INTO v_rota FROM public.paradas WHERE id = v_pm;
    r := r || CASE WHEN v_n = 1 AND v_rota = v_dest
      THEN ' | 2c OK: gestor da loja move a parada entre rotas da mesma loja'
      ELSE ' | 2c FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2c FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2d. gestor com vínculo de gestor inativo em B: não move para B
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_dest := gen_random_uuid(); v_pm := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra,   v_ua, v_m, 'em_andamento'),
    (v_dest, v_ub, v_m, 'em_andamento');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint)
    VALUES (v_pm, v_ra, 'entrega', 'Sonda caso 2d', -7.1, -34.8, 1, 'pendente', true);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gx, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET rota_id = v_dest WHERE id = v_pm;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 2d FALHOU: gestor com vínculo inativo no destino mudou a parada de rota (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE 'A parada só muda de rota%'
      THEN ' | 2d OK: vínculo de gestor inativo no destino não basta'
      ELSE ' | 2d FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. gestor ativo das duas lojas: move
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_dest := gen_random_uuid(); v_pm := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra,   v_ua, v_m, 'em_andamento'),
    (v_dest, v_ub, v_m, 'em_andamento');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint)
    VALUES (v_pm, v_ra, 'entrega', 'Sonda caso 3', -7.1, -34.8, 1, 'pendente', true);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gab, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET rota_id = v_dest WHERE id = v_pm;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    SELECT rota_id INTO v_rota FROM public.paradas WHERE id = v_pm;
    r := r || CASE WHEN v_n = 1 AND v_rota = v_dest
      THEN ' | 3 OK: gestor das duas lojas muda a parada de rota'
      ELSE ' | 3 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4a. inserir_parada (gestor GA numa rota própria do caso)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (gen_random_uuid(), v_ra, 'retirada', 'Sonda partida', -7.1, -34.8, 0, 'concluida', false),
    (gen_random_uuid(), v_ra, 'entrega',  'Sonda 1',       -7.1, -34.8, 1, 'pendente',  true),
    (gen_random_uuid(), v_ra, 'entrega',  'Sonda chegada', -7.1, -34.8, 2, 'pendente',  false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.inserir_parada(v_ra, 'entrega', 'Sonda nova', -7.1, -34.8);
    RESET ROLE;
    SELECT count(*) INTO v_n FROM public.paradas WHERE rota_id = v_ra AND endereco = 'Sonda nova';
    r := r || CASE WHEN (v_res->>'success')::boolean AND v_n = 1
      THEN ' | 4a OK: inserir_parada continua funcionando'
      ELSE ' | 4a FALHOU: ' || coalesce(v_res::text, 'sem retorno') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4a FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4b. reordenar_paradas (motorista M numa rota própria do caso)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_p1 := gen_random_uuid(); v_p2 := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (gen_random_uuid(), v_ra, 'retirada', 'Sonda partida', -7.1, -34.8, 0, 'concluida', false),
    (v_p1,              v_ra, 'entrega',  'Sonda 1',       -7.1, -34.8, 1, 'pendente',  true),
    (v_p2,              v_ra, 'entrega',  'Sonda 2',       -7.1, -34.8, 2, 'pendente',  true),
    (gen_random_uuid(), v_ra, 'entrega',  'Sonda chegada', -7.1, -34.8, 3, 'pendente',  false);
  BEGIN
    SELECT ordem INTO v_o1 FROM public.paradas WHERE id = v_p1;
    SELECT ordem INTO v_o2 FROM public.paradas WHERE id = v_p2;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reordenar_paradas(ARRAY[v_p1, v_p2], ARRAY[v_o2, v_o1]);
    RESET ROLE;
    SELECT count(*) INTO v_n FROM public.paradas
     WHERE (id = v_p1 AND ordem = v_o2) OR (id = v_p2 AND ordem = v_o1);
    r := r || CASE WHEN (v_res->>'success')::boolean AND v_n = 2
      THEN ' | 4b OK: reordenar_paradas continua funcionando'
      ELSE ' | 4b FALHOU: ' || coalesce(v_res::text, 'sem retorno') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4b FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. motorista M: UPDATE comum (status, concluida_em, foto) passa
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_pm := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint)
    VALUES (v_pm, v_ra, 'entrega', 'Sonda caso 5', -7.1, -34.8, 1, 'pendente', true);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas
       SET status = 'concluida', concluida_em = now(),
           foto_url = v_ua || '/' || v_ra || '/' || v_pm || '_1.jpg'
     WHERE id = v_pm;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 5 OK: motorista conclui a parada com foto'
      ELSE ' | 5 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. motorista M: SET com a mesma rota passa (a cláusula WHEN não dispara)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_pm := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint)
    VALUES (v_pm, v_ra, 'entrega', 'Sonda caso 6', -7.1, -34.8, 1, 'pendente', true);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET rota_id = v_ra, status = 'em_andamento' WHERE id = v_pm;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 6 OK: SET com a mesma rota passa'
      ELSE ' | 6 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. sem sessão: a troca de rota passa
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_dest := gen_random_uuid(); v_pm := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra,   v_ua, v_m, 'em_andamento'),
    (v_dest, v_ub, v_m, 'em_andamento');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint)
    VALUES (v_pm, v_ra, 'entrega', 'Sonda caso 7', -7.1, -34.8, 1, 'pendente', true);
  BEGIN
    UPDATE public.paradas SET rota_id = v_dest WHERE id = v_pm;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 7 OK: sem sessão a troca de rota passa'
      ELSE ' | 7 FALHOU: sem sessão gravou ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 8. catálogo
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_n
    FROM pg_trigger t
   WHERE t.tgrelid = 'public.paradas'::regclass
     AND t.tgname = 'trg_paradas_troca_de_rota_pelo_gestor'
     AND t.tgenabled = 'O';
  r := r || CASE WHEN v_n = 1
    THEN ' | 8a OK: gatilho habilitado'
    ELSE ' | 8a FALHOU: gatilho ausente ou desabilitado' END;

  SELECT count(*) INTO v_n FROM pg_proc
   WHERE proname = 'paradas_troca_de_rota_pelo_gestor'
     AND pronamespace = 'public'::regnamespace
     AND pg_get_userbyid(proowner) = 'postgres'
     AND prosecdef
     AND proconfig = ARRAY['search_path=""']
     AND NOT has_function_privilege('anon', oid, 'EXECUTE')
     AND NOT has_function_privilege('authenticated', oid, 'EXECUTE');
  r := r || CASE WHEN v_n = 1
    THEN ' | 8b OK: função com dono postgres, DEFINER, search_path vazio, sem EXECUTE para anon/authenticated'
    ELSE ' | 8b FALHOU: função fora do esperado' END;

  RAISE EXCEPTION 'SONDA M58 (desfeita):%', r;
END
$$;
