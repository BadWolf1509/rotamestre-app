-- ============================================================================
-- Sonda transacional da Migration 42 (rodar DEPOIS de aplicá-la, no SQL Editor)
-- ============================================================================
-- Banco único = produção, sem pgTAP. O bloco monta um cenário próprio dentro da
-- transação (não depende de dado real): lojas A, B e C, um gestor em cada, e um
-- motorista que atende A e B, com uma rota em cada loja e três incidentes —
-- um na rota de A, um na rota de B (com foto) e um sem rota. Depois faz as
-- leituras e alterações como `authenticated` (SET LOCAL ROLE + claims do JWT)
-- e termina SEMPRE em RAISE EXCEPTION, que desfaz tudo — inclusive as
-- notificações que os gatilhos criarem e a fila do pg_net, que só é lida
-- depois do commit. Leia o resultado na mensagem "SONDA M42 (desfeita): ...".
-- Esperado: todas as linhas com OK. Rodada ANTES da migration, os casos 2, 3,
-- 5, 6b e 10a saem FALHOU (é a falha que ela fecha).
--
--   1. gestor de A vê o incidente da rota de A
--   2. gestor de A NÃO vê o incidente da rota de B
--   3. gestor de A NÃO altera o incidente da rota de B (0 linhas)
--   4. gestor de A altera o incidente da rota de A (controle)
--   5. gestor de A NÃO move o incidente de A para a rota de B (WITH CHECK)
--   6. gestor de B vê e altera o incidente da rota de B (controle)
--   7. motorista vê os três incidentes e altera o seu da rota de B
--   8. incidente sem rota segue a regra antiga: gestores de A e de B veem,
--      gestor de C (loja sem o motorista) não
--   9. gestor de C não vê nenhum
--  10. foto do incidente de B: gestor de A não lê (10a), gestor de B lê (10b)
--  11. anon não vê nenhum incidente
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_uc uuid := gen_random_uuid();     -- loja C (sem o motorista)
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_gb uuid := gen_random_uuid();     -- gestor de B
  v_gc uuid := gen_random_uuid();     -- gestor de C
  v_m uuid := gen_random_uuid();      -- motorista de A e de B
  v_rota_a uuid := gen_random_uuid();
  v_rota_b uuid := gen_random_uuid();
  v_inc_a uuid := gen_random_uuid();
  v_inc_b uuid := gen_random_uuid();
  v_inc_sem uuid := gen_random_uuid();
  v_foto text;
  v_foto_ok boolean := false;
  v_n int;
