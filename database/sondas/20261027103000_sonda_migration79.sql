-- ============================================================================
-- Sonda transacional da Migration 79 (`criar_notificacao` avisa quando não
-- grava e confere o incidente)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 79 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, saem FALHOU o caso 1
-- (a notificação com incidente de outra loja é gravada) e o 6 (catálogo: o
-- corpo não tem o WARNING nem a conferência); os casos 2 a 5 já saem OK.
--
-- O WARNING em si não é capturável de dentro de um bloco plpgsql: o caso 4
-- prova que o INSERT recusado segue devolvendo NULL sem erro, e o 6 confere
-- no catálogo que o corpo vivo tem o RAISE WARNING.
--
-- Cenário comum (não depende de dado real): lojas A e B; gestor GA, gestor
-- ativo de A; motorista M, ativo em A; motorista MB, ativo em B; incidente IA
-- de M (loja A) e IB de MB (loja B), criados como postgres, sem sessão. As
-- chamadas rodam como `authenticated` (SET LOCAL ROLE + claims do JWT). O
-- bloco termina SEMPRE em RAISE EXCEPTION, que desfaz tudo. Leia o resultado
-- na mensagem "SONDA M79 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. GA notifica M com o incidente IB (outra loja) → insufficient_privilege
--      'Incidente não pertence a uma loja do gestor.'; nada gravado
--   2. GA notifica M com o incidente IA (loja dele) → id; notificação com
--      `incidente_id` = IA
--   3. GA notifica M sem incidente → id (como antes)
--   4. sem sessão, destinatário inexistente (FK recusa o INSERT) → NULL, sem
--      erro
--   5. sem sessão, M com o incidente IB → id (o caminho sem usuário não
--      confere, como os gatilhos)
--   6. catálogo: DEFINER, search_path vazio, dono postgres, sem EXECUTE para
--      PUBLIC e anon, com EXECUTE para authenticated, corpo com RAISE WARNING
--      e com a conferência do incidente
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_m uuid := gen_random_uuid();      -- motorista de A
  v_mb uuid := gen_random_uuid();     -- motorista de B
  v_ia uuid := gen_random_uuid();     -- incidente de A
  v_ib uuid := gen_random_uuid();     -- incidente de B
  v_fn regprocedure;
  v_id uuid;
  v_err text;
  v_inc uuid;
  v_n int;
  v_antes int;
  v_depois int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_ga, 'sonda-m79-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m,  'sonda-m79-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_mb, 'sonda-m79-mb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M79 A', 'Sonda'),
    (v_ub, 'Sonda M79 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_ga, 'Sonda gestor A',     'sonda-m79-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_m,  'Sonda motorista M',  'sonda-m79-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_mb, 'Sonda motorista MB', 'sonda-m79-mb-' || v_sufixo || '@example.invalid', 'motorista', v_ub, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_ga, v_ua, 'gestor',    true, true),
    (v_m,  v_ua, 'motorista', true, true),
    (v_mb, v_ub, 'motorista', true, true);

  INSERT INTO public.incidentes (id, motorista_id, categoria, descricao, endereco, unidade_id) VALUES
    (v_ia, v_m,  'other', 'sonda m79 A', 'sonda', v_ua),
    (v_ib, v_mb, 'other', 'sonda m79 B', 'sonda', v_ub);

  -- ---------------------------------------------------------------------------
  -- 1. GA com o incidente IB (outra loja)
  -- ---------------------------------------------------------------------------
  BEGIN
    SELECT count(*) INTO v_antes FROM public.notificacoes WHERE usuario_id = v_m AND tipo = 'sonda_m79';
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      v_id := public.criar_notificacao(v_m, 'sonda_m79', 'Sonda', 'sonda m79 caso 1', NULL, NULL, v_ib);
      RESET ROLE;
      v_err := 'aceito (' || coalesce(v_id::text, 'NULL') || ')';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_depois FROM public.notificacoes WHERE usuario_id = v_m AND tipo = 'sonda_m79';
    r := r || CASE WHEN v_err = '42501 Incidente não pertence a uma loja do gestor.' AND v_depois = v_antes
      THEN ' | 1 OK: gestor não notifica com incidente de outra loja (insufficient_privilege)'
      ELSE ' | 1 FALHOU: ' || coalesce(v_err, 'nulo') || ', notificações ' || v_antes || ' → ' || v_depois END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2. GA com o incidente IA (loja dele)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_id := public.criar_notificacao(v_m, 'sonda_m79', 'Sonda', 'sonda m79 caso 2', NULL, NULL, v_ia);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT incidente_id INTO v_inc FROM public.notificacoes WHERE id = v_id;
    r := r || CASE WHEN v_id IS NOT NULL AND v_inc = v_ia
      THEN ' | 2 OK: gestor notifica com incidente da própria loja'
      ELSE ' | 2 FALHOU: id ' || coalesce(v_id::text, 'nulo') || ', incidente gravado ' || coalesce(v_inc::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. GA sem incidente
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_id := public.criar_notificacao(v_m, 'sonda_m79', 'Sonda', 'sonda m79 caso 3');
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n FROM public.notificacoes WHERE id = v_id;
    r := r || CASE WHEN v_id IS NOT NULL AND v_n = 1
      THEN ' | 3 OK: gestor notifica sem incidente, como antes'
      ELSE ' | 3 FALHOU: id ' || coalesce(v_id::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. sem sessão, destinatário inexistente: o INSERT não grava
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    v_err := NULL;
    BEGIN
      v_id := public.criar_notificacao(gen_random_uuid(), 'sonda_m79', 'Sonda', 'sonda m79 caso 4');
      v_err := 'devolveu ' || coalesce(v_id::text, 'NULL');
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    r := r || CASE WHEN v_err = 'devolveu NULL'
      THEN ' | 4 OK: INSERT recusado pela FK devolve NULL sem erro (o WARNING vai para o log)'
      ELSE ' | 4 FALHOU: ' || coalesce(v_err, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 5. sem sessão, M com o incidente IB: o caminho sem usuário não confere
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    v_id := public.criar_notificacao(v_m, 'sonda_m79', 'Sonda', 'sonda m79 caso 5', NULL, NULL, v_ib);
    SELECT incidente_id INTO v_inc FROM public.notificacoes WHERE id = v_id;
    r := r || CASE WHEN v_id IS NOT NULL AND v_inc = v_ib
      THEN ' | 5 OK: sem usuário (gatilhos, cron) a conferência do incidente não se aplica'
      ELSE ' | 5 FALHOU: id ' || coalesce(v_id::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 6. catálogo da função
  -- ---------------------------------------------------------------------------
  BEGIN
    v_fn := to_regprocedure('public.criar_notificacao(uuid, character varying, character varying, text, uuid, uuid, uuid)');
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
       AND position('RAISE WARNING' in p.prosrc) > 0
       AND position('Incidente não pertence a uma loja do gestor.' in p.prosrc) > 0;
    r := r || CASE WHEN v_n = 1
      THEN ' | 6 OK: criar_notificacao DEFINER, search_path vazio, dono postgres, ACL de antes, com WARNING e conferência do incidente'
      ELSE ' | 6 FALHOU: função fora do esperado ('
           || coalesce((SELECT p.proacl::text FROM pg_proc p WHERE p.oid = v_fn), 'proacl nulo') || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  RAISE EXCEPTION 'SONDA M79 (desfeita):%', r;
END
$$;
