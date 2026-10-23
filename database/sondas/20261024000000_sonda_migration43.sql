-- ============================================================================
-- Sonda transacional da Migration 43 (rodar DEPOIS de aplicá-la, no SQL Editor)
-- ============================================================================
-- Banco único = produção, sem pgTAP. O bloco monta um cenário próprio dentro da
-- transação (não depende de dado real): lojas A, B e C, um gestor em cada; o
-- motorista M atende A e B (nenhum vínculo principal, `usuarios.unidade_id` =
-- B); o motorista M2 só atende A. M tem uma rota em A e uma em B. Os
-- incidentes nascem pelo próprio motorista, como `authenticated` (SET LOCAL
-- ROLE + claims do JWT), como o app faz.
--
-- Tem DELETE, só de linhas que a própria sonda cria (a rota de B, para
-- disparar o ON DELETE SET NULL, e um incidente, para a policy de DELETE): por
-- isso roda no SQL Editor, não pelo MCP. Termina SEMPRE em RAISE EXCEPTION, que
-- desfaz tudo — inclusive as notificações dos gatilhos e a fila do pg_net, que
-- só é lida depois do commit. Leia "SONDA M43 (desfeita): ...".
-- Esperado: todas as linhas com OK (10 pode sair SKIP se o objeto de Storage
-- não puder ser criado).
--
--   1. INSERT com rota de B mandando unidade_id de A → grava B (o cliente não
--      escolhe a loja)
--   2. INSERT sem rota, motorista de duas lojas sem principal → a loja de
--      usuarios.unidade_id (B)
--   3. INSERT sem rota, motorista de uma loja só → essa loja (A)
--   4. o motorista tenta trocar a loja do próprio incidente → fica B
--   5. aviso do incidente sem rota: gestor de B recebe, gestor de A não
--   6. gestor de A não vê, não altera e não apaga o incidente sem rota de B
--   7. gestor de B vê e altera o incidente sem rota de B
--   8. gestor de B não move o incidente para a rota de A (a loja vira A e o
--      WITH CHECK recusa)
--   9. rota de B apagada: o incidente fica sem rota e CONTINUA da loja B —
--      gestor de A segue sem ver, gestor de B segue vendo
--  10. foto do incidente sem rota de B: gestor de A não lê, gestor de B lê
--  11. gestor de C não vê nenhum
--  12. gestor de B apaga o incidente que perdeu a rota (antes, sem rota,
--      ninguém podia apagar)
--  13. anon não vê nenhum
--  14. o motorista continua vendo o próprio incidente
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_uc uuid := gen_random_uuid();     -- loja C (sem os motoristas)
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_gb uuid := gen_random_uuid();     -- gestor de B
  v_gc uuid := gen_random_uuid();     -- gestor de C
  v_m uuid := gen_random_uuid();      -- motorista de A e de B
  v_m2 uuid := gen_random_uuid();     -- motorista só de A
  v_rota_a uuid := gen_random_uuid();
  v_rota_b uuid := gen_random_uuid();
  v_inc_rb uuid := gen_random_uuid(); -- de M, na rota de B
  v_inc_sem uuid := gen_random_uuid(); -- de M, sem rota
  v_inc_m2 uuid := gen_random_uuid(); -- de M2, sem rota
  v_foto text;
  v_foto_ok boolean := false;
  v_loja uuid;
  v_rota uuid;
  v_n int;