BEGIN
  v_foto := 'incidentes/sonda_m42_' || v_sufixo || '.jpg';

  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres, antes de trocar de papel)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_ga, 'sonda-m42-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m42-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gc, 'sonda-m42-gc-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m,  'sonda-m42-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M42 A', 'Sonda'),
    (v_ub, 'Sonda M42 B', 'Sonda'),
    (v_uc, 'Sonda M42 C', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id) VALUES
    (v_ga, 'Sonda gestor A', 'sonda-m42-ga-' || v_sufixo || '@example.invalid', 'gestor', v_ua),
    (v_gb, 'Sonda gestor B', 'sonda-m42-gb-' || v_sufixo || '@example.invalid', 'gestor', v_ub),
    (v_gc, 'Sonda gestor C', 'sonda-m42-gc-' || v_sufixo || '@example.invalid', 'gestor', v_uc),
    (v_m,  'Sonda motorista', 'sonda-m42-m-' || v_sufixo || '@example.invalid', 'motorista', v_ua);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_ga, v_ua, 'gestor', true, true),
    (v_gb, v_ub, 'gestor', true, true),
    (v_gc, v_uc, 'gestor', true, true),
    (v_m,  v_ua, 'motorista', true, true),
    (v_m,  v_ub, 'motorista', true, false);

  INSERT INTO public.rotas (id, unidade_id, motorista_id) VALUES
    (v_rota_a, v_ua, v_m),
    (v_rota_b, v_ub, v_m);

  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status, foto_url) VALUES
    (v_inc_a,   v_m, v_rota_a, 'other', 'sonda m42 A', 'sonda', 'aberto', NULL),
    (v_inc_b,   v_m, v_rota_b, 'other', 'sonda m42 B', 'sonda', 'aberto', v_foto),
    (v_inc_sem, v_m, NULL,     'other', 'sonda m42 sem rota', 'sonda', 'aberto', NULL);

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner, owner_id)
      VALUES ('fotos-entrega', v_foto, v_m, v_m::text);
    v_foto_ok := true;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 10 SKIP: não criou o objeto da foto (' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 1-5. gestor de A
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO v_n FROM public.incidentes WHERE id = v_inc_a;
    r := r || CASE WHEN v_n = 1
      THEN ' | 1 OK: gestor de A vê o incidente da rota de A (1)'
      ELSE ' | 1 FALHOU: gestor de A não vê o incidente da rota de A (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.incidentes WHERE id = v_inc_b;
    r := r || CASE WHEN v_n = 0
      THEN ' | 2 OK: gestor de A não vê o incidente da rota de B (0)'
      ELSE ' | 2 FALHOU: gestor de A vê o incidente da rota de B (' || v_n || ')' END;

    UPDATE public.incidentes SET observacoes_gestao = 'sonda m42 gA' WHERE id = v_inc_b;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 3 OK: gestor de A não altera o incidente da rota de B (0)'
      ELSE ' | 3 FALHOU: gestor de A alterou o incidente da rota de B (' || v_n || ')' END;

    UPDATE public.incidentes SET status = 'em_analise' WHERE id = v_inc_a;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 4 OK: gestor de A altera o incidente da rota de A (1)'
      ELSE ' | 4 FALHOU: gestor de A não alterou o incidente da rota de A (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1-4 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- 5. mover o incidente de A para a rota de B: a rota é do motorista (o
  --    gatilho da Migration 38 aceita), quem recusa é o WITH CHECK.
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET rota_id = v_rota_b WHERE id = v_inc_a;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 5 FALHOU: gestor de A moveu o incidente para a rota de B (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE '%row-level security%'
      THEN ' | 5 OK: mover para a rota de B recusado pela policy (' || SQLERRM || ')'
      ELSE ' | 5 FALHOU: recusado por outro motivo (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. gestor de B (controle)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO v_n FROM public.incidentes WHERE id = v_inc_b;
    r := r || CASE WHEN v_n = 1
      THEN ' | 6a OK: gestor de B vê o incidente da rota de B (1)'
      ELSE ' | 6a FALHOU: gestor de B não vê o incidente da rota de B (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.incidentes WHERE id = v_inc_a;
    r := r || CASE WHEN v_n = 0
      THEN ' | 6b OK: gestor de B não vê o incidente da rota de A (0)'
      ELSE ' | 6b FALHOU: gestor de B vê o incidente da rota de A (' || v_n || ')' END;

    UPDATE public.incidentes SET status = 'resolvido' WHERE id = v_inc_b;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 6c OK: gestor de B altera o incidente da rota de B (1)'
      ELSE ' | 6c FALHOU: gestor de B não alterou o incidente da rota de B (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. motorista (controle)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO v_n FROM public.incidentes
     WHERE id IN (v_inc_a, v_inc_b, v_inc_sem);
    r := r || CASE WHEN v_n = 3
      THEN ' | 7a OK: motorista vê os três incidentes (3)'
      ELSE ' | 7a FALHOU: motorista vê ' || v_n || ' de 3' END;

    UPDATE public.incidentes SET descricao = 'sonda m42 B editado' WHERE id = v_inc_b;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 7b OK: motorista altera o próprio incidente (1)'
      ELSE ' | 7b FALHOU: motorista não alterou o próprio incidente (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8-9. incidente sem rota e gestor de outra loja
  -- ---------------------------------------------------------------------------
  BEGIN
    SET LOCAL ROLE authenticated;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO v_n FROM public.incidentes WHERE id = v_inc_sem;
    r := r || CASE WHEN v_n = 1
      THEN ' | 8a OK: gestor de A vê o incidente sem rota (1)'
      ELSE ' | 8a FALHOU: gestor de A não vê o incidente sem rota (' || v_n || ')' END;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO v_n FROM public.incidentes WHERE id = v_inc_sem;
    r := r || CASE WHEN v_n = 1
      THEN ' | 8b OK: gestor de B vê o incidente sem rota (1)'
      ELSE ' | 8b FALHOU: gestor de B não vê o incidente sem rota (' || v_n || ')' END;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gc, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO v_n FROM public.incidentes WHERE id = v_inc_sem;
    r := r || CASE WHEN v_n = 0
      THEN ' | 8c OK: gestor de C não vê o incidente sem rota (0)'
      ELSE ' | 8c FALHOU: gestor de C vê o incidente sem rota (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.incidentes
     WHERE id IN (v_inc_a, v_inc_b, v_inc_sem);
    r := r || CASE WHEN v_n = 0
      THEN ' | 9 OK: gestor de C não vê nenhum (0)'
      ELSE ' | 9 FALHOU: gestor de C vê ' || v_n || ' incidente(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8-9 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 10. foto do incidente de B ("fotos-entrega select", ramo incidentes/)
  -- ---------------------------------------------------------------------------
  IF v_foto_ok THEN
    BEGIN
      SET LOCAL ROLE authenticated;

      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
      SELECT count(*) INTO v_n FROM storage.objects
       WHERE bucket_id = 'fotos-entrega' AND name = v_foto;
      r := r || CASE WHEN v_n = 0
        THEN ' | 10a OK: gestor de A não lê a foto do incidente de B (0)'
        ELSE ' | 10a FALHOU: gestor de A lê a foto do incidente de B (' || v_n || ')' END;

      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
      SELECT count(*) INTO v_n FROM storage.objects
       WHERE bucket_id = 'fotos-entrega' AND name = v_foto;
      r := r || CASE WHEN v_n = 1
        THEN ' | 10b OK: gestor de B lê a foto do incidente de B (1)'
        ELSE ' | 10b FALHOU: gestor de B não lê a foto do incidente de B (' || v_n || ')' END;
    EXCEPTION WHEN OTHERS THEN
      r := r || ' | 10 FALHOU: erro inesperado (' || SQLERRM || ')';
    END;
    RESET ROLE;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 11. anon
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('role', 'anon')::text, true);
    SET LOCAL ROLE anon;
    SELECT count(*) INTO v_n FROM public.incidentes
     WHERE id IN (v_inc_a, v_inc_b, v_inc_sem);
    r := r || CASE WHEN v_n = 0
      THEN ' | 11 OK: anon não vê nenhum (0)'
      ELSE ' | 11 FALHOU: anon vê ' || v_n || ' incidente(s)' END;
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || ' | 11 OK: anon sem acesso (' || SQLERRM || ')';
  WHEN OTHERS THEN
    r := r || ' | 11 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  RAISE EXCEPTION 'SONDA M42 (desfeita):%', r;
END
$$;
