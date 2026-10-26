-- ============================================================================
-- Sonda transacional da Migration 71 (RPC `reativar_rota`)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 71 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os 10 casos saem
-- FALHOU (é o vermelho esperado: a função não existe, 42883; os casos 2, 3 e
-- 4 conferem o estado que o caso 1 deixaria; o 10 lê o catálogo).
--
-- Cenário comum (não depende de dado real): lojas A e B; motorista M, ativo
-- em A; gestor GA, gestor ativo de A; gestor GB, gestor ativo só de B; GX, com
-- vínculo de gestor INATIVO em A. Rotas montadas como postgres, sem sessão,
-- com partida (ordem 0), paradas reais e chegada (última), as duas pontas com
-- `is_checkpoint = false`. A rota R1 (casos 1 a 5) é `nao_executada` com
-- `data` = hoje em São Paulo − 3 dias, `iniciada_em` e `concluida_em`
-- preenchidos, e paradas: partida `concluida`, `em_andamento`, `pulada` (com
-- `motivo_skip = 'outro'`, `foto_url = 'sonda/x.jpg'` e `concluida_em`),
-- `concluida` (com `concluida_em`) e chegada `pendente`. Os casos 2 a 5
-- conferem o que o caso 1 deixou, de propósito; os demais montam a própria
-- rota. As chamadas rodam como `authenticated` (SET LOCAL ROLE + claims do
-- JWT); a conferência roda como postgres. Os avisos de parada reaberta (e o
-- pedido de push enfileirado pelo `pg_net`) vão só para GA e são desfeitos
-- junto. O bloco termina SEMPRE em RAISE EXCEPTION, que desfaz tudo. Leia o
-- resultado na mensagem "SONDA M71 (desfeita): ...". Esperado: todas as
-- linhas com OK.
--
--    1. GA reativa R1 → 'reativada'; rota `pendente`, `data` = (now() AT
--       TIME ZONE 'America/Sao_Paulo')::date, `iniciada_em` e `concluida_em`
--       nulos
--    2. paradas de R1: `em_andamento`, `pulada` e chegada → `pendente` com
--       `concluida_em` nulo; as duas `concluida` iguais, com `concluida_em`;
--       `motivo_skip` da ex-pulada igual
--    3. a ex-pulada com foto voltou a `pendente` com a foto preservada (o
--       gatilho de foto deixou o gestor passar)
--    4. 1 log `rota_reativada` de R1, `usuario_id` = GA, `reativado_por` =
--       'Sonda gestor A', `nova_data` = a data do caso 1
--    5. GA chama de novo R1 → 'situacao_mudou'; logs `rota_reativada` seguem 1
--    6. GA, rota `cancelada` → 'situacao_mudou'; rota igual
--    7. GX (vínculo de gestor inativo em A) e GB (gestor de outra loja) →
--       'sem_permissao' os dois; rota e parada pulada iguais
--    8. M (motorista da rota) → 'sem_permissao'; rota igual
--    9. GA com uuid inexistente e authenticated sem `sub` nas claims →
--       'sem_permissao' os dois; rota igual
--   10. catálogo: anon sem EXECUTE, proacl sem PUBLIC, authenticated e
--       service_role com EXECUTE, SECURITY DEFINER, search_path vazio, dono
--       postgres
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_m uuid := gen_random_uuid();      -- motorista de A
  v_ga uuid := gen_random_uuid();     -- gestor ativo de A
  v_gb uuid := gen_random_uuid();     -- gestor ativo só de B
  v_gx uuid := gen_random_uuid();     -- vínculo de gestor inativo em A
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_rota uuid;                        -- a rota do caso
  v_r1 uuid := gen_random_uuid();     -- R1 (casos 1 a 5)
  v_partida uuid := gen_random_uuid();
  v_em uuid := gen_random_uuid();     -- em_andamento em R1
  v_pul uuid := gen_random_uuid();    -- pulada com foto em R1
  v_conc uuid := gen_random_uuid();   -- concluida em R1
  v_cheg uuid := gen_random_uuid();   -- chegada pendente em R1
  v_p uuid;                           -- parada pulada do caso
  v_concluida_em timestamptz := '2026-10-20 09:15:00-03';
  v_fn regprocedure;
  v_res text;
  v_res2 text;
  v_status text;
  v_data date;
  v_n int;
  v_n2 int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,  'sonda-m71-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga, 'sonda-m71-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m71-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gx, 'sonda-m71-gx-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M71 A', 'Sonda'),
    (v_ub, 'Sonda M71 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m,  'Sonda motorista M', 'sonda-m71-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_ga, 'Sonda gestor A',    'sonda-m71-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gb, 'Sonda gestor B',    'sonda-m71-gb-' || v_sufixo || '@example.invalid', 'gestor',    v_ub, true),
    (v_gx, 'Sonda gestor X',    'sonda-m71-gx-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,  v_ua, 'motorista', true,  true),
    (v_ga, v_ua, 'gestor',    true,  true),
    (v_gb, v_ub, 'gestor',    true,  true),
    (v_gx, v_ua, 'gestor',    false, true);

  -- R1: nao_executada, data de 3 dias atrás, iniciada e encerrada
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em, concluida_em) VALUES
    (v_r1, v_ua, v_m, 'nao_executada', v_hoje - 3, v_concluida_em - interval '1 hour', v_concluida_em);
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, concluida_em, motivo_skip, foto_url) VALUES
    (v_partida, v_r1, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida',    false, v_concluida_em, NULL,    NULL),
    (v_em,      v_r1, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'em_andamento', true,  NULL,           NULL,    NULL),
    (v_pul,     v_r1, 'entrega', 'sonda p2',      -7.1, -34.8, 2, 'pulada',       true,  v_concluida_em, 'outro', 'sonda/x.jpg'),
    (v_conc,    v_r1, 'entrega', 'sonda p3',      -7.1, -34.8, 3, 'concluida',    true,  v_concluida_em, NULL,    NULL),
    (v_cheg,    v_r1, 'entrega', 'sonda chegada', -7.1, -34.8, 4, 'pendente',     false, NULL,           NULL,    NULL);

  -- ---------------------------------------------------------------------------
  -- 1. GA reativa R1
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_r1);
    RESET ROLE;
    SELECT count(*) INTO v_n FROM public.rotas
     WHERE id = v_r1 AND status = 'pendente' AND data = v_hoje
       AND iniciada_em IS NULL AND concluida_em IS NULL;
    SELECT status, data INTO v_status, v_data FROM public.rotas WHERE id = v_r1;
    r := r || CASE WHEN v_res = 'reativada' AND v_n = 1
      THEN ' | 1 OK: gestor reativa; rota pendente com a data de hoje em São Paulo, iniciada_em e concluida_em nulos'
      ELSE ' | 1 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') || ' em ' || coalesce(v_data::text, 'nula') || ' (esperado pendente em ' || v_hoje || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2. paradas de R1 depois do caso 1
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    SELECT count(*) INTO v_n FROM public.paradas
     WHERE (id = v_partida AND status = 'concluida' AND concluida_em = v_concluida_em)
        OR (id = v_em      AND status = 'pendente'  AND concluida_em IS NULL)
        OR (id = v_pul     AND status = 'pendente'  AND concluida_em IS NULL AND motivo_skip = 'outro')
        OR (id = v_conc    AND status = 'concluida' AND concluida_em = v_concluida_em)
        OR (id = v_cheg    AND status = 'pendente'  AND concluida_em IS NULL);
    r := r || CASE WHEN v_n = 5
      THEN ' | 2 OK: em_andamento, pulada e chegada voltam a pendente sem concluida_em; concluidas iguais; motivo_skip igual'
      ELSE ' | 2 FALHOU: paradas no esperado ' || v_n || ' de 5' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 3. a ex-pulada com foto voltou a pendente com a foto preservada
  -- ---------------------------------------------------------------------------
  BEGIN
    SELECT count(*) INTO v_n FROM public.paradas
     WHERE id = v_pul AND status = 'pendente' AND foto_url = 'sonda/x.jpg';
    r := r || CASE WHEN v_n = 1
      THEN ' | 3 OK: ex-pulada com foto reaberta pelo gestor, foto preservada'
      ELSE ' | 3 FALHOU: ex-pulada com foto não está pendente com a foto (' || coalesce((SELECT status || ' / ' || coalesce(foto_url, 'sem foto') FROM public.paradas WHERE id = v_pul), 'ausente') || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 4. log rota_reativada de R1
  -- ---------------------------------------------------------------------------
  BEGIN
    SELECT count(*) INTO v_n FROM public.logs WHERE rota_id = v_r1 AND evento = 'rota_reativada';
    SELECT count(*) INTO v_n2 FROM public.logs
     WHERE rota_id = v_r1 AND evento = 'rota_reativada'
       AND usuario_id = v_ga
       AND detalhes->>'reativado_por' = 'Sonda gestor A'
       AND detalhes->>'nova_data' = v_hoje::text;
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1
      THEN ' | 4 OK: um log rota_reativada com usuario_id do gestor, reativado_por e nova_data'
      ELSE ' | 4 FALHOU: logs rota_reativada ' || v_n || ', no formato esperado ' || v_n2 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 5. GA chama de novo R1 (já pendente)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_r1);
    RESET ROLE;
    SELECT count(*) INTO v_n FROM public.logs WHERE rota_id = v_r1 AND evento = 'rota_reativada';
    r := r || CASE WHEN v_res = 'situacao_mudou' AND v_n = 1
      THEN ' | 5 OK: segunda chamada devolve situacao_mudou, sem log a mais'
      ELSE ' | 5 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', logs rota_reativada ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. GA, rota cancelada
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES (v_rota, v_ua, v_m, 'cancelada', v_hoje - 3);
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente', true),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente', false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_rota);
    RESET ROLE;
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_res = 'situacao_mudou' AND v_status = 'cancelada'
      THEN ' | 6 OK: rota cancelada devolve situacao_mudou e fica igual'
      ELSE ' | 6 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. GX (vínculo de gestor inativo em A) e GB (gestor de outra loja)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid(); v_p := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES (v_rota, v_ua, v_m, 'nao_executada', v_hoje - 3);
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (gen_random_uuid(), v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false),
    (v_p,               v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pulada',    true),
    (gen_random_uuid(), v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente',  false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gx, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_rota);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res2 := public.reativar_rota(v_rota);
    RESET ROLE;
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    SELECT count(*) INTO v_n FROM public.paradas WHERE id = v_p AND status = 'pulada';
    r := r || CASE WHEN v_res = 'sem_permissao' AND v_res2 = 'sem_permissao' AND v_status = 'nao_executada' AND v_n = 1
      THEN ' | 7 OK: vínculo de gestor inativo e gestor de outra loja recebem sem_permissao; rota e parada iguais'
      ELSE ' | 7 FALHOU: GX ' || coalesce(v_res, 'nulo') || ', GB ' || coalesce(v_res2, 'nulo') || ', rota ' || coalesce(v_status, 'nula') || ', parada pulada ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. M (motorista da rota) chama a RPC
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES (v_rota, v_ua, v_m, 'nao_executada', v_hoje - 3);
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente', true),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente', false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_rota);
    RESET ROLE;
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_res = 'sem_permissao' AND v_status = 'nao_executada'
      THEN ' | 8 OK: motorista da rota recebe sem_permissao; rota igual'
      ELSE ' | 8 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. GA com uuid inexistente; authenticated sem `sub` numa rota real
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES (v_rota, v_ua, v_m, 'nao_executada', v_hoje - 3);
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 1, 'pendente', false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(gen_random_uuid());
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res2 := public.reativar_rota(v_rota);
    RESET ROLE;
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_res = 'sem_permissao' AND v_res2 = 'sem_permissao' AND v_status = 'nao_executada'
      THEN ' | 9 OK: rota inexistente e sessão sem usuário recebem sem_permissao; rota igual'
      ELSE ' | 9 FALHOU: inexistente ' || coalesce(v_res, 'nulo') || ', sem usuário ' || coalesce(v_res2, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 10. catálogo da função (lido sem abortar quando ela ainda não existe)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    v_fn := to_regprocedure('public.reativar_rota(uuid)');
    IF v_fn IS NULL THEN
      r := r || ' | 10 FALHOU: public.reativar_rota(uuid) não existe';
    ELSE
      SELECT count(*) INTO v_n
        FROM pg_proc p
       WHERE p.oid = v_fn
         AND p.prosecdef
         AND p.proconfig = ARRAY['search_path=""']
         AND pg_get_userbyid(p.proowner) = 'postgres'
         AND p.proacl IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
         AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
         AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
         AND has_function_privilege('service_role', p.oid, 'EXECUTE');
      r := r || CASE WHEN v_n = 1
        THEN ' | 10 OK: SECURITY DEFINER, search_path vazio, dono postgres, EXECUTE só de authenticated e service_role'
        ELSE ' | 10 FALHOU: catálogo fora do esperado (' || coalesce((SELECT p.proacl::text FROM pg_proc p WHERE p.oid = v_fn), 'proacl nulo') || ')' END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 10 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  RAISE EXCEPTION 'SONDA M71 (desfeita):%', r;
END
$$;
