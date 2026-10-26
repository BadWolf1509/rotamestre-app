-- ============================================================================
-- Sonda transacional da Migration 72 (RPC `nomes_motoristas_das_rotas`)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 72 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, o caso 1 sai OK (é a
-- premissa: a RLS de `usuarios` esconde o motorista) e os casos 2 a 9 saem
-- FALHOU (é o vermelho esperado: a função não existe, 42883; o 9 lê o
-- catálogo).
--
-- Cenário (não depende de dado real), montado como postgres, sem sessão:
--   - lojas A e B;
--   - M1: motorista com vínculo em A que fica INATIVO depois de a rota ser
--     criada, e `usuarios.ativo = false` (o caso medido em 26/10/2026);
--   - M2: motorista ativo em A e em B;
--   - M3: motorista ativo em A quando a rota é criada; depois o vínculo dele
--     passa para a loja B (UPDATE de `unidade_id`), e M3 fica sem linha em A.
--     Isso representa "nunca teve vínculo com A" e, de quebra, prova que o
--     vínculo conta só na loja da rota (o de B não serve para a rota de A);
--   - GA: gestor ativo de A; GB: gestor ativo só de B; GX: vínculo de gestor
--     INATIVO em A;
--   - rotas R1 (M1, A), R2 (M2, A), R3 (M3, A), R4 (sem motorista, A) e
--     R5 (M2, B).
-- O vínculo de M1 e o de M3 mudam depois do INSERT das rotas porque o gatilho
-- `validar_motorista_e_loja_da_rota` exige vínculo ativo do motorista na loja
-- ao criar a rota. As chamadas rodam como `authenticated` (SET LOCAL ROLE +
-- claims do JWT); a conferência roda como postgres. O bloco termina SEMPRE em
-- RAISE EXCEPTION, que desfaz tudo. Leia o resultado na mensagem
-- "SONDA M72 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. GA lê `usuarios` de M1 direto (premissa) → 0 linhas
--   2. GA pede [R1] → 1 linha, rota R1, nome de M1
--   3. GA pede [R1, R2, R3, R4, R5] → só R1 e R2, cada uma com o nome do
--      próprio motorista (R3 sem vínculo em A, R4 sem motorista, R5 de outra
--      loja)
--   4. GX (vínculo de gestor inativo em A) pede [R1] → 0 linhas
--   5. GB (gestor de outra loja) pede [R1] → 0 linhas
--   6. M2 (motorista) pede [R2] → 0 linhas
--   7. 1001 ids → erro 22023 com 'LISTA_GRANDE'; 1000 ids → sem erro
--   8. NULL e '{}' → 0 linhas, sem erro
--   9. catálogo: retorno TABLE(rota_id uuid, nome text), STABLE, SECURITY
--      DEFINER, search_path vazio, dono postgres, anon sem EXECUTE, proacl sem
--      PUBLIC, authenticated e service_role com EXECUTE
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_m1 uuid := gen_random_uuid();     -- motorista com vínculo inativo em A
  v_m2 uuid := gen_random_uuid();     -- motorista ativo em A e B
  v_m3 uuid := gen_random_uuid();     -- motorista sem linha em A
  v_ga uuid := gen_random_uuid();     -- gestor ativo de A
  v_gb uuid := gen_random_uuid();     -- gestor ativo só de B
  v_gx uuid := gen_random_uuid();     -- vínculo de gestor inativo em A
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_r1 uuid := gen_random_uuid();
  v_r2 uuid := gen_random_uuid();
  v_r3 uuid := gen_random_uuid();
  v_r4 uuid := gen_random_uuid();
  v_r5 uuid := gen_random_uuid();
  v_ids uuid[];
  v_fn regprocedure;
  v_n int;
  v_n2 int;
  v_txt text;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m1, 'sonda-m72-m1-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m2, 'sonda-m72-m2-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m3, 'sonda-m72-m3-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga, 'sonda-m72-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m72-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gx, 'sonda-m72-gx-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M72 A', 'Sonda'),
    (v_ub, 'Sonda M72 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m1, 'Sonda motorista M1', 'sonda-m72-m1-' || v_sufixo || '@example.invalid', 'motorista', v_ua, false),
    (v_m2, 'Sonda motorista M2', 'sonda-m72-m2-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_m3, 'Sonda motorista M3', 'sonda-m72-m3-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_ga, 'Sonda gestor A',     'sonda-m72-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gb, 'Sonda gestor B',     'sonda-m72-gb-' || v_sufixo || '@example.invalid', 'gestor',    v_ub, true),
    (v_gx, 'Sonda gestor X',     'sonda-m72-gx-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m1, v_ua, 'motorista', true,  true),
    (v_m2, v_ua, 'motorista', true,  true),
    (v_m2, v_ub, 'motorista', true,  false),
    (v_m3, v_ua, 'motorista', true,  true),
    (v_ga, v_ua, 'gestor',    true,  true),
    (v_gb, v_ub, 'gestor',    true,  true),
    (v_gx, v_ua, 'gestor',    false, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_r1, v_ua, v_m1, 'nao_executada', v_hoje - 30),
    (v_r2, v_ua, v_m2, 'pendente',  v_hoje),
    (v_r3, v_ua, v_m3, 'nao_executada', v_hoje - 30),
    (v_r4, v_ua, NULL, 'pendente',  v_hoje),
    (v_r5, v_ub, v_m2, 'pendente',  v_hoje);

  -- Depois das rotas: M1 perde o vínculo ativo em A; M3 fica sem linha em A.
  UPDATE public.usuario_unidades SET ativo = false
   WHERE usuario_id = v_m1 AND unidade_id = v_ua;
  UPDATE public.usuario_unidades SET unidade_id = v_ub, is_principal = false
   WHERE usuario_id = v_m3 AND unidade_id = v_ua;

  -- ---------------------------------------------------------------------------
  -- 1. premissa: GA não enxerga M1 em `usuarios`
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.usuarios WHERE id = v_m1;
    RESET ROLE;
    r := r || CASE WHEN v_n = 0
      THEN ' | 1 OK: a RLS de usuarios esconde do gestor o motorista com vínculo inativo'
      ELSE ' | 1 FALHOU: o gestor lê ' || v_n || ' linha(s) de M1 em usuarios (premissa da migration não vale)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2. GA pede [R1]
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*), count(*) FILTER (WHERE x.rota_id = v_r1 AND x.nome = 'Sonda motorista M1')
      INTO v_n, v_n2
      FROM public.nomes_motoristas_das_rotas(ARRAY[v_r1]) x;
    RESET ROLE;
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1
      THEN ' | 2 OK: gestor recebe o nome do motorista com vínculo inativo na loja'
      ELSE ' | 2 FALHOU: linhas ' || v_n || ', com rota e nome esperados ' || v_n2 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. GA pede [R1, R2, R3, R4, R5]
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*),
           count(*) FILTER (WHERE (x.rota_id = v_r1 AND x.nome = 'Sonda motorista M1')
                               OR (x.rota_id = v_r2 AND x.nome = 'Sonda motorista M2')),
           string_agg(x.rota_id::text, ',')
      INTO v_n, v_n2, v_txt
      FROM public.nomes_motoristas_das_rotas(ARRAY[v_r1, v_r2, v_r3, v_r4, v_r5]) x;
    RESET ROLE;
    r := r || CASE WHEN v_n = 2 AND v_n2 = 2
      THEN ' | 3 OK: só R1 e R2; sem vínculo na loja, sem motorista e rota de outra loja ficam de fora'
      ELSE ' | 3 FALHOU: linhas ' || v_n || ', esperadas ' || v_n2 || ' de 2 (' || coalesce(v_txt, 'nenhuma') || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. GX (vínculo de gestor inativo em A) pede [R1]
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gx, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.nomes_motoristas_das_rotas(ARRAY[v_r1]) x;
    RESET ROLE;
    r := r || CASE WHEN v_n = 0
      THEN ' | 4 OK: vínculo de gestor inativo não recebe nome'
      ELSE ' | 4 FALHOU: gestor inativo recebeu ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. GB (gestor de outra loja) pede [R1]
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.nomes_motoristas_das_rotas(ARRAY[v_r1]) x;
    RESET ROLE;
    r := r || CASE WHEN v_n = 0
      THEN ' | 5 OK: gestor de outra loja não recebe nome'
      ELSE ' | 5 FALHOU: gestor de outra loja recebeu ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. M2 (motorista) pede [R2]
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.nomes_motoristas_das_rotas(ARRAY[v_r2]) x;
    RESET ROLE;
    r := r || CASE WHEN v_n = 0
      THEN ' | 6 OK: motorista não recebe nome'
      ELSE ' | 6 FALHOU: motorista recebeu ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. teto: 1001 ids recusados com 22023; 1000 ids aceitos
  -- ---------------------------------------------------------------------------
  v_txt := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_ids := ARRAY(SELECT gen_random_uuid() FROM generate_series(1, 1001));
    BEGIN
      SELECT count(*) INTO v_n FROM public.nomes_motoristas_das_rotas(v_ids) x;
      v_txt := 'sem erro com 1001 ids (' || v_n || ' linhas)';
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE <> '22023' OR SQLERRM NOT LIKE 'LISTA_GRANDE:%' THEN
        v_txt := 'erro diferente com 1001 ids (' || SQLSTATE || ' ' || SQLERRM || ')';
      END IF;
    END;
    IF v_txt IS NULL THEN
      v_ids := v_ids[1:1000];
      SELECT count(*) INTO v_n FROM public.nomes_motoristas_das_rotas(v_ids) x;
    END IF;
    RESET ROLE;
    r := r || CASE WHEN v_txt IS NULL AND v_n = 0
      THEN ' | 7 OK: 1001 ids recusados com 22023 LISTA_GRANDE; 1000 ids aceitos'
      ELSE ' | 7 FALHOU: ' || coalesce(v_txt, '1000 ids devolveram ' || v_n || ' linha(s)') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. lista nula e lista vazia
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.nomes_motoristas_das_rotas(NULL::uuid[]) x;
    SELECT count(*) INTO v_n2 FROM public.nomes_motoristas_das_rotas('{}'::uuid[]) x;
    RESET ROLE;
    r := r || CASE WHEN v_n = 0 AND v_n2 = 0
      THEN ' | 8 OK: lista nula e lista vazia devolvem zero linhas, sem erro'
      ELSE ' | 8 FALHOU: nula ' || v_n || ', vazia ' || v_n2 || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. catálogo da função (lido sem abortar quando ela ainda não existe)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    v_fn := to_regprocedure('public.nomes_motoristas_das_rotas(uuid[])');
    IF v_fn IS NULL THEN
      r := r || ' | 9 FALHOU: public.nomes_motoristas_das_rotas(uuid[]) não existe';
    ELSE
      SELECT count(*) INTO v_n
        FROM pg_proc p
       WHERE p.oid = v_fn
         AND pg_get_function_result(p.oid) = 'TABLE(rota_id uuid, nome text)'
         AND p.provolatile = 's'
         AND p.prosecdef
         AND p.proconfig = ARRAY['search_path=""']
         AND pg_get_userbyid(p.proowner) = 'postgres'
         AND p.proacl IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
         AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
         AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
         AND has_function_privilege('service_role', p.oid, 'EXECUTE');
      r := r || CASE WHEN v_n = 1
        THEN ' | 9 OK: TABLE(rota_id uuid, nome text), STABLE, SECURITY DEFINER, search_path vazio, dono postgres, EXECUTE só de authenticated e service_role'
        ELSE ' | 9 FALHOU: catálogo fora do esperado (' || coalesce((SELECT pg_get_function_result(p.oid) || ' / ' || p.provolatile || ' / ' || coalesce(p.proacl::text, 'proacl nulo') FROM pg_proc p WHERE p.oid = v_fn), 'sem linha') || ')' END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  RAISE EXCEPTION 'SONDA M72 (desfeita):%', r;
END
$$;
