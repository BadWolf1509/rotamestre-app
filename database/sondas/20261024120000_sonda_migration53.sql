-- ============================================================================
-- Sonda transacional da Migration 53 (rodar DEPOIS de aplicá-la, no SQL Editor)
-- ============================================================================
-- Banco único = produção, sem pgTAP. O bloco monta um cenário próprio dentro da
-- transação (não depende de dado real): uma loja, um gestor, um motorista, uma
-- rota com quatro paradas (concluída, pulada e duas pendentes) e uma segunda
-- rota, concluída, só com paradas finalizadas. As ações saem como
-- `authenticated` (SET LOCAL ROLE + claims do JWT) e o bloco termina SEMPRE em
-- RAISE EXCEPTION, que desfaz tudo (inclusive logs e notificações dos
-- gatilhos). Não tem DELETE fora do que o próprio cenário cria. Leia o
-- resultado na mensagem "SONDA M53 (desfeita): ...".
-- Esperado: todas as linhas com OK. Rodada ANTES da migration, os casos 2, 3,
-- 5a, 5b e 5c saem FALHOU (é a falha que ela fecha).
--
-- Review Focus 1: o motorista conclui a parada enquanto o gestor está com a
-- tela velha — a trava não atrapalha o motorista (1) e passa a valer para o
-- gestor logo depois.
-- Review Focus 2: o gestor tenta apagar a parada que o motorista acabou de
-- concluir — o banco recusa com a sentinela e a linha continua lá (2).
--
--   1. motorista conclui a parada pendente (controle: UPDATE de status passa)
--   2. gestor NÃO apaga a parada concluída (PARADA_FINALIZADA; linha fica)
--   3. gestor NÃO apaga a parada pulada (PARADA_FINALIZADA; linha fica)
--   4. gestor apaga parada pendente (controle: 1 linha)
--   5. gestor NÃO muda endereço (5a), tipo (5b) nem latitude (5c) da concluída
--      (PARADA_CONCLUIDA_IMUTAVEL; valor antigo fica)
--   6. gestor edita destinatário e observações da concluída (controle)
--   7. gestor reabre a concluída (status volta a pendente) e a reordena
--   8. gestor corrige o endereço da parada pulada (controle)
--   9. cascata: gestor apaga a rota concluída e as paradas finalizadas vão junto
--  10. sem usuário (postgres/SQL Editor): apaga e edita parada concluída
--  11. authenticated e anon sem EXECUTE nas duas funções
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_u uuid := gen_random_uuid();       -- loja
  v_g uuid := gen_random_uuid();       -- gestor
  v_m uuid := gen_random_uuid();       -- motorista
  v_rota uuid := gen_random_uuid();
  v_rota2 uuid := gen_random_uuid();   -- concluída, só com paradas finalizadas
  v_conc uuid := gen_random_uuid();
  v_pul uuid := gen_random_uuid();
  v_pend uuid := gen_random_uuid();
  v_mot uuid := gen_random_uuid();     -- pendente que o motorista conclui
  v_c2a uuid := gen_random_uuid();
  v_c2b uuid := gen_random_uuid();
  v_n int;
  v_msg text;
  v_txt text;
  v_st text;
  v_ordem int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres, antes de trocar de papel)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_g, 'sonda-m53-g-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m, 'sonda-m53-m-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES (v_u, 'Sonda M53', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id) VALUES
    (v_g, 'Sonda gestor', 'sonda-m53-g-' || v_sufixo || '@example.invalid', 'gestor', v_u),
    (v_m, 'Sonda motorista', 'sonda-m53-m-' || v_sufixo || '@example.invalid', 'motorista', v_u);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_g, v_u, 'gestor', true, true),
    (v_m, v_u, 'motorista', true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id) VALUES
    (v_rota, v_u, v_m),
    (v_rota2, v_u, v_m);

  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_conc, v_rota, 'entrega', 'Rua Concluída, 1', -7.1, -34.8, 1, 'concluida', true),
    (v_pul,  v_rota, 'entrega', 'Rua Pulada, 2',    -7.2, -34.8, 2, 'pulada',    true),
    (v_pend, v_rota, 'entrega', 'Rua Pendente, 3',  -7.3, -34.8, 3, 'pendente',  true),
    (v_mot,  v_rota, 'entrega', 'Rua Do Motorista, 4', -7.4, -34.8, 4, 'pendente', true),
    (v_c2a,  v_rota2, 'entrega', 'Rua Dois A, 1',   -7.5, -34.8, 1, 'concluida', true),
    (v_c2b,  v_rota2, 'retirada', 'Rua Dois B, 2',  -7.6, -34.8, 2, 'pulada',    true);

  UPDATE public.rotas SET status = 'concluida' WHERE id = v_rota2;

  -- ---------------------------------------------------------------------------
  -- 1. motorista conclui a parada pendente
  -- ---------------------------------------------------------------------------
  v_n := 0; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET status = 'concluida', concluida_em = now() WHERE id = v_mot;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_n = 1 AND v_msg IS NULL
    THEN ' | 1 OK: motorista concluiu a parada (1 linha)'
    ELSE ' | 1 FALHOU: n=' || v_n || ' erro=' || COALESCE(v_msg, '-') END;

  -- ---------------------------------------------------------------------------
  -- 2. gestor apaga a parada que o motorista acabou de concluir
  -- ---------------------------------------------------------------------------
  v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.paradas WHERE id = v_mot;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  SELECT count(*) INTO v_n FROM public.paradas WHERE id = v_mot;
  r := r || CASE WHEN v_msg LIKE 'PARADA_FINALIZADA%' AND v_n = 1
    THEN ' | 2 OK: DELETE da concluída recusado com a sentinela; linha fica'
    ELSE ' | 2 FALHOU: erro=' || COALESCE(v_msg, '-') || ' linhas=' || v_n END;

  -- ---------------------------------------------------------------------------
  -- 3. gestor apaga a parada pulada
  -- ---------------------------------------------------------------------------
  v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.paradas WHERE id = v_pul;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  SELECT count(*) INTO v_n FROM public.paradas WHERE id = v_pul;
  r := r || CASE WHEN v_msg LIKE 'PARADA_FINALIZADA%' AND v_n = 1
    THEN ' | 3 OK: DELETE da pulada recusado com a sentinela; linha fica'
    ELSE ' | 3 FALHOU: erro=' || COALESCE(v_msg, '-') || ' linhas=' || v_n END;

  -- ---------------------------------------------------------------------------
  -- 4. gestor apaga parada pendente
  -- ---------------------------------------------------------------------------
  v_n := 0; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.paradas WHERE id = v_pend;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_n = 1 AND v_msg IS NULL
    THEN ' | 4 OK: parada pendente apagada (1 linha)'
    ELSE ' | 4 FALHOU: n=' || v_n || ' erro=' || COALESCE(v_msg, '-') END;

  -- ---------------------------------------------------------------------------
  -- 5. gestor muda endereço, tipo e latitude da concluída
  -- ---------------------------------------------------------------------------
  v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET endereco = 'Rua Outra, 99' WHERE id = v_conc;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  SELECT endereco INTO v_txt FROM public.paradas WHERE id = v_conc;
  r := r || CASE WHEN v_msg LIKE 'PARADA_CONCLUIDA_IMUTAVEL%' AND v_txt = 'Rua Concluída, 1'
    THEN ' | 5a OK: endereço da concluída recusado; valor antigo fica'
    ELSE ' | 5a FALHOU: erro=' || COALESCE(v_msg, '-') || ' endereco=' || COALESCE(v_txt, 'NULL') END;

  v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET tipo = 'retirada' WHERE id = v_conc;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  SELECT tipo INTO v_txt FROM public.paradas WHERE id = v_conc;
  r := r || CASE WHEN v_msg LIKE 'PARADA_CONCLUIDA_IMUTAVEL%' AND v_txt = 'entrega'
    THEN ' | 5b OK: tipo da concluída recusado; valor antigo fica'
    ELSE ' | 5b FALHOU: erro=' || COALESCE(v_msg, '-') || ' tipo=' || COALESCE(v_txt, 'NULL') END;

  v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET latitude = -8.0 WHERE id = v_conc;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_msg LIKE 'PARADA_CONCLUIDA_IMUTAVEL%'
      AND (SELECT latitude FROM public.paradas WHERE id = v_conc) = -7.1
    THEN ' | 5c OK: latitude da concluída recusada; valor antigo fica'
    ELSE ' | 5c FALHOU: erro=' || COALESCE(v_msg, '-') END;

  -- ---------------------------------------------------------------------------
  -- 6. destinatário e observações da concluída seguem editáveis
  -- ---------------------------------------------------------------------------
  v_n := 0; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET destinatario = 'Fulano', observacoes = 'obs' WHERE id = v_conc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_n = 1 AND v_msg IS NULL
    THEN ' | 6 OK: destinatário/observações da concluída editados (1 linha)'
    ELSE ' | 6 FALHOU: n=' || v_n || ' erro=' || COALESCE(v_msg, '-') END;

  -- ---------------------------------------------------------------------------
  -- 7. reabrir a concluída e reordenar
  -- ---------------------------------------------------------------------------
  v_n := 0; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET ordem = 10 WHERE id = v_mot;           -- concluída: ordem passa
    UPDATE public.paradas SET status = 'pendente', concluida_em = NULL WHERE id = v_conc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  SELECT status INTO v_st FROM public.paradas WHERE id = v_conc;
  SELECT ordem INTO v_ordem FROM public.paradas WHERE id = v_mot;
  r := r || CASE WHEN v_n = 1 AND v_msg IS NULL AND v_st = 'pendente' AND v_ordem = 10
    THEN ' | 7 OK: ordem e reabertura passam'
    ELSE ' | 7 FALHOU: n=' || v_n || ' status=' || COALESCE(v_st, 'NULL')
         || ' ordem=' || COALESCE(v_ordem::text, 'NULL') || ' erro=' || COALESCE(v_msg, '-') END;

  -- ---------------------------------------------------------------------------
  -- 8. endereço da parada pulada pode ser corrigido
  -- ---------------------------------------------------------------------------
  v_n := 0; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET endereco = 'Rua Corrigida, 2' WHERE id = v_pul;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_n = 1 AND v_msg IS NULL
    THEN ' | 8 OK: endereço da pulada corrigido (1 linha)'
    ELSE ' | 8 FALHOU: n=' || v_n || ' erro=' || COALESCE(v_msg, '-') END;

  -- ---------------------------------------------------------------------------
  -- 9. cascata: gestor apaga a rota concluída
  -- ---------------------------------------------------------------------------
  v_n := 0; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.rotas WHERE id = v_rota2;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  SELECT count(*) INTO v_ordem FROM public.paradas WHERE id IN (v_c2a, v_c2b);
  r := r || CASE WHEN v_n = 1 AND v_msg IS NULL AND v_ordem = 0
    THEN ' | 9 OK: rota concluída apagada e as paradas finalizadas foram em cascata'
    ELSE ' | 9 FALHOU: rotas=' || v_n || ' paradas restantes=' || v_ordem
         || ' erro=' || COALESCE(v_msg, '-') END;

  -- ---------------------------------------------------------------------------
  -- 10. sem usuário (papel postgres, sem claims): segue livre
  -- ---------------------------------------------------------------------------
  v_n := 0; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims', '', true);
    UPDATE public.paradas SET tipo = 'retirada' WHERE id = v_mot;   -- concluída
    DELETE FROM public.paradas WHERE id = v_mot;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  r := r || CASE WHEN v_n = 1 AND v_msg IS NULL
    THEN ' | 10 OK: sem usuário edita e apaga parada concluída'
    ELSE ' | 10 FALHOU: n=' || v_n || ' erro=' || COALESCE(v_msg, '-') END;

  -- ---------------------------------------------------------------------------
  -- 11. funções internas sem EXECUTE
  -- ---------------------------------------------------------------------------
  r := r || CASE WHEN NOT has_function_privilege('authenticated', 'public.recusa_apagar_parada_finalizada()', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.recusa_apagar_parada_finalizada()', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.recusa_editar_local_de_parada_concluida()', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.recusa_editar_local_de_parada_concluida()', 'EXECUTE')
    THEN ' | 11 OK: authenticated e anon sem EXECUTE nas funções'
    ELSE ' | 11 FALHOU: alguma função tem EXECUTE para authenticated/anon' END;

  RAISE EXCEPTION 'SONDA M53 (desfeita):%', r;
END
$$;
