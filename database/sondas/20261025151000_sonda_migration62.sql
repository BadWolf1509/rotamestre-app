-- ============================================================================
-- Sonda transacional da Migration 62 (todo incidente tem loja)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 62 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os casos 1 e 2 saem
-- FALHOU (é o vermelho esperado).
--
-- Cenário comum (não depende de dado real): loja A; motorista M com vínculo
-- ativo em A; motorista P cujo único vínculo (em A) está inativo; gestor GA,
-- gestor ativo de A. Cada caso monta o PRÓPRIO incidente e não depende do
-- resultado de outro. As consultas rodam como `authenticated` (SET LOCAL ROLE
-- + claims do JWT). O bloco termina SEMPRE em RAISE EXCEPTION, que desfaz
-- tudo. Leia o resultado na mensagem "SONDA M62 (desfeita): ...". Esperado:
-- todas as linhas com OK.
--
--   1. catálogo: `incidentes.unidade_id` é NOT NULL
--   2. P (sem vínculo ativo) cria incidente sem rota: recusado (23502), em vez
--      de gravar um incidente que nenhuma loja enxerga
--   3. M cria incidente sem rota: grava com a loja do vínculo (A)
--   4. M cria incidente na rota de A: grava com a loja da rota (A)
--   5. GA grava unidade_id NULL direto: a loja continua A
--   6. M desliga a rota do incidente: a loja continua A
--   7. sem sessão (chave secreta, jobs): UPDATE comum passa e a loja fica
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_m uuid := gen_random_uuid();      -- motorista ativo em A
  v_p uuid := gen_random_uuid();      -- motorista com vínculo inativo
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_ra uuid;                          -- rota do caso
  v_inc uuid;                         -- o incidente do caso
  v_n int;
  v_loja uuid;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,  'sonda-m62-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_p,  'sonda-m62-p-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga, 'sonda-m62-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M62 A', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m,  'Sonda motorista M', 'sonda-m62-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_p,  'Sonda motorista P', 'sonda-m62-p-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_ga, 'Sonda gestor A',    'sonda-m62-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,  v_ua, 'motorista', true,  true),
    (v_p,  v_ua, 'motorista', false, true),
    (v_ga, v_ua, 'gestor',    true,  true);

  -- ---------------------------------------------------------------------------
  -- 1. catálogo
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_n
    FROM pg_attribute
   WHERE attrelid = 'public.incidentes'::regclass
     AND attname = 'unidade_id'
     AND attnotnull;
  r := r || CASE WHEN v_n = 1
    THEN ' | 1 OK: incidentes.unidade_id é NOT NULL'
    ELSE ' | 1 FALHOU: incidentes.unidade_id aceita NULL' END;

  -- ---------------------------------------------------------------------------
  -- 2. P (sem vínculo ativo) cria incidente sem rota
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_p, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
      VALUES (v_inc, v_p, NULL, 'other', 'sonda m62 caso 2', 'sonda', 'aberto');
    RESET ROLE;
    SELECT unidade_id INTO v_loja FROM public.incidentes WHERE id = v_inc;
    r := r || ' | 2 FALHOU: incidente gravado com loja ' || COALESCE(v_loja::text, 'NULL');
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '23502' AND SQLERRM LIKE '%unidade_id%'
      THEN ' | 2 OK: incidente sem loja é recusado'
      ELSE ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. M cria incidente sem rota
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
      VALUES (v_inc, v_m, NULL, 'other', 'sonda m62 caso 3', 'sonda', 'aberto');
    RESET ROLE;
    SELECT unidade_id INTO v_loja FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_loja = v_ua
      THEN ' | 3 OK: incidente sem rota grava a loja do vínculo'
      ELSE ' | 3 FALHOU: loja gravada ' || COALESCE(v_loja::text, 'NULL') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. M cria incidente na rota de A
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
      VALUES (v_inc, v_m, v_ra, 'other', 'sonda m62 caso 4', 'sonda', 'aberto');
    RESET ROLE;
    SELECT unidade_id INTO v_loja FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_loja = v_ua
      THEN ' | 4 OK: incidente na rota grava a loja da rota'
      ELSE ' | 4 FALHOU: loja gravada ' || COALESCE(v_loja::text, 'NULL') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. GA grava unidade_id NULL direto
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, NULL, 'other', 'sonda m62 caso 5', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET unidade_id = NULL WHERE id = v_inc;
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- recusar também serve: o que importa é a loja gravada, conferida abaixo
  END;
  RESET ROLE;
  SELECT unidade_id INTO v_loja FROM public.incidentes WHERE id = v_inc;
  r := r || CASE WHEN v_loja = v_ua
    THEN ' | 5 OK: gravar unidade_id NULL direto não tira a loja'
    ELSE ' | 5 FALHOU: a loja do incidente mudou para ' || COALESCE(v_loja::text, 'NULL') END;

  -- ---------------------------------------------------------------------------
  -- 6. M desliga a rota do incidente
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento');
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_ra, 'other', 'sonda m62 caso 6', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET rota_id = NULL, parada_id = NULL WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    SELECT unidade_id INTO v_loja FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1 AND v_loja = v_ua
      THEN ' | 6 OK: desligar a rota mantém a loja'
      ELSE ' | 6 FALHOU: gravou ' || v_n || ' linha(s), loja ' || COALESCE(v_loja::text, 'NULL') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. sem sessão: UPDATE comum passa e a loja fica
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_inc := gen_random_uuid();
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, NULL, 'other', 'sonda m62 caso 7', 'sonda', 'aberto');
  BEGIN
    UPDATE public.incidentes SET status = 'resolvido', resolvido_em = now() WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    SELECT unidade_id INTO v_loja FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1 AND v_loja = v_ua
      THEN ' | 7 OK: sem sessão o UPDATE comum passa e a loja fica'
      ELSE ' | 7 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  RAISE EXCEPTION 'SONDA M62 (desfeita):%', r;
END
$$;
