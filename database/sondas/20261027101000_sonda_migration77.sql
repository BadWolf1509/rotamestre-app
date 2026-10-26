-- ============================================================================
-- Sonda transacional da Migration 77 (gatilho `trg_parada_de_rota_encerrada_nao_muda`)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 77 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, saem FALHOU os casos
-- 1, 2, 3, 6 e 11 (o UPDATE é aceito) e o 10 (catálogo); os casos 4, 5, 7, 8 e 9
-- já saem OK — são os caminhos que precisam continuar valendo.
--
-- Cenário comum (não depende de dado real): loja A; motorista M, ativo em A;
-- gestor GA, gestor ativo de A. Cada caso monta a própria rota como postgres,
-- sem sessão, com partida (ordem 0) e chegada (última), as duas com
-- `is_checkpoint = false`. As escritas da API rodam como `authenticated`
-- (SET LOCAL ROLE + claims do JWT), com os corpos de UPDATE do app; a
-- conferência roda como postgres. Os avisos e pedidos de push dos gatilhos
-- são desfeitos junto. O bloco termina SEMPRE em RAISE EXCEPTION, que desfaz
-- tudo. Leia o resultado na mensagem "SONDA M77 (desfeita): ...". Esperado:
-- todas as linhas com OK.
--
--    1. M "Retomar" (`pulada → pendente`, corpo de `updateParadaStatus`) numa
--       rota `concluida` → P0001 PARADA_DE_ROTA_ENCERRADA; parada segue
--       `pulada`
--    2. M conclui pela fila offline (corpo de `atualizarSeAberta`) uma parada
--       de rota `cancelada` → P0001; parada segue `pendente`
--    3. GA reabre (`pulada → pendente`) parada de rota `nao_executada` por
--       UPDATE direto → P0001; parada segue `pulada`
--    4. M conclui pela fila (corpo de `atualizarSeAberta`) e avança a próxima
--       (`pendente → em_andamento`) numa rota `em_andamento` → 1 linha cada
--    5. finalização do app até a 1.14.2: M conclui a rota por UPDATE direto e
--       depois a chegada (`is_checkpoint = false`) → 1 linha; chegada
--       `concluida`
--    6. M conclui uma entrega `pendente` numa rota `concluida` → P0001 (a
--       exceção da chegada não se estende à entrega)
--    7. RPCs: `reativar_rota` (GA), `cancelar_rota` (GA) e `finalizar_rota`
--       (M) mudam as paradas como antes
--    8. sem sessão (postgres) e como `service_role`, parada de rota
--       `concluida` `pulada → pendente` → passa nos dois
--    9. GA muda o telefone e M regrava o mesmo status numa parada de rota
--       `concluida` → 1 linha cada
--   10. catálogo: gatilho BEFORE UPDATE OF status, por linha, habilitado;
--       função SECURITY INVOKER, search_path vazio, dono postgres, proacl sem
--       PUBLIC, anon e authenticated sem EXECUTE
--   11. M leva a chegada `pulada` a `concluida` numa rota `concluida` →
--       P0001; chegada segue `pulada` (a exceção do caso 5 vale só para a
--       chegada `pendente`/`em_andamento`)
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_m uuid := gen_random_uuid();      -- motorista de A
  v_ga uuid := gen_random_uuid();     -- gestor ativo de A
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_rota uuid;
  v_rota2 uuid;
  v_rota3 uuid;
  v_p uuid;                           -- a parada do caso
  v_p2 uuid;
  v_chegada uuid;
  v_fn regprocedure;
  v_res text;
  v_res2 text;
  v_err text;
  v_err2 text;
  v_status text;
  v_status2 text;
  v_status3 text;
  v_tel text;
  v_n int;
  v_n2 int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,  'sonda-m77-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga, 'sonda-m77-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M77 A', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m,  'Sonda motorista M', 'sonda-m77-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_ga, 'Sonda gestor A',    'sonda-m77-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,  v_ua, 'motorista', true, true),
    (v_ga, v_ua, 'gestor',    true, true);

  -- ---------------------------------------------------------------------------
  -- 1. M "Retomar" numa rota concluida
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_p := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em, concluida_em) VALUES
    (v_rota, v_ua, v_m, 'concluida', v_hoje, now() - interval '2 hours', now() - interval '5 minutes');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, motivo_skip) VALUES
    (gen_random_uuid(), v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false, NULL),
    (v_p,               v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pulada',    true,  'cliente_ausente'),
    (gen_random_uuid(), v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'concluida', false, NULL);
  BEGIN
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.paradas SET status = 'pendente' WHERE id = v_p;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RESET ROLE;
      v_err := 'UPDATE aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.paradas WHERE id = v_p;
    r := r || CASE WHEN v_err = 'P0001 PARADA_DE_ROTA_ENCERRADA' AND v_status = 'pulada'
      THEN ' | 1 OK: motorista não reabre parada pulada de rota concluida (P0001 PARADA_DE_ROTA_ENCERRADA)'
      ELSE ' | 1 FALHOU: ' || coalesce(v_err, 'nulo') || ', parada ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2. M conclui pela fila offline uma parada de rota cancelada
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_p := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_rota, v_ua, v_m, 'cancelada', v_hoje, now() - interval '2 hours');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (gen_random_uuid(), v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false),
    (v_p,               v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente',  true),
    (gen_random_uuid(), v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente',  false);
  BEGIN
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.paradas
         SET status = 'concluida', concluida_em = now() - interval '30 minutes'
       WHERE id = v_p
         AND status IN ('pendente', 'em_andamento');
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RESET ROLE;
      v_err := 'UPDATE aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.paradas WHERE id = v_p;
    r := r || CASE WHEN v_err = 'P0001 PARADA_DE_ROTA_ENCERRADA' AND v_status = 'pendente'
      THEN ' | 2 OK: fila offline não conclui parada de rota cancelada (P0001)'
      ELSE ' | 2 FALHOU: ' || coalesce(v_err, 'nulo') || ', parada ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. GA reabre parada de rota nao_executada por UPDATE direto
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_p := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota, v_ua, v_m, 'nao_executada', v_hoje - 2);
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, motivo_skip) VALUES
    (v_p, v_rota, 'entrega', 'sonda p1', -7.1, -34.8, 1, 'pulada', true, 'cliente_ausente');
  BEGIN
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.paradas SET status = 'pendente', concluida_em = NULL WHERE id = v_p;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RESET ROLE;
      v_err := 'UPDATE aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.paradas WHERE id = v_p;
    r := r || CASE WHEN v_err = 'P0001 PARADA_DE_ROTA_ENCERRADA' AND v_status = 'pulada'
      THEN ' | 3 OK: gestor não reabre parada de rota nao_executada por UPDATE direto (P0001)'
      ELSE ' | 3 FALHOU: ' || coalesce(v_err, 'nulo') || ', parada ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. M conclui pela fila e avança a próxima numa rota em_andamento
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_p := gen_random_uuid();
  v_p2 := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_rota, v_ua, v_m, 'em_andamento', v_hoje, now() - interval '1 hour');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (gen_random_uuid(), v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida',    false),
    (v_p,               v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'em_andamento', true),
    (v_p2,              v_rota, 'entrega', 'sonda p2',      -7.1, -34.8, 2, 'pendente',     true),
    (gen_random_uuid(), v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 3, 'pendente',     false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas
       SET status = 'concluida', concluida_em = now()
     WHERE id = v_p
       AND status IN ('pendente', 'em_andamento');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    UPDATE public.paradas
       SET status = 'em_andamento'
     WHERE id = v_p2
       AND status = 'pendente';
    GET DIAGNOSTICS v_n2 = ROW_COUNT;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.paradas WHERE id = v_p;
    SELECT status INTO v_status2 FROM public.paradas WHERE id = v_p2;
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1 AND v_status = 'concluida' AND v_status2 = 'em_andamento'
      THEN ' | 4 OK: motorista conclui e avança a próxima em rota em_andamento, como o app'
      ELSE ' | 4 FALHOU: concluir ' || v_n || ' linha (' || coalesce(v_status, 'nula') || '), avançar '
           || v_n2 || ' linha (' || coalesce(v_status2, 'nula') || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. finalização do app até a 1.14.2: rota primeiro, chegada depois
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_chegada := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_rota, v_ua, v_m, 'em_andamento', v_hoje, now() - interval '1 hour');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (gen_random_uuid(), v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false),
    (gen_random_uuid(), v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'concluida', true),
    (v_chegada,         v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente',  false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.rotas SET status = 'concluida', concluida_em = now() WHERE id = v_rota;
    UPDATE public.paradas SET status = 'concluida', concluida_em = now() WHERE id = v_chegada;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.paradas WHERE id = v_chegada;
    r := r || CASE WHEN v_n = 1 AND v_status = 'concluida'
      THEN ' | 5 OK: chegada concluída depois da rota, como a finalização até a 1.14.2'
      ELSE ' | 5 FALHOU: ' || v_n || ' linha, chegada ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. M conclui uma entrega pendente numa rota concluida
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_p := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em, concluida_em) VALUES
    (v_rota, v_ua, v_m, 'concluida', v_hoje, now() - interval '2 hours', now() - interval '5 minutes');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_p, v_rota, 'entrega', 'sonda p1', -7.1, -34.8, 1, 'pendente', true);
  BEGIN
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.paradas SET status = 'concluida', concluida_em = now() WHERE id = v_p;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RESET ROLE;
      v_err := 'UPDATE aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.paradas WHERE id = v_p;
    r := r || CASE WHEN v_err = 'P0001 PARADA_DE_ROTA_ENCERRADA' AND v_status = 'pendente'
      THEN ' | 6 OK: entrega de rota concluida não é concluída depois (P0001)'
      ELSE ' | 6 FALHOU: ' || coalesce(v_err, 'nulo') || ', parada ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. RPCs: reativar_rota, cancelar_rota (GA) e finalizar_rota (M)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();   -- nao_executada, parada pulada
  v_rota2 := gen_random_uuid();  -- em_andamento, parada em_andamento
  v_rota3 := gen_random_uuid();  -- em_andamento, chegada pendente
  v_p := gen_random_uuid();
  v_p2 := gen_random_uuid();
  v_chegada := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_rota,  v_ua, v_m, 'nao_executada', v_hoje - 2, NULL),
    (v_rota2, v_ua, v_m, 'em_andamento',  v_hoje,     now() - interval '1 hour'),
    (v_rota3, v_ua, v_m, 'em_andamento',  v_hoje,     now() - interval '1 hour');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, motivo_skip, concluida_em) VALUES
    (v_p,               v_rota,  'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pulada',       true,  'cliente_ausente', NULL),
    (v_p2,              v_rota2, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'em_andamento', true,  NULL, NULL),
    (gen_random_uuid(), v_rota3, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida',    false, NULL, now() - interval '1 hour'),
    (gen_random_uuid(), v_rota3, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'concluida',    true,  NULL, now() - interval '10 minutes'),
    (v_chegada,         v_rota3, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente',     false, NULL, NULL);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_rota);
    v_res2 := public.cancelar_rota(v_rota2);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.finalizar_rota(v_rota3);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.paradas WHERE id = v_p;
    SELECT status INTO v_status2 FROM public.paradas WHERE id = v_p2;
    SELECT status INTO v_status3 FROM public.paradas WHERE id = v_chegada;
    r := r || CASE WHEN v_res = 'reativada' AND v_status = 'pendente'
                    AND v_res2 = 'cancelada' AND v_status2 = 'pendente'
                    AND v_status3 = 'concluida'
      THEN ' | 7 OK: reativar_rota, cancelar_rota e finalizar_rota mudam as paradas como antes'
      ELSE ' | 7 FALHOU: reativar ' || coalesce(v_res, 'nulo') || ' / ' || coalesce(v_status, 'nula')
           || ', cancelar ' || coalesce(v_res2, 'nulo') || ' / ' || coalesce(v_status2, 'nula')
           || ', finalizar chegada ' || coalesce(v_status3, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. sem sessão (postgres) e service_role: pulada → pendente em rota concluida
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_p := gen_random_uuid();
  v_p2 := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, concluida_em) VALUES
    (v_rota, v_ua, v_m, 'concluida', v_hoje, now() - interval '1 hour');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, motivo_skip) VALUES
    (v_p,  v_rota, 'entrega', 'sonda p1', -7.1, -34.8, 1, 'pulada', true, 'cliente_ausente'),
    (v_p2, v_rota, 'entrega', 'sonda p2', -7.1, -34.8, 2, 'pulada', true, 'cliente_ausente');
  BEGIN
    v_err := NULL;
    v_err2 := NULL;
    BEGIN
      UPDATE public.paradas SET status = 'pendente' WHERE id = v_p;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_err := 'aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    BEGIN
      SET LOCAL ROLE service_role;
      UPDATE public.paradas SET status = 'pendente' WHERE id = v_p2;
      GET DIAGNOSTICS v_n2 = ROW_COUNT;
      RESET ROLE;
      v_err2 := 'aceito (' || v_n2 || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err2 := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    SELECT status INTO v_status FROM public.paradas WHERE id = v_p;
    SELECT status INTO v_status2 FROM public.paradas WHERE id = v_p2;
    r := r || CASE WHEN v_err = 'aceito (1 linha)' AND v_err2 = 'aceito (1 linha)'
                    AND v_status = 'pendente' AND v_status2 = 'pendente'
      THEN ' | 8 OK: sem sessão (postgres) e service_role mudam parada de rota concluida'
      ELSE ' | 8 FALHOU: postgres ' || coalesce(v_err, 'nulo') || ' / ' || coalesce(v_status, 'nula')
           || ', service_role ' || coalesce(v_err2, 'nulo') || ' / ' || coalesce(v_status2, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. GA muda o telefone e M regrava o mesmo status em rota concluida
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_p := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, concluida_em) VALUES
    (v_rota, v_ua, v_m, 'concluida', v_hoje, now() - interval '1 hour');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, concluida_em) VALUES
    (v_p, v_rota, 'entrega', 'sonda p1', -7.1, -34.8, 1, 'concluida', true, now() - interval '2 hours');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET telefone = '83999990000' WHERE id = v_p;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET status = 'concluida' WHERE id = v_p;
    GET DIAGNOSTICS v_n2 = ROW_COUNT;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status, telefone INTO v_status, v_tel FROM public.paradas WHERE id = v_p;
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1 AND v_status = 'concluida' AND v_tel = '83999990000'
      THEN ' | 9 OK: outra coluna e o mesmo status seguem em parada de rota concluida'
      ELSE ' | 9 FALHOU: telefone ' || v_n || ' linha, mesmo status ' || v_n2 || ' linha, parada '
           || coalesce(v_status, 'nula') || ' / ' || coalesce(v_tel, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 10. catálogo do gatilho e da função (lido sem abortar quando não existem)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    v_fn := to_regprocedure('public.parada_de_rota_encerrada_nao_muda()');
    IF v_fn IS NULL THEN
      r := r || ' | 10 FALHOU: public.parada_de_rota_encerrada_nao_muda() não existe';
    ELSE
      -- tgtype: ROW = 1, BEFORE = 2, UPDATE = 16; tgattr = só a coluna status.
      SELECT count(*) INTO v_n
        FROM pg_trigger t
       WHERE t.tgrelid = 'public.paradas'::regclass
         AND t.tgname = 'trg_parada_de_rota_encerrada_nao_muda'
         AND t.tgfoid = v_fn
         AND t.tgenabled = 'O'
         AND t.tgtype & 19 = 19
         AND array_length(t.tgattr::int2[], 1) = 1
         AND (SELECT a.attnum FROM pg_attribute a
               WHERE a.attrelid = 'public.paradas'::regclass
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
        THEN ' | 10 OK: gatilho BEFORE UPDATE OF status por linha habilitado; função INVOKER, search_path vazio, dono postgres, sem EXECUTE de PUBLIC, anon e authenticated'
        ELSE ' | 10 FALHOU: gatilho no esperado ' || v_n || ', função no esperado ' || v_n2
             || ' (' || coalesce((SELECT p.proacl::text FROM pg_proc p WHERE p.oid = v_fn), 'proacl nulo') || ')' END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 10 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 11. M leva a chegada pulada a concluida numa rota concluida
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_chegada := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em, concluida_em) VALUES
    (v_rota, v_ua, v_m, 'concluida', v_hoje, now() - interval '2 hours', now() - interval '5 minutes');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, motivo_skip) VALUES
    (gen_random_uuid(), v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false, NULL),
    (gen_random_uuid(), v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'concluida', true,  NULL),
    (v_chegada,         v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pulada',    false, 'cliente_ausente');
  BEGIN
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.paradas SET status = 'concluida', concluida_em = now() WHERE id = v_chegada;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RESET ROLE;
      v_err := 'UPDATE aceito (' || v_n || ' linha)';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.paradas WHERE id = v_chegada;
    r := r || CASE WHEN v_err = 'P0001 PARADA_DE_ROTA_ENCERRADA' AND v_status = 'pulada'
      THEN ' | 11 OK: chegada pulada não vira concluida em rota concluida (P0001; a exceção vale só para chegada aberta)'
      ELSE ' | 11 FALHOU: ' || coalesce(v_err, 'nulo') || ', chegada ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 11 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  RAISE EXCEPTION 'SONDA M77 (desfeita):%', r;
END
$$;
