-- ============================================================================
-- Sonda transacional da Migration 48 (logs, posições e logs de push pela loja
-- da rota)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 48 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas.
--
-- O bloco monta um cenário próprio (não depende de dado real): lojas A, B e
-- C, um gestor em cada, e um motorista com vínculo ativo em A e em B, com uma
-- rota em cada loja. O motorista grava as próprias posições e logs nas duas
-- rotas como `authenticated`; o resto do cenário entra como postgres. Depois
-- as leituras rodam como `authenticated` (SET LOCAL ROLE + claims do JWT), e o
-- bloco termina SEMPRE em RAISE EXCEPTION, que desfaz tudo — inclusive as
-- notificações que os gatilhos criarem e a fila do pg_net, que só é lida
-- depois do commit. Não tem DELETE. Leia o resultado na mensagem
-- "SONDA M48 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. motorista grava posição e log (com RETURNING) nas rotas de A e de B
--   2. gestor de A: lê posição, log e log de push das rotas de A; não lê os
--      das rotas de B (nem o log sem autor da rota de B)
--   3. gestor de B: o espelho do item 2
--   4. motorista: lê as próprias posições e os próprios logs das duas lojas
--      (e o log sem rota); não lê log de outro autor nem log de push
--   5. linhas sem rota: o log sem rota do motorista só ele lê (nenhum dos dois
--      gestores); o log de gestão sem rota do gestor de A só ele lê; o log de
--      push de notificação sem rota nenhum gestor lê
--   6. gestor de C (loja sem o motorista) não lê nada do cenário
--   7. anon não lê nada; helper sem EXECUTE para anon, com EXECUTE para
--      authenticated
--   8. gestor com vínculo desativado em A não lê nada das rotas de A
--   9. motorista colega (só em A, com rota própria): não lê posição nem log
--      do outro motorista; não grava posição na rota do outro (recusado pela
--      policy); grava posição na própria rota
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_uc uuid := gen_random_uuid();     -- loja C (sem o motorista)
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_gb uuid := gen_random_uuid();     -- gestor de B
  v_gc uuid := gen_random_uuid();     -- gestor de C
  v_m uuid := gen_random_uuid();      -- motorista de A e de B
  v_ga_off uuid := gen_random_uuid(); -- gestor com vínculo desativado em A
  v_m2 uuid := gen_random_uuid();     -- motorista colega, só em A
  v_rota_a uuid := gen_random_uuid();
  v_rota_b uuid := gen_random_uuid();
  v_rota_m2 uuid := gen_random_uuid(); -- rota do colega, em A
  v_loc_m2 uuid := gen_random_uuid();
  -- posições e logs gravados pelo motorista
  v_loc_a uuid := gen_random_uuid();
  v_loc_b uuid := gen_random_uuid();
  v_log_a uuid := gen_random_uuid();
  v_log_b uuid := gen_random_uuid();
  v_log_m_sem uuid := gen_random_uuid();   -- log do motorista sem rota
  -- logs gravados como postgres
  v_log_b_sis uuid := gen_random_uuid();   -- log sem autor na rota de B
  v_log_ga_sem uuid := gen_random_uuid();  -- log de gestão sem rota (gestor A)
  -- notificações e logs de push
  v_n_ga uuid := gen_random_uuid();        -- para o gestor A, rota de A
  v_n_gb uuid := gen_random_uuid();        -- para o gestor B, rota de B
  v_n_m_a uuid := gen_random_uuid();       -- para o motorista, rota de A
  v_n_m_b uuid := gen_random_uuid();       -- para o motorista, rota de B
  v_n_m_sem uuid := gen_random_uuid();     -- para o motorista, sem rota
  v_p_ga uuid := gen_random_uuid();
  v_p_gb uuid := gen_random_uuid();
  v_p_m_a uuid := gen_random_uuid();
  v_p_m_b uuid := gen_random_uuid();
  v_p_m_sem uuid := gen_random_uuid();
  v_ret uuid;
  v_n int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres, antes de trocar de papel)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_ga, 'sonda-m48-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m48-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gc, 'sonda-m48-gc-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m,  'sonda-m48-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga_off, 'sonda-m48-gaoff-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m2, 'sonda-m48-m2-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M48 A', 'Sonda'),
    (v_ub, 'Sonda M48 B', 'Sonda'),
    (v_uc, 'Sonda M48 C', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id) VALUES
    (v_ga, 'Sonda gestor A', 'sonda-m48-ga-' || v_sufixo || '@example.invalid', 'gestor', v_ua),
    (v_gb, 'Sonda gestor B', 'sonda-m48-gb-' || v_sufixo || '@example.invalid', 'gestor', v_ub),
    (v_gc, 'Sonda gestor C', 'sonda-m48-gc-' || v_sufixo || '@example.invalid', 'gestor', v_uc),
    (v_m,  'Sonda motorista', 'sonda-m48-m-' || v_sufixo || '@example.invalid', 'motorista', v_ua),
    (v_ga_off, 'Sonda gestor A desativado', 'sonda-m48-gaoff-' || v_sufixo || '@example.invalid', 'gestor', v_ua),
    (v_m2, 'Sonda motorista colega', 'sonda-m48-m2-' || v_sufixo || '@example.invalid', 'motorista', v_ua);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_ga, v_ua, 'gestor', true, true),
    (v_gb, v_ub, 'gestor', true, true),
    (v_gc, v_uc, 'gestor', true, true),
    (v_m,  v_ua, 'motorista', true, true),
    (v_m,  v_ub, 'motorista', true, false),
    (v_ga_off, v_ua, 'gestor', false, true),
    (v_m2, v_ua, 'motorista', true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id) VALUES
    (v_rota_a, v_ua, v_m),
    (v_rota_b, v_ub, v_m),
    (v_rota_m2, v_ua, v_m2);

  -- Eventos distintos: o gatilho prevent_duplicate_log descarta em silêncio
  -- o log igual (rota, evento, autor, parada) dos últimos 5 s.
  INSERT INTO public.logs (id, usuario_id, rota_id, evento, detalhes) VALUES
    (v_log_b_sis,  NULL, v_rota_b, 'sonda_m48_sistema_b', '{}'::jsonb),
    (v_log_ga_sem, v_ga, NULL,     'sonda_m48_gestao_ga', '{}'::jsonb);

  INSERT INTO public.notificacoes (id, usuario_id, tipo, titulo, mensagem, rota_id) VALUES
    (v_n_ga,    v_ga, 'sonda_m48', 'sonda', 'sonda m48', v_rota_a),
    (v_n_gb,    v_gb, 'sonda_m48', 'sonda', 'sonda m48', v_rota_b),
    (v_n_m_a,   v_m,  'sonda_m48', 'sonda', 'sonda m48', v_rota_a),
    (v_n_m_b,   v_m,  'sonda_m48', 'sonda', 'sonda m48', v_rota_b),
    (v_n_m_sem, v_m,  'sonda_m48', 'sonda', 'sonda m48', NULL);

  INSERT INTO public.push_notification_logs (id, notificacao_id, usuario_id, status) VALUES
    (v_p_ga,    v_n_ga,    v_ga, 'sonda'),
    (v_p_gb,    v_n_gb,    v_gb, 'sonda'),
    (v_p_m_a,   v_n_m_a,   v_m,  'sonda'),
    (v_p_m_b,   v_n_m_b,   v_m,  'sonda'),
    (v_p_m_sem, v_n_m_sem, v_m,  'sonda');

  -- ---------------------------------------------------------------------------
  -- 1. motorista grava nas duas lojas
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    INSERT INTO public.motorista_locations (id, motorista_id, rota_id, latitude, longitude, fonte) VALUES
      (v_loc_a, v_m, v_rota_a, -7.1, -34.8, 'sonda'),
      (v_loc_b, v_m, v_rota_b, -7.2, -34.9, 'sonda');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 2
      THEN ' | 1a OK: motorista grava posição nas rotas de A e de B (2)'
      ELSE ' | 1a FALHOU: motorista gravou ' || v_n || ' de 2 posições' END;

    -- RETURNING exige que a linha nova passe na policy de SELECT (é o que o
    -- registro de foto sem vínculo faz em src/lib/storage.ts).
    INSERT INTO public.logs (id, usuario_id, rota_id, evento, detalhes)
      VALUES (v_log_a, v_m, v_rota_a, 'sonda_m48_motorista_a', '{}'::jsonb)
      RETURNING id INTO v_ret;
    r := r || CASE WHEN v_ret = v_log_a
      THEN ' | 1b OK: motorista grava log na rota de A e o lê de volta'
      ELSE ' | 1b FALHOU: log na rota de A não voltou (' || coalesce(v_ret::text, 'NULL') || ')' END;

    v_ret := NULL;
    INSERT INTO public.logs (id, usuario_id, rota_id, evento, detalhes)
      VALUES (v_log_b, v_m, v_rota_b, 'sonda_m48_motorista_b', '{}'::jsonb)
      RETURNING id INTO v_ret;
    r := r || CASE WHEN v_ret = v_log_b
      THEN ' | 1c OK: motorista grava log na rota de B e o lê de volta'
      ELSE ' | 1c FALHOU: log na rota de B não voltou (' || coalesce(v_ret::text, 'NULL') || ')' END;

    v_ret := NULL;
    INSERT INTO public.logs (id, usuario_id, rota_id, evento, detalhes)
      VALUES (v_log_m_sem, v_m, NULL, 'sonda_m48_motorista_sem_rota', '{}'::jsonb)
      RETURNING id INTO v_ret;
    r := r || CASE WHEN v_ret = v_log_m_sem
      THEN ' | 1d OK: motorista grava log sem rota e o lê de volta'
      ELSE ' | 1d FALHOU: log sem rota não voltou (' || coalesce(v_ret::text, 'NULL') || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2. gestor de A
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO v_n FROM public.motorista_locations WHERE id = v_loc_a;
    r := r || CASE WHEN v_n = 1
      THEN ' | 2a OK: gestor de A lê a posição da rota de A (1)'
      ELSE ' | 2a FALHOU: gestor de A não lê a posição da rota de A (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.motorista_locations WHERE id = v_loc_b;
    r := r || CASE WHEN v_n = 0
      THEN ' | 2b OK: gestor de A não lê a posição da rota de B (0)'
      ELSE ' | 2b FALHOU: gestor de A lê a posição da rota de B (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.logs WHERE id = v_log_a;
    r := r || CASE WHEN v_n = 1
      THEN ' | 2c OK: gestor de A lê o log da rota de A (1)'
      ELSE ' | 2c FALHOU: gestor de A não lê o log da rota de A (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.logs WHERE id IN (v_log_b, v_log_b_sis);
    r := r || CASE WHEN v_n = 0
      THEN ' | 2d OK: gestor de A não lê os logs da rota de B (0)'
      ELSE ' | 2d FALHOU: gestor de A lê ' || v_n || ' log(s) da rota de B' END;

    SELECT count(*) INTO v_n FROM public.push_notification_logs WHERE id IN (v_p_ga, v_p_m_a);
    r := r || CASE WHEN v_n = 2
      THEN ' | 2e OK: gestor de A lê os logs de push da rota de A (2)'
      ELSE ' | 2e FALHOU: gestor de A lê ' || v_n || ' de 2 logs de push da rota de A' END;

    SELECT count(*) INTO v_n FROM public.push_notification_logs WHERE id IN (v_p_gb, v_p_m_b);
    r := r || CASE WHEN v_n = 0
      THEN ' | 2f OK: gestor de A não lê os logs de push da rota de B (0)'
      ELSE ' | 2f FALHOU: gestor de A lê ' || v_n || ' log(s) de push da rota de B' END;

    -- a consulta que o mapa do gestor faz (rota_id + última posição)
    SELECT count(*) INTO v_n FROM (
      SELECT 1 FROM public.motorista_locations
       WHERE rota_id = v_rota_b ORDER BY "timestamp" DESC LIMIT 1) x;
    r := r || CASE WHEN v_n = 0
      THEN ' | 2g OK: a última posição da rota de B vem vazia para o gestor de A (0)'
      ELSE ' | 2g FALHOU: gestor de A obtém a última posição da rota de B (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. gestor de B
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO v_n FROM public.motorista_locations WHERE id = v_loc_b;
    r := r || CASE WHEN v_n = 1
      THEN ' | 3a OK: gestor de B lê a posição da rota de B (1)'
      ELSE ' | 3a FALHOU: gestor de B não lê a posição da rota de B (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.motorista_locations WHERE id = v_loc_a;
    r := r || CASE WHEN v_n = 0
      THEN ' | 3b OK: gestor de B não lê a posição da rota de A (0)'
      ELSE ' | 3b FALHOU: gestor de B lê a posição da rota de A (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.logs WHERE id IN (v_log_b, v_log_b_sis);
    r := r || CASE WHEN v_n = 2
      THEN ' | 3c OK: gestor de B lê os dois logs da rota de B, inclusive o sem autor (2)'
      ELSE ' | 3c FALHOU: gestor de B lê ' || v_n || ' de 2 logs da rota de B' END;

    SELECT count(*) INTO v_n FROM public.logs WHERE id = v_log_a;
    r := r || CASE WHEN v_n = 0
      THEN ' | 3d OK: gestor de B não lê o log da rota de A (0)'
      ELSE ' | 3d FALHOU: gestor de B lê o log da rota de A (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.push_notification_logs WHERE id IN (v_p_gb, v_p_m_b);
    r := r || CASE WHEN v_n = 2
      THEN ' | 3e OK: gestor de B lê os logs de push da rota de B (2)'
      ELSE ' | 3e FALHOU: gestor de B lê ' || v_n || ' de 2 logs de push da rota de B' END;

    SELECT count(*) INTO v_n FROM public.push_notification_logs WHERE id IN (v_p_ga, v_p_m_a);
    r := r || CASE WHEN v_n = 0
      THEN ' | 3f OK: gestor de B não lê os logs de push da rota de A (0)'
      ELSE ' | 3f FALHOU: gestor de B lê ' || v_n || ' log(s) de push da rota de A' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. motorista lê o que é seu
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO v_n FROM public.motorista_locations WHERE id IN (v_loc_a, v_loc_b);
    r := r || CASE WHEN v_n = 2
      THEN ' | 4a OK: motorista lê as próprias posições das duas lojas (2)'
      ELSE ' | 4a FALHOU: motorista lê ' || v_n || ' de 2 posições' END;

    SELECT count(*) INTO v_n FROM public.logs WHERE id IN (v_log_a, v_log_b, v_log_m_sem);
    r := r || CASE WHEN v_n = 3
      THEN ' | 4b OK: motorista lê os próprios logs das duas lojas e o sem rota (3)'
      ELSE ' | 4b FALHOU: motorista lê ' || v_n || ' de 3 logs' END;

    SELECT count(*) INTO v_n FROM public.logs WHERE id IN (v_log_b_sis, v_log_ga_sem);
    r := r || CASE WHEN v_n = 0
      THEN ' | 4c OK: motorista não lê log de outro autor (0)'
      ELSE ' | 4c FALHOU: motorista lê ' || v_n || ' log(s) de outro autor' END;

    SELECT count(*) INTO v_n FROM public.push_notification_logs WHERE id IN (v_p_m_a, v_p_m_b, v_p_m_sem);
    r := r || CASE WHEN v_n = 0
      THEN ' | 4d OK: motorista não lê log de push (0)'
      ELSE ' | 4d FALHOU: motorista lê ' || v_n || ' log(s) de push' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. linhas sem rota
  -- ---------------------------------------------------------------------------
  BEGIN
    SET LOCAL ROLE authenticated;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO v_n FROM public.logs WHERE id = v_log_m_sem;
    r := r || CASE WHEN v_n = 0
      THEN ' | 5a OK: gestor de A não lê o log sem rota do motorista (0)'
      ELSE ' | 5a FALHOU: gestor de A lê o log sem rota do motorista (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.logs WHERE id = v_log_ga_sem;
    r := r || CASE WHEN v_n = 1
      THEN ' | 5b OK: gestor de A lê o próprio log de gestão sem rota (1)'
      ELSE ' | 5b FALHOU: gestor de A não lê o próprio log sem rota (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.push_notification_logs WHERE id = v_p_m_sem;
    r := r || CASE WHEN v_n = 0
      THEN ' | 5c OK: gestor de A não lê log de push sem rota (0)'
      ELSE ' | 5c FALHOU: gestor de A lê log de push sem rota (' || v_n || ')' END;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO v_n FROM public.logs WHERE id IN (v_log_m_sem, v_log_ga_sem);
    r := r || CASE WHEN v_n = 0
      THEN ' | 5d OK: gestor de B não lê nenhum dos logs sem rota (0)'
      ELSE ' | 5d FALHOU: gestor de B lê ' || v_n || ' log(s) sem rota' END;

    SELECT count(*) INTO v_n FROM public.push_notification_logs WHERE id = v_p_m_sem;
    r := r || CASE WHEN v_n = 0
      THEN ' | 5e OK: gestor de B não lê log de push sem rota (0)'
      ELSE ' | 5e FALHOU: gestor de B lê log de push sem rota (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. gestor de C
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gc, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT (SELECT count(*) FROM public.motorista_locations WHERE id IN (v_loc_a, v_loc_b))
         + (SELECT count(*) FROM public.logs
             WHERE id IN (v_log_a, v_log_b, v_log_m_sem, v_log_b_sis, v_log_ga_sem))
         + (SELECT count(*) FROM public.push_notification_logs
             WHERE id IN (v_p_ga, v_p_gb, v_p_m_a, v_p_m_b, v_p_m_sem))
      INTO v_n;
    r := r || CASE WHEN v_n = 0
      THEN ' | 6 OK: gestor de C não lê nada do cenário (0)'
      ELSE ' | 6 FALHOU: gestor de C lê ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. anon e o helper
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('role', 'anon')::text, true);
    SET LOCAL ROLE anon;
    SELECT (SELECT count(*) FROM public.motorista_locations WHERE id IN (v_loc_a, v_loc_b))
         + (SELECT count(*) FROM public.logs
             WHERE id IN (v_log_a, v_log_b, v_log_m_sem, v_log_b_sis, v_log_ga_sem))
         + (SELECT count(*) FROM public.push_notification_logs
             WHERE id IN (v_p_ga, v_p_gb, v_p_m_a, v_p_m_b, v_p_m_sem))
      INTO v_n;
    r := r || CASE WHEN v_n = 0
      THEN ' | 7a OK: anon não lê nada (0)'
      ELSE ' | 7a FALHOU: anon lê ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || ' | 7a OK: anon sem acesso (' || SQLERRM || ')';
  WHEN OTHERS THEN
    r := r || ' | 7a FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    r := r || CASE
      WHEN NOT has_function_privilege('anon',
             'public.notificacao_da_loja_do_gestor(uuid)', 'EXECUTE')
       AND has_function_privilege('authenticated',
             'public.notificacao_da_loja_do_gestor(uuid)', 'EXECUTE')
      THEN ' | 7b OK: helper sem EXECUTE para anon, com EXECUTE para authenticated'
      ELSE ' | 7b FALHOU: privilégios do helper fora do esperado' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7b FALHOU: helper ausente (' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 8. gestor com vínculo desativado em A
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_ga_off, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT (SELECT count(*) FROM public.motorista_locations WHERE id = v_loc_a)
         + (SELECT count(*) FROM public.logs WHERE id = v_log_a)
         + (SELECT count(*) FROM public.push_notification_logs WHERE id IN (v_p_ga, v_p_m_a))
      INTO v_n;
    r := r || CASE WHEN v_n = 0
      THEN ' | 8 OK: gestor com vínculo desativado em A não lê nada das rotas de A (0)'
      ELSE ' | 8 FALHOU: gestor com vínculo desativado em A lê ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. motorista colega na mesma loja (A)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO v_n FROM public.motorista_locations WHERE id IN (v_loc_a, v_loc_b);
    r := r || CASE WHEN v_n = 0
      THEN ' | 9a OK: motorista colega não lê as posições do outro motorista (0)'
      ELSE ' | 9a FALHOU: motorista colega lê ' || v_n || ' posição(ões) do outro' END;

    SELECT count(*) INTO v_n FROM public.logs WHERE id IN (v_log_a, v_log_b);
    r := r || CASE WHEN v_n = 0
      THEN ' | 9b OK: motorista colega não lê os logs do outro motorista (0)'
      ELSE ' | 9b FALHOU: motorista colega lê ' || v_n || ' log(s) do outro' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9a-9b FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- 9c. posição na rota do outro motorista: recusada pelo WITH CHECK
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations (motorista_id, rota_id, latitude, longitude, fonte)
      VALUES (v_m2, v_rota_a, -7.3, -34.7, 'sonda');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 9c FALHOU: motorista colega gravou posição na rota do outro (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE '%row-level security%'
      THEN ' | 9c OK: posição na rota do outro recusada pela policy (' || SQLERRM || ')'
      ELSE ' | 9c FALHOU: recusada por outro motivo (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- 9d. posição na própria rota: aceita
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations (id, motorista_id, rota_id, latitude, longitude, fonte)
      VALUES (v_loc_m2, v_m2, v_rota_m2, -7.3, -34.7, 'sonda');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 9d OK: motorista colega grava posição na própria rota (1)'
      ELSE ' | 9d FALHOU: motorista colega gravou ' || v_n || ' posição(ões) na própria rota' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9d FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  RAISE EXCEPTION 'SONDA M48 (desfeita):%', r;
END
$$;
