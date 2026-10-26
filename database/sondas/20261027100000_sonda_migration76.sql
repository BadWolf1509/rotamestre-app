-- ============================================================================
-- Sonda transacional da Migration 76 (gatilho `trg_rotas_loja_e_status_pelo_gestor`)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 76 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, saem FALHOU os casos
-- 1, 4 e 5 (o UPDATE é aceito), o 2 e o 11 (o RLS recusa, mas com a mensagem
-- da policy, não a do gatilho) e o 10 (catálogo); os casos 3, 6, 7, 8 e 9 já
-- saem OK — são os caminhos que precisam continuar valendo.
--
-- Cenário comum (não depende de dado real): lojas A e B; motorista M com
-- vínculo ativo de motorista nas duas; gestor GA, gestor ativo só de A;
-- gestor GAB, gestor ativo de A e de B; gestor GX, gestor ativo de A e com
-- vínculo de gestor INATIVO em B. Cada caso monta a própria rota como
-- postgres, sem sessão, com partida (ordem 0) e chegada (última), as duas com
-- `is_checkpoint = false`. As escritas da API rodam como `authenticated`
-- (SET LOCAL ROLE + claims do JWT), com os corpos de UPDATE do app; a
-- conferência roda como postgres. O bloco termina SEMPRE em RAISE EXCEPTION,
-- que desfaz tudo. Leia o resultado na mensagem "SONDA M76 (desfeita): ...".
-- Esperado: todas as linhas com OK.
--
--    1. M muda `unidade_id` da própria rota de A para B → 42501 com a
--       mensagem do gatilho; rota segue em A
--    2. GA (gestor só de A) muda a rota de A para B → 42501 com a mensagem do
--       gatilho; rota segue em A
--    3. GAB (gestor das duas) muda a rota de A para B → 1 linha; rota em B
--    4. M leva a própria rota `pendente → cancelada` → P0001
--       ROTA_TRANSICAO_RECUSADA; rota segue `pendente`
--    5. M leva a própria rota `em_andamento → nao_executada` → P0001
--       ROTA_TRANSICAO_RECUSADA; rota segue `em_andamento`
--    6. M inicia `pendente → em_andamento` com o corpo de `startRoute` → 1
--       linha; rota `em_andamento`
--    7. M conclui `em_andamento → concluida` por UPDATE direto (a
--       finalização do app até a 1.14.2) → 1 linha; rota `concluida`
--    8. RPCs: M finaliza pela `finalizar_rota` e GA cancela pela
--       `cancelar_rota` → rotas `concluida` e `cancelada`
--    9. sem sessão (postgres) e como `service_role`: loja A → B e
--       `pendente → cancelada` → passam nos dois
--   10. catálogo: gatilho BEFORE UPDATE OF unidade_id, status, por linha,
--       habilitado; função DEFINER, search_path vazio, dono postgres, proacl
--       sem PUBLIC, anon e authenticated sem EXECUTE
--   11. GX (vínculo de gestor inativo em B) muda a rota de A para B → 42501
--       com a mensagem do gatilho; rota segue em A
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_m uuid := gen_random_uuid();      -- motorista em A e B
  v_ga uuid := gen_random_uuid();     -- gestor só de A
  v_gab uuid := gen_random_uuid();    -- gestor de A e de B
  v_gx uuid := gen_random_uuid();     -- gestor ativo em A, inativo em B
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_rota uuid;
  v_rota2 uuid;
  v_fn regprocedure;
  v_res text;
  v_err text;
  v_err2 text;
  v_status text;
  v_status2 text;
  v_loja uuid;
  v_loja2 uuid;
  v_n int;
  v_n2 int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,   'sonda-m76-m-'   || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga,  'sonda-m76-ga-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gab, 'sonda-m76-gab-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gx,  'sonda-m76-gx-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M76 A', 'Sonda'),
    (v_ub, 'Sonda M76 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m,   'Sonda motorista M', 'sonda-m76-m-'   || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_ga,  'Sonda gestor A',    'sonda-m76-ga-'  || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gab, 'Sonda gestor AB',   'sonda-m76-gab-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gx,  'Sonda gestor AX',   'sonda-m76-gx-'  || v_sufixo || '@example.invalid', 'gestor',    v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,   v_ua, 'motorista', true, true),
    (v_m,   v_ub, 'motorista', true, false),
    (v_ga,  v_ua, 'gestor',    true, true),
    (v_gab, v_ua, 'gestor',    true, true),
    (v_gab, v_ub, 'gestor',    true, false),
    (v_gx,  v_ua, 'gestor',    true, true),
    (v_gx,  v_ub, 'gestor',    false, false);

  -- ---------------------------------------------------------------------------
  -- 1. M: unidade_id da própria rota de A para B
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota, v_ua, v_m, 'pendente', v_hoje);
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente', true),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente', false);
  BEGIN
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.rotas SET unidade_id = v_ub WHERE id = v_rota;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RESET ROLE;
      v_err := 'UPDATE aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT unidade_id INTO v_loja FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_err = '42501 A rota só muda de loja pelo gestor das duas lojas.' AND v_loja = v_ua
      THEN ' | 1 OK: motorista com vínculo nas duas lojas não muda a loja da rota (42501)'
      ELSE ' | 1 FALHOU: ' || coalesce(v_err, 'nulo') || ', rota na loja ' || CASE WHEN v_loja = v_ua THEN 'A' WHEN v_loja = v_ub THEN 'B' ELSE 'nula' END END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2. GA (gestor só de A): rota de A para B
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota, v_ua, v_m, 'pendente', v_hoje);
  BEGIN
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.rotas SET unidade_id = v_ub WHERE id = v_rota;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RESET ROLE;
      v_err := 'UPDATE aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT unidade_id INTO v_loja FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_err = '42501 A rota só muda de loja pelo gestor das duas lojas.' AND v_loja = v_ua
      THEN ' | 2 OK: gestor só da loja de origem não muda a loja da rota (42501 do gatilho)'
      ELSE ' | 2 FALHOU: ' || coalesce(v_err, 'nulo') || ', rota na loja ' || CASE WHEN v_loja = v_ua THEN 'A' WHEN v_loja = v_ub THEN 'B' ELSE 'nula' END END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. GAB (gestor das duas lojas): rota de A para B
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota, v_ua, v_m, 'pendente', v_hoje);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gab, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.rotas SET unidade_id = v_ub WHERE id = v_rota;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT unidade_id INTO v_loja FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_n = 1 AND v_loja = v_ub
      THEN ' | 3 OK: gestor das duas lojas muda a rota de A para B'
      ELSE ' | 3 FALHOU: ' || v_n || ' linha, rota na loja ' || CASE WHEN v_loja = v_ua THEN 'A' WHEN v_loja = v_ub THEN 'B' ELSE 'nula' END END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. M: pendente → cancelada na própria rota
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota, v_ua, v_m, 'pendente', v_hoje);
  BEGIN
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.rotas SET status = 'cancelada' WHERE id = v_rota;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RESET ROLE;
      v_err := 'UPDATE aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_err = 'P0001 ROTA_TRANSICAO_RECUSADA' AND v_status = 'pendente'
      THEN ' | 4 OK: motorista não cancela a própria rota (P0001 ROTA_TRANSICAO_RECUSADA)'
      ELSE ' | 4 FALHOU: ' || coalesce(v_err, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. M: em_andamento → nao_executada na própria rota
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_rota, v_ua, v_m, 'em_andamento', v_hoje, now() - interval '1 hour');
  BEGIN
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.rotas SET status = 'nao_executada' WHERE id = v_rota;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RESET ROLE;
      v_err := 'UPDATE aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_err = 'P0001 ROTA_TRANSICAO_RECUSADA' AND v_status = 'em_andamento'
      THEN ' | 5 OK: motorista não leva a própria rota a nao_executada (P0001 ROTA_TRANSICAO_RECUSADA)'
      ELSE ' | 5 FALHOU: ' || coalesce(v_err, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. M inicia pendente → em_andamento (corpo de startRoute)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota, v_ua, v_m, 'pendente', v_hoje);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.rotas
       SET status = 'em_andamento', iniciada_em = now()
     WHERE id = v_rota
       AND status = 'pendente'
       AND motorista_id = v_m;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_n = 1 AND v_status = 'em_andamento'
      THEN ' | 6 OK: motorista inicia a rota pendente por UPDATE direto, como o app'
      ELSE ' | 6 FALHOU: ' || v_n || ' linha, rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. M conclui em_andamento → concluida por UPDATE direto (app até a 1.14.2)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_rota, v_ua, v_m, 'em_andamento', v_hoje, now() - interval '1 hour');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.rotas
       SET status = 'concluida', concluida_em = now()
     WHERE id = v_rota;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_n = 1 AND v_status = 'concluida'
      THEN ' | 7 OK: motorista conclui por UPDATE direto, como o app até a 1.14.2'
      ELSE ' | 7 FALHOU: ' || v_n || ' linha, rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. RPCs: M finaliza (finalizar_rota) e GA cancela (cancelar_rota)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_rota2 := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_rota,  v_ua, v_m, 'em_andamento', v_hoje, now() - interval '1 hour'),
    (v_rota2, v_ua, v_m, 'pendente',     v_hoje, NULL);
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, concluida_em) VALUES
    (v_rota,  'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false, now() - interval '1 hour'),
    (v_rota,  'entrega', 'sonda p1',      -7.1, -34.8, 1, 'concluida', true,  now() - interval '10 minutes'),
    (v_rota,  'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente',  false, NULL),
    (v_rota2, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente',  false, NULL),
    (v_rota2, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente',  true,  NULL),
    (v_rota2, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente',  false, NULL);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.finalizar_rota(v_rota);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_rota2);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    SELECT status INTO v_status2 FROM public.rotas WHERE id = v_rota2;
    r := r || CASE WHEN v_status = 'concluida' AND v_res = 'cancelada' AND v_status2 = 'cancelada'
      THEN ' | 8 OK: finalizar_rota (motorista) e cancelar_rota (gestor) seguem'
      ELSE ' | 8 FALHOU: finalizar → ' || coalesce(v_status, 'nula') || ', cancelar → '
           || coalesce(v_res, 'nulo') || ' / ' || coalesce(v_status2, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. sem sessão (postgres) e service_role: loja e status
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_rota2 := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota,  v_ua, v_m, 'pendente', v_hoje),
    (v_rota2, v_ua, v_m, 'pendente', v_hoje);
  BEGIN
    v_err := NULL;
    v_err2 := NULL;
    BEGIN
      UPDATE public.rotas SET unidade_id = v_ub, status = 'cancelada' WHERE id = v_rota;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_err := 'aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    BEGIN
      SET LOCAL ROLE service_role;
      UPDATE public.rotas SET unidade_id = v_ub, status = 'cancelada' WHERE id = v_rota2;
      GET DIAGNOSTICS v_n2 = ROW_COUNT;
      RESET ROLE;
      v_err2 := 'aceito (' || v_n2 || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err2 := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    SELECT status, unidade_id INTO v_status, v_loja FROM public.rotas WHERE id = v_rota;
    SELECT status, unidade_id INTO v_status2, v_loja2 FROM public.rotas WHERE id = v_rota2;
    r := r || CASE WHEN v_err = 'aceito (1 linha)' AND v_err2 = 'aceito (1 linha)'
                    AND v_status = 'cancelada' AND v_status2 = 'cancelada'
                    AND v_loja = v_ub AND v_loja2 = v_ub
      THEN ' | 9 OK: sem sessão (postgres) e service_role mudam loja e status'
      ELSE ' | 9 FALHOU: postgres ' || coalesce(v_err, 'nulo') || ' / ' || coalesce(v_status, 'nula')
           || ', service_role ' || coalesce(v_err2, 'nulo') || ' / ' || coalesce(v_status2, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 10. catálogo do gatilho e da função (lido sem abortar quando não existem)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    v_fn := to_regprocedure('public.rotas_loja_e_status_pelo_gestor()');
    IF v_fn IS NULL THEN
      r := r || ' | 10 FALHOU: public.rotas_loja_e_status_pelo_gestor() não existe';
    ELSE
      -- tgtype: ROW = 1, BEFORE = 2, UPDATE = 16; tgattr = unidade_id e status.
      SELECT count(*) INTO v_n
        FROM pg_trigger t
       WHERE t.tgrelid = 'public.rotas'::regclass
         AND t.tgname = 'trg_rotas_loja_e_status_pelo_gestor'
         AND t.tgfoid = v_fn
         AND t.tgenabled = 'O'
         AND t.tgtype & 19 = 19
         AND array_length(t.tgattr::int2[], 1) = 2
         AND (SELECT a.attnum FROM pg_attribute a
               WHERE a.attrelid = 'public.rotas'::regclass
                 AND a.attname = 'status') = ANY (t.tgattr::int2[])
         AND (SELECT a.attnum FROM pg_attribute a
               WHERE a.attrelid = 'public.rotas'::regclass
                 AND a.attname = 'unidade_id') = ANY (t.tgattr::int2[]);
      SELECT count(*) INTO v_n2
        FROM pg_proc p
       WHERE p.oid = v_fn
         AND p.prosecdef
         AND p.proconfig = ARRAY['search_path=""']
         AND pg_get_userbyid(p.proowner) = 'postgres'
         AND p.proacl IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
         AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
         AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE');
      r := r || CASE WHEN v_n = 1 AND v_n2 = 1
        THEN ' | 10 OK: gatilho BEFORE UPDATE OF unidade_id, status por linha habilitado; função DEFINER, search_path vazio, dono postgres, sem EXECUTE de PUBLIC, anon e authenticated'
        ELSE ' | 10 FALHOU: gatilho no esperado ' || v_n || ', função no esperado ' || v_n2
             || ' (' || coalesce((SELECT p.proacl::text FROM pg_proc p WHERE p.oid = v_fn), 'proacl nulo') || ')' END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 10 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 11. GX (vínculo de gestor inativo em B): rota de A para B
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota, v_ua, v_m, 'pendente', v_hoje);
  BEGIN
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gx, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.rotas SET unidade_id = v_ub WHERE id = v_rota;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RESET ROLE;
      v_err := 'UPDATE aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT unidade_id INTO v_loja FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_err = '42501 A rota só muda de loja pelo gestor das duas lojas.' AND v_loja = v_ua
      THEN ' | 11 OK: gestor com vínculo inativo na loja de destino não muda a loja da rota (42501 do gatilho)'
      ELSE ' | 11 FALHOU: ' || coalesce(v_err, 'nulo') || ', rota na loja ' || CASE WHEN v_loja = v_ua THEN 'A' WHEN v_loja = v_ub THEN 'B' ELSE 'nula' END END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 11 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  RAISE EXCEPTION 'SONDA M76 (desfeita):%', r;
END
$$;
