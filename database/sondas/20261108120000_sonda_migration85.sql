-- ============================================================================
-- Sonda transacional da Migration 85 (Places: teto de details, sessão ausente
-- e limpeza global)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 85 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os casos 1, 3, 4, 5,
-- 6 e 7 saem FALHOU (teto de 300, false sem sessão, limpeza inexistente).
--
-- Cenário (não depende de dado real): usuários A, B, C e D só em
-- `auth.users`. As chamadas da API rodam como `authenticated`/`anon` (SET
-- LOCAL ROLE + claims do JWT); a limpeza roda como postgres (a Edge Function
-- usa a chave secreta), e o EXECUTE dela se confere no catálogo e numa
-- chamada como `authenticated`. O bloco termina SEMPRE em RAISE EXCEPTION,
-- que desfaz tudo (inclusive as linhas antigas reais que a limpeza apagar).
-- Uso concorrente: a sonda roda em produção (READ COMMITTED), então só conta
-- e confere as linhas dos usuários que ela mesma criou — nunca a tabela
-- inteira nem o total real apagado. O DELETE global do caso 4 trava as linhas
-- antigas reais até o RAISE do fim; é inócuo (ninguém mais grava dia passado).
-- Leia o resultado na mensagem "SONDA M85 (desfeita): N OK | N FALHOU ..."
-- (o detalhe sai antes num RAISE NOTICE; a API corta mensagens de erro em
-- ~1.200 caracteres).
--
--    1. A chama details 1001 vezes → 1000 true; a 1001ª → false; linha com
--       1000 (o teto subiu de 300)
--    2. B chama autocomplete 1001 vezes → 1000 true; a 1001ª → false (o teto
--       do autocomplete não mudou)
--    3. `authenticated` sem `sub` nas claims → NULL (não false), nada
--       gravado; papel `anon` → sem EXECUTE (42501)
--    4. limpeza padrão: C tem linhas de 9 e de 8 dias atrás e de hoje; D, de
--       20 dias atrás. `limpar_uso_places_antigo()` apaga as de 9 e 20 dias
--       (e qualquer outra anterior ao corte), devolve ao menos 2 apagadas e
--       mantém as de 8 dias e de hoje
--    5. piso: `limpar_uso_places_antigo(0)` e `(NULL)` → 22023, nada apagado
--    6. `authenticated` e `anon` não executam a limpeza (42501)
--    7. catálogo: as duas funções DEFINER, search_path vazio, dona postgres,
--       sem EXECUTE de PUBLIC/anon; cota com EXECUTE de authenticated;
--       limpeza só de service_role (não de authenticated); COMMENT da
--       Migration 85 nas duas
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_c uuid := gen_random_uuid();
  v_d uuid := gen_random_uuid();
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_res boolean;
  v_true int;
  v_false int;
  v_nulo int;
  v_n int;
  v_n2 int;
  v_i int;
  v_apagadas int;
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
    (v_a, 'sonda-m85-a-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_b, 'sonda-m85-b-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_c, 'sonda-m85-c-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_d, 'sonda-m85-d-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  -- ---------------------------------------------------------------------------
  -- 1. Details aceita 1000 por dia
  -- ---------------------------------------------------------------------------
  BEGIN
    v_true := 0;
    v_false := 0;
    v_nulo := 0;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    FOR v_i IN 1..1001 LOOP
      v_res := public.consumir_cota_places('details');
      IF v_res IS NULL THEN v_nulo := v_nulo + 1;
      ELSIF v_res THEN v_true := v_true + 1;
      ELSE v_false := v_false + 1; END IF;
      -- A recusa só pode vir depois das 1000 aceitas.
      IF v_i <= 1000 AND v_res IS DISTINCT FROM true THEN
        v_false := v_false + 1000;
      END IF;
    END LOOP;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT chamadas INTO v_n FROM public.uso_places_diario
     WHERE usuario_id = v_a AND dia = v_hoje AND servico = 'details';
    r := r || CASE WHEN v_true = 1000 AND v_false = 1 AND v_nulo = 0 AND v_n = 1000
      THEN ' | 1 OK: details aceita 1000 e recusa a 1001ª; linha com 1000'
      ELSE ' | 1 FALHOU: ' || v_true || ' true, ' || v_false || ' false, ' || v_nulo
           || ' nulos, linha ' || coalesce(v_n::text, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 2. Autocomplete continua em 1000
  -- ---------------------------------------------------------------------------
  BEGIN
    v_true := 0;
    v_false := 0;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    FOR v_i IN 1..1001 LOOP
      v_res := public.consumir_cota_places('autocomplete');
      IF v_res THEN v_true := v_true + 1; ELSE v_false := v_false + 1; END IF;
      IF v_i <= 1000 AND v_res IS DISTINCT FROM true THEN
        v_false := v_false + 1000;
      END IF;
    END LOOP;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT chamadas INTO v_n FROM public.uso_places_diario
     WHERE usuario_id = v_b AND dia = v_hoje AND servico = 'autocomplete';
    r := r || CASE WHEN v_true = 1000 AND v_false = 1 AND v_n = 1000
      THEN ' | 2 OK: autocomplete segue com teto de 1000'
      ELSE ' | 2 FALHOU: ' || v_true || ' true, ' || v_false || ' false, linha '
           || coalesce(v_n::text, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 3. Sem usuário: NULL (não false); papel anon: sem EXECUTE
  -- ---------------------------------------------------------------------------
  BEGIN
    SELECT count(*) INTO v_n FROM public.uso_places_diario
     WHERE usuario_id IN (v_a, v_b, v_c, v_d);
    v_res := true;
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.consumir_cota_places('details');
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n2 FROM public.uso_places_diario
     WHERE usuario_id IN (v_a, v_b, v_c, v_d);

    v_err := 'sem erro';
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
      SET LOCAL ROLE anon;
      PERFORM public.consumir_cota_places('details');
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);

    r := r || CASE WHEN v_res IS NULL AND v_n = v_n2 AND v_err = '42501'
      THEN ' | 3 OK: sem sub devolve NULL sem gravar; anon sem EXECUTE (42501)'
      ELSE ' | 3 FALHOU: sem sub ' || coalesce(v_res::text, 'nulo') || ' (linhas ' || v_n || ' -> ' || v_n2
           || '), anon ' || v_err END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 4. Limpeza padrão: só o que é anterior a hoje - 8
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.uso_places_diario (usuario_id, dia, servico, chamadas) VALUES
      (v_c, v_hoje - 9, 'autocomplete', 5),
      (v_c, v_hoje - 8, 'autocomplete', 6),
      (v_c, v_hoje, 'details', 7),
      (v_d, v_hoje - 20, 'details', 8);
    -- Só as plantadas entram na conta: o total real apagado varia com o uso.
    v_apagadas := public.limpar_uso_places_antigo();
    SELECT count(*) INTO v_n2 FROM public.uso_places_diario
     WHERE (usuario_id = v_c AND dia = v_hoje - 9)
        OR (usuario_id = v_d AND dia = v_hoje - 20);
    v_ok := v_apagadas >= 2 AND v_n2 = 0
      AND EXISTS (SELECT 1 FROM public.uso_places_diario WHERE usuario_id = v_c AND dia = v_hoje - 8 AND chamadas = 6)
      AND EXISTS (SELECT 1 FROM public.uso_places_diario WHERE usuario_id = v_c AND dia = v_hoje AND chamadas = 7)
      AND EXISTS (SELECT 1 FROM public.uso_places_diario WHERE usuario_id = v_a AND dia = v_hoje AND chamadas = 1000);
    r := r || CASE WHEN v_ok
      THEN ' | 4 OK: limpeza apaga as de 9 e 20 dias (' || v_apagadas || ' no total) e mantém as de 8 dias e de hoje'
      ELSE ' | 4 FALHOU: apagadas ' || coalesce(v_apagadas::text, 'nulo')
           || ', antigas plantadas restantes ' || v_n2 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 5. Piso da retenção
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.uso_places_diario (usuario_id, dia, servico, chamadas) VALUES
      (v_d, v_hoje - 1, 'autocomplete', 9);
    SELECT count(*) INTO v_n FROM public.uso_places_diario
     WHERE usuario_id IN (v_a, v_b, v_c, v_d);
    v_err := 'sem erro';
    BEGIN
      PERFORM public.limpar_uso_places_antigo(0);
    EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE;
    END;
    v_err2 := 'sem erro';
    BEGIN
      PERFORM public.limpar_uso_places_antigo(NULL);
    EXCEPTION WHEN OTHERS THEN v_err2 := SQLSTATE;
    END;
    SELECT count(*) INTO v_n2 FROM public.uso_places_diario
     WHERE usuario_id IN (v_a, v_b, v_c, v_d);
    r := r || CASE WHEN v_err = '22023' AND v_err2 = '22023' AND v_n = v_n2
      THEN ' | 5 OK: retenção 0 e NULL recusadas com 22023, nada apagado'
      ELSE ' | 5 FALHOU: 0 -> ' || v_err || ', NULL -> ' || v_err2 || ', linhas ' || v_n || ' -> ' || v_n2 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 6. A API não executa a limpeza
  -- ---------------------------------------------------------------------------
  BEGIN
    v_err := 'aceito';
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      PERFORM public.limpar_uso_places_antigo();
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE;
    END;
    RESET ROLE;
    v_err2 := 'aceito';
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
      SET LOCAL ROLE anon;
      PERFORM public.limpar_uso_places_antigo();
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN v_err2 := SQLSTATE;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    r := r || CASE WHEN v_err = '42501' AND v_err2 = '42501'
      THEN ' | 6 OK: authenticated e anon sem EXECUTE na limpeza (42501)'
      ELSE ' | 6 FALHOU: authenticated ' || v_err || ', anon ' || v_err2 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 7. Catálogo
  -- ---------------------------------------------------------------------------
  BEGIN
    v_ok := true;
    v_det := '';

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
       AND obj_description(p.oid, 'pg_proc') LIKE 'Migration 85%';
    IF v_n <> 1 THEN
      v_ok := false;
      v_det := v_det || ' consumir_cota_places fora do esperado;';
    END IF;

    SELECT count(*) INTO v_n
      FROM pg_proc p
     WHERE p.oid = to_regprocedure('public.limpar_uso_places_antigo(integer)')
       AND p.prosecdef
       AND p.proconfig = ARRAY['search_path=""']
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.proacl IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
       AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
       AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
       AND has_function_privilege('service_role', p.oid, 'EXECUTE')
       AND obj_description(p.oid, 'pg_proc') LIKE 'Migration 85%';
    IF v_n <> 1 THEN
      v_ok := false;
      v_det := v_det || ' limpar_uso_places_antigo fora do esperado;';
    END IF;

    r := r || CASE WHEN v_ok
      THEN ' | 7 OK: catálogo (DEFINER, search_path vazio, dono, ACL, COMMENT nas duas)'
      ELSE ' | 7 FALHOU:' || v_det END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- Resumo (o detalhe vai no NOTICE; a EXCEPTION desfaz tudo)
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_ok_n FROM regexp_matches(r, '\| \d+ OK:', 'g');
  SELECT count(*) INTO v_falhou_n FROM regexp_matches(r, '\| \d+ FALHOU', 'g');
  SELECT coalesce(string_agg(x[1], ' '), '') INTO v_falhas
    FROM regexp_matches(r, '(\| \d+ FALHOU[^|]*)', 'g') AS x;

  RAISE NOTICE 'SONDA M85 detalhe:%', r;
  RAISE EXCEPTION 'SONDA M85 (desfeita): % OK | % FALHOU %', v_ok_n, v_falhou_n, v_falhas;
END
$$;
