-- ============================================================================
-- Sonda transacional da Migration 86 (aviso ao motorista ao cancelar e ao
-- reativar a rota)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 86 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, saem FALHOU os casos
-- 1, 6, 7 e 10 (nenhum aviso; COMMENT antigo); os outros já saem OK.
--
-- Cenário (não depende de dado real): lojas A e B; gestor GA, gestor ativo de
-- A; gestor GB, gestor ativo só de B; motoristas M1 e M2, ativos em A na
-- montagem, nenhum com linha em `push_tokens`. As rotas nascem como
-- postgres, sem sessão (o gatilho de INSERT já grava o aviso de nova rota,
-- de título diferente; a sonda conta só os títulos da Migration 86); depois,
-- também como postgres, M2 perde o vínculo com A. As chamadas rodam como
-- `authenticated` (SET LOCAL ROLE + claims do JWT). O push enfileirado pelo
-- gatilho de `notificacoes` (pg_net) é desfeito com o resto. O bloco termina
-- SEMPRE em RAISE EXCEPTION, que desfaz tudo. Leia o resultado na mensagem
-- "SONDA M86 (desfeita): N OK | N FALHOU ..." (o detalhe sai antes num
-- RAISE NOTICE; a API corta mensagens de erro em ~1.200 caracteres). Conta
-- só as linhas das rotas e usuários criados aqui.
--
--    1. GA cancela a rota pendente de M1 (sem token de push) → 'cancelada';
--       1 notificação para M1, tipo rota_nao_executada, "Rota cancelada pelo
--       gestor", mensagem com a data da rota e o nome da loja
--    2. GA cancela de novo → 'ja_cancelada'; segue 1 notificação
--    3. GA cancela uma rota concluida → 'situacao_mudou'; nenhum aviso
--    4. GB (outra loja) cancela uma rota de A → 'sem_permissao'; rota segue
--       pendente; nenhum aviso
--    5. sem sessão (`sub` ausente) → 'sem_permissao'; nenhum aviso
--    6. GA cancela a rota de M2, que saiu da loja: `criar_notificacao` recusa
--       o aviso, mas a rota fica cancelada ('cancelada') e nada é gravado
--       para M2 — o aviso não desfaz a RPC
--    7. GA reativa a rota nao_executada de M1 → 'reativada'; 1 notificação
--       para M1, tipo nova_rota_atribuida, "Rota reativada", com a data de
--       hoje e o nome da loja
--    8. GA reativa uma rota pendente → 'situacao_mudou'; GB reativa uma rota
--       nao_executada de A → 'sem_permissao'; nenhum aviso
--    9. GA reativa a rota de M2 (sem vínculo) → 'motorista_indisponivel';
--       nenhum aviso
--   10. catálogo: as duas DEFINER, search_path vazio, dona postgres, sem
--       EXECUTE de PUBLIC/anon, com EXECUTE de authenticated; corpo com
--       criar_notificacao; COMMENT da Migration 86
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_gb uuid := gen_random_uuid();     -- gestor só de B
  v_m1 uuid := gen_random_uuid();     -- ativo, sem token
  v_m2 uuid := gen_random_uuid();     -- perde o vínculo com A
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_r1 uuid := gen_random_uuid();     -- pendente de M1 (cancelar)
  v_r2 uuid := gen_random_uuid();     -- concluida de M1
  v_r3 uuid := gen_random_uuid();     -- pendente de M1 (outros casos)
  v_r4 uuid := gen_random_uuid();     -- pendente de M2 (cancelar sem vínculo)
  v_r5 uuid := gen_random_uuid();     -- nao_executada de M1 (reativar)
  v_r6 uuid := gen_random_uuid();     -- nao_executada de M1 (GB tenta)
  v_r7 uuid := gen_random_uuid();     -- nao_executada de M2
  v_rotas uuid[];
  v_res text;
  v_res2 text;
  v_status text;
  v_n int;
  v_n2 int;
  v_tok int;
  v_tipo text;
  v_msg text;
  v_ok boolean;
  v_det text;
  v_ok_n int;
  v_falhou_n int;
  v_falhas text;
