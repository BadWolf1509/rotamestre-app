-- ============================================================================
-- Sonda transacional da Migration 70 (RPC `cancelar_rota`)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 70 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os 12 casos saem
-- FALHOU (é o vermelho esperado: a função não existe, 42883, e o caso 11 conta
-- a parada medida em 26/10).
--
-- Cenário comum (não depende de dado real): lojas A e B; motorista M, ativo
-- em A; gestor GA, gestor ativo de A; gestor GB, gestor ativo só de B; GX, com
-- vínculo de gestor INATIVO em A. Cada caso monta a PRÓPRIA rota (como
-- postgres, sem sessão) com partida (ordem 0), paradas reais e chegada
-- (última), as duas pontas com `is_checkpoint = false`, e não depende do
-- resultado de outro caso (exceto o 2, que repete a rota do 1 de propósito).
-- As chamadas rodam como `authenticated` (SET LOCAL ROLE + claims do JWT); a
-- conferência roda como postgres. O bloco termina SEMPRE em RAISE EXCEPTION,
-- que desfaz tudo. Leia o resultado na mensagem "SONDA M70 (desfeita): ...".
-- Esperado: todas as linhas com OK.
--
--    1. GA cancela rota em_andamento (paradas concluida, em_andamento,
--       pendente) → 'cancelada'; rota cancelada; em_andamento → pendente;
--       concluida (com concluida_em) e pendente iguais
--    2. GA chama de novo a mesma rota → 'ja_cancelada'; 1 log rota_cancelada
--    3. GA, rota pendente → 'cancelada'; paradas pendente iguais
--    4. GA, rota concluida → 'situacao_mudou'; rota igual
--    5. GA, rota nao_executada → 'situacao_mudou'; rota igual
--    6. GB (gestor de outra loja) → 'sem_permissao'; rota e parada iguais
--    7. GX (vínculo de gestor inativo em A) → 'sem_permissao'; rota igual
--    8. M (motorista da rota) → 'sem_permissao'; rota igual
--    9. uuid inexistente → 'sem_permissao'
--   10. catálogo: anon sem EXECUTE, proacl sem PUBLIC, authenticated e
--       service_role com EXECUTE, SECURITY DEFINER, search_path vazio, dono
--       postgres
--   11. dados reais: nenhuma parada em_andamento em rota cancelada
--   12. authenticated sem `sub` nas claims → 'sem_permissao'; rota igual
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
  v_rota uuid;                        -- a rota do caso
  v_rota1 uuid;                       -- a rota do caso 1 (repetida no 2)
  v_p1 uuid;                          -- parada concluida do caso
  v_p2 uuid;                          -- parada em_andamento do caso
  v_p3 uuid;                          -- parada pendente do caso
  v_concluida_em timestamptz := '2026-10-26 09:15:00-03';
  v_fn regprocedure;
  v_res text;
  v_status text;
  v_n int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,  'sonda-m70-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga, 'sonda-m70-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m70-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gx, 'sonda-m70-gx-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M70 A', 'Sonda'),
    (v_ub, 'Sonda M70 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m,  'Sonda motorista M', 'sonda-m70-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_ga, 'Sonda gestor A',    'sonda-m70-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gb, 'Sonda gestor B',    'sonda-m70-gb-' || v_sufixo || '@example.invalid', 'gestor',    v_ub, true),
    (v_gx, 'Sonda gestor X',    'sonda-m70-gx-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,  v_ua, 'motorista', true,  true),
    (v_ga, v_ua, 'gestor',    true,  true),
    (v_gb, v_ub, 'gestor',    true,  true),
    (v_gx, v_ua, 'gestor',    false, true);

  -- ---------------------------------------------------------------------------
  -- 1. GA cancela rota em_andamento com paradas concluida, em_andamento e
  --    pendente
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid(); v_rota1 := v_rota;
  v_p1 := gen_random_uuid(); v_p2 := gen_random_uuid(); v_p3 := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES (v_rota, v_ua, v_m, 'em_andamento');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, concluida_em) VALUES
    (gen_random_uuid(), v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida',    false, v_concluida_em),
    (v_p1,              v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'concluida',    true,  v_concluida_em),
    (v_p2,              v_rota, 'entrega', 'sonda p2',      -7.1, -34.8, 2, 'em_andamento', true,  NULL),
    (v_p3,              v_rota, 'entrega', 'sonda p3',      -7.1, -34.8, 3, 'pendente',     true,  NULL),
    (gen_random_uuid(), v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 4, 'pendente',     false, NULL);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_rota);
    RESET ROLE;
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    SELECT count(*) INTO v_n FROM public.paradas
     WHERE (id = v_p1 AND status = 'concluida' AND concluida_em = v_concluida_em)
        OR (id = v_p2 AND status = 'pendente' AND concluida_em IS NULL)
        OR (id = v_p3 AND status = 'pendente');
    r := r || CASE WHEN v_res = 'cancelada' AND v_status = 'cancelada' AND v_n = 3
      THEN ' | 1 OK: gestor cancela; em_andamento volta a pendente, concluida e pendente iguais'
      ELSE ' | 1 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') || ', paradas no esperado ' || v_n || ' de 3' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2. GA chama de novo a mesma rota (toque duplo / resposta perdida)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_rota1);
    RESET ROLE;
    SELECT count(*) INTO v_n FROM public.logs WHERE rota_id = v_rota1 AND evento = 'rota_cancelada';
    r := r || CASE WHEN v_res = 'ja_cancelada' AND v_n = 1
      THEN ' | 2 OK: segunda chamada devolve ja_cancelada, sem log a mais'
      ELSE ' | 2 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', logs rota_cancelada ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. GA cancela rota pendente
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES (v_rota, v_ua, v_m, 'pendente');
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente', true),
    (v_rota, 'entrega', 'sonda p2',      -7.1, -34.8, 2, 'pendente', true),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 3, 'pendente', false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_rota);
    RESET ROLE;
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    SELECT count(*) INTO v_n FROM public.paradas WHERE rota_id = v_rota AND status = 'pendente';
    r := r || CASE WHEN v_res = 'cancelada' AND v_status = 'cancelada' AND v_n = 4
      THEN ' | 3 OK: rota pendente cancelada, paradas pendente iguais'
      ELSE ' | 3 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') || ', pendentes ' || v_n || ' de 4' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. GA, rota concluida
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES (v_rota, v_ua, v_m, 'concluida');
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, concluida_em) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false, v_concluida_em),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'concluida', true,  v_concluida_em),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'concluida', false, v_concluida_em);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_rota);
    RESET ROLE;
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_res = 'situacao_mudou' AND v_status = 'concluida'
      THEN ' | 4 OK: rota concluida devolve situacao_mudou e fica igual'
      ELSE ' | 4 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. GA, rota nao_executada
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES (v_rota, v_ua, v_m, 'nao_executada');
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente', true),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente', false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_rota);
    RESET ROLE;
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_res = 'situacao_mudou' AND v_status = 'nao_executada'
      THEN ' | 5 OK: rota nao_executada devolve situacao_mudou e fica igual'
      ELSE ' | 5 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. GB (gestor de outra loja) tenta cancelar rota em_andamento de A
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid(); v_p2 := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES (v_rota, v_ua, v_m, 'em_andamento');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (gen_random_uuid(), v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida',    false),
    (v_p2,              v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'em_andamento', true),
    (gen_random_uuid(), v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente',     false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_rota);
    RESET ROLE;
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    SELECT count(*) INTO v_n FROM public.paradas WHERE id = v_p2 AND status = 'em_andamento';
    r := r || CASE WHEN v_res = 'sem_permissao' AND v_status = 'em_andamento' AND v_n = 1
      THEN ' | 6 OK: gestor de outra loja recebe sem_permissao; rota e parada iguais'
      ELSE ' | 6 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') || ', parada em_andamento ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. GX (vínculo de gestor inativo em A) tenta cancelar rota de A
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES (v_rota, v_ua, v_m, 'pendente');
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente', true),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente', false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gx, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_rota);
    RESET ROLE;
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_res = 'sem_permissao' AND v_status = 'pendente'
      THEN ' | 7 OK: vínculo de gestor inativo recebe sem_permissao; rota igual'
      ELSE ' | 7 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. M (motorista da rota) chama a RPC
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES (v_rota, v_ua, v_m, 'em_andamento');
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida',    false),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'em_andamento', true),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente',     false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_rota);
    RESET ROLE;
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_res = 'sem_permissao' AND v_status = 'em_andamento'
      THEN ' | 8 OK: motorista da rota recebe sem_permissao; rota igual'
      ELSE ' | 8 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. GA, uuid inexistente
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(gen_random_uuid());
    RESET ROLE;
    r := r || CASE WHEN v_res = 'sem_permissao'
      THEN ' | 9 OK: rota inexistente devolve sem_permissao'
      ELSE ' | 9 FALHOU: resultado ' || coalesce(v_res, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 10. catálogo da função (lido sem abortar quando ela ainda não existe)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    v_fn := to_regprocedure('public.cancelar_rota(uuid)');
    IF v_fn IS NULL THEN
      r := r || ' | 10 FALHOU: public.cancelar_rota(uuid) não existe';
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

  -- ---------------------------------------------------------------------------
  -- 11. dados reais: nenhuma parada em_andamento em rota cancelada
  -- ---------------------------------------------------------------------------
  BEGIN
    SELECT count(*) INTO v_n
      FROM public.paradas p
      JOIN public.rotas r2 ON r2.id = p.rota_id
     WHERE r2.status = 'cancelada' AND p.status = 'em_andamento';
    r := r || CASE WHEN v_n = 0
      THEN ' | 11 OK: nenhuma parada em_andamento em rota cancelada'
      ELSE ' | 11 FALHOU: ' || v_n || ' parada(s) em_andamento em rota cancelada' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 11 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 12. authenticated sem `sub` nas claims
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES (v_rota, v_ua, v_m, 'pendente');
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 1, 'pendente', false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_rota);
    RESET ROLE;
    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    r := r || CASE WHEN v_res = 'sem_permissao' AND v_status = 'pendente'
      THEN ' | 12 OK: sessão sem usuário recebe sem_permissao; rota igual'
      ELSE ' | 12 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 12 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  RAISE EXCEPTION 'SONDA M70 (desfeita):%', r;
END
$$;
