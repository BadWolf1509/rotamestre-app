-- ============================================================================
-- Sonda transacional da Migration 65 (bucket fotos-entrega: na pasta da loja,
-- o gestor lê pela loja e o motorista lê as fotos das próprias rotas)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 65 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os casos 1, 2 e 11
-- saem FALHOU (é o vermelho esperado).
--
-- Cenário comum (não depende de dado real): lojas A e B; motorista M, ativo
-- em A, com a rota RM; motorista C, colega ativo em A, com a rota RC; gestor
-- GA, gestor ativo de A, com foto de perfil; gestor GB, gestor ativo só de B;
-- motorista D, com vínculo ativo em A mas desativado como pessoa
-- (`usuarios.ativo = false`), com a rota RD; motorista E, com o vínculo em A
-- inativo, com a rota RE. Objetos (só metadados em `storage.objects`, entram
-- como postgres; nada vai para o armazenamento de arquivos):
--   A/RM/x_1.jpg  dono M
--   A/RC/x_2.jpg  dono C
--   A/RM/x_3.jpg  dono C (foto da rota de M tirada por outra conta)
--   A/RD/x_4.jpg  dono C
--   A/RE/x_5.jpg  dono C
--   perfis/perfil_<GA>_1.jpg  dono GA, referenciado em usuarios.foto_url
-- As leituras rodam como `authenticated` (SET LOCAL ROLE + claims do JWT),
-- como a Storage API faz ao assinar a URL. O bloco termina SEMPRE em RAISE
-- EXCEPTION, que desfaz tudo. Leia o resultado na mensagem
-- "SONDA M65 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. C lê A/RM/x_1.jpg (foto da rota de M, dono M) → 0
--   2. C, em A/%, não vê objeto de outro dono → 0
--   3. M lê A/RM/x_1.jpg (dono) → 1
--   4. M lê A/RM/x_3.jpg (rota dele, dono C) → 1
--   5. GA lê os 5 objetos de A/% → 5
--   6. GB (gestor de outra loja) lê A/RM/x_1.jpg → 0
--   7. D (pessoa desativada) lê A/RD/x_4.jpg (rota dele, dono C) → 0
--   8. E (vínculo inativo) lê A/RE/x_5.jpg (rota dele, dono C) → 0
--   9. M sobe A/RM/x_6.jpg (dono M) → 1 linha (INSERT inalterado)
--  10. M lê a foto de perfil de GA → 1 (ramo perfis inalterado)
--  11. catálogo: foto_de_rota_minha DEFINER, `search_path` vazio, dono
--      postgres, EXECUTE para authenticated e não para anon; a policy de
--      SELECT sem minhas_unidades_com_acesso e com o helper novo
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_m uuid := gen_random_uuid();      -- motorista de A, dono de RM
  v_c uuid := gen_random_uuid();      -- colega de A, dono de RC
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_gb uuid := gen_random_uuid();     -- gestor só de B
  v_d uuid := gen_random_uuid();      -- motorista desativado como pessoa
  v_e uuid := gen_random_uuid();      -- motorista com vínculo inativo
  v_rm uuid := gen_random_uuid();     -- rota de M em A
  v_rc uuid := gen_random_uuid();     -- rota de C em A
  v_rd uuid := gen_random_uuid();     -- rota de D em A
  v_re uuid := gen_random_uuid();     -- rota de E em A
  o_1 text;   -- A/RM, dono M
  o_2 text;   -- A/RC, dono C
  o_3 text;   -- A/RM, dono C
  o_4 text;   -- A/RD, dono C
  o_5 text;   -- A/RE, dono C
  o_6 text;   -- A/RM, enviado por M como authenticated
  o_perfil text;
  v_n int;