BEGIN
  v_rotas := ARRAY[v_r1, v_r2, v_r3, v_r4, v_r5, v_r6, v_r7];

  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_ga, 'sonda-m86-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m86-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m1, 'sonda-m86-m1-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m2, 'sonda-m86-m2-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M86 A', 'Sonda'),
    (v_ub, 'Sonda M86 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_ga, 'Sonda gestor A',     'sonda-m86-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gb, 'Sonda gestor B',     'sonda-m86-gb-' || v_sufixo || '@example.invalid', 'gestor',    v_ub, true),
    (v_m1, 'Sonda motorista M1', 'sonda-m86-m1-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_m2, 'Sonda motorista M2', 'sonda-m86-m2-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_ga, v_ua, 'gestor',    true, true),
    (v_gb, v_ub, 'gestor',    true, true),
    (v_m1, v_ua, 'motorista', true, true),
    (v_m2, v_ua, 'motorista', true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, concluida_em) VALUES
    (v_r1, v_ua, v_m1, 'pendente',      v_hoje + 2, NULL),
    (v_r2, v_ua, v_m1, 'concluida',     v_hoje - 1, now() - interval '1 day'),
    (v_r3, v_ua, v_m1, 'pendente',      v_hoje + 3, NULL),
    (v_r4, v_ua, v_m2, 'pendente',      v_hoje + 2, NULL),
    (v_r5, v_ua, v_m1, 'nao_executada', v_hoje - 3, NULL),
    (v_r6, v_ua, v_m1, 'nao_executada', v_hoje - 4, NULL),
    (v_r7, v_ua, v_m2, 'nao_executada', v_hoje - 3, NULL);

  UPDATE public.usuario_unidades SET ativo = false WHERE usuario_id = v_m2 AND unidade_id = v_ua;

  -- ---------------------------------------------------------------------------
  -- 1. cancelar avisa o motorista (sem token de push)
  -- ---------------------------------------------------------------------------
  BEGIN
    SELECT count(*) INTO v_tok FROM public.push_tokens WHERE usuario_id = v_m1;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_r1);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_r1;
    SELECT count(*), max(tipo), max(mensagem) INTO v_n, v_tipo, v_msg
      FROM public.notificacoes
     WHERE rota_id = v_r1 AND usuario_id = v_m1 AND titulo = 'Rota cancelada pelo gestor';
    r := r || CASE WHEN v_res = 'cancelada' AND v_status = 'cancelada' AND v_tok = 0 AND v_n = 1
                    AND v_tipo = 'rota_nao_executada'
                    AND position(to_char(v_hoje + 2, 'DD/MM/YYYY') in v_msg) > 0
                    AND position('Sonda M86 A' in v_msg) > 0
      THEN ' | 1 OK: cancelada avisa M1 (rota_nao_executada, data e loja), sem token de push'
      ELSE ' | 1 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula')
           || ', tokens ' || v_tok || ', avisos ' || v_n || ', tipo ' || coalesce(v_tipo, 'nulo')
           || ', msg ' || coalesce(v_msg, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 2. ja_cancelada não avisa de novo
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_r1);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n FROM public.notificacoes
     WHERE rota_id = v_r1 AND titulo = 'Rota cancelada pelo gestor';
    r := r || CASE WHEN v_res = 'ja_cancelada' AND v_n = 1
      THEN ' | 2 OK: ja_cancelada não avisa de novo'
      ELSE ' | 2 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', avisos ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 3. situacao_mudou (rota concluida) não avisa
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_r2);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n FROM public.notificacoes
     WHERE rota_id = v_r2 AND titulo = 'Rota cancelada pelo gestor';
    r := r || CASE WHEN v_res = 'situacao_mudou' AND v_n = 0
      THEN ' | 3 OK: situacao_mudou não avisa'
      ELSE ' | 3 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', avisos ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 4. sem_permissao (gestor de outra loja) não avisa
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_r3);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_r3;
    SELECT count(*) INTO v_n FROM public.notificacoes
     WHERE rota_id = v_r3 AND titulo = 'Rota cancelada pelo gestor';
    r := r || CASE WHEN v_res = 'sem_permissao' AND v_status = 'pendente' AND v_n = 0
      THEN ' | 4 OK: sem_permissao (outra loja) não cancela nem avisa'
      ELSE ' | 4 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula')
           || ', avisos ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 5. sem sessão → sem_permissao, sem aviso
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_r3);
    v_res2 := public.reativar_rota(v_r6);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n FROM public.notificacoes
     WHERE rota_id IN (v_r3, v_r6) AND titulo IN ('Rota cancelada pelo gestor', 'Rota reativada');
    r := r || CASE WHEN v_res = 'sem_permissao' AND v_res2 = 'sem_permissao' AND v_n = 0
      THEN ' | 5 OK: sem sessão → sem_permissao nas duas, sem aviso'
      ELSE ' | 5 FALHOU: cancelar ' || coalesce(v_res, 'nulo') || ', reativar ' || coalesce(v_res2, 'nulo')
           || ', avisos ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 6. aviso recusado não desfaz o cancelamento (M2 saiu da loja)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_r4);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_r4;
    SELECT count(*) INTO v_n FROM public.notificacoes
     WHERE rota_id = v_r4 AND titulo = 'Rota cancelada pelo gestor';
    -- Prova de que o caminho do aviso existe: o corpo chama criar_notificacao.
    SELECT count(*) INTO v_n2 FROM pg_proc p
     WHERE p.oid = to_regprocedure('public.cancelar_rota(uuid)')
       AND position('criar_notificacao' in p.prosrc) > 0;
    r := r || CASE WHEN v_res = 'cancelada' AND v_status = 'cancelada' AND v_n = 0 AND v_n2 = 1
      THEN ' | 6 OK: aviso recusado (motorista fora da loja) não desfaz o cancelamento'
      ELSE ' | 6 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula')
           || ', avisos ' || v_n || ', corpo com aviso ' || v_n2 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 7. reativar avisa o motorista
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_r5);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_r5;
    SELECT count(*), max(tipo), max(mensagem) INTO v_n, v_tipo, v_msg
      FROM public.notificacoes
     WHERE rota_id = v_r5 AND usuario_id = v_m1 AND titulo = 'Rota reativada';
    r := r || CASE WHEN v_res = 'reativada' AND v_status = 'pendente' AND v_n = 1
                    AND v_tipo = 'nova_rota_atribuida'
                    AND position(to_char(v_hoje, 'DD/MM/YYYY') in v_msg) > 0
                    AND position('Sonda M86 A' in v_msg) > 0
      THEN ' | 7 OK: reativada avisa M1 (nova_rota_atribuida, hoje e loja)'
      ELSE ' | 7 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula')
           || ', avisos ' || v_n || ', tipo ' || coalesce(v_tipo, 'nulo') || ', msg ' || coalesce(v_msg, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 8. reativar: situacao_mudou e sem_permissao não avisam
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_r3);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res2 := public.reativar_rota(v_r6);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_r6;
    SELECT count(*) INTO v_n FROM public.notificacoes
     WHERE rota_id IN (v_r3, v_r6) AND titulo = 'Rota reativada';
    r := r || CASE WHEN v_res = 'situacao_mudou' AND v_res2 = 'sem_permissao'
                    AND v_status = 'nao_executada' AND v_n = 0
      THEN ' | 8 OK: reativar com situacao_mudou ou sem_permissao não avisa'
      ELSE ' | 8 FALHOU: pendente ' || coalesce(v_res, 'nulo') || ', outra loja ' || coalesce(v_res2, 'nulo')
           || ', rota ' || coalesce(v_status, 'nula') || ', avisos ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 9. reativar: motorista_indisponivel não avisa
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reativar_rota(v_r7);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_r7;
    SELECT count(*) INTO v_n FROM public.notificacoes
     WHERE rota_id = v_r7 AND titulo = 'Rota reativada';
    r := r || CASE WHEN v_res = 'motorista_indisponivel' AND v_status = 'nao_executada' AND v_n = 0
      THEN ' | 9 OK: motorista_indisponivel não reativa nem avisa'
      ELSE ' | 9 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula')
           || ', avisos ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 10. catálogo
  -- ---------------------------------------------------------------------------
  BEGIN
    v_ok := true;
    v_det := '';
    SELECT count(*) INTO v_n
      FROM pg_proc p
     WHERE p.oid IN (to_regprocedure('public.cancelar_rota(uuid)'),
                     to_regprocedure('public.reativar_rota(uuid)'))
       AND p.prosecdef
       AND p.proconfig = ARRAY['search_path=""']
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.proacl IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
       AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
       AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
       AND position('criar_notificacao' in p.prosrc) > 0
       AND obj_description(p.oid, 'pg_proc') LIKE 'Migration 86%';
    IF v_n <> 2 THEN
      v_ok := false;
      v_det := ' ' || v_n || ' de 2 funções no esperado';
    END IF;
    r := r || CASE WHEN v_ok
      THEN ' | 10 OK: catálogo (DEFINER, search_path vazio, dono, ACL, aviso, COMMENT nas duas)'
      ELSE ' | 10 FALHOU:' || v_det END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 10 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- Sanidade: nenhum aviso da Migration 86 escapou para fora das rotas da sonda.
  SELECT count(*) INTO v_n FROM public.notificacoes
   WHERE usuario_id IN (v_m1, v_m2)
     AND titulo IN ('Rota cancelada pelo gestor', 'Rota reativada')
     AND rota_id <> ALL (v_rotas);
  IF v_n <> 0 THEN
    r := r || ' | 11 FALHOU: ' || v_n || ' aviso(s) fora das rotas da sonda';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Resumo (o detalhe vai no NOTICE; a EXCEPTION desfaz tudo)
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_ok_n FROM regexp_matches(r, '\| \d+ OK:', 'g');
  SELECT count(*) INTO v_falhou_n FROM regexp_matches(r, '\| \d+ FALHOU', 'g');
  SELECT coalesce(string_agg(x[1], ' '), '') INTO v_falhas
    FROM regexp_matches(r, '(\| \d+ FALHOU[^|]*)', 'g') AS x;

  RAISE NOTICE 'SONDA M86 detalhe:%', r;
  RAISE EXCEPTION 'SONDA M86 (desfeita): % OK | % FALHOU %', v_ok_n, v_falhou_n, v_falhas;
END
$$;
