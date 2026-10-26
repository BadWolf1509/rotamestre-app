-- ============================================================================
-- Sonda transacional da Migration 75 (gatilho `trg_rota_encerrada_nao_volta`)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 75 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, saem FALHOU os casos
-- 1, 2 e 3 (o UPDATE direto é aceito) e o 10 (catálogo); os casos 4 a 9 já
-- saem OK — são os caminhos que precisam continuar valendo.
--
-- Cenário comum (não depende de dado real): loja A; motorista M, ativo em A;
-- gestor GA, gestor ativo de A. Cada caso monta a própria rota como postgres,
-- sem sessão, com partida (ordem 0) e chegada (última), as duas com
-- `is_checkpoint = false`. As escritas da API rodam como `authenticated`
-- (SET LOCAL ROLE + claims do JWT), com os corpos de UPDATE do app; a
-- conferência roda como postgres. Os avisos e pedidos de push dos gatilhos
-- de `rotas` e `paradas` são desfeitos junto. O bloco termina SEMPRE em
-- RAISE EXCEPTION, que desfaz tudo. Leia o resultado na mensagem
-- "SONDA M75 (desfeita): ...". Esperado: todas as linhas com OK.
--
--    1. M tenta `concluida → em_andamento` na própria rota (UPDATE direto)
--       → P0001 ROTA_ENCERRADA; rota segue `concluida`
--    2. M tenta `cancelada → em_andamento` → P0001 ROTA_ENCERRADA; rota segue
--       `cancelada`
--    3. GA tenta `nao_executada → pendente` por UPDATE direto (o corpo do
--       gestor 1.14.7) → P0001 ROTA_ENCERRADA; rota segue `nao_executada`
--    4. GA reativa pela RPC `reativar_rota` → 'reativada'; rota `pendente`
--    5. GA cancela pela RPC `cancelar_rota` (rota `pendente`) → 'cancelada';
--       rota `cancelada`
--    6. M finaliza pela RPC `finalizar_rota` (rota `em_andamento`) → rota
--       `concluida`
--    7. M inicia `pendente → em_andamento` por UPDATE direto, com o corpo de
--       `startRoute` → 1 linha; rota `em_andamento`
--    8. sem sessão (postgres, como o CLI) e como `service_role` (a chave
--       secreta das Edge Functions), `concluida → pendente` → passa nos dois
--    9. GA muda `distancia_total` e regrava o mesmo status numa rota
--       `concluida` → 1 linha cada; rota `concluida` com a distância nova
--   10. catálogo: gatilho BEFORE UPDATE OF status, por linha, habilitado;
--       função SECURITY INVOKER, search_path vazio, dono postgres, proacl sem
--       PUBLIC, anon sem EXECUTE
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_m uuid := gen_random_uuid();      -- motorista de A
  v_ga uuid := gen_random_uuid();     -- gestor ativo de A
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_rota uuid;                        -- a rota do caso
  v_rota2 uuid;                       -- segunda rota do caso 8
  v_fn regprocedure;
  v_res text;
  v_err text;
  v_err2 text;
  v_status text;
  v_status2 text;
  v_dist numeric;
  v_n int;
  v_n2 int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,  'sonda-m75-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga, 'sonda-m75-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M75 A', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m,  'Sonda motorista M', 'sonda-m75-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_ga, 'Sonda gestor A',    'sonda-m75-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,  v_ua, 'motorista', true, true),
    (v_ga, v_ua, 'gestor',    true, true);

  -- ---------------------------------------------------------------------------
  -- 1. M: concluida → em_andamento por UPDATE direto
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em, concluida_em) VALUES
    (v_rota, v_ua, v_m, 'concluida', v_hoje, now() - interval '2 hours', now() - interval '1 hour');
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'concluida', true),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'concluida', false);
  BEGIN
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.rotas
         SET status = 'em_andamento', iniciada_em = now(), concluida_em = NULL
       WHERE id = v_rota;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RESET ROLE;
      v_err := 'UPDATE aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_err = 'P0001 ROTA_ENCERRADA' AND v_status = 'concluida'
      THEN ' | 1 OK: motorista não devolve rota concluida a em_andamento (P0001 ROTA_ENCERRADA)'
      ELSE ' | 1 FALHOU: ' || coalesce(v_err, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2. M: cancelada → em_andamento por UPDATE direto
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota, v_ua, v_m, 'cancelada', v_hoje);
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente', true),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente', false);
  BEGIN
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.rotas
         SET status = 'em_andamento', iniciada_em = now()
       WHERE id = v_rota;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RESET ROLE;
      v_err := 'UPDATE aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_err = 'P0001 ROTA_ENCERRADA' AND v_status = 'cancelada'
      THEN ' | 2 OK: motorista não devolve rota cancelada a em_andamento (P0001 ROTA_ENCERRADA)'
      ELSE ' | 2 FALHOU: ' || coalesce(v_err, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. GA: nao_executada → pendente por UPDATE direto (corpo do gestor 1.14.7)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota, v_ua, v_m, 'nao_executada', v_hoje - 3);
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente', true),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente', false);
  BEGIN
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.rotas
         SET status = 'pendente', data = v_hoje, iniciada_em = NULL, concluida_em = NULL
       WHERE id = v_rota
         AND status = 'nao_executada';
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RESET ROLE;
      v_err := 'UPDATE aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_err = 'P0001 ROTA_ENCERRADA' AND v_status = 'nao_executada'
      THEN ' | 3 OK: gestor não reativa por UPDATE direto (P0001 ROTA_ENCERRADA)'
      ELSE ' | 3 FALHOU: ' || coalesce(v_err, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. GA reativa pela RPC reativar_rota
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota, v_ua, v_m, 'nao_executada', v_hoje - 3);
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pulada',    true),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente',  false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_rota);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_res = 'reativada' AND v_status = 'pendente'
      THEN ' | 4 OK: gestor reativa pela RPC reativar_rota (nao_executada → pendente)'
      ELSE ' | 4 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. GA cancela pela RPC cancelar_rota (rota pendente)
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
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_rota);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_res = 'cancelada' AND v_status = 'cancelada'
      THEN ' | 5 OK: gestor cancela pela RPC cancelar_rota (pendente → cancelada)'
      ELSE ' | 5 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. M finaliza pela RPC finalizar_rota (rota em_andamento)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_rota, v_ua, v_m, 'em_andamento', v_hoje, now() - interval '1 hour');
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, concluida_em) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false, now() - interval '1 hour'),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'concluida', true,  now() - interval '10 minutes'),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente',  false, NULL);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.finalizar_rota(v_rota);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_status = 'concluida'
      THEN ' | 6 OK: motorista finaliza pela RPC finalizar_rota (em_andamento → concluida)'
      ELSE ' | 6 FALHOU: rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. M inicia pendente → em_andamento por UPDATE direto (corpo de startRoute)
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
      THEN ' | 7 OK: motorista inicia a rota pendente por UPDATE direto, como o app'
      ELSE ' | 7 FALHOU: ' || v_n || ' linha, rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. sem sessão (postgres) e service_role: concluida → pendente
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_rota2 := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, concluida_em) VALUES
    (v_rota,  v_ua, v_m, 'concluida', v_hoje, now() - interval '1 hour'),
    (v_rota2, v_ua, v_m, 'concluida', v_hoje, now() - interval '1 hour');
  BEGIN
    v_err := NULL;
    v_err2 := NULL;
    BEGIN
      UPDATE public.rotas SET status = 'pendente', concluida_em = NULL WHERE id = v_rota;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_err := 'aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    BEGIN
      SET LOCAL ROLE service_role;
      UPDATE public.rotas SET status = 'pendente', concluida_em = NULL WHERE id = v_rota2;
      GET DIAGNOSTICS v_n2 = ROW_COUNT;
      RESET ROLE;
      v_err2 := 'aceito (' || v_n2 || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err2 := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    SELECT status INTO v_status2 FROM public.rotas WHERE id = v_rota2;
    r := r || CASE WHEN v_err = 'aceito (1 linha)' AND v_err2 = 'aceito (1 linha)'
                    AND v_status = 'pendente' AND v_status2 = 'pendente'
      THEN ' | 8 OK: sem sessão (postgres) e service_role mudam concluida → pendente'
      ELSE ' | 8 FALHOU: postgres ' || coalesce(v_err, 'nulo') || ' / ' || coalesce(v_status, 'nula')
           || ', service_role ' || coalesce(v_err2, 'nulo') || ' / ' || coalesce(v_status2, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. GA muda outra coluna e regrava o mesmo status numa rota concluida
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, concluida_em) VALUES
    (v_rota, v_ua, v_m, 'concluida', v_hoje, now() - interval '1 hour');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.rotas SET distancia_total = 12.3 WHERE id = v_rota;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    UPDATE public.rotas SET status = 'concluida' WHERE id = v_rota;
    GET DIAGNOSTICS v_n2 = ROW_COUNT;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status, distancia_total INTO v_status, v_dist FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1 AND v_status = 'concluida' AND v_dist = 12.3
      THEN ' | 9 OK: gestor muda distancia_total e regrava o mesmo status em rota concluida'
      ELSE ' | 9 FALHOU: distância ' || v_n || ' linha, mesmo status ' || v_n2 || ' linha, rota '
           || coalesce(v_status, 'nula') || ' / ' || coalesce(v_dist::text, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 10. catálogo do gatilho e da função (lido sem abortar quando não existem)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    v_fn := to_regprocedure('public.rota_encerrada_nao_volta()');
    IF v_fn IS NULL THEN
      r := r || ' | 10 FALHOU: public.rota_encerrada_nao_volta() não existe';
    ELSE
      -- tgtype: ROW = 1, BEFORE = 2, UPDATE = 16; tgattr = só a coluna status.
      SELECT count(*) INTO v_n
        FROM pg_trigger t
       WHERE t.tgrelid = 'public.rotas'::regclass
         AND t.tgname = 'trg_rota_encerrada_nao_volta'
         AND t.tgfoid = v_fn
         AND t.tgenabled = 'O'
         AND t.tgtype & 19 = 19
         -- int2vector vira array com índice inicial 0: compara por pertença
         -- e tamanho, não por igualdade de arrays (que exige o mesmo índice).
         AND array_length(t.tgattr::int2[], 1) = 1
         AND (SELECT a.attnum FROM pg_attribute a
               WHERE a.attrelid = 'public.rotas'::regclass
                 AND a.attname = 'status') = ANY (t.tgattr::int2[]);
      SELECT count(*) INTO v_n2
        FROM pg_proc p
       WHERE p.oid = v_fn
         AND NOT p.prosecdef
         AND p.proconfig = ARRAY['search_path=""']
         AND pg_get_userbyid(p.proowner) = 'postgres'
         AND p.proacl IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
         AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
         AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE');
      r := r || CASE WHEN v_n = 1 AND v_n2 = 1
        THEN ' | 10 OK: gatilho BEFORE UPDATE OF status por linha habilitado; função INVOKER, search_path vazio, dono postgres, sem EXECUTE de PUBLIC e anon'
        ELSE ' | 10 FALHOU: gatilho no esperado ' || v_n || ', função no esperado ' || v_n2
             || ' (' || coalesce((SELECT p.proacl::text FROM pg_proc p WHERE p.oid = v_fn), 'proacl nulo') || ')' END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 10 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  RAISE EXCEPTION 'SONDA M75 (desfeita):%', r;
END
$$;
