-- ============================================================================
-- Sonda transacional da Migration 78 (`reativar_rota` confere o motorista)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 78 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, saem FALHOU os casos
-- 1 e 2 (a RPC devolve 'reativada') e o 7 (catálogo: o corpo não tem o
-- resultado novo); os casos 3 a 6 já saem OK.
--
-- Cenário comum (não depende de dado real): lojas A e B; gestor GA, gestor
-- ativo de A; gestor GB, gestor ativo só de B; motoristas M1, M2 e M3, ativos
-- em A na montagem. As rotas nascem como postgres, sem sessão, com o
-- motorista ainda ativo (o gatilho de validação confere o vínculo no INSERT);
-- depois, também como postgres, M1 perde o vínculo e M2 é desativado. As
-- chamadas rodam como `authenticated` (SET LOCAL ROLE + claims do JWT). O
-- bloco termina SEMPRE em RAISE EXCEPTION, que desfaz tudo. Leia o resultado
-- na mensagem "SONDA M78 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. GA reativa a rota de M1 (vínculo inativo na loja) →
--      'motorista_indisponivel'; rota segue `nao_executada`, parada `pulada`
--   2. GA reativa a rota de M2 (cadastro desativado) →
--      'motorista_indisponivel'; rota segue `nao_executada`
--   3. GA reativa a rota de M3 (ativo) → 'reativada'; rota `pendente` com a
--      data de hoje, parada `pendente`
--   4. GA reativa uma rota sem motorista → 'reativada'
--   5. GA chama numa rota `em_andamento` de M1 → 'situacao_mudou' (o status
--      vem antes do motorista)
--   6. GB (gestor de outra loja) chama na rota de M3 → 'sem_permissao'
--   7. catálogo: DEFINER, search_path vazio, dono postgres, sem EXECUTE para
--      PUBLIC e anon, com EXECUTE para authenticated, corpo com
--      'motorista_indisponivel'
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_gb uuid := gen_random_uuid();     -- gestor só de B
  v_m1 uuid := gen_random_uuid();     -- perde o vínculo com A
  v_m2 uuid := gen_random_uuid();     -- cadastro desativado
  v_m3 uuid := gen_random_uuid();     -- ativo
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_r1 uuid := gen_random_uuid();
  v_r2 uuid := gen_random_uuid();
  v_r3 uuid := gen_random_uuid();
  v_r4 uuid := gen_random_uuid();
  v_r5 uuid := gen_random_uuid();
  v_p1 uuid := gen_random_uuid();
  v_p3 uuid := gen_random_uuid();
  v_fn regprocedure;
  v_res text;
  v_status text;
  v_status2 text;
  v_data date;
  v_n int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_ga, 'sonda-m78-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m78-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m1, 'sonda-m78-m1-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m2, 'sonda-m78-m2-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m3, 'sonda-m78-m3-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M78 A', 'Sonda'),
    (v_ub, 'Sonda M78 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_ga, 'Sonda gestor A',     'sonda-m78-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gb, 'Sonda gestor B',     'sonda-m78-gb-' || v_sufixo || '@example.invalid', 'gestor',    v_ub, true),
    (v_m1, 'Sonda motorista M1', 'sonda-m78-m1-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_m2, 'Sonda motorista M2', 'sonda-m78-m2-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_m3, 'Sonda motorista M3', 'sonda-m78-m3-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_ga, v_ua, 'gestor',    true, true),
    (v_gb, v_ub, 'gestor',    true, true),
    (v_m1, v_ua, 'motorista', true, true),
    (v_m2, v_ua, 'motorista', true, true),
    (v_m3, v_ua, 'motorista', true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_r1, v_ua, v_m1, 'nao_executada', v_hoje - 3, NULL),
    (v_r2, v_ua, v_m2, 'nao_executada', v_hoje - 3, NULL),
    (v_r3, v_ua, v_m3, 'nao_executada', v_hoje - 3, NULL),
    (v_r4, v_ua, NULL, 'nao_executada', v_hoje - 3, NULL),
    (v_r5, v_ua, v_m1, 'em_andamento',  v_hoje,     now() - interval '1 hour');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, motivo_skip) VALUES
    (v_p1, v_r1, 'entrega', 'sonda p1', -7.1, -34.8, 1, 'pulada', true, 'cliente_ausente'),
    (v_p3, v_r3, 'entrega', 'sonda p1', -7.1, -34.8, 1, 'pulada', true, 'cliente_ausente');

  UPDATE public.usuario_unidades SET ativo = false WHERE usuario_id = v_m1 AND unidade_id = v_ua;
  UPDATE public.usuarios SET ativo = false WHERE id = v_m2;

  -- ---------------------------------------------------------------------------
  -- 1. rota de M1 (vínculo inativo)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_r1);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_r1;
    SELECT status INTO v_status2 FROM public.paradas WHERE id = v_p1;
    r := r || CASE WHEN v_res = 'motorista_indisponivel' AND v_status = 'nao_executada' AND v_status2 = 'pulada'
      THEN ' | 1 OK: motorista sem vínculo ativo → motorista_indisponivel, nada muda'
      ELSE ' | 1 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula')
           || ', parada ' || coalesce(v_status2, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2. rota de M2 (cadastro desativado)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_r2);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_r2;
    r := r || CASE WHEN v_res = 'motorista_indisponivel' AND v_status = 'nao_executada'
      THEN ' | 2 OK: motorista desativado → motorista_indisponivel, rota segue nao_executada'
      ELSE ' | 2 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. rota de M3 (ativo)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_r3);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status, data INTO v_status, v_data FROM public.rotas WHERE id = v_r3;
    SELECT status INTO v_status2 FROM public.paradas WHERE id = v_p3;
    r := r || CASE WHEN v_res = 'reativada' AND v_status = 'pendente' AND v_data = v_hoje AND v_status2 = 'pendente'
      THEN ' | 3 OK: motorista ativo → reativada, rota pendente para hoje, parada pendente'
      ELSE ' | 3 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula')
           || ' / ' || coalesce(v_data::text, 'sem data') || ', parada ' || coalesce(v_status2, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. rota sem motorista
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_r4);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_r4;
    r := r || CASE WHEN v_res = 'reativada' AND v_status = 'pendente'
      THEN ' | 4 OK: rota sem motorista segue reativando'
      ELSE ' | 4 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. rota em_andamento de M1: o status vem antes do motorista
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_r5);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_r5;
    r := r || CASE WHEN v_res = 'situacao_mudou' AND v_status = 'em_andamento'
      THEN ' | 5 OK: rota fora de nao_executada → situacao_mudou, antes da conferência do motorista'
      ELSE ' | 5 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. GB (gestor de outra loja)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_r2);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_r2;
    r := r || CASE WHEN v_res = 'sem_permissao' AND v_status = 'nao_executada'
      THEN ' | 6 OK: gestor de outra loja → sem_permissao'
      ELSE ' | 6 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. catálogo da função
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    v_fn := to_regprocedure('public.reativar_rota(uuid)');
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
       AND position('motorista_indisponivel' in p.prosrc) > 0;
    r := r || CASE WHEN v_n = 1
      THEN ' | 7 OK: reativar_rota DEFINER, search_path vazio, dono postgres, EXECUTE só de authenticated/service_role, com motorista_indisponivel'
      ELSE ' | 7 FALHOU: função fora do esperado ('
           || coalesce((SELECT p.proacl::text FROM pg_proc p WHERE p.oid = v_fn), 'proacl nulo') || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  RAISE EXCEPTION 'SONDA M78 (desfeita):%', r;
END
$$;
