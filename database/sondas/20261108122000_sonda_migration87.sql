-- ============================================================================
-- Sonda transacional da Migration 87 (`resolvido_em` do incidente mantido
-- pelo banco)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 87 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, saem FALHOU os casos
-- 1, 4, 5, 6 e 8; os outros (2, 3 e 7) já saem OK — são o que o gatilho não
-- pode estragar.
--
-- Cenário (não depende de dado real): loja A, gestor GA ativo de A, motorista
-- M ativo de A, uma rota de M em A. Cada caso cria o próprio incidente como
-- postgres, sem sessão; as mudanças de status dos casos 1–5 rodam como o
-- gestor (`authenticated`, SET LOCAL ROLE + claims do JWT), como no app.
-- `now()` é fixo dentro da transação, então "preenchido pelo gatilho" é
-- `resolvido_em = now()`. O bloco termina SEMPRE em RAISE EXCEPTION, que
-- desfaz tudo. Leia o resultado na mensagem
-- "SONDA M87 (desfeita): N OK | N FALHOU ..." (o detalhe sai antes num
-- RAISE NOTICE). Conta só os incidentes criados aqui.
--
--    1. GA: aberto → resolvido sem mandar resolvido_em → resolvido_em = now()
--    2. GA: aberto → resolvido mandando a hora do aparelho → fica a mandada
--    3. GA: resolvido → resolvido (só a observação) → a data não muda
--    4. GA: resolvido → aberto (sem mandar resolvido_em) → nulo
--    5. GA: resolvido → fechado (sem mandar resolvido_em) → nulo
--    6. INSERT já resolvido sem a data → now(); INSERT aberto → nulo
--    7. registro antigo resolvido sem data: reenviar status resolvido com a
--       observação não inventa data (segue nulo)
--    8. catálogo: gatilho BEFORE INSERT OR UPDATE OF status ligado; função
--       INVOKER, search_path vazio, dona postgres, sem EXECUTE de PUBLIC,
--       anon e authenticated; COMMENT da Migration 87
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_m uuid := gen_random_uuid();      -- motorista de A
  v_rm uuid := gen_random_uuid();     -- rota de M, em A
  v_inc uuid;
  v_inc2 uuid;
  v_incs uuid[] := '{}';
  v_hora_app timestamptz := now() - interval '7 minutes';
  v_em timestamptz;
  v_em2 timestamptz;
  v_n int;
  v_ok boolean;
  v_det text;
  v_ok_n int;
  v_falhou_n int;
  v_falhas text;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_ga, 'sonda-m87-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m,  'sonda-m87-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES (v_ua, 'Sonda M87 A', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_ga, 'Sonda gestor A',    'sonda-m87-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_m,  'Sonda motorista M', 'sonda-m87-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_ga, v_ua, 'gestor',    true, true),
    (v_m,  v_ua, 'motorista', true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_rm, v_ua, v_m, 'em_andamento');

  -- ---------------------------------------------------------------------------
  -- 1. aberto → resolvido sem a data: o gatilho preenche
  -- ---------------------------------------------------------------------------
  BEGIN
    v_inc := gen_random_uuid();
    v_incs := v_incs || v_inc;
    INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
      VALUES (v_inc, v_m, v_rm, 'other', 'sonda m87 caso 1', 'sonda', 'aberto');
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET status = 'resolvido', observacoes_gestao = 'sonda m87' WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT resolvido_em INTO v_em FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1 AND v_em = now()
      THEN ' | 1 OK: entrar em resolvido sem a data preenche now()'
      ELSE ' | 1 FALHOU: linhas ' || v_n || ', resolvido_em ' || coalesce(v_em::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 2. aberto → resolvido com a hora do aparelho: fica a mandada
  -- ---------------------------------------------------------------------------
  BEGIN
    v_inc := gen_random_uuid();
    v_incs := v_incs || v_inc;
    INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
      VALUES (v_inc, v_m, v_rm, 'other', 'sonda m87 caso 2', 'sonda', 'aberto');
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET status = 'resolvido', resolvido_em = v_hora_app WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT resolvido_em INTO v_em FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1 AND v_em = v_hora_app
      THEN ' | 2 OK: a hora mandada pelo app fica'
      ELSE ' | 2 FALHOU: linhas ' || v_n || ', resolvido_em ' || coalesce(v_em::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 3. resolvido → resolvido (só a observação): a data não muda
  --    (o incidente do caso 2, com a hora do aparelho)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET status = 'resolvido', observacoes_gestao = 'sonda m87 de novo' WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT resolvido_em INTO v_em FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1 AND v_em = v_hora_app
      THEN ' | 3 OK: resolvido → resolvido mantém a data'
      ELSE ' | 3 FALHOU: linhas ' || v_n || ', resolvido_em ' || coalesce(v_em::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 4. resolvido → aberto sem mandar a data: limpa
  --    (o incidente dos casos 2 e 3)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET status = 'aberto' WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT resolvido_em INTO v_em FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1 AND v_em IS NULL
      THEN ' | 4 OK: reabrir limpa resolvido_em'
      ELSE ' | 4 FALHOU: linhas ' || v_n || ', resolvido_em ' || coalesce(v_em::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 5. resolvido → fechado sem mandar a data: limpa (só resolvido conta)
  -- ---------------------------------------------------------------------------
  BEGIN
    v_inc := gen_random_uuid();
    v_incs := v_incs || v_inc;
    INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status, resolvido_em)
      VALUES (v_inc, v_m, v_rm, 'other', 'sonda m87 caso 5', 'sonda', 'resolvido', v_hora_app);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET status = 'fechado' WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT resolvido_em INTO v_em FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1 AND v_em IS NULL
      THEN ' | 5 OK: resolvido → fechado limpa resolvido_em'
      ELSE ' | 5 FALHOU: linhas ' || v_n || ', resolvido_em ' || coalesce(v_em::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 6. INSERT já resolvido sem a data → now(); INSERT aberto → nulo
  -- ---------------------------------------------------------------------------
  BEGIN
    v_inc := gen_random_uuid();
    v_inc2 := gen_random_uuid();
    v_incs := v_incs || v_inc || v_inc2;
    INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status) VALUES
      (v_inc,  v_m, v_rm, 'other', 'sonda m87 caso 6a', 'sonda', 'resolvido'),
      (v_inc2, v_m, v_rm, 'other', 'sonda m87 caso 6b', 'sonda', 'aberto');
    SELECT resolvido_em INTO v_em FROM public.incidentes WHERE id = v_inc;
    SELECT resolvido_em INTO v_em2 FROM public.incidentes WHERE id = v_inc2;
    r := r || CASE WHEN v_em = now() AND v_em2 IS NULL
      THEN ' | 6 OK: INSERT resolvido preenche now(); INSERT aberto fica nulo'
      ELSE ' | 6 FALHOU: resolvido ' || coalesce(v_em::text, 'nulo') || ', aberto ' || coalesce(v_em2::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 7. registro antigo resolvido sem data: reenviar o status não inventa data
  --    (a data é apagada sem tocar no status, o que não dispara o gatilho)
  -- ---------------------------------------------------------------------------
  BEGIN
    v_inc := gen_random_uuid();
    v_incs := v_incs || v_inc;
    INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status, resolvido_em)
      VALUES (v_inc, v_m, v_rm, 'other', 'sonda m87 caso 7', 'sonda', 'resolvido', v_hora_app);
    UPDATE public.incidentes SET resolvido_em = NULL WHERE id = v_inc;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET status = 'resolvido', observacoes_gestao = 'sonda m87 antigo' WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT resolvido_em INTO v_em FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1 AND v_em IS NULL
      THEN ' | 7 OK: resolvido antigo sem data segue sem data'
      ELSE ' | 7 FALHOU: linhas ' || v_n || ', resolvido_em ' || coalesce(v_em::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 8. catálogo
  -- ---------------------------------------------------------------------------
  BEGIN
    v_ok := true;
    v_det := '';
    SELECT count(*) INTO v_n
      FROM pg_trigger t
     WHERE t.tgrelid = 'public.incidentes'::regclass
       AND t.tgname = 'trg_incidentes_resolvido_em'
       AND t.tgenabled = 'O'
       AND t.tgfoid = to_regprocedure('public.incidentes_resolvido_em()')
       AND pg_get_triggerdef(t.oid) LIKE '%BEFORE INSERT OR UPDATE OF status ON public.incidentes FOR EACH ROW%';
    IF v_n <> 1 THEN
      v_ok := false;
      v_det := v_det || ' gatilho ausente ou diferente;';
    END IF;
    SELECT count(*) INTO v_n
      FROM pg_proc p
     WHERE p.oid = to_regprocedure('public.incidentes_resolvido_em()')
       AND NOT p.prosecdef
       AND p.proconfig = ARRAY['search_path=""']
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.proacl IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
       AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
       AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
       AND obj_description(p.oid, 'pg_proc') LIKE 'Migration 87%';
    IF v_n <> 1 THEN
      v_ok := false;
      v_det := v_det || ' função fora do esperado;';
    END IF;
    r := r || CASE WHEN v_ok
      THEN ' | 8 OK: catálogo (gatilho, INVOKER, search_path vazio, dono, ACL, COMMENT)'
      ELSE ' | 8 FALHOU:' || v_det END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- Sanidade: a sonda só criou os próprios incidentes.
  SELECT count(*) INTO v_n FROM public.incidentes WHERE rota_id = v_rm AND id <> ALL (v_incs);
  IF v_n <> 0 THEN
    r := r || ' | 9 FALHOU: ' || v_n || ' incidente(s) fora dos da sonda na rota da sonda';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Resumo (o detalhe vai no NOTICE; a EXCEPTION desfaz tudo)
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_ok_n FROM regexp_matches(r, '\| \d+ OK:', 'g');
  SELECT count(*) INTO v_falhou_n FROM regexp_matches(r, '\| \d+ FALHOU', 'g');
  SELECT coalesce(string_agg(x[1], ' '), '') INTO v_falhas
    FROM regexp_matches(r, '(\| \d+ FALHOU[^|]*)', 'g') AS x;

  RAISE NOTICE 'SONDA M87 detalhe:%', r;
  RAISE EXCEPTION 'SONDA M87 (desfeita): % OK | % FALHOU %', v_ok_n, v_falhou_n, v_falhas;
END
$$;
