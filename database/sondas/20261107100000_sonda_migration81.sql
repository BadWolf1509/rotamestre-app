-- ============================================================================
-- Sonda transacional da Migration 81 (`inserir_parada` e `reordenar_paradas`
-- só em rota aberta, com `code` na resposta)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 81 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, saem FALHOU os casos
-- 1, 3, 4, 5, 6, 8, 9, 10 e 11 (sem `code`, rota encerrada aceita, id de
-- outra rota ignorado, texto do Postgres no `error`, catálogo); os casos 2 e
-- 7 já saem OK — são os caminhos que precisam continuar valendo.
--
-- Cenário comum (não depende de dado real): lojas A e B; motorista M, ativo
-- em A; gestor GA, gestor ativo de A; gestor GB, gestor ativo só de B. Cada
-- caso monta a própria rota como postgres, sem sessão, com partida (ordem 0)
-- e chegada (última), as duas com `is_checkpoint = false`. As chamadas rodam
-- como `authenticated` (SET LOCAL ROLE + claims do JWT), com os argumentos
-- que o app manda; a conferência roda como postgres. O bloco termina SEMPRE
-- em RAISE EXCEPTION, que desfaz tudo. Leia o resultado na mensagem
-- "SONDA M81 (desfeita): ...". Esperado: todas as linhas com OK.
--
--    1. GA `inserir_parada` em rota `cancelada`, `concluida` e
--       `nao_executada` → ROTA_ENCERRADA nas três; nenhuma parada criada
--    2. GA `inserir_parada` na posição 1 de rota `em_andamento` → sucesso;
--       nova na ordem 1, as seguintes deslocadas, partida em 0 e chegada no
--       fim
--    3. GA `reordenar_paradas` em rota `concluida` → ROTA_ENCERRADA; ordens
--       iguais
--    4. GA `reordenar_paradas` com id de outra rota e com id inexistente na
--       2ª posição → PARADAS_DE_OUTRA_ROTA nos dois; nada muda nas duas rotas
--    5. GA `reordenar_paradas` com ordem duplicada → ORDEM_DUPLICADA, `error`
--       sem texto do Postgres; ordens iguais
--    6. GB (sem vínculo com A) insere e reordena numa rota de A, e M
--       (motorista) insere na própria rota → SEM_PERMISSAO nos três; nada muda
--    7. M reordena as próprias paradas numa rota `em_andamento` → sucesso,
--       `updated` = 2, ordens aplicadas
--    8. ids repetidos, arrays de tamanhos diferentes e ordem nula →
--       ENTRADA_INVALIDA nos três; ordens iguais
--    9. 1º id inexistente → PARADA_NAO_ENCONTRADA
--   10. toda recusa dos casos acima tem exatamente `success` (false), `code`
--       do conjunto fechado e `error` não vazio, sem `duplicate key`,
--       `violates`, `constraint` nem `SQLSTATE`
--   11. catálogo: as duas SECURITY DEFINER, search_path vazio, dono postgres,
--       sem PUBLIC, anon sem EXECUTE, authenticated e service_role com
--       EXECUTE, COMMENT da Migration 81
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_m uuid := gen_random_uuid();      -- motorista de A
  v_ga uuid := gen_random_uuid();     -- gestor ativo de A
  v_gb uuid := gen_random_uuid();     -- gestor ativo só de B
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_rota uuid;
  v_rota2 uuid;
  v_partida uuid;
  v_p1 uuid;
  v_p2 uuid;
  v_p3 uuid;
  v_q1 uuid;
  v_chegada uuid;
  v_status text;
  v_res jsonb;
  v_res2 jsonb;
  v_res3 jsonb;
  v_recusas jsonb := '[]'::jsonb;
  v_ok boolean;
  v_det text;
  v_n int;
  v_n2 int;
  v_o0 int;
  v_o1 int;
  v_o2 int;
  v_o3 int;
  v_onova int;
  v_oq int;
  v_ochegada int;
  v_fn regprocedure;
  v_fn2 regprocedure;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,  'sonda-m81-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga, 'sonda-m81-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m81-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M81 A', 'Sonda'),
    (v_ub, 'Sonda M81 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m,  'Sonda motorista M', 'sonda-m81-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_ga, 'Sonda gestor A',    'sonda-m81-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gb, 'Sonda gestor B',    'sonda-m81-gb-' || v_sufixo || '@example.invalid', 'gestor',    v_ub, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,  v_ua, 'motorista', true, true),
    (v_ga, v_ua, 'gestor',    true, true),
    (v_gb, v_ub, 'gestor',    true, true);

  -- ---------------------------------------------------------------------------
  -- 1. GA insere parada em rota cancelada, concluida e nao_executada
  -- ---------------------------------------------------------------------------
  BEGIN
    v_ok := true;
    v_det := '';
    FOREACH v_status IN ARRAY ARRAY['cancelada', 'concluida', 'nao_executada'] LOOP
      PERFORM set_config('request.jwt.claims', '', true);
      v_rota := gen_random_uuid();
      INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
        (v_rota, v_ua, v_m, v_status, v_hoje);
      INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
        (gen_random_uuid(), v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false),
        (gen_random_uuid(), v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente',  true),
        (gen_random_uuid(), v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente',  false);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      v_res := public.inserir_parada(v_rota, 'entrega', 'sonda nova', -7.1, -34.8, NULL, NULL, NULL, NULL);
      RESET ROLE;
      PERFORM set_config('request.jwt.claims', '', true);
      SELECT count(*) INTO v_n FROM public.paradas WHERE rota_id = v_rota;
      v_recusas := v_recusas || jsonb_build_array(v_res);
      IF NOT (v_res->>'success' = 'false' AND v_res->>'code' = 'ROTA_ENCERRADA' AND v_n = 3) THEN
        v_ok := false;
        v_det := v_det || ' ' || v_status || ': ' || coalesce(v_res::text, 'nulo') || ', ' || v_n || ' paradas;';
      END IF;
    END LOOP;
    r := r || CASE WHEN v_ok
      THEN ' | 1 OK: inserir_parada recusa rota cancelada, concluida e nao_executada (ROTA_ENCERRADA), sem criar parada'
      ELSE ' | 1 FALHOU:' || v_det END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2. GA insere na posição 1 de rota em_andamento
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_partida := gen_random_uuid();
  v_p1 := gen_random_uuid();
  v_p2 := gen_random_uuid();
  v_chegada := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_rota, v_ua, v_m, 'em_andamento', v_hoje, now() - interval '1 hour');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_partida, v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false),
    (v_p1,      v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente',  true),
    (v_p2,      v_rota, 'entrega', 'sonda p2',      -7.1, -34.8, 2, 'pendente',  true),
    (v_chegada, v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 3, 'pendente',  false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.inserir_parada(v_rota, 'entrega', 'sonda nova', -7.1, -34.8, 1, NULL, NULL, NULL);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT ordem INTO v_o0 FROM public.paradas WHERE id = v_partida;
    SELECT ordem INTO v_o1 FROM public.paradas WHERE id = v_p1;
    SELECT ordem INTO v_o2 FROM public.paradas WHERE id = v_p2;
    SELECT ordem INTO v_ochegada FROM public.paradas WHERE id = v_chegada;
    SELECT ordem INTO v_onova FROM public.paradas WHERE id = (v_res->>'parada_id')::uuid;
    SELECT max(ordem) INTO v_n FROM public.paradas WHERE rota_id = v_rota;
    r := r || CASE WHEN v_res->>'success' = 'true' AND (v_res->>'ordem')::int = 1
                    AND v_onova = 1 AND v_o0 = 0 AND v_o1 = 2 AND v_o2 = 3
                    AND v_ochegada = 4 AND v_n = 4
      THEN ' | 2 OK: inserir_parada em rota em_andamento: nova na ordem 1, seguintes deslocadas, chegada no fim'
      ELSE ' | 2 FALHOU: ' || coalesce(v_res::text, 'nulo') || ', ordens partida ' || coalesce(v_o0::text, 'nula')
           || ' nova ' || coalesce(v_onova::text, 'nula') || ' p1 ' || coalesce(v_o1::text, 'nula')
           || ' p2 ' || coalesce(v_o2::text, 'nula') || ' chegada ' || coalesce(v_ochegada::text, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. GA reordena em rota concluida
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_p1 := gen_random_uuid();
  v_p2 := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em, concluida_em) VALUES
    (v_rota, v_ua, v_m, 'concluida', v_hoje, now() - interval '2 hours', now() - interval '5 minutes');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (gen_random_uuid(), v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false),
    (v_p1,              v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'concluida', true),
    (v_p2,              v_rota, 'entrega', 'sonda p2',      -7.1, -34.8, 2, 'concluida', true),
    (gen_random_uuid(), v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 3, 'concluida', false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reordenar_paradas(ARRAY[v_p1, v_p2], ARRAY[2, 1]);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT ordem INTO v_o1 FROM public.paradas WHERE id = v_p1;
    SELECT ordem INTO v_o2 FROM public.paradas WHERE id = v_p2;
    v_recusas := v_recusas || jsonb_build_array(v_res);
    r := r || CASE WHEN v_res->>'success' = 'false' AND v_res->>'code' = 'ROTA_ENCERRADA' AND v_o1 = 1 AND v_o2 = 2
      THEN ' | 3 OK: reordenar_paradas recusa rota concluida (ROTA_ENCERRADA); ordens iguais'
      ELSE ' | 3 FALHOU: ' || coalesce(v_res::text, 'nulo') || ', ordens ' || coalesce(v_o1::text, 'nula')
           || '/' || coalesce(v_o2::text, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. GA reordena com id de outra rota e com id inexistente
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_rota2 := gen_random_uuid();
  v_p1 := gen_random_uuid();
  v_p2 := gen_random_uuid();
  v_q1 := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota,  v_ua, v_m, 'pendente', v_hoje),
    (v_rota2, v_ua, v_m, 'pendente', v_hoje);
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (gen_random_uuid(), v_rota,  'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
    (v_p1,              v_rota,  'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente', true),
    (v_p2,              v_rota,  'entrega', 'sonda p2',      -7.1, -34.8, 2, 'pendente', true),
    (gen_random_uuid(), v_rota,  'entrega', 'sonda chegada', -7.1, -34.8, 3, 'pendente', false),
    (v_q1,              v_rota2, 'entrega', 'sonda q1',      -7.1, -34.8, 1, 'pendente', true);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reordenar_paradas(ARRAY[v_p1, v_q1], ARRAY[2, 1]);
    v_res2 := public.reordenar_paradas(ARRAY[v_p1, gen_random_uuid()], ARRAY[2, 1]);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT ordem INTO v_o1 FROM public.paradas WHERE id = v_p1;
    SELECT ordem INTO v_oq FROM public.paradas WHERE id = v_q1;
    v_recusas := v_recusas || jsonb_build_array(v_res, v_res2);
    r := r || CASE WHEN v_res->>'success' = 'false' AND v_res->>'code' = 'PARADAS_DE_OUTRA_ROTA'
                    AND v_res2->>'success' = 'false' AND v_res2->>'code' = 'PARADAS_DE_OUTRA_ROTA'
                    AND v_o1 = 1 AND v_oq = 1
      THEN ' | 4 OK: id de outra rota e id inexistente recusados (PARADAS_DE_OUTRA_ROTA); nada muda nas duas rotas'
      ELSE ' | 4 FALHOU: outra rota ' || coalesce(v_res::text, 'nulo') || ', inexistente ' || coalesce(v_res2::text, 'nulo')
           || ', ordens p1 ' || coalesce(v_o1::text, 'nula') || ' q1 ' || coalesce(v_oq::text, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. GA reordena com ordem duplicada
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_p1 := gen_random_uuid();
  v_p2 := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota, v_ua, v_m, 'pendente', v_hoje);
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (gen_random_uuid(), v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
    (v_p1,              v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente', true),
    (v_p2,              v_rota, 'entrega', 'sonda p2',      -7.1, -34.8, 2, 'pendente', true),
    (gen_random_uuid(), v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 3, 'pendente', false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reordenar_paradas(ARRAY[v_p1, v_p2], ARRAY[1, 1]);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT ordem INTO v_o1 FROM public.paradas WHERE id = v_p1;
    SELECT ordem INTO v_o2 FROM public.paradas WHERE id = v_p2;
    v_recusas := v_recusas || jsonb_build_array(v_res);
    r := r || CASE WHEN v_res->>'success' = 'false' AND v_res->>'code' = 'ORDEM_DUPLICADA'
                    AND v_res->>'error' NOT ILIKE '%duplicate key%'
                    AND v_res->>'error' NOT ILIKE '%violates%'
                    AND v_o1 = 1 AND v_o2 = 2
      THEN ' | 5 OK: ordem duplicada vira ORDEM_DUPLICADA com texto fixo; ordens iguais'
      ELSE ' | 5 FALHOU: ' || coalesce(v_res::text, 'nulo') || ', ordens ' || coalesce(v_o1::text, 'nula')
           || '/' || coalesce(v_o2::text, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. GB (sem vínculo com A) insere e reordena; M insere
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_p1 := gen_random_uuid();
  v_p2 := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota, v_ua, v_m, 'pendente', v_hoje);
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (gen_random_uuid(), v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
    (v_p1,              v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente', true),
    (v_p2,              v_rota, 'entrega', 'sonda p2',      -7.1, -34.8, 2, 'pendente', true),
    (gen_random_uuid(), v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 3, 'pendente', false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.inserir_parada(v_rota, 'entrega', 'sonda nova', -7.1, -34.8, NULL, NULL, NULL, NULL);
    v_res2 := public.reordenar_paradas(ARRAY[v_p1, v_p2], ARRAY[2, 1]);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res3 := public.inserir_parada(v_rota, 'entrega', 'sonda nova', -7.1, -34.8, NULL, NULL, NULL, NULL);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n FROM public.paradas WHERE rota_id = v_rota;
    SELECT ordem INTO v_o1 FROM public.paradas WHERE id = v_p1;
    SELECT ordem INTO v_o2 FROM public.paradas WHERE id = v_p2;
    v_recusas := v_recusas || jsonb_build_array(v_res, v_res2, v_res3);
    r := r || CASE WHEN v_res->>'code' = 'SEM_PERMISSAO' AND v_res2->>'code' = 'SEM_PERMISSAO'
                    AND v_res3->>'code' = 'SEM_PERMISSAO'
                    AND v_res->>'success' = 'false' AND v_res2->>'success' = 'false' AND v_res3->>'success' = 'false'
                    AND v_n = 4 AND v_o1 = 1 AND v_o2 = 2
      THEN ' | 6 OK: gestor de outra loja (inserir e reordenar) e motorista (inserir) recebem SEM_PERMISSAO; nada muda'
      ELSE ' | 6 FALHOU: GB inserir ' || coalesce(v_res::text, 'nulo') || ', GB reordenar ' || coalesce(v_res2::text, 'nulo')
           || ', M inserir ' || coalesce(v_res3::text, 'nulo') || ', ' || v_n || ' paradas, ordens '
           || coalesce(v_o1::text, 'nula') || '/' || coalesce(v_o2::text, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. M reordena as próprias paradas numa rota em_andamento
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_p1 := gen_random_uuid();
  v_p2 := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_rota, v_ua, v_m, 'em_andamento', v_hoje, now() - interval '1 hour');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (gen_random_uuid(), v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false),
    (v_p1,              v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente',  true),
    (v_p2,              v_rota, 'entrega', 'sonda p2',      -7.1, -34.8, 2, 'pendente',  true),
    (gen_random_uuid(), v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 3, 'pendente',  false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reordenar_paradas(ARRAY[v_p1, v_p2], ARRAY[2, 1]);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT ordem INTO v_o1 FROM public.paradas WHERE id = v_p1;
    SELECT ordem INTO v_o2 FROM public.paradas WHERE id = v_p2;
    r := r || CASE WHEN v_res->>'success' = 'true' AND (v_res->>'updated')::int = 2 AND v_o1 = 2 AND v_o2 = 1
      THEN ' | 7 OK: motorista reordena as próprias paradas em rota em_andamento (updated 2)'
      ELSE ' | 7 FALHOU: ' || coalesce(v_res::text, 'nulo') || ', ordens ' || coalesce(v_o1::text, 'nula')
           || '/' || coalesce(v_o2::text, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. ids repetidos, tamanhos diferentes e ordem nula
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  v_p1 := gen_random_uuid();
  v_p2 := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota, v_ua, v_m, 'pendente', v_hoje);
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (gen_random_uuid(), v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
    (v_p1,              v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente', true),
    (v_p2,              v_rota, 'entrega', 'sonda p2',      -7.1, -34.8, 2, 'pendente', true),
    (gen_random_uuid(), v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 3, 'pendente', false);
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reordenar_paradas(ARRAY[v_p1, v_p1], ARRAY[1, 2]);
    v_res2 := public.reordenar_paradas(ARRAY[v_p1, v_p2], ARRAY[1]);
    v_res3 := public.reordenar_paradas(ARRAY[v_p1, v_p2], ARRAY[2, NULL]::integer[]);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT ordem INTO v_o1 FROM public.paradas WHERE id = v_p1;
    SELECT ordem INTO v_o2 FROM public.paradas WHERE id = v_p2;
    v_recusas := v_recusas || jsonb_build_array(v_res, v_res2, v_res3);
    r := r || CASE WHEN v_res->>'code' = 'ENTRADA_INVALIDA' AND v_res2->>'code' = 'ENTRADA_INVALIDA'
                    AND v_res3->>'code' = 'ENTRADA_INVALIDA'
                    AND v_res->>'success' = 'false' AND v_res2->>'success' = 'false' AND v_res3->>'success' = 'false'
                    AND v_o1 = 1 AND v_o2 = 2
      THEN ' | 8 OK: ids repetidos, tamanhos diferentes e ordem nula recusados (ENTRADA_INVALIDA); ordens iguais'
      ELSE ' | 8 FALHOU: repetidos ' || coalesce(v_res::text, 'nulo') || ', tamanhos ' || coalesce(v_res2::text, 'nulo')
           || ', nula ' || coalesce(v_res3::text, 'nulo') || ', ordens ' || coalesce(v_o1::text, 'nula')
           || '/' || coalesce(v_o2::text, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. 1º id inexistente (usa a rota do caso 8)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.reordenar_paradas(ARRAY[gen_random_uuid(), v_p1], ARRAY[1, 2]);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT ordem INTO v_o1 FROM public.paradas WHERE id = v_p1;
    v_recusas := v_recusas || jsonb_build_array(v_res);
    r := r || CASE WHEN v_res->>'success' = 'false' AND v_res->>'code' = 'PARADA_NAO_ENCONTRADA' AND v_o1 = 1
      THEN ' | 9 OK: 1º id inexistente recusado (PARADA_NAO_ENCONTRADA)'
      ELSE ' | 9 FALHOU: ' || coalesce(v_res::text, 'nulo') || ', ordem p1 ' || coalesce(v_o1::text, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 10. forma de toda recusa dos casos acima
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    SELECT count(*),
           count(*) FILTER (
             WHERE NOT (
               jsonb_typeof(e) = 'object'
               AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(e) AS k) = ARRAY['code', 'error', 'success']
               AND e->'success' = 'false'::jsonb
               AND e->>'code' IN ('SEM_PERMISSAO', 'ROTA_ENCERRADA', 'PARADA_NAO_ENCONTRADA',
                                  'PARADAS_DE_OUTRA_ROTA', 'ENTRADA_INVALIDA', 'ORDEM_DUPLICADA', 'ERRO')
               AND coalesce(e->>'error', '') <> ''
               AND e->>'error' !~* '(duplicate key|violates|constraint|sqlstate)'
             )
           )
      INTO v_n, v_n2
      FROM jsonb_array_elements(v_recusas) AS e;
    r := r || CASE WHEN v_n = 14 AND v_n2 = 0
      THEN ' | 10 OK: as 14 recusas têm só success/code/error, code do conjunto fechado e texto fixo'
      ELSE ' | 10 FALHOU: ' || v_n || ' recusas, ' || v_n2 || ' fora da forma: '
           || coalesce((SELECT string_agg(e::text, ' ; ') FROM jsonb_array_elements(v_recusas) AS e
                         WHERE e->>'code' IS NULL OR e->>'error' ~* '(duplicate key|violates|constraint|sqlstate)'), '') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 10 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 11. catálogo das duas RPCs
  -- ---------------------------------------------------------------------------
  BEGIN
    v_fn := to_regprocedure('public.inserir_parada(uuid,text,text,double precision,double precision,integer,text,text,text)');
    v_fn2 := to_regprocedure('public.reordenar_paradas(uuid[],integer[])');
    SELECT count(*) INTO v_n
      FROM pg_proc p
     WHERE p.oid IN (v_fn, v_fn2)
       AND p.prosecdef
       AND p.proconfig = ARRAY['search_path=""']
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.proacl IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
       AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
       AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
       AND has_function_privilege('service_role', p.oid, 'EXECUTE')
       AND obj_description(p.oid, 'pg_proc') LIKE 'Migration 81:%';
    r := r || CASE WHEN v_fn IS NOT NULL AND v_fn2 IS NOT NULL AND v_n = 2
      THEN ' | 11 OK: as duas SECURITY DEFINER, search_path vazio, dono postgres, sem PUBLIC e anon, EXECUTE de authenticated e service_role, COMMENT da Migration 81'
      ELSE ' | 11 FALHOU: ' || v_n || ' de 2 no esperado ('
           || coalesce((SELECT string_agg(p.proname || ' ' || coalesce(p.proacl::text, 'proacl nulo') || ' '
                                          || coalesce(left(obj_description(p.oid, 'pg_proc'), 20), 'sem COMMENT'), ' ; ')
                          FROM pg_proc p WHERE p.oid IN (v_fn, v_fn2)), 'funções ausentes') || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 11 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  RAISE EXCEPTION 'SONDA M81 (desfeita):%', r;
END
$$;
