-- ============================================================================
-- Sonda transacional da Migration 61 (o incidente mantém o motorista que o
-- registrou)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 61 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os casos 1, 1b, 1c, 2,
-- 3, 6, 9a e 9b saem FALHOU (é o vermelho esperado; o 6b já é recusado pela
-- policy e sai OK nos dois momentos).
--
-- Cenário comum (não depende de dado real): lojas A e B; motoristas M e M2,
-- ativos só em A; motorista X, ativo só em B; gestor GA, gestor ativo só de
-- A. Cada caso monta o PRÓPRIO incidente (como postgres, sem sessão) e não
-- depende do resultado de outro caso. As consultas rodam como
-- `authenticated` (SET LOCAL ROLE + claims do JWT). O bloco termina SEMPRE em
-- RAISE EXCEPTION, que desfaz tudo. Leia o resultado na mensagem
-- "SONDA M61 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. gestor GA põe X (de outra loja) num incidente de M sem rota: recusado
--   1b. X não lê o incidente
--   1c. o incidente continua com M
--   2. gestor GA põe M2 (da mesma loja) num incidente de M sem rota: recusado
--   3. gestor GA passa a rota para M2 e põe M2 no incidente da rota: recusado
--   4. gestor GA resolve o incidente (status, observações, resolvido_em)
--   5. motorista M edita a descrição do próprio incidente
--   6. gestor GA grava motorista_id NULL direto: recusado
--   6b. motorista M grava o próprio motorista_id NULL: recusado
--   7. sem sessão (jobs, SQL do dono): a troca de motorista passa
--   7b. service_role (chave secreta): a troca de motorista passa
--   (O NULL gravado pela ação ON DELETE SET NULL da FK, ao excluir a conta,
--   não entra aqui porque a sonda não apaga linha; ver o cabeçalho da
--   migration.)
--   8. motorista M cria incidente (INSERT) sem rota
--   9. catálogo: gatilho habilitado com a cláusula WHEN; função com dono
--      postgres, DEFINER, `search_path` vazio, sem EXECUTE para
--      anon/authenticated
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_m uuid := gen_random_uuid();      -- motorista de A (quem registra)
  v_m2 uuid := gen_random_uuid();     -- outro motorista de A
  v_x uuid := gen_random_uuid();      -- motorista só de B
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_ra uuid;                          -- rota do caso
  v_inc uuid;                         -- o incidente do caso
  v_n int;
  v_mot uuid;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,  'sonda-m61-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m2, 'sonda-m61-m2-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_x,  'sonda-m61-x-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga, 'sonda-m61-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M61 A', 'Sonda'),
    (v_ub, 'Sonda M61 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m,  'Sonda motorista M',  'sonda-m61-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_m2, 'Sonda motorista M2', 'sonda-m61-m2-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_x,  'Sonda motorista X',  'sonda-m61-x-'  || v_sufixo || '@example.invalid', 'motorista', v_ub, true),
    (v_ga, 'Sonda gestor A',     'sonda-m61-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,  v_ua, 'motorista', true, true),
    (v_m2, v_ua, 'motorista', true, true),
    (v_x,  v_ub, 'motorista', true, true),
    (v_ga, v_ua, 'gestor',    true, true);

  -- ---------------------------------------------------------------------------
  -- 1. gestor GA põe X (de outra loja) num incidente de M sem rota
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, NULL, 'other', 'sonda m61 caso 1', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET motorista_id = v_x WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 1 FALHOU: gestor trocou o motorista do incidente (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE 'O incidente mantém o motorista%'
      THEN ' | 1 OK: gestor não põe pessoa de outra loja no incidente'
      ELSE ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- 1b. X não lê o incidente
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_x, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.incidentes WHERE id = v_inc;
  RESET ROLE;
  r := r || CASE WHEN v_n = 0
    THEN ' | 1b OK: a pessoa de outra loja não lê o incidente'
    ELSE ' | 1b FALHOU: a pessoa de outra loja lê o incidente' END;

  -- 1c. o incidente continua com M
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT motorista_id INTO v_mot FROM public.incidentes WHERE id = v_inc;
  r := r || CASE WHEN v_mot = v_m
    THEN ' | 1c OK: o incidente continua com o motorista que o registrou'
    ELSE ' | 1c FALHOU: o incidente mudou de motorista' END;

  -- ---------------------------------------------------------------------------
  -- 2. gestor GA põe M2 (da mesma loja) num incidente de M sem rota
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, NULL, 'other', 'sonda m61 caso 2', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET motorista_id = v_m2 WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 2 FALHOU: gestor trocou o motorista por outro da loja (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE 'O incidente mantém o motorista%'
      THEN ' | 2 OK: gestor não troca o motorista nem por outro da mesma loja'
      ELSE ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. gestor GA passa a rota para M2 e põe M2 no incidente da rota
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento');
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_ra, 'other', 'sonda m61 caso 3', 'sonda', 'aberto');
  UPDATE public.rotas SET motorista_id = v_m2 WHERE id = v_ra;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET motorista_id = v_m2 WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 3 FALHOU: gestor trocou o motorista do incidente da rota (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE 'O incidente mantém o motorista%'
      THEN ' | 3 OK: rota reatribuída não leva o incidente para o novo motorista'
      ELSE ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. gestor GA resolve o incidente
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, NULL, 'other', 'sonda m61 caso 4', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes
       SET status = 'resolvido', observacoes_gestao = 'sonda m61', resolvido_em = now(), updated_at = now()
     WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 4 OK: gestor resolve o incidente'
      ELSE ' | 4 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. motorista M edita a descrição do próprio incidente
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, NULL, 'other', 'sonda m61 caso 5', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET descricao = 'sonda m61 caso 5 editado', motorista_id = v_m WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 5 OK: motorista edita o próprio incidente'
      ELSE ' | 5 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. gestor GA grava motorista_id NULL direto: recusado
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, NULL, 'other', 'sonda m61 caso 6', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET motorista_id = NULL WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 6 FALHOU: gestor apagou o motorista do incidente (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE 'O incidente mantém o motorista%'
      THEN ' | 6 OK: gestor não apaga o motorista do incidente'
      ELSE ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6b. motorista M grava o próprio motorista_id NULL: recusado
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, NULL, 'other', 'sonda m61 caso 6b', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET motorista_id = NULL WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 6b FALHOU: motorista apagou a si mesmo do incidente (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    -- A WITH CHECK de incidentes_update já recusa (a linha nova não é mais
    -- dele); o gatilho também recusaria. Qualquer 42501 serve.
    r := r || CASE WHEN SQLSTATE = '42501'
      THEN ' | 6b OK: motorista não apaga a si mesmo do incidente'
      ELSE ' | 6b FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. sem sessão: a troca de motorista passa
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, NULL, 'other', 'sonda m61 caso 7', 'sonda', 'aberto');
  BEGIN
    UPDATE public.incidentes SET motorista_id = v_m2 WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    SELECT motorista_id INTO v_mot FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1 AND v_mot = v_m2
      THEN ' | 7 OK: sem sessão a troca de motorista passa'
      ELSE ' | 7 FALHOU: sem sessão gravou ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 7b. service_role (chave secreta: papel sem `sub`): a troca passa
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, NULL, 'other', 'sonda m61 caso 7b', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
    SET LOCAL ROLE service_role;
    UPDATE public.incidentes SET motorista_id = v_m2 WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    SELECT motorista_id INTO v_mot FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1 AND v_mot = v_m2
      THEN ' | 7b OK: service_role troca o motorista'
      ELSE ' | 7b FALHOU: service_role gravou ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7b FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. motorista M cria incidente (INSERT) sem rota
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
      VALUES (v_inc, v_m, NULL, 'other', 'sonda m61 caso 8', 'sonda', 'aberto');
    RESET ROLE;
    SELECT motorista_id INTO v_mot FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_mot = v_m
      THEN ' | 8 OK: motorista cria incidente sem rota'
      ELSE ' | 8 FALHOU: incidente não gravado com o motorista' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. catálogo
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_n
    FROM pg_trigger t
   WHERE t.tgrelid = 'public.incidentes'::regclass
     AND t.tgname = 'trg_incidentes_mantem_o_motorista'
     AND t.tgenabled = 'O'
     AND pg_get_triggerdef(t.oid) LIKE '%BEFORE UPDATE OF motorista_id%WHEN%';
  r := r || CASE WHEN v_n = 1
    THEN ' | 9a OK: gatilho habilitado, BEFORE UPDATE OF motorista_id com WHEN'
    ELSE ' | 9a FALHOU: gatilho ausente, desabilitado ou sem WHEN' END;

  SELECT count(*) INTO v_n FROM pg_proc
   WHERE proname = 'incidentes_mantem_o_motorista'
     AND pronamespace = 'public'::regnamespace
     AND pg_get_userbyid(proowner) = 'postgres'
     AND prosecdef
     AND proconfig = ARRAY['search_path=""']
     AND NOT has_function_privilege('anon', oid, 'EXECUTE')
     AND NOT has_function_privilege('authenticated', oid, 'EXECUTE');
  r := r || CASE WHEN v_n = 1
    THEN ' | 9b OK: função com dono postgres, DEFINER, search_path vazio, sem EXECUTE para anon/authenticated'
    ELSE ' | 9b FALHOU: função fora do esperado' END;

  RAISE EXCEPTION 'SONDA M61 (desfeita):%', r;
END
$$;
