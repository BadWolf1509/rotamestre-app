-- ============================================================================
-- Sonda transacional da Migration 46 (rodar DEPOIS de aplicá-la, no SQL Editor)
-- ============================================================================
-- Banco único = produção, sem pgTAP. O bloco monta um cenário próprio dentro da
-- transação (não depende de dado real): lojas A, B e C; gestor GA só em A, GB
-- só em B, GC só em C e GAB em A e em B (para provar que ninguém recebe duas
-- vezes). O motorista M tem vínculo ATIVO em A e em B (nenhum principal — o
-- caso que hoje não avisa ninguém) e vínculo INATIVO em C. M2 só atende A e
-- grava pelo INSERT direto, como as versões até a 1.14.5. M3 não tem vínculo
-- ativo nenhum. Há uma rota de M em A e uma rota de outro motorista em C.
-- O SOS sai como `authenticated` (SET LOCAL ROLE + claims do JWT), como o app.
--
-- Sem DELETE. Termina SEMPRE em RAISE EXCEPTION, que desfaz tudo — inclusive
-- as notificações dos gatilhos e a fila do pg_net, que só é lida depois do
-- commit. Leia "SONDA M46 (desfeita): ...". Esperado: todas as linhas com OK.
--
-- Atenção: dentro da transação `now()` não anda, então o prevent_duplicate_log
-- (5 s) vê todos os logs como simultâneos. Cada caso usa uma combinação
-- (motorista, rota) própria, salvo o 6, que repete de propósito.
--
--   1. M, sem rota, com dois vínculos ativos: registrar_sos devolve 3
--   2. ... 1 notificação para cada gestor de A e de B (GA, GB, GAB — GAB uma só)
--   3. ... o vínculo inativo (C) não avisa: GC recebe 0
--   4. ... a `descricao` chega no texto
--   5. ... o log guarda `gestores_avisados` = 3
--   6. M repete o SOS sem rota (descartado como duplicado): responde 3 de novo
--      e ninguém recebe um segundo aviso
--   7. M, com rota de A: só os gestores da loja da rota (GA e GAB), devolve 2
--   8. M2 pelo INSERT direto com só `motivo`: o gatilho avisa GA e GAB, o texto
--      é o `motivo` e o log guarda `gestores_avisados` = 2
--   9. M3 sem vínculo ativo, mandando `gestores_avisados` = 99: devolve 0 (a
--      contagem do cliente é descartada) e o texto padrão não quebra nada
--  10. M não registra SOS na rota de outra loja em que não atende (42501)
--  11. anon não executa registrar_sos
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_uc uuid := gen_random_uuid();     -- loja C (vínculo inativo de M)
  v_ga uuid := gen_random_uuid();     -- gestor só de A
  v_gb uuid := gen_random_uuid();     -- gestor só de B
  v_gc uuid := gen_random_uuid();     -- gestor só de C
  v_gab uuid := gen_random_uuid();    -- gestor de A e de B
  v_m uuid := gen_random_uuid();      -- motorista de A e B (ativo) e C (inativo)
  v_m2 uuid := gen_random_uuid();     -- motorista só de A (INSERT direto)
  v_m3 uuid := gen_random_uuid();     -- motorista sem vínculo ativo
  v_mc uuid := gen_random_uuid();     -- motorista de C (dono da rota de C)
  v_rota_a uuid := gen_random_uuid(); -- de M, em A
  v_rota_c uuid := gen_random_uuid(); -- de MC, em C
  v_ret integer;
  v_n integer;
  v_txt text;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_ga,  'sonda-m46-ga-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb,  'sonda-m46-gb-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gc,  'sonda-m46-gc-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gab, 'sonda-m46-gab-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m,   'sonda-m46-m-'   || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m2,  'sonda-m46-m2-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m3,  'sonda-m46-m3-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_mc,  'sonda-m46-mc-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M46 A', 'Sonda'),
    (v_ub, 'Sonda M46 B', 'Sonda'),
    (v_uc, 'Sonda M46 C', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id) VALUES
    (v_ga,  'Sonda gestor A',  'sonda-m46-ga-'  || v_sufixo || '@example.invalid', 'gestor', v_ua),
    (v_gb,  'Sonda gestor B',  'sonda-m46-gb-'  || v_sufixo || '@example.invalid', 'gestor', v_ub),
    (v_gc,  'Sonda gestor C',  'sonda-m46-gc-'  || v_sufixo || '@example.invalid', 'gestor', v_uc),
    (v_gab, 'Sonda gestor AB', 'sonda-m46-gab-' || v_sufixo || '@example.invalid', 'gestor', v_ua),
    (v_m,   'Sonda motorista', 'sonda-m46-m-'   || v_sufixo || '@example.invalid', 'motorista', v_ua),
    (v_m2,  'Sonda motorista 2', 'sonda-m46-m2-' || v_sufixo || '@example.invalid', 'motorista', v_ua),
    (v_m3,  'Sonda motorista 3', 'sonda-m46-m3-' || v_sufixo || '@example.invalid', 'motorista', v_uc),
    (v_mc,  'Sonda motorista C', 'sonda-m46-mc-' || v_sufixo || '@example.invalid', 'motorista', v_uc);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_ga,  v_ua, 'gestor', true, true),
    (v_gb,  v_ub, 'gestor', true, true),
    (v_gc,  v_uc, 'gestor', true, true),
    (v_gab, v_ua, 'gestor', true, true),
    (v_gab, v_ub, 'gestor', true, false),
    (v_m,   v_ua, 'motorista', true, false),
    (v_m,   v_ub, 'motorista', true, false),
    (v_m,   v_uc, 'motorista', false, false),
    (v_m2,  v_ua, 'motorista', true, false),
    (v_m3,  v_uc, 'motorista', false, false),
    (v_mc,  v_uc, 'motorista', true, false);

  INSERT INTO public.rotas (id, unidade_id, motorista_id) VALUES
    (v_rota_a, v_ua, v_m),
    (v_rota_c, v_uc, v_mc);

  -- ---------------------------------------------------------------------------
  -- 1-5. M, sem rota, pela RPC
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_ret := public.registrar_sos(
      jsonb_build_object('descricao', 'sonda m46 pneu furado', 'gestores_avisados', 99), NULL);
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: registrar_sos levantou (' || SQLERRM || ')';
  END;
  RESET ROLE;

  r := r || CASE WHEN v_ret = 3
    THEN ' | 1 OK: sem rota, dois vínculos ativos → 3 gestores avisados'
    ELSE ' | 1 FALHOU: devolveu ' || COALESCE(v_ret::text, 'NULL') || ' (esperado 3)' END;

  SELECT count(*) INTO v_n FROM public.notificacoes
   WHERE tipo = 'sos_acionado' AND rota_id IS NULL AND usuario_id = v_ga;
  r := r || CASE WHEN v_n = 1 THEN ' | 2a OK: GA recebeu 1'
    ELSE ' | 2a FALHOU: GA recebeu ' || v_n END;
  SELECT count(*) INTO v_n FROM public.notificacoes
   WHERE tipo = 'sos_acionado' AND rota_id IS NULL AND usuario_id = v_gb;
  r := r || CASE WHEN v_n = 1 THEN ' | 2b OK: GB recebeu 1'
    ELSE ' | 2b FALHOU: GB recebeu ' || v_n END;
  SELECT count(*) INTO v_n FROM public.notificacoes
   WHERE tipo = 'sos_acionado' AND rota_id IS NULL AND usuario_id = v_gab;
  r := r || CASE WHEN v_n = 1 THEN ' | 2c OK: GAB (gestor das duas lojas) recebeu 1, sem repetir'
    ELSE ' | 2c FALHOU: GAB recebeu ' || v_n END;

  SELECT count(*) INTO v_n FROM public.notificacoes
   WHERE tipo = 'sos_acionado' AND usuario_id = v_gc;
  r := r || CASE WHEN v_n = 0 THEN ' | 3 OK: vínculo inativo (C) não avisa (GC 0)'
    ELSE ' | 3 FALHOU: GC recebeu ' || v_n END;

  SELECT mensagem INTO v_txt FROM public.notificacoes
   WHERE tipo = 'sos_acionado' AND rota_id IS NULL AND usuario_id = v_ga LIMIT 1;
  r := r || CASE WHEN v_txt LIKE '%sonda m46 pneu furado%' AND v_txt LIKE '%Sonda motorista%'
    THEN ' | 4 OK: a descricao chega no texto'
    ELSE ' | 4 FALHOU: texto = ' || COALESCE(v_txt, 'NULL') END;

  SELECT (detalhes->>'gestores_avisados')::int INTO v_n FROM public.logs
   WHERE usuario_id = v_m AND evento = 'sos_acionado' AND rota_id IS NULL;
  r := r || CASE WHEN v_n = 3 THEN ' | 5 OK: o log guarda gestores_avisados = 3 (o 99 do cliente saiu)'
    ELSE ' | 5 FALHOU: gestores_avisados = ' || COALESCE(v_n::text, 'NULL') END;

  -- ---------------------------------------------------------------------------
  -- 6. M repete o SOS sem rota (o prevent_duplicate_log descarta)
  -- ---------------------------------------------------------------------------
  v_ret := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_ret := public.registrar_sos(jsonb_build_object('descricao', 'sonda m46 de novo'), NULL);
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: registrar_sos levantou (' || SQLERRM || ')';
  END;
  RESET ROLE;

  SELECT count(*) INTO v_n FROM public.notificacoes
   WHERE tipo = 'sos_acionado' AND rota_id IS NULL AND usuario_id IN (v_ga, v_gb, v_gab);
  r := r || CASE WHEN v_ret = 3 AND v_n = 3
    THEN ' | 6 OK: SOS repetido responde pelo anterior (3) sem aviso em dobro'
    ELSE ' | 6 FALHOU: devolveu ' || COALESCE(v_ret::text, 'NULL') || ', avisos ' || v_n || ' (esperado 3 e 3)' END;

  -- ---------------------------------------------------------------------------
  -- 7. M, com a rota de A
  -- ---------------------------------------------------------------------------
  v_ret := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_ret := public.registrar_sos(jsonb_build_object('descricao', 'sonda m46 na rota'), v_rota_a);
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: registrar_sos levantou (' || SQLERRM || ')';
  END;
  RESET ROLE;

  SELECT count(*) INTO v_n FROM public.notificacoes
   WHERE tipo = 'sos_acionado' AND rota_id = v_rota_a AND usuario_id IN (v_ga, v_gab);
  r := r || CASE WHEN v_ret = 2 AND v_n = 2
    THEN ' | 7a OK: com rota, os gestores da loja da rota (GA e GAB), devolve 2'
    ELSE ' | 7a FALHOU: devolveu ' || COALESCE(v_ret::text, 'NULL') || ', avisos GA/GAB ' || v_n END;
  SELECT count(*) INTO v_n FROM public.notificacoes
   WHERE tipo = 'sos_acionado' AND rota_id = v_rota_a AND usuario_id IN (v_gb, v_gc);
  r := r || CASE WHEN v_n = 0
    THEN ' | 7b OK: com rota de A, GB e GC não recebem'
    ELSE ' | 7b FALHOU: GB/GC receberam ' || v_n END;

  -- ---------------------------------------------------------------------------
  -- 8. M2 pelo INSERT direto (versões até a 1.14.5), só com `motivo`
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.logs (usuario_id, evento, detalhes)
      VALUES (v_m2, 'sos_acionado', jsonb_build_object('motivo', 'sonda m46 motivo antigo'));
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: INSERT direto recusado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  SELECT count(*) INTO v_n FROM public.notificacoes
   WHERE tipo = 'sos_acionado' AND rota_id IS NULL AND usuario_id IN (v_ga, v_gab)
     AND mensagem LIKE '%sonda m46 motivo antigo%';
  r := r || CASE WHEN v_n = 2
    THEN ' | 8a OK: INSERT direto avisa GA e GAB com o texto do motivo'
    ELSE ' | 8a FALHOU: avisos com o motivo = ' || v_n || ' (esperado 2)' END;
  SELECT (detalhes->>'gestores_avisados')::int INTO v_n FROM public.logs
   WHERE usuario_id = v_m2 AND evento = 'sos_acionado';
  r := r || CASE WHEN v_n = 2 THEN ' | 8b OK: o log do INSERT direto guarda gestores_avisados = 2'
    ELSE ' | 8b FALHOU: gestores_avisados = ' || COALESCE(v_n::text, 'NULL') END;

  -- ---------------------------------------------------------------------------
  -- 9. M3 sem vínculo ativo, mandando a contagem
  -- ---------------------------------------------------------------------------
  v_ret := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m3, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_ret := public.registrar_sos(jsonb_build_object('gestores_avisados', 99), NULL);
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: registrar_sos levantou (' || SQLERRM || ')';
  END;
  RESET ROLE;

  SELECT count(*) INTO v_n FROM public.logs
   WHERE usuario_id = v_m3 AND evento = 'sos_acionado';
  r := r || CASE WHEN v_ret = 0 AND v_n = 1
    THEN ' | 9 OK: sem vínculo ativo, o log grava e a RPC devolve 0 (não 99)'
    ELSE ' | 9 FALHOU: devolveu ' || COALESCE(v_ret::text, 'NULL') || ', logs ' || v_n END;

  -- ---------------------------------------------------------------------------
  -- 10. M na rota de C (não é dele, e o vínculo de C está inativo)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_ret := public.registrar_sos(jsonb_build_object('descricao', 'sonda m46 rota alheia'), v_rota_c);
    r := r || ' | 10 FALHOU: registrou SOS na rota de outra loja (' || COALESCE(v_ret::text, 'NULL') || ')';
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || ' | 10 OK: rota de outra loja recusada (42501)';
  WHEN OTHERS THEN
    r := r || ' | 10 FALHOU: recusado por outro motivo (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 11. anon
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('role', 'anon')::text, true);
    SET LOCAL ROLE anon;
    v_ret := public.registrar_sos(jsonb_build_object('descricao', 'sonda m46 anon'), NULL);
    r := r || ' | 11 FALHOU: anon executou registrar_sos';
  EXCEPTION WHEN insufficient_privilege THEN
    -- A RPC também levanta 42501 sem sessão: só conta o "permission denied"
    -- do GRANT, senão o caso passaria pelo motivo errado.
    r := r || CASE WHEN SQLERRM LIKE 'permission denied for function%'
      THEN ' | 11 OK: anon sem EXECUTE (' || SQLERRM || ')'
      ELSE ' | 11 FALHOU: anon executou e a RPC recusou por dentro (' || SQLERRM || ')' END;
  WHEN OTHERS THEN
    r := r || ' | 11 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  RAISE EXCEPTION 'SONDA M46 (desfeita):%', r;
END
$$;
