-- ============================================================================
-- Sonda transacional da Migration 84 (teto diário por usuário no Google Places)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 84 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, todos os casos saem
-- FALHOU (a função e a tabela não existem).
--
-- Cenário (não depende de dado real): usuários A, B e C só em `auth.users`
-- (a tabela de uso referencia `auth.users`; perfil em `usuarios` não é
-- preciso). As chamadas da API rodam como `authenticated` (SET LOCAL ROLE +
-- claims do JWT); a conferência roda como postgres. O bloco termina SEMPRE em
-- RAISE EXCEPTION, que desfaz tudo. Leia o resultado na mensagem
-- "SONDA M84 (desfeita): N OK | N FALHOU ..." (o detalhe sai antes num RAISE
-- NOTICE; a API corta mensagens de erro em ~1.200 caracteres).
--
--    1. A chama autocomplete 1000 vezes → 1000 true; a 1001ª e a 1002ª → false;
--       a linha de hoje fica com 1000
--    2. A, com o autocomplete no teto, chama details 300 vezes → 300 true; a
--       301ª → false; linha de details com 300 (serviços contam separado)
--    3. B, com A nos dois tetos, chama autocomplete e details → true e true;
--       linhas de B com 1 cada (outro usuário não é afetado)
--    4. `authenticated` sem `sub` nas claims → false, nada gravado; papel
--       `anon` → sem EXECUTE (42501)
--    5. serviço desconhecido ('geocode') → 22023, nada gravado
--    6. limpeza: C tem linhas de 8 e de 7 dias atrás; uma chamada de C apaga
--       a de 8 dias e mantém a de 7; linha de A intacta
--    7. a API não lê nem grava a tabela direto: SELECT, INSERT, UPDATE e
--       DELETE como `authenticated` → 42501
--    8. catálogo: RLS ligada e nenhuma policy; anon/authenticated sem
--       privilégio na tabela; função DEFINER, search_path vazio, dona
--       postgres, EXECUTE de authenticated e não de anon/PUBLIC, COMMENT da
--       Migration 84
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_c uuid := gen_random_uuid();
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_res boolean;
  v_res2 boolean;
  v_true int;
  v_false int;
  v_n int;
  v_n2 int;
  v_i int;
  v_err text;
  v_err2 text;
  v_ok boolean;
  v_det text;
  v_ok_n int;
  v_falhou_n int;
  v_falhas text;
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);

  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_a, 'sonda-m84-a-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_b, 'sonda-m84-b-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_c, 'sonda-m84-c-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  -- ---------------------------------------------------------------------------
  -- 1. Conta até o teto do autocomplete e recusa depois
  -- ---------------------------------------------------------------------------
  BEGIN
    v_true := 0;
    v_false := 0;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    FOR v_i IN 1..1002 LOOP
      v_res := public.consumir_cota_places('autocomplete');
      IF v_res THEN v_true := v_true + 1; ELSE v_false := v_false + 1; END IF;
      -- A recusa só pode vir depois das 1000 aceitas.
      IF v_i <= 1000 AND NOT v_res THEN
        v_false := v_false + 1000;
      END IF;
    END LOOP;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT chamadas INTO v_n FROM public.uso_places_diario
     WHERE usuario_id = v_a AND dia = v_hoje AND servico = 'autocomplete';
    r := r || CASE WHEN v_true = 1000 AND v_false = 2 AND v_n = 1000
      THEN ' | 1 OK: autocomplete aceita 1000 e recusa a 1001ª e a 1002ª; linha com 1000'
      ELSE ' | 1 FALHOU: ' || v_true || ' true, ' || v_false || ' false, linha ' || coalesce(v_n::text, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 2. Details conta separado do autocomplete
  -- ---------------------------------------------------------------------------
  BEGIN
    v_true := 0;
    v_false := 0;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    FOR v_i IN 1..301 LOOP
      v_res := public.consumir_cota_places('details');
      IF v_res THEN v_true := v_true + 1; ELSE v_false := v_false + 1; END IF;
      IF v_i <= 300 AND NOT v_res THEN
        v_false := v_false + 1000;
      END IF;
    END LOOP;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT chamadas INTO v_n FROM public.uso_places_diario
     WHERE usuario_id = v_a AND dia = v_hoje AND servico = 'details';
    SELECT chamadas INTO v_n2 FROM public.uso_places_diario
     WHERE usuario_id = v_a AND dia = v_hoje AND servico = 'autocomplete';
    r := r || CASE WHEN v_true = 300 AND v_false = 1 AND v_n = 300 AND v_n2 = 1000
      THEN ' | 2 OK: details aceita 300 com o autocomplete no teto e recusa a 301ª'
      ELSE ' | 2 FALHOU: ' || v_true || ' true, ' || v_false || ' false, details '
           || coalesce(v_n::text, 'nula') || ', autocomplete ' || coalesce(v_n2::text, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 3. Outro usuário não é afetado
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.consumir_cota_places('autocomplete');
    v_res2 := public.consumir_cota_places('details');
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) FILTER (WHERE chamadas = 1), count(*) INTO v_n, v_n2
      FROM public.uso_places_diario WHERE usuario_id = v_b AND dia = v_hoje;
    r := r || CASE WHEN v_res AND v_res2 AND v_n = 2 AND v_n2 = 2
      THEN ' | 3 OK: B busca normalmente com A nos dois tetos'
      ELSE ' | 3 FALHOU: autocomplete ' || coalesce(v_res::text, 'nulo') || ', details '
           || coalesce(v_res2::text, 'nulo') || ', linhas de B ' || v_n2 || ' (com 1: ' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 4. Sem usuário: false; papel anon: sem EXECUTE
  -- ---------------------------------------------------------------------------
  BEGIN
    SELECT count(*) INTO v_n FROM public.uso_places_diario;
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.consumir_cota_places('autocomplete');
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n2 FROM public.uso_places_diario;

    v_err := 'sem erro';
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
      SET LOCAL ROLE anon;
      PERFORM public.consumir_cota_places('autocomplete');
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);

    r := r || CASE WHEN v_res = false AND v_n = v_n2 AND v_err = '42501'
      THEN ' | 4 OK: sem sub devolve false sem gravar; anon sem EXECUTE (42501)'
      ELSE ' | 4 FALHOU: sem sub ' || coalesce(v_res::text, 'nulo') || ' (linhas ' || v_n || ' -> ' || v_n2
           || '), anon ' || v_err END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 5. Serviço desconhecido
  -- ---------------------------------------------------------------------------
  BEGIN
    v_err := 'sem erro';
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      PERFORM public.consumir_cota_places('geocode');
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n FROM public.uso_places_diario WHERE usuario_id = v_b;
    r := r || CASE WHEN v_err = '22023' AND v_n = 2
      THEN ' | 5 OK: serviço desconhecido recusado com 22023, nada gravado'
      ELSE ' | 5 FALHOU: ' || v_err || ', linhas de B ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 6. Limpeza das linhas antigas do próprio usuário
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.uso_places_diario (usuario_id, dia, servico, chamadas) VALUES
      (v_c, v_hoje - 8, 'autocomplete', 5),
      (v_c, v_hoje - 7, 'autocomplete', 6),
      (v_a, v_hoje - 9, 'details', 7);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.consumir_cota_places('autocomplete');
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    v_ok := v_res
      AND NOT EXISTS (SELECT 1 FROM public.uso_places_diario WHERE usuario_id = v_c AND dia = v_hoje - 8)
      AND EXISTS (SELECT 1 FROM public.uso_places_diario WHERE usuario_id = v_c AND dia = v_hoje - 7 AND chamadas = 6)
      AND EXISTS (SELECT 1 FROM public.uso_places_diario WHERE usuario_id = v_c AND dia = v_hoje AND chamadas = 1)
      AND EXISTS (SELECT 1 FROM public.uso_places_diario WHERE usuario_id = v_a AND dia = v_hoje - 9);
    r := r || CASE WHEN v_ok
      THEN ' | 6 OK: a chamada de C apaga a linha de 8 dias e mantém a de 7; a de A fica'
      ELSE ' | 6 FALHOU: limpeza fora do esperado (resultado ' || coalesce(v_res::text, 'nulo') || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 7. A API não lê nem grava a tabela direto
  -- ---------------------------------------------------------------------------
  BEGIN
    v_det := '';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);

    v_err := 'aceito';
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM count(*) FROM public.uso_places_diario;
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE;
    END;
    RESET ROLE;
    v_det := v_det || ' select ' || v_err || ';';

    v_err := 'aceito';
    BEGIN
      SET LOCAL ROLE authenticated;
      INSERT INTO public.uso_places_diario (usuario_id, dia, servico, chamadas)
      VALUES (v_b, v_hoje - 1, 'autocomplete', 0);
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE;
    END;
    RESET ROLE;
    v_det := v_det || ' insert ' || v_err || ';';

    v_err := 'aceito';
    BEGIN
      SET LOCAL ROLE authenticated;
      UPDATE public.uso_places_diario SET chamadas = 0 WHERE usuario_id = v_b;
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE;
    END;
    RESET ROLE;
    v_det := v_det || ' update ' || v_err || ';';

    v_err2 := 'aceito';
    BEGIN
      SET LOCAL ROLE authenticated;
      DELETE FROM public.uso_places_diario WHERE usuario_id = v_b;
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN v_err2 := SQLSTATE;
    END;
    RESET ROLE;
    v_det := v_det || ' delete ' || v_err2 || ';';
    PERFORM set_config('request.jwt.claims', '', true);

    SELECT count(*) FILTER (WHERE chamadas = 1) INTO v_n
      FROM public.uso_places_diario WHERE usuario_id = v_b;
    r := r || CASE WHEN v_det = ' select 42501; insert 42501; update 42501; delete 42501;' AND v_n = 2
      THEN ' | 7 OK: authenticated não lê nem grava a tabela (42501 nas quatro)'
      ELSE ' | 7 FALHOU:' || v_det || ' linhas de B com 1: ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 8. Catálogo
  -- ---------------------------------------------------------------------------
  BEGIN
    v_ok := true;
    v_det := '';

    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.uso_places_diario'::regclass) THEN
      v_ok := false;
      v_det := v_det || ' RLS desligada;';
    END IF;

    SELECT count(*) INTO v_n FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'uso_places_diario';
    IF v_n <> 0 THEN
      v_ok := false;
      v_det := v_det || ' ' || v_n || ' policy(ies);';
    END IF;

    IF has_table_privilege('anon', 'public.uso_places_diario', 'SELECT,INSERT,UPDATE,DELETE')
       OR has_table_privilege('authenticated', 'public.uso_places_diario', 'SELECT,INSERT,UPDATE,DELETE') THEN
      v_ok := false;
      v_det := v_det || ' anon/authenticated com privilégio na tabela;';
    END IF;

    SELECT count(*) INTO v_n
      FROM pg_proc p
     WHERE p.oid = to_regprocedure('public.consumir_cota_places(text)')
       AND p.prosecdef
       AND p.proconfig = ARRAY['search_path=""']
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.proacl IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
       AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
       AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
       AND obj_description(p.oid, 'pg_proc') LIKE 'Migration 84%';
    IF v_n <> 1 THEN
      v_ok := false;
      v_det := v_det || ' consumir_cota_places fora do esperado;';
    END IF;

    r := r || CASE WHEN v_ok
      THEN ' | 8 OK: catálogo (RLS sem policy, tabela fechada à API, DEFINER, search_path, dono, ACL, COMMENT)'
      ELSE ' | 8 FALHOU:' || v_det END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- Resumo (o detalhe vai no NOTICE; a EXCEPTION desfaz tudo)
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_ok_n FROM regexp_matches(r, '\| \d+ OK:', 'g');
  SELECT count(*) INTO v_falhou_n FROM regexp_matches(r, '\| \d+ FALHOU', 'g');
  SELECT coalesce(string_agg(x[1], ' '), '') INTO v_falhas
    FROM regexp_matches(r, '(\| \d+ FALHOU[^|]*)', 'g') AS x;

  RAISE NOTICE 'SONDA M84 detalhe:%', r;
  RAISE EXCEPTION 'SONDA M84 (desfeita): % OK | % FALHOU %', v_ok_n, v_falhou_n, v_falhas;
END
$$;