BEGIN
  o_1 := v_ua || '/' || v_rm || '/x_1.jpg';
  o_2 := v_ua || '/' || v_rc || '/x_2.jpg';
  o_3 := v_ua || '/' || v_rm || '/x_3.jpg';
  o_4 := v_ua || '/' || v_rd || '/x_4.jpg';
  o_5 := v_ua || '/' || v_re || '/x_5.jpg';
  o_6 := v_ua || '/' || v_rm || '/x_6.jpg';
  o_perfil := 'perfis/perfil_' || v_ga || '_1.jpg';

  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,  'sonda-m65-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_c,  'sonda-m65-c-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga, 'sonda-m65-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m65-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_d,  'sonda-m65-d-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_e,  'sonda-m65-e-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M65 A', 'Sonda'),
    (v_ub, 'Sonda M65 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo, foto_url) VALUES
    (v_m,  'Sonda motorista M', 'sonda-m65-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true,  NULL),
    (v_c,  'Sonda motorista C', 'sonda-m65-c-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true,  NULL),
    (v_ga, 'Sonda gestor A',    'sonda-m65-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true,  o_perfil),
    (v_gb, 'Sonda gestor B',    'sonda-m65-gb-' || v_sufixo || '@example.invalid', 'gestor',    v_ub, true,  NULL),
    (v_d,  'Sonda motorista D', 'sonda-m65-d-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, false, NULL),
    (v_e,  'Sonda motorista E', 'sonda-m65-e-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true,  NULL);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,  v_ua, 'motorista', true, true),
    (v_c,  v_ua, 'motorista', true, true),
    (v_ga, v_ua, 'gestor',    true, true),
    (v_gb, v_ub, 'gestor',    true, true),
    (v_d,  v_ua, 'motorista', true, true),
    (v_e,  v_ua, 'motorista', true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_rm, v_ua, v_m, 'em_andamento'),
    (v_rc, v_ua, v_c, 'em_andamento'),
    (v_rd, v_ua, v_d, 'em_andamento'),
    (v_re, v_ua, v_e, 'em_andamento');

  -- O vínculo de E só fica inativo depois de a rota existir: o gatilho
  -- `trg_validar_motorista_e_loja_da_rota` exige vínculo ativo para criar a
  -- rota (e não dispara neste UPDATE de usuario_unidades).
  UPDATE public.usuario_unidades SET ativo = false
   WHERE usuario_id = v_e AND unidade_id = v_ua;

  INSERT INTO storage.objects (bucket_id, name, owner, owner_id) VALUES
    ('fotos-entrega', o_1,      v_m,  v_m::text),
    ('fotos-entrega', o_2,      v_c,  v_c::text),
    ('fotos-entrega', o_3,      v_c,  v_c::text),
    ('fotos-entrega', o_4,      v_c,  v_c::text),
    ('fotos-entrega', o_5,      v_c,  v_c::text),
    ('fotos-entrega', o_perfil, v_ga, v_ga::text);

  -- ---------------------------------------------------------------------------
  -- 1. C lê a foto da rota de M (dono M)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM storage.objects
     WHERE bucket_id = 'fotos-entrega' AND name = o_1;
    r := r || CASE WHEN v_n = 0
      THEN ' | 1 OK: o colega da loja não lê a foto da rota de outro motorista (0)'
      ELSE ' | 1 FALHOU: o colega da loja lê a foto da rota de outro motorista (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2. C, na pasta da loja A, só vê os próprios objetos
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM storage.objects
     WHERE bucket_id = 'fotos-entrega' AND name LIKE v_ua || '/%'
       AND owner IS DISTINCT FROM v_c;
    r := r || CASE WHEN v_n = 0
      THEN ' | 2 OK: na pasta da loja, o colega só vê os próprios objetos (0 de outro dono)'
      ELSE ' | 2 FALHOU: na pasta da loja, o colega vê ' || v_n || ' objeto(s) de outro dono' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. M lê o próprio upload na própria rota
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM storage.objects
     WHERE bucket_id = 'fotos-entrega' AND name = o_1;
    r := r || CASE WHEN v_n = 1
      THEN ' | 3 OK: o motorista lê o próprio upload (1)'
      ELSE ' | 3 FALHOU: o motorista lê ' || v_n || ' do próprio upload' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. M lê a foto da própria rota tirada por outra conta
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM storage.objects
     WHERE bucket_id = 'fotos-entrega' AND name = o_3;
    r := r || CASE WHEN v_n = 1
      THEN ' | 4 OK: o motorista lê a foto da própria rota enviada por outra conta (1)'
      ELSE ' | 4 FALHOU: o motorista lê ' || v_n || ' da foto da própria rota enviada por outra conta' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. GA lê os 5 objetos da pasta da loja A
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM storage.objects
     WHERE bucket_id = 'fotos-entrega' AND name IN (o_1, o_2, o_3, o_4, o_5);
    r := r || CASE WHEN v_n = 5
      THEN ' | 5 OK: o gestor da loja lê as 5 fotos da loja'
      ELSE ' | 5 FALHOU: o gestor da loja lê ' || v_n || ' de 5' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. GB (gestor de outra loja) lê a foto da rota de M
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM storage.objects
     WHERE bucket_id = 'fotos-entrega' AND name = o_1;
    r := r || CASE WHEN v_n = 0
      THEN ' | 6 OK: o gestor de outra loja não lê a foto (0)'
      ELSE ' | 6 FALHOU: o gestor de outra loja lê ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. D (pessoa desativada) lê a foto da própria rota (dono C)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_d, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM storage.objects
     WHERE bucket_id = 'fotos-entrega' AND name = o_4;
    r := r || CASE WHEN v_n = 0
      THEN ' | 7 OK: a pessoa desativada não lê a foto da própria rota (0)'
      ELSE ' | 7 FALHOU: a pessoa desativada lê ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. E (vínculo inativo) lê a foto da própria rota (dono C)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_e, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM storage.objects
     WHERE bucket_id = 'fotos-entrega' AND name = o_5;
    r := r || CASE WHEN v_n = 0
      THEN ' | 8 OK: o vínculo inativo não lê a foto da própria rota (0)'
      ELSE ' | 8 FALHOU: o vínculo inativo lê ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. M sobe uma foto na pasta da própria rota (INSERT inalterado)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO storage.objects (bucket_id, name, owner, owner_id)
      VALUES ('fotos-entrega', o_6, v_m, v_m::text);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 9 OK: o motorista sobe foto na pasta da própria rota (1)'
      ELSE ' | 9 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: upload recusado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 10. M lê a foto de perfil do gestor (ramo perfis inalterado)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM storage.objects
     WHERE bucket_id = 'fotos-entrega' AND name = o_perfil;
    r := r || CASE WHEN v_n = 1
      THEN ' | 10 OK: o motorista lê a foto de perfil do gestor da loja (1)'
      ELSE ' | 10 FALHOU: o motorista lê ' || v_n || ' da foto de perfil do gestor' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 10 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 11. catálogo
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT count(*) INTO v_n FROM pg_proc
   WHERE oid = to_regprocedure('public.foto_de_rota_minha(text)')
     AND pg_get_userbyid(proowner) = 'postgres'
     AND prosecdef
     AND proconfig = ARRAY['search_path=""']
     AND has_function_privilege('authenticated', oid, 'EXECUTE')
     AND NOT has_function_privilege('anon', oid, 'EXECUTE');
  SELECT v_n + count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname = 'fotos-entrega select'
     AND roles = '{authenticated}'
     AND qual NOT ILIKE '%minhas_unidades_com_acesso%'
     AND qual NOT ILIKE '%get_my_unidade_ids%'
     AND qual ILIKE '%foto_de_rota_minha%';
  r := r || CASE WHEN v_n = 2
    THEN ' | 11 OK: função DEFINER, search_path vazio, dono postgres, EXECUTE só para authenticated; policy de SELECT pela rota própria'
    ELSE ' | 11 FALHOU: ' || v_n || ' de 2 conferências de catálogo' END;

  RAISE EXCEPTION 'SONDA M65 (desfeita):%', r;
END
$$;
