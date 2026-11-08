-- ============================================================================
-- Sonda transacional da Migration 88 (`iniciar_rota`)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 88 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, todos os casos saem
-- FALHOU (a função não existe).
--
-- Cenário (não depende de dado real): loja A; gestor GA, gestor ativo de A;
-- motoristas M1 e M2 ativos em A; M3, que perde o vínculo com A; M4, que
-- perde o cadastro ativo. Rotas e paradas nascem como postgres, sem sessão
-- (M3 e M4 perdem o vínculo/cadastro DEPOIS de terem as rotas). Cada rota
-- com paradas tem partida (ordem 0) e chegada (última), `is_checkpoint =
-- false`, e paradas reais no meio. As chamadas rodam como `authenticated`
-- (SET LOCAL ROLE + claims do JWT). `now()` é fixo dentro da transação. O
-- bloco termina SEMPRE em RAISE EXCEPTION, que desfaz tudo. Leia o resultado
-- na mensagem "SONDA M88 (desfeita): N OK | N FALHOU ..." (o detalhe sai
-- antes num RAISE NOTICE). Conta só as rotas e paradas criadas aqui.
--
--    1. M1 inicia a própria rota pendente → 'iniciada': rota em_andamento com
--       iniciada_em = now(); partida concluida (concluida_em = now()); 1ª real
--       em_andamento; 2ª real e chegada pendentes; o gestor recebe o aviso
--       rota_iniciada (gatilho que já existia)
--    2. M1 de novo na mesma rota → 'ja_iniciada', nada muda (iniciada_em,
--       uma real em andamento só, 2ª real pendente)
--    3. início pela metade de versão antiga (rota em andamento, partida e 1ª
--       real pendentes) → 'ja_iniciada': partida concluida com a hora do
--       iniciada_em e 1ª real em_andamento
--    4. rota cancelada e rota concluida → 'situacao_mudou', sem escrita
--    5. 'sem_permissao' sem escrita: M2 na rota de M1; GA (gestor) na rota de
--       M1; M3 (vínculo inativo) e M4 (cadastro inativo) nas próprias; sem
--       sessão
--    6. rota só com partida e chegada → 'iniciada', partida concluida,
--       chegada pendente
--    7. catálogo: DEFINER, search_path vazio, dona postgres, sem EXECUTE de
--       PUBLIC/anon, com EXECUTE de authenticated; COMMENT da Migration 88
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_m1 uuid := gen_random_uuid();     -- ativo
  v_m2 uuid := gen_random_uuid();     -- ativo, outra pessoa
  v_m3 uuid := gen_random_uuid();     -- perde o vínculo com A
  v_m4 uuid := gen_random_uuid();     -- perde o cadastro ativo
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_r1 uuid := gen_random_uuid();     -- pendente de M1 (casos 1 e 2)
  v_r2 uuid := gen_random_uuid();     -- em andamento pela metade, de M1
  v_r3 uuid := gen_random_uuid();     -- cancelada de M1
  v_r4 uuid := gen_random_uuid();     -- concluida de M1
  v_r5 uuid := gen_random_uuid();     -- pendente de M1 (outros tentam)
  v_r6 uuid := gen_random_uuid();     -- pendente de M3
  v_r7 uuid := gen_random_uuid();     -- pendente de M4
  v_r8 uuid := gen_random_uuid();     -- pendente de M1, só partida e chegada
  v_rotas uuid[];
  v_inicio_antigo timestamptz := now() - interval '10 minutes';
  v_res text;
  v_res2 text;
  v_res3 text;
  v_res4 text;
  v_res5 text;
  v_status text;
  v_iniciada timestamptz;
  v_sit text;
  v_conc timestamptz;
  v_n int;
  v_ok boolean;
  v_det text;
  v_ok_n int;
  v_falhou_n int;
  v_falhas text;
