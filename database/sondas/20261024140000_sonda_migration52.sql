-- ============================================================================
-- Sonda transacional da Migration 52 (contato do gestor segue o vínculo
-- ativo)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 52 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Rodada sozinha antes da migration,
-- tem de mostrar FALHOU (vermelho).
--
-- O bloco monta um cenário próprio (não depende de dado real), como
-- postgres: lojas A, B, C e D; gestores com vínculo ativo e inativo, ativos
-- e inativos no cadastro, com e sem a flag de gestor principal; motoristas
-- com uma ou duas lojas, com rota aberta, só rota antiga ou sem rota. As
-- chamadas rodam como `authenticated` (SET LOCAL ROLE + claims do JWT). O
-- bloco termina SEMPRE em RAISE EXCEPTION, que desfaz tudo — inclusive as
-- notificações que os gatilhos de rota criarem. Não tem DELETE. Leia o
-- resultado na mensagem "SONDA M52 (desfeita): ...". Esperado: todas as
-- linhas com OK.
--
--   1. rota em andamento em B (vínculo B mais antigo, A mais recente, rota
--      pendente em A): gestor de B
--   2. só rota pendente em A, rota concluída mais recente em B: gestor de A
--   3. sem rota aberta, rota mais recente em B (vínculo de A mais recente):
--      gestor de B
--   4. sem rota, vínculos A (mais antigo) e B: gestor de A
--   5. sem rota, vínculo B marcado como principal: gestor de B
--   6. rota em andamento em C com o vínculo de C desativado, vínculo ativo em
--      A: gestor de A, nunca o de C
--   7. nenhum vínculo ativo (o cadastro ainda aponta para C): nenhuma linha
--   8. inativo no cadastro, vínculo ativo em A: nenhuma linha
--   9. loja D cujo único gestor tem o vínculo desativado: nenhuma linha
--  10. gestor de C chamando: o contato de um gestor de C
--  11. na loja A vence o gestor principal (ativo, vínculo ativo) sobre o
--      vínculo mais antigo; em B vence o vínculo ativo mais antigo de gestor
--      ativo — não o vínculo ainda mais antigo, desativado, nem o gestor
--      inativo no cadastro, nem a flag de principal de um gestor cujo
--      cadastro aponta para outra loja. Coberto pelos casos 1-6 (o e-mail
--      esperado é sempre o do gestor certo). Só um gestor principal ativo por
--      loja (`idx_one_main_manager_per_unit`)
--  12. formato: colunas nome, telefone e e-mail, com o telefone do gestor
--  13. sem usuário autenticado: exceção 42501
--  14. catálogo: retorno, SECURITY DEFINER, search_path vazio, STABLE;
--      EXECUTE para authenticated, não para anon nem PUBLIC
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();
  v_ub uuid := gen_random_uuid();
  v_uc uuid := gen_random_uuid();
  v_ud uuid := gen_random_uuid();
  -- gestores
  v_ga_princ uuid := gen_random_uuid();     -- A: principal, vínculo ativo
  v_ga_antigo uuid := gen_random_uuid();    -- A: vínculo ativo mais antigo, sem flag
  v_ga_vinc_off uuid := gen_random_uuid();  -- A: vínculo desativado
  v_ga_pessoa_off uuid := gen_random_uuid();-- A: inativo no cadastro, vínculo ativo
  v_gb0 uuid := gen_random_uuid();          -- B: vínculo ativo mais antigo
  v_gb1 uuid := gen_random_uuid();          -- B: flag de principal, cadastro em C
  v_gb_vinc_off uuid := gen_random_uuid();  -- B: vínculo mais antigo, desativado
  v_gb_pessoa_off uuid := gen_random_uuid();-- B: inativo no cadastro, vínculo ativo antigo
  v_gc uuid := gen_random_uuid();           -- C
  v_gd_vinc_off uuid := gen_random_uuid();  -- D: único gestor, vínculo desativado
  -- motoristas
  v_m1 uuid := gen_random_uuid();
  v_m2 uuid := gen_random_uuid();
  v_m3 uuid := gen_random_uuid();
  v_m4 uuid := gen_random_uuid();
  v_m5 uuid := gen_random_uuid();
  v_m6 uuid := gen_random_uuid();
  v_m7 uuid := gen_random_uuid();
  v_m8 uuid := gen_random_uuid();
  v_m9 uuid := gen_random_uuid();
  v_quem uuid[];
  v_esperado uuid[];
  v_rotulo text[];
  v_email_esperado text;
  v_n int;
  v_nome text;
  v_tel text;
  v_email text;
  v_state text;
  v_bool boolean;
  v_txt text;
  i int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role)
  SELECT x.id, 'sonda-m52-' || x.rotulo || '-' || v_sufixo || '@example.invalid',
         'authenticated', 'authenticated'
    FROM (VALUES
      (v_ga_princ, 'gaprinc'), (v_ga_antigo, 'gaantigo'), (v_ga_vinc_off, 'gavincoff'),
      (v_ga_pessoa_off, 'gapessoaoff'), (v_gb0, 'gb0'), (v_gb1, 'gb1'), (v_gc, 'gc'),
      (v_gb_vinc_off, 'gbvincoff'), (v_gb_pessoa_off, 'gbpessoaoff'),
      (v_gd_vinc_off, 'gdvincoff'),
      (v_m1, 'm1'), (v_m2, 'm2'), (v_m3, 'm3'), (v_m4, 'm4'), (v_m5, 'm5'),
      (v_m6, 'm6'), (v_m7, 'm7'), (v_m8, 'm8'), (v_m9, 'm9')
    ) AS x(id, rotulo);

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M52 A', 'Sonda'),
    (v_ub, 'Sonda M52 B', 'Sonda'),
    (v_uc, 'Sonda M52 C', 'Sonda'),
    (v_ud, 'Sonda M52 D', 'Sonda');

  -- created_at explícito: dentro da transação o default now() é o mesmo
  -- instante para todas as linhas, e as ordens ficariam empatadas.
  INSERT INTO public.usuarios (id, nome, email, telefone, papel, unidade_id, ativo, is_gestor_principal, created_at)
  SELECT x.id, 'Sonda M52 ' || x.rotulo,
         'sonda-m52-' || x.rotulo || '-' || v_sufixo || '@example.invalid',
         x.tel, x.papel, x.unidade, x.ativo, x.princ, x.criado::timestamptz
    FROM (VALUES
      (v_ga_princ, 'gaprinc', '00000000052', 'gestor', v_ua, true, true, '2024-01-01'),
      (v_ga_antigo, 'gaantigo', NULL, 'gestor', v_ua, true, false, '2018-01-01'),
      (v_ga_vinc_off, 'gavincoff', NULL, 'gestor', v_ua, true, false, '2017-01-01'),
      (v_ga_pessoa_off, 'gapessoaoff', NULL, 'gestor', v_ua, false, true, '2016-01-01'),
      (v_gb0, 'gb0', NULL, 'gestor', v_ub, true, false, '2022-01-01'),
      (v_gb1, 'gb1', NULL, 'gestor', v_uc, true, true, '2015-01-01'),
      (v_gb_vinc_off, 'gbvincoff', NULL, 'gestor', v_ub, true, false, '2010-01-01'),
      (v_gb_pessoa_off, 'gbpessoaoff', NULL, 'gestor', v_ub, false, false, '2011-01-01'),
      (v_gc, 'gc', NULL, 'gestor', v_uc, true, false, '2022-01-01'),
      (v_gd_vinc_off, 'gdvincoff', NULL, 'gestor', v_ud, true, true, '2022-01-01'),
      (v_m1, 'm1', NULL, 'motorista', v_ua, true, false, '2024-01-01'),
      (v_m2, 'm2', NULL, 'motorista', v_ub, true, false, '2024-01-01'),
      (v_m3, 'm3', NULL, 'motorista', v_ua, true, false, '2024-01-01'),
      (v_m4, 'm4', NULL, 'motorista', v_ub, true, false, '2024-01-01'),
      (v_m5, 'm5', NULL, 'motorista', v_ua, true, false, '2024-01-01'),
      (v_m6, 'm6', NULL, 'motorista', v_uc, true, false, '2024-01-01'),
      (v_m7, 'm7', NULL, 'motorista', v_uc, true, false, '2024-01-01'),
      (v_m8, 'm8', NULL, 'motorista', v_ua, false, false, '2024-01-01'),
      (v_m9, 'm9', NULL, 'motorista', v_ud, true, false, '2024-01-01')
    ) AS x(id, rotulo, tel, papel, unidade, ativo, princ, criado);

  -- O vínculo de C do m6 nasce ativo (o gatilho da rota exige) e é
  -- desativado depois da rota.
  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal, created_at)
  SELECT x.u, x.loja, x.papel, x.ativo, x.princ, x.criado::timestamptz
    FROM (VALUES
      (v_ga_princ, v_ua, 'gestor', true, false, '2024-01-01'),
      (v_ga_antigo, v_ua, 'gestor', true, false, '2021-01-01'),
      (v_ga_vinc_off, v_ua, 'gestor', false, false, '2017-01-01'),
      (v_ga_pessoa_off, v_ua, 'gestor', true, false, '2016-01-01'),
      (v_gb0, v_ub, 'gestor', true, false, '2022-01-01'),
      (v_gb1, v_ub, 'gestor', true, false, '2023-01-01'),
      (v_gb_vinc_off, v_ub, 'gestor', false, false, '2010-01-01'),
      (v_gb_pessoa_off, v_ub, 'gestor', true, false, '2011-01-01'),
      (v_gc, v_uc, 'gestor', true, false, '2022-01-01'),
      (v_gd_vinc_off, v_ud, 'gestor', false, false, '2022-01-01'),
      (v_m1, v_ub, 'motorista', true, false, '2024-01-01'),
      (v_m1, v_ua, 'motorista', true, false, '2024-06-01'),
      (v_m2, v_ua, 'motorista', true, false, '2024-01-01'),
      (v_m2, v_ub, 'motorista', true, false, '2024-06-01'),
      (v_m3, v_ub, 'motorista', true, false, '2024-01-01'),
      (v_m3, v_ua, 'motorista', true, false, '2024-06-01'),
      (v_m4, v_ua, 'motorista', true, false, '2024-01-01'),
      (v_m4, v_ub, 'motorista', true, false, '2024-06-01'),
      (v_m5, v_ua, 'motorista', true, false, '2024-01-01'),
      (v_m5, v_ub, 'motorista', true, true, '2024-06-01'),
      (v_m6, v_ua, 'motorista', true, false, '2024-06-01'),
      (v_m6, v_uc, 'motorista', true, false, '2024-01-01'),
      (v_m7, v_uc, 'motorista', false, false, '2024-01-01'),
      (v_m8, v_ua, 'motorista', true, false, '2024-01-01'),
      (v_m9, v_ud, 'motorista', true, false, '2024-01-01')
    ) AS x(u, loja, papel, ativo, princ, criado);

  INSERT INTO public.rotas (unidade_id, motorista_id, status, data, created_at)
  SELECT x.loja, x.m, x.status, x.dia::date, x.criado::timestamptz
    FROM (VALUES
      -- m1: em andamento em B; pendente em A com data anterior
      (v_ub, v_m1, 'em_andamento', '2026-10-24', '2026-10-24 08:00'),
      (v_ua, v_m1, 'pendente',     '2026-10-20', '2026-10-20 08:00'),
      -- m2: pendente em A; concluída mais recente em B
      (v_ua, v_m2, 'pendente',     '2026-10-25', '2026-10-01 08:00'),
      (v_ub, v_m2, 'concluida',    '2026-10-23', '2026-10-23 08:00'),
      -- m3: só concluídas; a mais recente em B
      (v_ua, v_m3, 'concluida',    '2026-09-01', '2026-09-01 08:00'),
      (v_ub, v_m3, 'concluida',    '2026-10-01', '2026-10-01 08:00'),
      -- m6: em andamento em C (vínculo desativado logo abaixo)
      (v_uc, v_m6, 'em_andamento', '2026-10-24', '2026-10-24 08:00')
    ) AS x(loja, m, status, dia, criado);

  UPDATE public.usuario_unidades SET ativo = false
   WHERE usuario_id = v_m6 AND unidade_id = v_uc;

  -- ---------------------------------------------------------------------------
  -- 1-10. quem chama → gestor esperado (NULL = nenhuma linha)
  -- ---------------------------------------------------------------------------
  v_quem     := ARRAY[v_m1, v_m2, v_m3, v_m4, v_m5, v_m6, v_m7, v_m8, v_m9, v_gc];
  v_esperado := ARRAY[v_gb0, v_ga_princ, v_gb0, v_ga_princ, v_gb0, v_ga_princ,
                      NULL, NULL, NULL, v_gc];
  v_rotulo   := ARRAY[
    '1 rota em andamento em B',
    '2 rota pendente em A, concluída mais recente em B',
    '3 sem rota aberta, mais recente em B',
    '4 sem rota, vínculo mais antigo em A',
    '5 sem rota, vínculo principal em B',
    '6 rota em C com vínculo desativado, ativo em A',
    '7 sem vínculo ativo (cadastro aponta para C)',
    '8 inativo no cadastro',
    '9 loja sem gestor com vínculo ativo',
    '10 gestor de C'];

  FOR i IN 1 .. array_length(v_quem, 1) LOOP
    v_email_esperado := (SELECT u.email FROM public.usuarios u WHERE u.id = v_esperado[i]);
    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_quem[i], 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;

      SELECT count(*), max(g.nome), max(g.email)
        INTO v_n, v_nome, v_email
        FROM public.get_gestor_contato() AS g;
      RESET ROLE;

      r := r || CASE
        WHEN v_esperado[i] IS NULL AND v_n = 0
          THEN ' | ' || v_rotulo[i] || ' OK: nenhuma linha'
        WHEN v_esperado[i] IS NOT NULL AND v_n = 1 AND v_email = v_email_esperado
          THEN ' | ' || v_rotulo[i] || ' OK: ' || v_nome
        ELSE ' | ' || v_rotulo[i] || ' FALHOU: ' || v_n || ' linha(s), '
          || coalesce(v_nome, 'nenhum') || ' (esperado '
          || coalesce((SELECT u.nome FROM public.usuarios u WHERE u.id = v_esperado[i]), 'nenhuma linha')
          || ')'
      END;
    EXCEPTION WHEN OTHERS THEN
      r := r || ' | ' || v_rotulo[i] || ' FALHOU: erro (' || SQLERRM || ')';
    END;
    RESET ROLE;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- 12. formato do retorno
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m4, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT g.nome, g.telefone, g.email INTO v_nome, v_tel, v_email
      FROM public.get_gestor_contato() AS g;
    RESET ROLE;
    r := r || CASE
      WHEN v_nome = 'Sonda M52 gaprinc' AND v_tel = '00000000052'
           AND v_email LIKE 'sonda-m52-gaprinc-%'
        THEN ' | 12 OK: nome, telefone e e-mail do gestor'
      ELSE ' | 12 FALHOU: ' || coalesce(v_nome, 'NULL') || ' / '
        || coalesce(v_tel, 'NULL') || ' / ' || coalesce(v_email, 'NULL') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 12 FALHOU: erro (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 13. sem usuário autenticado
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.get_gestor_contato();
    RESET ROLE;
    r := r || ' | 13 FALHOU: sem usuário devolveu ' || v_n || ' linha(s)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    r := r || CASE WHEN v_state = '42501'
      THEN ' | 13 OK: sem usuário, exceção 42501'
      ELSE ' | 13 FALHOU: exceção ' || v_state || ' (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 14. catálogo
  -- ---------------------------------------------------------------------------
  BEGIN
    SELECT pg_get_function_result(p.oid) INTO v_txt
      FROM pg_catalog.pg_proc p
     WHERE p.oid = 'public.get_gestor_contato()'::regprocedure;
    r := r || CASE WHEN v_txt = 'TABLE(nome text, telefone text, email text)'
      THEN ' | 14a OK: retorno igual ao do app instalado'
      ELSE ' | 14a FALHOU: retorno ' || coalesce(v_txt, 'NULL') END;

    SELECT p.prosecdef AND p.provolatile = 's'
           AND p.proconfig = ARRAY['search_path=""']
      INTO v_bool
      FROM pg_catalog.pg_proc p
     WHERE p.oid = 'public.get_gestor_contato()'::regprocedure;
    r := r || CASE WHEN v_bool
      THEN ' | 14b OK: SECURITY DEFINER, STABLE, search_path vazio'
      ELSE ' | 14b FALHOU: atributos da função (' || coalesce(v_bool::text, 'NULL') || ')' END;

    r := r || CASE
      WHEN has_function_privilege('authenticated', 'public.get_gestor_contato()', 'EXECUTE')
       AND has_function_privilege('service_role', 'public.get_gestor_contato()', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.get_gestor_contato()', 'EXECUTE')
       AND NOT EXISTS (
         SELECT 1
           FROM pg_catalog.pg_proc p, aclexplode(p.proacl) a
          WHERE p.oid = 'public.get_gestor_contato()'::regprocedure
            AND a.grantee = 0 AND a.privilege_type = 'EXECUTE')
      THEN ' | 14c OK: EXECUTE para authenticated e service_role; anon e PUBLIC sem'
      ELSE ' | 14c FALHOU: grants da função' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 14 FALHOU: erro (' || SQLERRM || ')';
  END;

  RAISE EXCEPTION 'SONDA M52 (desfeita):%', r;
END
$$;
