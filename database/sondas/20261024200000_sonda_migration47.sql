-- ============================================================================
-- Sonda transacional da Migration 47 (rodar DEPOIS de aplicá-la, no SQL Editor)
-- ============================================================================
-- Banco único = produção, sem pgTAP. O bloco monta um cenário próprio dentro da
-- transação (não depende de dado real): uma loja, o motorista M, o motorista
-- M2 e o gestor G dela (G enxerga e alcança pela RLS as linhas de M e M2 em
-- `usuarios`, que é justamente o que a tabela própria evita). Tudo como
-- `authenticated` (SET LOCAL ROLE + claims do JWT), como o app faz.
--
-- O único DELETE é a tentativa de M (sem grant), que tem de ser recusada.
-- Termina SEMPRE em RAISE EXCEPTION, que desfaz tudo. Leia
-- "SONDA M47 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. M sem linha não vê nada; M cria a linha só com o id → tudo ligado
--      (default)
--   2. M grava pelo upsert do app (ON CONFLICT DO UPDATE) e relê o que gravou
--   3. G (mesma loja) não lê a preferência de M
--   4. G não altera a linha de M (UPDATE alcança 0 linhas; valores intactos)
--   5. G não cria linha para M2 nem faz upsert na de M → 42501; nada muda
--   6. M não passa a própria linha para G (WITH CHECK) → 42501
--   7. M não apaga a própria linha (sem grant de DELETE) → 42501
--   8. anon não lê a tabela → 42501
--   9. service_role (a Edge Function) lê a linha de M
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_u uuid := gen_random_uuid();      -- loja
  v_m uuid := gen_random_uuid();      -- motorista
  v_m2 uuid := gen_random_uuid();     -- outro motorista, sem linha
  v_g uuid := gen_random_uuid();      -- gestor da mesma loja
  v_n int;
  v_push boolean;
  v_inc boolean;
  v_rot boolean;
  v_res boolean;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m, 'sonda-m47-m-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m2, 'sonda-m47-m2-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_g, 'sonda-m47-g-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES (v_u, 'Sonda M47', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id) VALUES
    (v_m, 'Sonda motorista', 'sonda-m47-m-' || v_sufixo || '@example.invalid', 'motorista', v_u),
    (v_m2, 'Sonda motorista 2', 'sonda-m47-m2-' || v_sufixo || '@example.invalid', 'motorista', v_u),
    (v_g, 'Sonda gestor', 'sonda-m47-g-' || v_sufixo || '@example.invalid', 'gestor', v_u);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m, v_u, 'motorista', true, true),
    (v_m2, v_u, 'motorista', true, true),
    (v_g, v_u, 'gestor', true, true);

  -- ---------------------------------------------------------------------------
  -- 1. M sem linha; cria só com o id → tudo ligado
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.preferencias_notificacao;
    INSERT INTO public.preferencias_notificacao (usuario_id) VALUES (v_m);
    SELECT push_ativo, incidentes, rotas, resumo_diario
      INTO v_push, v_inc, v_rot, v_res
      FROM public.preferencias_notificacao WHERE usuario_id = v_m;
    r := r || CASE WHEN v_n = 0 AND v_push AND v_inc AND v_rot AND v_res
      THEN ' | 1 OK: sem linha não vê nada; linha nova nasce toda ligada'
      ELSE ' | 1 FALHOU: via ' || v_n || ' linha(s) ou default não ligado' END;
  EXCEPTION
    WHEN OTHERS THEN r := r || ' | 1 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2. M grava pelo upsert do app e relê
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.preferencias_notificacao
      (usuario_id, push_ativo, incidentes, rotas, resumo_diario, atualizado_em)
    VALUES (v_m, true, true, false, true, now())
    ON CONFLICT (usuario_id) DO UPDATE
      SET push_ativo = EXCLUDED.push_ativo,
          incidentes = EXCLUDED.incidentes,
          rotas = EXCLUDED.rotas,
          resumo_diario = EXCLUDED.resumo_diario,
          atualizado_em = EXCLUDED.atualizado_em;
    SELECT push_ativo, rotas INTO v_push, v_rot
      FROM public.preferencias_notificacao WHERE usuario_id = v_m;
    r := r || CASE WHEN v_push AND NOT v_rot
      THEN ' | 2 OK: M grava pelo upsert e relê (rotas desligado)'
      ELSE ' | 2 FALHOU: releitura não bate' END;
  EXCEPTION
    WHEN OTHERS THEN r := r || ' | 2 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. G não lê a preferência de M
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.preferencias_notificacao WHERE usuario_id = v_m;
    r := r || CASE WHEN v_n = 0
      THEN ' | 3 OK: G (mesma loja) não lê a preferência de M'
      ELSE ' | 3 FALHOU: G leu a preferência de M' END;
  EXCEPTION
    WHEN OTHERS THEN r := r || ' | 3 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. G não altera a linha de M
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.preferencias_notificacao SET push_ativo = false WHERE usuario_id = v_m;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    SELECT push_ativo INTO v_push FROM public.preferencias_notificacao WHERE usuario_id = v_m;
    r := r || CASE WHEN v_n = 0 AND v_push
      THEN ' | 4 OK: G não altera a linha de M (0 linhas; push de M segue ligado)'
      ELSE ' | 4 FALHOU: G alterou a preferência de M' END;
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | 4 OK: G não altera a linha de M (42501)';
    WHEN OTHERS THEN r := r || ' | 4 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. G não cria linha para M2 nem faz upsert na de M
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.preferencias_notificacao (usuario_id, push_ativo) VALUES (v_m2, false);
    r := r || ' | 5a FALHOU: G criou linha para M2';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | 5a OK: G não cria linha para M2 (42501)';
    WHEN OTHERS THEN r := r || ' | 5a FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.preferencias_notificacao (usuario_id, push_ativo) VALUES (v_m, false)
    ON CONFLICT (usuario_id) DO UPDATE SET push_ativo = EXCLUDED.push_ativo;
    r := r || ' | 5b FALHOU: o upsert de G passou';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | 5b OK: G não faz upsert na linha de M (42501)';
    WHEN OTHERS THEN r := r || ' | 5b FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', '', true);
  SELECT count(*) INTO v_n FROM public.preferencias_notificacao WHERE usuario_id = v_m2;
  SELECT push_ativo INTO v_push FROM public.preferencias_notificacao WHERE usuario_id = v_m;
  r := r || CASE WHEN v_n = 0 AND v_push
    THEN ' | 5 OK: nada mudou (M2 sem linha; push de M ligado)'
    ELSE ' | 5 FALHOU: G mudou algo' END;

  -- ---------------------------------------------------------------------------
  -- 6. M não passa a própria linha para G
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.preferencias_notificacao SET usuario_id = v_g WHERE usuario_id = v_m;
    r := r || ' | 6 FALHOU: M passou a linha para G';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | 6 OK: M não passa a linha para G (42501)';
    WHEN OTHERS THEN r := r || ' | 6 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. M não apaga a própria linha (sem grant)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.preferencias_notificacao WHERE usuario_id = v_m;
    r := r || ' | 7 FALHOU: M apagou a linha';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | 7 OK: M não apaga (42501)';
    WHEN OTHERS THEN r := r || ' | 7 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. anon não lê
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    SET LOCAL ROLE anon;
    SELECT count(*) INTO v_n FROM public.preferencias_notificacao;
    r := r || ' | 8 FALHOU: anon leu (' || v_n || ' linhas)';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | 8 OK: anon não lê (42501)';
    WHEN OTHERS THEN r := r || ' | 8 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. service_role (a Edge Function) lê a linha de M
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
    SET LOCAL ROLE service_role;
    SELECT rotas INTO v_rot FROM public.preferencias_notificacao WHERE usuario_id = v_m;
    r := r || CASE WHEN v_rot IS FALSE
      THEN ' | 9 OK: service_role lê a preferência de M'
      ELSE ' | 9 FALHOU: service_role não leu a linha de M' END;
  EXCEPTION
    WHEN OTHERS THEN r := r || ' | 9 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  RAISE EXCEPTION 'SONDA M47 (desfeita):%', r;
END
$$;