BEGIN
  v_rotas := ARRAY[v_r1, v_r2, v_r3, v_r4, v_r5, v_r6, v_r7, v_r8];

  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_ga, 'sonda-m88-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m1, 'sonda-m88-m1-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m2, 'sonda-m88-m2-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m3, 'sonda-m88-m3-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m4, 'sonda-m88-m4-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES (v_ua, 'Sonda M88 A', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_ga, 'Sonda gestor A',     'sonda-m88-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_m1, 'Sonda motorista M1', 'sonda-m88-m1-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_m2, 'Sonda motorista M2', 'sonda-m88-m2-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_m3, 'Sonda motorista M3', 'sonda-m88-m3-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_m4, 'Sonda motorista M4', 'sonda-m88-m4-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_ga, v_ua, 'gestor',    true, true),
    (v_m1, v_ua, 'motorista', true, true),
    (v_m2, v_ua, 'motorista', true, true),
    (v_m3, v_ua, 'motorista', true, true),
    (v_m4, v_ua, 'motorista', true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em, concluida_em) VALUES
    (v_r1, v_ua, v_m1, 'pendente',     v_hoje,     NULL,            NULL),
    (v_r2, v_ua, v_m1, 'em_andamento', v_hoje,     v_inicio_antigo, NULL),
    (v_r3, v_ua, v_m1, 'pendente',     v_hoje + 1, NULL,            NULL),
    (v_r4, v_ua, v_m1, 'pendente',     v_hoje - 1, NULL,            NULL),
    (v_r5, v_ua, v_m1, 'pendente',     v_hoje + 2, NULL,            NULL),
    (v_r6, v_ua, v_m3, 'pendente',     v_hoje,     NULL,            NULL),
    (v_r7, v_ua, v_m4, 'pendente',     v_hoje,     NULL,            NULL),
    (v_r8, v_ua, v_m1, 'pendente',     v_hoje + 3, NULL,            NULL);

  -- Partida (0), duas reais (1, 2) e chegada (3) em toda rota, menos a r8.
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint)
  SELECT rid, 'entrega', 'Sonda M88 ' || o, -7.1, -34.8, o, 'pendente', o NOT IN (0, 3)
    FROM unnest(ARRAY[v_r1, v_r2, v_r3, v_r4, v_r5, v_r6, v_r7]) AS rid,
         generate_series(0, 3) AS o;
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_r8, 'entrega', 'Sonda M88 partida', -7.1, -34.8, 0, 'pendente', false),
    (v_r8, 'entrega', 'Sonda M88 chegada', -7.1, -34.8, 1, 'pendente', false);

  -- Rotas encerradas, vínculo e cadastro perdidos (como postgres).
  UPDATE public.rotas SET status = 'cancelada' WHERE id = v_r3;
  UPDATE public.rotas SET status = 'concluida', concluida_em = now() WHERE id = v_r4;
  UPDATE public.usuario_unidades SET ativo = false WHERE usuario_id = v_m3 AND unidade_id = v_ua;
  UPDATE public.usuarios SET ativo = false WHERE id = v_m4;

  -- ---------------------------------------------------------------------------
  -- 1. M1 inicia a própria rota pendente
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.iniciar_rota(v_r1);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status, iniciada_em INTO v_status, v_iniciada FROM public.rotas WHERE id = v_r1;
    SELECT string_agg(ordem || ':' || status, ',' ORDER BY ordem) INTO v_sit
      FROM public.paradas WHERE rota_id = v_r1;
    SELECT concluida_em INTO v_conc FROM public.paradas WHERE rota_id = v_r1 AND ordem = 0;
    SELECT count(*) INTO v_n FROM public.notificacoes
     WHERE rota_id = v_r1 AND usuario_id = v_ga AND tipo = 'rota_iniciada';
    r := r || CASE WHEN v_res = 'iniciada' AND v_status = 'em_andamento' AND v_iniciada = now()
                    AND v_sit = '0:concluida,1:em_andamento,2:pendente,3:pendente'
                    AND v_conc = now() AND v_n = 1
      THEN ' | 1 OK: iniciada (rota, partida e 1ª real numa transação; gestor avisado)'
      ELSE ' | 1 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula')
           || ', iniciada_em ' || coalesce(v_iniciada::text, 'nula') || ', paradas ' || coalesce(v_sit, 'nenhuma')
           || ', partida em ' || coalesce(v_conc::text, 'nula') || ', avisos ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 2. de novo: ja_iniciada, nada muda
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.iniciar_rota(v_r1);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status, iniciada_em INTO v_status, v_iniciada FROM public.rotas WHERE id = v_r1;
    SELECT string_agg(ordem || ':' || status, ',' ORDER BY ordem) INTO v_sit
      FROM public.paradas WHERE rota_id = v_r1;
    r := r || CASE WHEN v_res = 'ja_iniciada' AND v_status = 'em_andamento' AND v_iniciada = now()
                    AND v_sit = '0:concluida,1:em_andamento,2:pendente,3:pendente'
      THEN ' | 2 OK: ja_iniciada não muda nada'
      ELSE ' | 2 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula')
           || ', paradas ' || coalesce(v_sit, 'nenhuma') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 3. início pela metade de versão antiga: ja_iniciada completa
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.iniciar_rota(v_r2);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT iniciada_em INTO v_iniciada FROM public.rotas WHERE id = v_r2;
    SELECT string_agg(ordem || ':' || status, ',' ORDER BY ordem) INTO v_sit
      FROM public.paradas WHERE rota_id = v_r2;
    SELECT concluida_em INTO v_conc FROM public.paradas WHERE rota_id = v_r2 AND ordem = 0;
    r := r || CASE WHEN v_res = 'ja_iniciada' AND v_iniciada = v_inicio_antigo
                    AND v_sit = '0:concluida,1:em_andamento,2:pendente,3:pendente'
                    AND v_conc = v_inicio_antigo
      THEN ' | 3 OK: ja_iniciada completa a partida (hora do início) e a 1ª real'
      ELSE ' | 3 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', iniciada_em ' || coalesce(v_iniciada::text, 'nula')
           || ', paradas ' || coalesce(v_sit, 'nenhuma') || ', partida em ' || coalesce(v_conc::text, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 4. rota cancelada e rota concluida: situacao_mudou, sem escrita
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.iniciar_rota(v_r3);
    v_res2 := public.iniciar_rota(v_r4);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n FROM public.paradas
     WHERE rota_id IN (v_r3, v_r4) AND status <> 'pendente';
    SELECT string_agg(status, ',' ORDER BY data) INTO v_sit FROM public.rotas WHERE id IN (v_r3, v_r4);
    r := r || CASE WHEN v_res = 'situacao_mudou' AND v_res2 = 'situacao_mudou' AND v_n = 0
                    AND v_sit = 'concluida,cancelada'
      THEN ' | 4 OK: cancelada e concluida → situacao_mudou, sem escrita'
      ELSE ' | 4 FALHOU: cancelada ' || coalesce(v_res, 'nulo') || ', concluida ' || coalesce(v_res2, 'nulo')
           || ', paradas mexidas ' || v_n || ', rotas ' || coalesce(v_sit, 'nenhuma') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 5. sem_permissao, sem escrita
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.iniciar_rota(v_r5);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res2 := public.iniciar_rota(v_r5);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m3, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res3 := public.iniciar_rota(v_r6);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m4, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res4 := public.iniciar_rota(v_r7);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res5 := public.iniciar_rota(v_r5);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n FROM public.rotas WHERE id IN (v_r5, v_r6, v_r7) AND status <> 'pendente';
    SELECT v_n + count(*) INTO v_n FROM public.paradas
     WHERE rota_id IN (v_r5, v_r6, v_r7) AND status <> 'pendente';
    r := r || CASE WHEN v_res = 'sem_permissao' AND v_res2 = 'sem_permissao' AND v_res3 = 'sem_permissao'
                    AND v_res4 = 'sem_permissao' AND v_res5 = 'sem_permissao' AND v_n = 0
      THEN ' | 5 OK: sem_permissao (outro motorista, gestor, vínculo inativo, cadastro inativo, sem sessão), sem escrita'
      ELSE ' | 5 FALHOU: outro ' || coalesce(v_res, 'nulo') || ', gestor ' || coalesce(v_res2, 'nulo')
           || ', sem vínculo ' || coalesce(v_res3, 'nulo') || ', inativo ' || coalesce(v_res4, 'nulo')
           || ', sem sessão ' || coalesce(v_res5, 'nulo') || ', linhas mexidas ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 6. rota só com partida e chegada
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.iniciar_rota(v_r8);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_r8;
    SELECT string_agg(ordem || ':' || status, ',' ORDER BY ordem) INTO v_sit
      FROM public.paradas WHERE rota_id = v_r8;
    r := r || CASE WHEN v_res = 'iniciada' AND v_status = 'em_andamento' AND v_sit = '0:concluida,1:pendente'
      THEN ' | 6 OK: sem parada real, inicia e conclui só a partida'
      ELSE ' | 6 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula')
           || ', paradas ' || coalesce(v_sit, 'nenhuma') END;
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
     WHERE p.oid = to_regprocedure('public.iniciar_rota(uuid)')
       AND p.prosecdef
       AND p.proconfig = ARRAY['search_path=""']
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.prorettype = 'text'::regtype
       AND p.proacl IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
       AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
       AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
       AND obj_description(p.oid, 'pg_proc') LIKE 'Migration 88%';
    IF v_n <> 1 THEN
      v_ok := false;
      v_det := ' função ausente ou fora do esperado';
    END IF;
    r := r || CASE WHEN v_ok
      THEN ' | 7 OK: catálogo (DEFINER, search_path vazio, dono, text, ACL, COMMENT)'
      ELSE ' | 7 FALHOU:' || v_det END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- Sanidade: nada iniciado fora das rotas da sonda pelos motoristas dela.
  SELECT count(*) INTO v_n FROM public.rotas
   WHERE motorista_id IN (v_m1, v_m2, v_m3, v_m4) AND id <> ALL (v_rotas);
  IF v_n <> 0 THEN
    r := r || ' | 8 FALHOU: ' || v_n || ' rota(s) dos motoristas da sonda fora das dela';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Resumo (o detalhe vai no NOTICE; a EXCEPTION desfaz tudo)
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_ok_n FROM regexp_matches(r, '\| \d+ OK:', 'g');
  SELECT count(*) INTO v_falhou_n FROM regexp_matches(r, '\| \d+ FALHOU', 'g');
  SELECT coalesce(string_agg(x[1], ' '), '') INTO v_falhas
    FROM regexp_matches(r, '(\| \d+ FALHOU[^|]*)', 'g') AS x;

  RAISE NOTICE 'SONDA M88 detalhe:%', r;
  RAISE EXCEPTION 'SONDA M88 (desfeita): % OK | % FALHOU %', v_ok_n, v_falhou_n, v_falhas;
END
$$;
