-- ============================================================================
-- Sonda transacional da Migration 59 (incidente só muda de rota pelo gestor
-- das lojas de origem e de destino)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 59 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os casos 1, 1b, 1c, 1e
-- e 1f saem FALHOU (é o vermelho esperado); nos casos 2 e 2c a WITH CHECK de
-- `incidentes_update` já recusa, com outra mensagem, e eles também saem
-- FALHOU (só a mensagem do gatilho conta como OK).
--
-- Cenário comum (não depende de dado real): lojas A e B; motorista M com
-- vínculo ativo nas duas; gestor GA, gestor ativo só de A; gestor GAB, gestor
-- ativo de A e de B; gestor GX, gestor ativo de A e com vínculo de gestor
-- INATIVO em B. Cada caso monta as PRÓPRIAS rotas e o PRÓPRIO incidente (como
-- postgres, sem sessão) e não depende do resultado de outro caso. As
-- consultas rodam como `authenticated` (SET LOCAL ROLE + claims do JWT). O
-- bloco termina SEMPRE em RAISE EXCEPTION, que desfaz tudo. Leia o resultado
-- na mensagem "SONDA M59 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. motorista M (vínculo ativo em A e B): não move o incidente da rota
--      dele em A para a rota dele em B; o incidente continua na loja A
--   1c. motorista M: também não troca a rota dentro da mesma loja
--   1e. motorista M: não liga a uma rota de B um incidente de A sem rota
--   2. gestor GA (só de A): não move o incidente para uma rota de B
--   2b. gestor GA: move o incidente entre duas rotas da loja A
--   2c. gestor GX (vínculo de gestor inativo em B): não move para B
--   3. gestor GAB (gestor ativo das duas lojas): move, e a loja vira B
--   4. motorista M: UPDATE comum (descrição, foto NULL → valor) passa
--   5. motorista M: desligar a rota (NULL) passa e a loja não muda
--   6. motorista M: gravar `unidade_id` direto não muda a loja
--   7. motorista M: SET com a mesma rota passa
--   8. sem sessão (chave secreta, jobs): a troca de rota passa
--   9. motorista M: criar incidente (INSERT) na rota de B continua passando
--   10. catálogo: gatilho habilitado com a cláusula WHEN; função com dono
--       postgres, DEFINER, `search_path` vazio, sem EXECUTE para
--       anon/authenticated
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_m uuid := gen_random_uuid();      -- motorista em A e B
  v_ga uuid := gen_random_uuid();     -- gestor só de A
  v_gab uuid := gen_random_uuid();    -- gestor de A e de B
  v_gx uuid := gen_random_uuid();     -- gestor ativo em A, inativo em B
  v_ra uuid;                          -- rota de M em A (por caso)
  v_ra2 uuid;                         -- outra rota de M em A (por caso)
  v_rb uuid;                          -- rota de M em B (por caso)
  v_inc uuid;                         -- o incidente do caso
  v_n int;
  v_rota uuid;
  v_loja uuid;
  v_txt text;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,   'sonda-m59-m-'   || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga,  'sonda-m59-ga-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gab, 'sonda-m59-gab-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gx,  'sonda-m59-gx-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M59 A', 'Sonda'),
    (v_ub, 'Sonda M59 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m,   'Sonda motorista', 'sonda-m59-m-'   || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_ga,  'Sonda gestor A',  'sonda-m59-ga-'  || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gab, 'Sonda gestor AB', 'sonda-m59-gab-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gx,  'Sonda gestor AX', 'sonda-m59-gx-'  || v_sufixo || '@example.invalid', 'gestor',    v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,   v_ua, 'motorista', true,  true),
    (v_m,   v_ub, 'motorista', true,  false),
    (v_ga,  v_ua, 'gestor',    true,  true),
    (v_gab, v_ua, 'gestor',    true,  true),
    (v_gab, v_ub, 'gestor',    true,  false),
    (v_gx,  v_ua, 'gestor',    true,  true),
    (v_gx,  v_ub, 'gestor',    false, false);

  -- ---------------------------------------------------------------------------
  -- 1. motorista M: não move o incidente da loja A para a rota dele na loja B
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_rb := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento'),
    (v_rb, v_ub, v_m, 'em_andamento');
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_ra, 'other', 'sonda m59 caso 1', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET rota_id = v_rb, parada_id = NULL WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 1 FALHOU: motorista mudou o incidente de rota (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE 'O incidente só muda de rota%'
      THEN ' | 1 OK: motorista com vínculo nas duas lojas não muda o incidente de rota'
      ELSE ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;
  SELECT rota_id, unidade_id INTO v_rota, v_loja FROM public.incidentes WHERE id = v_inc;
  r := r || CASE WHEN v_rota = v_ra AND v_loja = v_ua
    THEN ' | 1b OK: o incidente continua na rota e na loja de origem'
    ELSE ' | 1b FALHOU: o incidente saiu da rota ou da loja de origem' END;

  -- ---------------------------------------------------------------------------
  -- 1c. motorista M: não troca a rota nem dentro da mesma loja
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_ra2 := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra,  v_ua, v_m, 'em_andamento'),
    (v_ra2, v_ua, v_m, 'em_andamento');
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_ra, 'other', 'sonda m59 caso 1c', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET rota_id = v_ra2 WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 1c FALHOU: motorista trocou a rota do incidente na mesma loja (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE 'O incidente só muda de rota%'
      THEN ' | 1c OK: motorista não troca a rota do incidente na mesma loja'
      ELSE ' | 1c FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 1e. motorista M: não liga a uma rota de B um incidente de A sem rota
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rb := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_rb, v_ub, v_m, 'em_andamento');
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, NULL, 'other', 'sonda m59 caso 1e', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET rota_id = v_rb WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 1e FALHOU: motorista ligou o incidente a uma rota de outra loja (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE 'O incidente só muda de rota%'
      THEN ' | 1e OK: motorista não liga incidente sem rota a uma rota de outra loja'
      ELSE ' | 1e FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;
  SELECT unidade_id INTO v_loja FROM public.incidentes WHERE id = v_inc;
  r := r || CASE WHEN v_loja = v_ua
    THEN ' | 1f OK: o incidente sem rota continua na loja A'
    ELSE ' | 1f FALHOU: o incidente sem rota mudou de loja' END;

  -- ---------------------------------------------------------------------------
  -- 2. gestor só de A: não move o incidente para uma rota de B
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_rb := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento'),
    (v_rb, v_ub, v_m, 'em_andamento');
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_ra, 'other', 'sonda m59 caso 2', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET rota_id = v_rb WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 2 FALHOU: gestor de uma loja só mudou o incidente de loja (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE 'O incidente só muda de rota%'
      THEN ' | 2 OK: gestor de uma loja só não muda o incidente para outra loja'
      ELSE ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2b. gestor só de A: move entre duas rotas da loja A
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_ra2 := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra,  v_ua, v_m, 'em_andamento'),
    (v_ra2, v_ua, v_m, 'em_andamento');
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_ra, 'other', 'sonda m59 caso 2b', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET rota_id = v_ra2 WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    SELECT rota_id, unidade_id INTO v_rota, v_loja FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1 AND v_rota = v_ra2 AND v_loja = v_ua
      THEN ' | 2b OK: gestor da loja move o incidente entre rotas da mesma loja'
      ELSE ' | 2b FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2b FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2c. gestor com vínculo de gestor inativo em B: não move para B
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_rb := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento'),
    (v_rb, v_ub, v_m, 'em_andamento');
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_ra, 'other', 'sonda m59 caso 2c', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gx, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET rota_id = v_rb WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 2c FALHOU: gestor com vínculo inativo no destino mudou o incidente de loja (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE 'O incidente só muda de rota%'
      THEN ' | 2c OK: vínculo de gestor inativo no destino não basta'
      ELSE ' | 2c FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. gestor ativo das duas lojas: move, e a loja vira B
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_rb := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento'),
    (v_rb, v_ub, v_m, 'em_andamento');
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_ra, 'other', 'sonda m59 caso 3', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gab, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET rota_id = v_rb WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    SELECT rota_id, unidade_id INTO v_rota, v_loja FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1 AND v_rota = v_rb AND v_loja = v_ub
      THEN ' | 3 OK: gestor das duas lojas muda o incidente de rota (loja B)'
      ELSE ' | 3 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. motorista M: UPDATE comum (descrição, foto NULL → valor) passa
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento');
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status, foto_url)
    VALUES (v_inc, v_m, v_ra, 'other', 'sonda m59 caso 4', 'sonda', 'aberto', NULL);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes
       SET descricao = 'sonda m59 caso 4 editado',
           foto_url = 'incidentes/sonda_m59_' || v_sufixo || '_4.jpg'
     WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    SELECT foto_url INTO v_txt FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1 AND v_txt IS NOT NULL
      THEN ' | 4 OK: motorista edita a descrição e liga a foto ao incidente'
      ELSE ' | 4 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. motorista M: desligar a rota passa e a loja não muda
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento');
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_ra, 'other', 'sonda m59 caso 5', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET rota_id = NULL, parada_id = NULL WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    SELECT rota_id, unidade_id INTO v_rota, v_loja FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1 AND v_rota IS NULL AND v_loja = v_ua
      THEN ' | 5 OK: desligar a rota passa e a loja continua A'
      ELSE ' | 5 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. motorista M: gravar unidade_id direto não muda a loja
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento');
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_ra, 'other', 'sonda m59 caso 6', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET unidade_id = v_ub WHERE id = v_inc;
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- recusar também serve: o que importa é a loja gravada, conferida abaixo
  END;
  RESET ROLE;
  SELECT unidade_id INTO v_loja FROM public.incidentes WHERE id = v_inc;
  r := r || CASE WHEN v_loja = v_ua
    THEN ' | 6 OK: gravar unidade_id direto não muda a loja'
    ELSE ' | 6 FALHOU: a loja do incidente mudou' END;

  -- ---------------------------------------------------------------------------
  -- 7. motorista M: SET com a mesma rota passa (a cláusula WHEN não dispara)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento');
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_ra, 'other', 'sonda m59 caso 7', 'sonda', 'aberto');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET rota_id = v_ra, descricao = 'sonda m59 caso 7 editado' WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 7 OK: SET com a mesma rota passa'
      ELSE ' | 7 FALHOU: gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. sem sessão: a troca de rota passa
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_ra := gen_random_uuid(); v_rb := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_ra, v_ua, v_m, 'em_andamento'),
    (v_rb, v_ub, v_m, 'em_andamento');
  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
    VALUES (v_inc, v_m, v_ra, 'other', 'sonda m59 caso 8', 'sonda', 'aberto');
  BEGIN
    UPDATE public.incidentes SET rota_id = v_rb WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    SELECT unidade_id INTO v_loja FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_n = 1 AND v_loja = v_ub
      THEN ' | 8 OK: sem sessão a troca de rota passa'
      ELSE ' | 8 FALHOU: sem sessão gravou ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 9. motorista M: criar incidente (INSERT) na rota de B continua passando
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rb := gen_random_uuid(); v_inc := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_rb, v_ub, v_m, 'em_andamento');
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status)
      VALUES (v_inc, v_m, v_rb, 'other', 'sonda m59 caso 9', 'sonda', 'aberto');
    RESET ROLE;
    SELECT unidade_id INTO v_loja FROM public.incidentes WHERE id = v_inc;
    r := r || CASE WHEN v_loja = v_ub
      THEN ' | 9 OK: motorista cria incidente na rota de B'
      ELSE ' | 9 FALHOU: incidente criado fora da loja B' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 10. catálogo
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_n
    FROM pg_trigger t
   WHERE t.tgrelid = 'public.incidentes'::regclass
     AND t.tgname = 'trg_incidentes_troca_de_rota_pelo_gestor'
     AND t.tgenabled = 'O'
     AND pg_get_triggerdef(t.oid) LIKE '%BEFORE UPDATE OF rota_id%WHEN%';
  r := r || CASE WHEN v_n = 1
    THEN ' | 10a OK: gatilho habilitado, BEFORE UPDATE OF rota_id com WHEN'
    ELSE ' | 10a FALHOU: gatilho ausente, desabilitado ou sem WHEN' END;

  SELECT count(*) INTO v_n FROM pg_proc
   WHERE proname = 'incidentes_troca_de_rota_pelo_gestor'
     AND pronamespace = 'public'::regnamespace
     AND pg_get_userbyid(proowner) = 'postgres'
     AND prosecdef
     AND proconfig = ARRAY['search_path=""']
     AND NOT has_function_privilege('anon', oid, 'EXECUTE')
     AND NOT has_function_privilege('authenticated', oid, 'EXECUTE');
  r := r || CASE WHEN v_n = 1
    THEN ' | 10b OK: função com dono postgres, DEFINER, search_path vazio, sem EXECUTE para anon/authenticated'
    ELSE ' | 10b FALHOU: função fora do esperado' END;

  RAISE EXCEPTION 'SONDA M59 (desfeita):%', r;
END
$$;