BEGIN
  v_foto := 'incidentes/sonda_m43_' || v_sufixo || '.jpg';

  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_ga, 'sonda-m43-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m43-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gc, 'sonda-m43-gc-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m,  'sonda-m43-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m2, 'sonda-m43-m2-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M43 A', 'Sonda'),
    (v_ub, 'Sonda M43 B', 'Sonda'),
    (v_uc, 'Sonda M43 C', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id) VALUES
    (v_ga, 'Sonda gestor A', 'sonda-m43-ga-' || v_sufixo || '@example.invalid', 'gestor', v_ua),
    (v_gb, 'Sonda gestor B', 'sonda-m43-gb-' || v_sufixo || '@example.invalid', 'gestor', v_ub),
    (v_gc, 'Sonda gestor C', 'sonda-m43-gc-' || v_sufixo || '@example.invalid', 'gestor', v_uc),
    (v_m,  'Sonda motorista', 'sonda-m43-m-' || v_sufixo || '@example.invalid', 'motorista', v_ub),
    (v_m2, 'Sonda motorista 2', 'sonda-m43-m2-' || v_sufixo || '@example.invalid', 'motorista', v_ua);

  -- M: vínculo de A criado ANTES do de B, para o critério "mais antigo" não
  -- coincidir com o de usuarios.unidade_id (B) por acaso.
  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal, created_at) VALUES
    (v_ga, v_ua, 'gestor', true, true, now()),
    (v_gb, v_ub, 'gestor', true, true, now()),
    (v_gc, v_uc, 'gestor', true, true, now()),
    (v_m,  v_ua, 'motorista', true, false, now() - interval '2 days'),
    (v_m,  v_ub, 'motorista', true, false, now() - interval '1 day'),
    (v_m2, v_ua, 'motorista', true, false, now());

  INSERT INTO public.rotas (id, unidade_id, motorista_id) VALUES
    (v_rota_a, v_ua, v_m),
    (v_rota_b, v_ub, v_m);

  -- ---------------------------------------------------------------------------
  -- 1-2. M reporta (como authenticated)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.incidentes (id, motorista_id, rota_id, unidade_id, categoria, descricao, endereco, status)
      VALUES (v_inc_rb, v_m, v_rota_b, v_ua, 'other', 'sonda m43 rota B', 'sonda', 'aberto');
    INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status, foto_url)
      VALUES (v_inc_sem, v_m, NULL, 'other', 'sonda m43 sem rota', 'sonda', 'aberto', v_foto);
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1-2 FALHOU: motorista não reportou (' || SQLERRM || ')';
  END;
  RESET ROLE;

  SELECT unidade_id INTO v_loja FROM public.incidentes WHERE id = v_inc_rb;
  r := r || CASE WHEN v_loja = v_ub
    THEN ' | 1 OK: com rota de B e unidade_id de A no INSERT, gravou B'
    ELSE ' | 1 FALHOU: gravou ' || COALESCE(v_loja::text, 'NULL') || ' (esperado B)' END;

  SELECT unidade_id INTO v_loja FROM public.incidentes WHERE id = v_inc_sem;
  r := r || CASE WHEN v_loja = v_ub
    THEN ' | 2 OK: sem rota, duas lojas sem principal → usuarios.unidade_id (B)'
    ELSE ' | 2 FALHOU: gravou ' || COALESCE(v_loja::text, 'NULL') || ' (esperado B)' END;

  -- ---------------------------------------------------------------------------
  -- 3. M2 (uma loja só) reporta sem rota
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
      VALUES (v_inc_m2, v_m2, NULL, 'other', 'sonda m43 m2', 'sonda', 'aberto');
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: motorista 2 não reportou (' || SQLERRM || ')';
  END;
  RESET ROLE;

  SELECT unidade_id INTO v_loja FROM public.incidentes WHERE id = v_inc_m2;
  r := r || CASE WHEN v_loja = v_ua
    THEN ' | 3 OK: sem rota, uma loja só → essa loja (A)'
    ELSE ' | 3 FALHOU: gravou ' || COALESCE(v_loja::text, 'NULL') || ' (esperado A)' END;

  -- ---------------------------------------------------------------------------
  -- 4. M tenta trocar a loja do próprio incidente
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET unidade_id = v_ua WHERE id = v_inc_sem;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 nota: UPDATE recusado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  SELECT unidade_id INTO v_loja FROM public.incidentes WHERE id = v_inc_sem;
  r := r || CASE WHEN v_loja = v_ub
    THEN ' | 4 OK: a loja gravada não muda pelo cliente (B)'
    ELSE ' | 4 FALHOU: a loja virou ' || COALESCE(v_loja::text, 'NULL') END;

  -- ---------------------------------------------------------------------------
  -- 5. aviso do incidente sem rota
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_n FROM public.notificacoes
   WHERE incidente_id = v_inc_sem AND usuario_id = v_gb;
  r := r || CASE WHEN v_n = 1
    THEN ' | 5a OK: gestor de B avisado (1)'
    ELSE ' | 5a FALHOU: gestor de B recebeu ' || v_n || ' aviso(s)' END;
  SELECT count(*) INTO v_n FROM public.notificacoes
   WHERE incidente_id = v_inc_sem AND usuario_id IN (v_ga, v_gc);
  r := r || CASE WHEN v_n = 0
    THEN ' | 5b OK: gestores de A e C não avisados (0)'
    ELSE ' | 5b FALHOU: gestores de A/C receberam ' || v_n || ' aviso(s)' END;

  IF v_foto IS NOT NULL THEN
    BEGIN
      INSERT INTO storage.objects (bucket_id, name, owner, owner_id)
        VALUES ('fotos-entrega', v_foto, v_m, v_m::text);
      v_foto_ok := true;
    EXCEPTION WHEN OTHERS THEN
      r := r || ' | 10 SKIP: não criou o objeto da foto (' || SQLERRM || ')';
    END;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 6. gestor de A x incidente sem rota de B
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO v_n FROM public.incidentes WHERE id = v_inc_sem;
    r := r || CASE WHEN v_n = 0
      THEN ' | 6a OK: gestor de A não vê o sem rota de B (0)'
      ELSE ' | 6a FALHOU: gestor de A vê o sem rota de B (' || v_n || ')' END;

    UPDATE public.incidentes SET observacoes_gestao = 'sonda m43 gA' WHERE id = v_inc_sem;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 6b OK: gestor de A não altera (0)'
      ELSE ' | 6b FALHOU: gestor de A alterou (' || v_n || ')' END;

    DELETE FROM public.incidentes WHERE id = v_inc_sem;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 6c OK: gestor de A não apaga (0)'
      ELSE ' | 6c FALHOU: gestor de A apagou (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.incidentes WHERE id = v_inc_m2;
    r := r || CASE WHEN v_n = 1
      THEN ' | 6d OK: gestor de A vê o sem rota do motorista só de A (1)'
      ELSE ' | 6d FALHOU: gestor de A não vê o incidente de M2 (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. gestor de B (controle)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO v_n FROM public.incidentes WHERE id = v_inc_sem;
    r := r || CASE WHEN v_n = 1
      THEN ' | 7a OK: gestor de B vê o sem rota de B (1)'
      ELSE ' | 7a FALHOU: gestor de B não vê (' || v_n || ')' END;

    UPDATE public.incidentes SET status = 'em_analise' WHERE id = v_inc_sem;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 7b OK: gestor de B altera (1)'
      ELSE ' | 7b FALHOU: gestor de B não alterou (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. gestor de B move o incidente da rota de B para a rota de A (a rota é
  --    do motorista, então o gatilho da Migration 38 aceita; a loja vira A e
  --    quem recusa é o WITH CHECK)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET rota_id = v_rota_a WHERE id = v_inc_rb;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 8 FALHOU: gestor de B moveu o incidente para a rota de A (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE '%row-level security%'
      THEN ' | 8 OK: mover para a rota de A recusado pela policy'
      ELSE ' | 8 FALHOU: recusado por outro motivo (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. a rota de B é apagada (como postgres): ON DELETE SET NULL
  -- ---------------------------------------------------------------------------
  BEGIN
    DELETE FROM public.rotas WHERE id = v_rota_b;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: não apagou a rota de B (' || SQLERRM || ')';
  END;

  SELECT rota_id, unidade_id INTO v_rota, v_loja FROM public.incidentes WHERE id = v_inc_rb;
  r := r || CASE WHEN v_rota IS NULL AND v_loja = v_ub
    THEN ' | 9a OK: rota apagada, incidente sem rota e ainda da loja B'
    ELSE ' | 9a FALHOU: rota ' || COALESCE(v_rota::text, 'NULL') || ', loja ' || COALESCE(v_loja::text, 'NULL') END;

  BEGIN
    SET LOCAL ROLE authenticated;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO v_n FROM public.incidentes WHERE id = v_inc_rb;
    r := r || CASE WHEN v_n = 0
      THEN ' | 9b OK: gestor de A segue sem ver o incidente que perdeu a rota (0)'
      ELSE ' | 9b FALHOU: gestor de A passou a ver (' || v_n || ')' END;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO v_n FROM public.incidentes WHERE id = v_inc_rb;
    r := r || CASE WHEN v_n = 1
      THEN ' | 9c OK: gestor de B segue vendo (1)'
      ELSE ' | 9c FALHOU: gestor de B deixou de ver (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9b-c FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 10. foto do incidente sem rota de B ("fotos-entrega select", incidentes/)
  -- ---------------------------------------------------------------------------
  IF v_foto_ok THEN
    BEGIN
      SET LOCAL ROLE authenticated;

      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
      SELECT count(*) INTO v_n FROM storage.objects
       WHERE bucket_id = 'fotos-entrega' AND name = v_foto;
      r := r || CASE WHEN v_n = 0
        THEN ' | 10a OK: gestor de A não lê a foto (0)'
        ELSE ' | 10a FALHOU: gestor de A lê a foto (' || v_n || ')' END;

      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
      SELECT count(*) INTO v_n FROM storage.objects
       WHERE bucket_id = 'fotos-entrega' AND name = v_foto;
      r := r || CASE WHEN v_n = 1
        THEN ' | 10b OK: gestor de B lê a foto (1)'
        ELSE ' | 10b FALHOU: gestor de B não lê a foto (' || v_n || ')' END;
    EXCEPTION WHEN OTHERS THEN
      r := r || ' | 10 FALHOU: erro inesperado (' || SQLERRM || ')';
    END;
    RESET ROLE;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 11. gestor de C
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gc, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.incidentes
     WHERE id IN (v_inc_rb, v_inc_sem, v_inc_m2);
    r := r || CASE WHEN v_n = 0
      THEN ' | 11 OK: gestor de C não vê nenhum (0)'
      ELSE ' | 11 FALHOU: gestor de C vê ' || v_n || ' incidente(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 11 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 12. gestor de B apaga o incidente que perdeu a rota
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.incidentes WHERE id = v_inc_rb;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 12 OK: gestor de B apaga o incidente sem rota da loja dele (1)'
      ELSE ' | 12 FALHOU: gestor de B não apagou (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 12 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 13. anon
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('role', 'anon')::text, true);
    SET LOCAL ROLE anon;
    SELECT count(*) INTO v_n FROM public.incidentes
     WHERE id IN (v_inc_sem, v_inc_m2);
    r := r || CASE WHEN v_n = 0
      THEN ' | 13 OK: anon não vê nenhum (0)'
      ELSE ' | 13 FALHOU: anon vê ' || v_n || ' incidente(s)' END;
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || ' | 13 OK: anon sem acesso (' || SQLERRM || ')';
  WHEN OTHERS THEN
    r := r || ' | 13 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 14. o motorista vê o próprio
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.incidentes WHERE id = v_inc_sem;
    r := r || CASE WHEN v_n = 1
      THEN ' | 14 OK: motorista vê o próprio incidente (1)'
      ELSE ' | 14 FALHOU: motorista não vê o próprio (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 14 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  RAISE EXCEPTION 'SONDA M43 (desfeita):%', r;
END
$$;
