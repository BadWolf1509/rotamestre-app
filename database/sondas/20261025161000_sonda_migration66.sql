-- ============================================================================
-- Sonda transacional da Migration 66 (incidente atualizado só pelo gestor da
-- loja)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 66 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os casos 1, 2, 3 e 8
-- saem FALHOU (é o vermelho esperado; os demais já valem antes).
--
-- Cenário comum (não depende de dado real): lojas A e B; motorista M, ativo
-- em A, com a rota RM; gestor GA, gestor ativo de A; gestor GB, gestor ativo
-- só de B. Cada caso de UPDATE monta o PRÓPRIO incidente (como postgres, sem
-- sessão, com status 'aberto') e não depende do resultado de outro caso. As
-- consultas rodam como `authenticated` (SET LOCAL ROLE + claims do JWT). O
-- bloco termina SEMPRE em RAISE EXCEPTION, que desfaz tudo. Leia o resultado
-- na mensagem "SONDA M66 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. M atualiza status e resolvido_em do incidente dele → 0 linhas
--   2. M atualiza observacoes_gestao do incidente dele → 0 linhas
--   3. M atualiza a descrição do incidente dele → 0 linhas
--   4. GA atualiza o status do incidente de A → 1 linha
--   5. GB (gestor de outra loja) atualiza o incidente de A → 0 linhas
--   6. M lê o próprio incidente → 1
--   7. M cria incidente na própria rota (INSERT) → 1 linha
--   8. catálogo: `qual` e `with_check` de `incidentes_update` sem
--      `motorista_id` e com o gestor da loja, `FOR UPDATE TO authenticated`,
--      e uma única policy de UPDATE na tabela
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_m uuid := gen_random_uuid();      -- motorista de A
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_gb uuid := gen_random_uuid();     -- gestor de B
  v_rm uuid := gen_random_uuid();     -- rota de M, em A
  v_inc uuid;                         -- o incidente do caso
  v_n int;
  v_total int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,  'sonda-m66-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga, 'sonda-m66-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m66-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M66 A', 'Sonda'),
    (v_ub, 'Sonda M66 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m,  'Sonda motorista M', 'sonda-m66-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_ga, 'Sonda gestor A',    'sonda-m66-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gb, 'Sonda gestor B',    'sonda-m66-gb-' || v_sufixo || '@example.invalid', 'gestor',    v_ub, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,  v_ua, 'motorista', true, true),
    (v_ga, v_ua, 'gestor',    true, true),
    (v_gb, v_ub, 'gestor',    true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_rm, v_ua, v_m, 'em_andamento');

  -- ---------------------------------------------------------------------------
  -- 1. M atualiza status e resolvido_em do incidente dele
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_rm, 'other', 'sonda m66 caso 1', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET status = 'resolvido', resolvido_em = now() WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 1 OK: motorista não muda o status do incidente'
      ELSE ' | 1 FALHOU: motorista gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2. M atualiza observacoes_gestao do incidente dele
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_rm, 'other', 'sonda m66 caso 2', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET observacoes_gestao = 'x' WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 2 OK: motorista não grava as observações da gestão'
      ELSE ' | 2 FALHOU: motorista gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. M atualiza a descrição do incidente dele
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_rm, 'other', 'sonda m66 caso 3', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET descricao = 'x' WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 3 OK: motorista não muda a descrição depois de registrar'
      ELSE ' | 3 FALHOU: motorista gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. GA atualiza o status do incidente de A
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_rm, 'other', 'sonda m66 caso 4', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET status = 'resolvido', resolvido_em = now() WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 4 OK: gestor da loja atualiza o incidente'
      ELSE ' | 4 FALHOU: gestor gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. GB (gestor de outra loja) atualiza o incidente de A
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_rm, 'other', 'sonda m66 caso 5', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET status = 'resolvido' WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 5 OK: gestor de outra loja não atualiza o incidente'
      ELSE ' | 5 FALHOU: gestor de outra loja gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. M lê o próprio incidente (o do caso 5)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1
      THEN ' | 6 OK: motorista lê o próprio incidente'
      ELSE ' | 6 FALHOU: motorista lê ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. M cria incidente na própria rota (INSERT)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
      VALUES (v_inc, v_m, v_rm, 'other', 'sonda m66 caso 7', 'sonda', 'aberto');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 7 OK: motorista cria incidente na própria rota'
      ELSE ' | 7 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. catálogo: a policy de UPDATE sem o ramo do motorista
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'incidentes'
     AND policyname = 'incidentes_update'
     AND cmd = 'UPDATE'
     AND roles = '{authenticated}'
     AND qual IS NOT NULL AND with_check IS NOT NULL
     AND qual NOT ILIKE '%motorista_id%'
     AND with_check NOT ILIKE '%motorista_id%'
     AND qual ILIKE '%gestor%'
     AND with_check ILIKE '%gestor%';
  SELECT count(*) INTO v_total FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'incidentes' AND cmd = 'UPDATE';
  r := r || CASE WHEN v_n = 1 AND v_total = 1
    THEN ' | 8 OK: incidentes_update só com o gestor da loja, em USING e WITH CHECK'
    ELSE ' | 8 FALHOU: policy de UPDATE com o ramo do motorista, ausente ou fora do esperado (' || v_n || ' de ' || v_total || ')' END;

  RAISE EXCEPTION 'SONDA M66 (desfeita):%', r;
END
$$;
