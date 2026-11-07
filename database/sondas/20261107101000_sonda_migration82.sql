-- ============================================================================
-- Sonda transacional da Migration 82 (dez funções sem uso apagadas)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 82 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, sai FALHOU o caso 1
-- (as funções existem); os casos 2 e 3 já saem OK — são o que precisa
-- continuar valendo.
--
-- Cenário do caso 3 (não depende de dado real): loja A; gestor GA, gestor
-- ativo de A; motorista M, ativo em A; uma rota de A com uma parada, criadas
-- como postgres. As leituras rodam como `authenticated` (SET LOCAL ROLE +
-- claims do JWT). O bloco termina SEMPRE em RAISE EXCEPTION, que desfaz tudo.
-- Leia o resultado na mensagem "SONDA M82 (desfeita): ...". Esperado: todas
-- as linhas com OK.
--
--    1. as dez assinaturas não existem mais em public
--    2. os helpers vigentes seguem: `get_my_unidade_ids()`,
--       `usuario_atual_ativo()`; `get_user_unidade()` sem argumento não
--       existia e segue sem existir (nenhuma sobrecarga de mesmo nome sobra)
--    3. RLS segue resolvendo: GA e M leem a rota e a parada da loja A
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_m uuid := gen_random_uuid();      -- motorista de A
  v_ga uuid := gen_random_uuid();     -- gestor ativo de A
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_rota uuid := gen_random_uuid();
  v_assinatura text;
  v_restantes text := '';
  v_n int;
  v_n2 int;
  v_n3 int;
  v_n4 int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1. as dez assinaturas não existem
  -- ---------------------------------------------------------------------------
  BEGIN
    FOREACH v_assinatura IN ARRAY ARRAY[
      'public.get_user_role(uuid)',
      'public.get_user_unidade(uuid)',
      'public.get_user_unidades(uuid)',
      'public.get_user_papel_in_unidade(uuid,uuid)',
      'public.user_belongs_to_unidade(uuid,uuid)',
      'public.user_is_gestor_in_any_unidade(uuid)',
      'public.obter_paradas_ordenadas(uuid)',
      'public.rotas_ativas_motorista(uuid)',
      'public.estatisticas_rota(uuid)',
      'public.notify_push_on_insert()'
    ] LOOP
      IF to_regprocedure(v_assinatura) IS NOT NULL THEN
        v_restantes := v_restantes || ' ' || v_assinatura;
      END IF;
    END LOOP;
    r := r || CASE WHEN v_restantes = ''
      THEN ' | 1 OK: as dez funções não existem mais'
      ELSE ' | 1 FALHOU: ainda existem' || v_restantes END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 2. helpers vigentes seguem; get_user_unidade() sem argumento
  -- ---------------------------------------------------------------------------
  BEGIN
    SELECT count(*) INTO v_n
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'get_user_unidade';
    r := r || CASE WHEN to_regprocedure('public.get_my_unidade_ids()') IS NOT NULL
                    AND to_regprocedure('public.usuario_atual_ativo()') IS NOT NULL
                    AND to_regprocedure('public.get_user_unidade()') IS NULL
                    AND v_n = 0
      THEN ' | 2 OK: get_my_unidade_ids() e usuario_atual_ativo() seguem; get_user_unidade() sem argumento não existe (nem outra sobrecarga)'
      ELSE ' | 2 FALHOU: get_my_unidade_ids ' || coalesce(to_regprocedure('public.get_my_unidade_ids()')::text, 'ausente')
           || ', usuario_atual_ativo ' || coalesce(to_regprocedure('public.usuario_atual_ativo()')::text, 'ausente')
           || ', sobrecargas de get_user_unidade: ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 3. RLS de rotas e paradas segue resolvendo
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', '', true);
    INSERT INTO auth.users (id, email, aud, role) VALUES
      (v_m,  'sonda-m82-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
      (v_ga, 'sonda-m82-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');
    INSERT INTO public.unidades (id, nome, cidade) VALUES
      (v_ua, 'Sonda M82 A', 'Sonda');
    INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
      (v_m,  'Sonda motorista M', 'sonda-m82-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
      (v_ga, 'Sonda gestor A',    'sonda-m82-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true);
    INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
      (v_m,  v_ua, 'motorista', true, true),
      (v_ga, v_ua, 'gestor',    true, true);
    INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
      (v_rota, v_ua, v_m, 'pendente', v_hoje);
    INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
      (gen_random_uuid(), v_rota, 'entrega', 'sonda p1', -7.1, -34.8, 1, 'pendente', true);

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.rotas WHERE id = v_rota;
    SELECT count(*) INTO v_n2 FROM public.paradas WHERE rota_id = v_rota;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n3 FROM public.rotas WHERE id = v_rota;
    SELECT count(*) INTO v_n4 FROM public.paradas WHERE rota_id = v_rota;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1 AND v_n3 = 1 AND v_n4 = 1
      THEN ' | 3 OK: gestor e motorista da loja leem a rota e a parada (RLS sem as funções apagadas)'
      ELSE ' | 3 FALHOU: gestor ' || v_n || ' rota / ' || v_n2 || ' parada, motorista ' || v_n3 || ' rota / '
           || v_n4 || ' parada' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  RAISE EXCEPTION 'SONDA M82 (desfeita):%', r;
END
$$;
