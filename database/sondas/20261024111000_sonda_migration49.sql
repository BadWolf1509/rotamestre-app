-- ============================================================================
-- Sonda transacional da Migration 49 (rotas e paradas do motorista pelo
-- vínculo ativo com a loja)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 49 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas.
--
-- O bloco monta um cenário próprio (não depende de dado real): lojas A e B,
-- um gestor em cada, e um motorista com vínculo em A e em B, com uma rota em
-- andamento em cada loja (partida, uma parada real e chegada); mais um
-- motorista desativado como pessoa com vínculo ativo em A e rota própria, e
-- um gestor com vínculo desativado em A. O cenário entra
-- como postgres; depois o vínculo do motorista com A é desativado e as
-- consultas rodam como `authenticated` (SET LOCAL ROLE + claims do JWT). O
-- bloco termina SEMPRE em RAISE EXCEPTION, que desfaz tudo — inclusive as
-- notificações e logs que os gatilhos criarem e a fila do pg_net, que só é
-- lida depois do commit. Não tem DELETE. Leia o resultado na mensagem
-- "SONDA M49 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. motorista (A desativado, B ativo): lê rota e paradas de B, não as de A
--   2. motorista: atualiza rota e parada de B; o UPDATE em A não pega linha
--   3. reordenar_paradas: recusa em A, aceita em B
--   4. pode_registrar_log_na_rota e INSERT de log comum: recusa em A, aceita
--      em B. SOS com a rota de A (INSERT direto e registrar_sos): aceito SEM
--      rota (`rota_recusada`), avisa o gestor de B e nenhum gestor de A. Os
--      SOS levam `parada_id` distintos em `detalhes` para o
--      prevent_duplicate_log (mesma rota/evento/autor/parada em 5 s) não
--      descartar um deles dentro da mesma transação
--   5. posição (motorista_locations, Migration 48): recusada em A pelo RLS de
--      rotas herdado, aceita em B
--   6. finalizar_rota: ROTA_NAO_ENCONTRADA em A; conclui a rota de B
--   7. gestor de A: lê e atualiza a rota de A e as paradas dela (inclusive do
--      motorista desativado), reordena; não lê a de B
--   8. gestor de B: lê a rota de B, não a de A
--   9. vínculo reativado: o motorista volta a ler a rota de A e as paradas
--  10. anon não lê nada; as funções sem EXECUTE para anon; o gatilho do SOS
--      dispara antes de prevent_duplicate_log_trigger
--  11. motorista desativado como pessoa (`usuarios.ativo = false`) com
--      vínculo ativo em A: não lê nem atualiza a rota e as paradas dele, não
--      finaliza, não registra log na rota; o SOS com a rota vai sem rota
--  12. gestor com vínculo desativado em A: não lê nem atualiza rota e
--      paradas de A
--  13. SOS de quem não tem nenhuma loja ativa: gravado mesmo assim, com 0
--      gestores avisados
--  14. ramo do gestor pelo vínculo: um segundo gestor de A, com vínculo de
--      gestor ativo, lê a rota e as paradas de A, atualiza a rota e registra
--      log nela
--  15. checagem da rota com erro: o SOS (INSERT direto e RPC) segue sem rota,
--      marcado, sem falhar. O erro é forçado renomeando o helper
--      `usuario_atual_ativo` só dentro desta transação (a função
--      `pode_registrar_log_na_rota` passa a não achá-lo); o nome volta no fim
--      do bloco, e o RAISE final desfaz tudo de qualquer forma
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A (vínculo do motorista desativado)
  v_ub uuid := gen_random_uuid();     -- loja B (vínculo ativo)
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_gb uuid := gen_random_uuid();     -- gestor de B
  v_m uuid := gen_random_uuid();      -- motorista de A e de B
  v_m3 uuid := gen_random_uuid();     -- motorista desativado como pessoa, vínculo ativo em A
  v_ga_off uuid := gen_random_uuid(); -- gestor com vínculo desativado em A
  v_m4 uuid := gen_random_uuid();     -- motorista sem nenhuma loja ativa (vínculo de A desativado)
  v_gp_off uuid := gen_random_uuid(); -- segundo gestor de A (vínculo de gestor ativo)
  v_rota_m3 uuid := gen_random_uuid();
  v_p_m3 uuid := gen_random_uuid();
  v_rota_a uuid := gen_random_uuid();
  v_rota_b uuid := gen_random_uuid();
  v_pa_partida uuid := gen_random_uuid();
  v_pa_real uuid := gen_random_uuid();
  v_pa_chegada uuid := gen_random_uuid();
  v_pb_partida uuid := gen_random_uuid();
  v_pb_real uuid := gen_random_uuid();
  v_pb_chegada uuid := gen_random_uuid();
  v_log_b uuid := gen_random_uuid();
  v_loc_b uuid := gen_random_uuid();
  v_ret uuid;
  v_json jsonb;
  v_bool boolean;
  v_txt text;
  v_n int;
  v_ret_n int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_ga, 'sonda-m49-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m49-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m,  'sonda-m49-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m3, 'sonda-m49-m3-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga_off, 'sonda-m49-gaoff-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m4, 'sonda-m49-m4-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gp_off, 'sonda-m49-gpoff-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M49 A', 'Sonda'),
    (v_ub, 'Sonda M49 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id) VALUES
    (v_ga, 'Sonda gestor A', 'sonda-m49-ga-' || v_sufixo || '@example.invalid', 'gestor', v_ua),
    (v_gb, 'Sonda gestor B', 'sonda-m49-gb-' || v_sufixo || '@example.invalid', 'gestor', v_ub),
    (v_m,  'Sonda motorista', 'sonda-m49-m-' || v_sufixo || '@example.invalid', 'motorista', v_ua),
    (v_ga_off, 'Sonda gestor A desativado', 'sonda-m49-gaoff-' || v_sufixo || '@example.invalid', 'gestor', v_ua);

  -- desativados como pessoa (o vínculo com A segue ativo) e o motorista sem
  -- nenhuma loja ativa (pessoa ativa, vínculo de A desativado)
  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m3, 'Sonda motorista desativado', 'sonda-m49-m3-' || v_sufixo || '@example.invalid', 'motorista', v_ua, false),
    (v_gp_off, 'Sonda gestor A 2', 'sonda-m49-gpoff-' || v_sufixo || '@example.invalid', 'gestor', v_ua, false),
    (v_m4, 'Sonda motorista sem loja ativa', 'sonda-m49-m4-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true);

  -- O vínculo com A nasce ativo: o gatilho validar_motorista_e_loja_da_rota
  -- só aceita rota de motorista com vínculo ativo. Desativado logo abaixo.
  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_ga, v_ua, 'gestor', true, true),
    (v_gb, v_ub, 'gestor', true, true),
    (v_m,  v_ua, 'motorista', true, true),
    (v_m,  v_ub, 'motorista', true, false),
    (v_m3, v_ua, 'motorista', true, true),
    (v_ga_off, v_ua, 'gestor', false, true),
    (v_gp_off, v_ua, 'gestor', true, true),
    (v_m4, v_ua, 'motorista', false, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_rota_a, v_ua, v_m, 'em_andamento'),
    (v_rota_b, v_ub, v_m, 'em_andamento'),
    (v_rota_m3, v_ua, v_m3, 'em_andamento');

  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_p_m3, v_rota_m3, 'entrega', 'Sonda parada M3', -7.3, -34.7, 1, 'pendente', true);

  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_pa_partida, v_rota_a, 'entrega', 'Sonda partida A', -7.1, -34.8, 0, 'concluida', false),
    (v_pa_real,    v_rota_a, 'entrega', 'Sonda parada A',  -7.1, -34.8, 1, 'pendente',  true),
    (v_pa_chegada, v_rota_a, 'entrega', 'Sonda chegada A', -7.1, -34.8, 2, 'pendente',  false),
    (v_pb_partida, v_rota_b, 'entrega', 'Sonda partida B', -7.2, -34.9, 0, 'concluida', false),
    (v_pb_real,    v_rota_b, 'entrega', 'Sonda parada B',  -7.2, -34.9, 1, 'pendente',  true),
    (v_pb_chegada, v_rota_b, 'entrega', 'Sonda chegada B', -7.2, -34.9, 2, 'pendente',  false);

  UPDATE public.usuario_unidades SET ativo = false
   WHERE usuario_id = v_m AND unidade_id = v_ua;

  -- ---------------------------------------------------------------------------
  -- 1. leitura do motorista
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO v_n FROM public.rotas WHERE id = v_rota_a;
    r := r || CASE WHEN v_n = 0
      THEN ' | 1a OK: motorista não lê a rota de A (0)'
      ELSE ' | 1a FALHOU: motorista lê a rota de A (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.rotas WHERE id = v_rota_b;
    r := r || CASE WHEN v_n = 1
      THEN ' | 1b OK: motorista lê a rota de B (1)'
      ELSE ' | 1b FALHOU: motorista não lê a rota de B (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.paradas WHERE rota_id = v_rota_a;
    r := r || CASE WHEN v_n = 0
      THEN ' | 1c OK: motorista não lê as paradas de A (0)'
      ELSE ' | 1c FALHOU: motorista lê ' || v_n || ' parada(s) de A' END;

    SELECT count(*) INTO v_n FROM public.paradas WHERE rota_id = v_rota_b;
    r := r || CASE WHEN v_n = 3
      THEN ' | 1d OK: motorista lê as 3 paradas de B'
      ELSE ' | 1d FALHOU: motorista lê ' || v_n || ' de 3 paradas de B' END;

    -- a consulta da rota ativa do app (motorista_id + status)
    SELECT count(*) INTO v_n FROM public.rotas
     WHERE motorista_id = v_m AND status IN ('pendente', 'em_andamento');
    r := r || CASE WHEN v_n = 1
      THEN ' | 1e OK: a busca da rota ativa traz só a de B (1)'
      ELSE ' | 1e FALHOU: a busca da rota ativa traz ' || v_n || ' rota(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 2. escrita do motorista em rota e parada
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    UPDATE public.rotas SET iniciada_em = now() WHERE id = v_rota_a;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 2a OK: UPDATE do motorista na rota de A não pega linha (0)'
      ELSE ' | 2a FALHOU: motorista atualizou a rota de A (' || v_n || ')' END;

    UPDATE public.rotas SET iniciada_em = now() WHERE id = v_rota_b;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 2b OK: motorista atualiza a rota de B (1)'
      ELSE ' | 2b FALHOU: motorista atualizou ' || v_n || ' rota(s) de B' END;

    UPDATE public.paradas SET status = 'em_andamento' WHERE id = v_pa_real;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 2c OK: UPDATE do motorista na parada de A não pega linha (0)'
      ELSE ' | 2c FALHOU: motorista atualizou a parada de A (' || v_n || ')' END;

    UPDATE public.paradas SET status = 'concluida', concluida_em = now() WHERE id = v_pb_real;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 2d OK: motorista conclui a parada de B (1)'
      ELSE ' | 2d FALHOU: motorista atualizou ' || v_n || ' parada(s) de B' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. reordenar_paradas
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    v_json := public.reordenar_paradas(ARRAY[v_pa_real], ARRAY[1]);
    r := r || CASE WHEN (v_json->>'success')::boolean = false
      THEN ' | 3a OK: reordenar_paradas recusa a rota de A (' || coalesce(v_json->>'error', '') || ')'
      ELSE ' | 3a FALHOU: reordenar_paradas aceitou a rota de A (' || v_json::text || ')' END;

    v_json := public.reordenar_paradas(ARRAY[v_pb_real], ARRAY[1]);
    r := r || CASE WHEN (v_json->>'success')::boolean = true
      THEN ' | 3b OK: reordenar_paradas aceita a rota de B'
      ELSE ' | 3b FALHOU: reordenar_paradas recusou a rota de B (' || v_json::text || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. logs: helper, INSERT direto e registrar_sos
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    v_bool := public.pode_registrar_log_na_rota(v_rota_a);
    r := r || CASE WHEN v_bool = false
      THEN ' | 4a OK: pode_registrar_log_na_rota(A) = false'
      ELSE ' | 4a FALHOU: pode_registrar_log_na_rota(A) = ' || coalesce(v_bool::text, 'NULL') END;

    v_bool := public.pode_registrar_log_na_rota(v_rota_b);
    r := r || CASE WHEN v_bool = true
      THEN ' | 4b OK: pode_registrar_log_na_rota(B) = true'
      ELSE ' | 4b FALHOU: pode_registrar_log_na_rota(B) = ' || coalesce(v_bool::text, 'NULL') END;

    INSERT INTO public.logs (id, usuario_id, rota_id, evento, detalhes)
      VALUES (v_log_b, v_m, v_rota_b, 'sonda_m49_motorista_b', '{}'::jsonb)
      RETURNING id INTO v_ret;
    r := r || CASE WHEN v_ret = v_log_b
      THEN ' | 4c OK: motorista grava log na rota de B'
      ELSE ' | 4c FALHOU: log na rota de B não voltou (' || coalesce(v_ret::text, 'NULL') || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4a-4c FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- 4d. log direto na rota de A: recusado pelo WITH CHECK de logs_insert
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
      VALUES (v_m, v_rota_a, 'sonda_m49_motorista_a', '{}'::jsonb);
    r := r || ' | 4d FALHOU: motorista gravou log na rota de A';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE '%row-level security%'
      THEN ' | 4d OK: log na rota de A recusado pela policy'
      ELSE ' | 4d FALHOU: recusado por outro motivo (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  -- 4e. SOS com a rota de A por INSERT direto (como o app sem a RPC faz):
  -- aceito sem rota
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
      VALUES (v_m, v_rota_a, 'sos_acionado', jsonb_build_object(
        'descricao', 'sonda m49 direto', 'parada_id', 'sonda-m49-direto',
        'rota_id', v_rota_a, 'rota_status', 'em_andamento'));
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 4e OK: SOS direto com a rota de A aceito (1)'
      ELSE ' | 4e FALHOU: SOS direto com a rota de A gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4e FALHOU: SOS direto recusado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- 4e (conferência, como postgres): sem rota, sem rastro da rota de A,
  -- marcado e com o gestor de B avisado
  BEGIN
    SELECT count(*) INTO v_n FROM public.logs l
     WHERE l.usuario_id = v_m AND l.evento = 'sos_acionado'
       AND l.detalhes->>'parada_id' = 'sonda-m49-direto'
       AND l.rota_id IS NULL
       AND (l.detalhes->>'rota_recusada')::boolean
       AND NOT (l.detalhes ? 'rota_id') AND NOT (l.detalhes ? 'rota_status')
       AND (l.detalhes->>'gestores_avisados')::int = 1;
    r := r || CASE WHEN v_n = 1
      THEN ' | 4f OK: SOS direto gravado sem rota, rota_recusada, 1 gestor avisado'
      ELSE ' | 4f FALHOU: SOS direto fora do esperado (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4f FALHOU: erro inesperado (' || SQLERRM || ')';
  END;

  -- 4g. SOS com a rota de A pela RPC: aceito sem rota
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_n := public.registrar_sos(jsonb_build_object(
      'descricao', 'sonda m49 rpc', 'parada_id', 'sonda-m49-rpc',
      'rota_id', v_rota_a, 'rota_status', 'em_andamento'), v_rota_a);
    r := r || CASE WHEN v_n = 1
      THEN ' | 4g OK: registrar_sos com a rota de A aceito, avisou 1 gestor'
      ELSE ' | 4g FALHOU: registrar_sos com a rota de A avisou ' || v_n || ' gestor(es)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4g FALHOU: registrar_sos recusou (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- 4h (conferência, como postgres): o da RPC sem rota e marcado; os avisos
  -- dos dois SOS foram ao gestor de B e a nenhum gestor de A
  BEGIN
    SELECT count(*) INTO v_n FROM public.logs l
     WHERE l.usuario_id = v_m AND l.evento = 'sos_acionado'
       AND l.detalhes->>'parada_id' = 'sonda-m49-rpc'
       AND l.rota_id IS NULL
       AND (l.detalhes->>'rota_recusada')::boolean
       AND NOT (l.detalhes ? 'rota_id');
    r := r || CASE WHEN v_n = 1
      THEN ' | 4h OK: SOS da RPC gravado sem rota e rota_recusada'
      ELSE ' | 4h FALHOU: SOS da RPC fora do esperado (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.notificacoes
     WHERE usuario_id = v_gb AND tipo = 'sos_acionado' AND rota_id IS NULL;
    r := r || CASE WHEN v_n = 2
      THEN ' | 4i OK: gestor de B recebeu os 2 avisos de SOS sem rota'
      ELSE ' | 4i FALHOU: gestor de B recebeu ' || v_n || ' de 2 avisos' END;

    SELECT count(*) INTO v_n FROM public.notificacoes
     WHERE usuario_id IN (v_ga, v_ga_off) AND tipo = 'sos_acionado';
    r := r || CASE WHEN v_n = 0
      THEN ' | 4j OK: nenhum gestor de A recebeu aviso do SOS (0)'
      ELSE ' | 4j FALHOU: gestores de A receberam ' || v_n || ' aviso(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4h-4j FALHOU: erro inesperado (' || SQLERRM || ')';
  END;

  -- 4k. SOS na rota de B: aceito com a rota, avisa o gestor de B
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_n := public.registrar_sos(jsonb_build_object(
      'descricao', 'sonda m49 b', 'parada_id', 'sonda-m49-b'), v_rota_b);
    r := r || CASE WHEN v_n = 1
      THEN ' | 4k OK: registrar_sos aceita a rota de B (1 gestor avisado)'
      ELSE ' | 4k FALHOU: registrar_sos na rota de B avisou ' || v_n || ' gestor(es)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4k FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    SELECT count(*) INTO v_n FROM public.logs l
     WHERE l.usuario_id = v_m AND l.evento = 'sos_acionado'
       AND l.detalhes->>'parada_id' = 'sonda-m49-b'
       AND l.rota_id = v_rota_b
       AND NOT (l.detalhes ? 'rota_recusada');
    r := r || CASE WHEN v_n = 1
      THEN ' | 4l OK: SOS da rota de B gravado com a rota, sem rota_recusada'
      ELSE ' | 4l FALHOU: SOS da rota de B fora do esperado (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4l FALHOU: erro inesperado (' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 5. posição do motorista (regra herdada do RLS de rotas)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations (motorista_id, rota_id, latitude, longitude, fonte)
      VALUES (v_m, v_rota_a, -7.1, -34.8, 'sonda');
    r := r || ' | 5a FALHOU: motorista gravou posição na rota de A';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE '%row-level security%'
      THEN ' | 5a OK: posição na rota de A recusada pela policy'
      ELSE ' | 5a FALHOU: recusada por outro motivo (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.motorista_locations (id, motorista_id, rota_id, latitude, longitude, fonte)
      VALUES (v_loc_b, v_m, v_rota_b, -7.2, -34.9, 'sonda');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 5b OK: motorista grava posição na rota de B (1)'
      ELSE ' | 5b FALHOU: motorista gravou ' || v_n || ' posição(ões) na rota de B' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5b FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. finalizar_rota
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.finalizar_rota(v_rota_a);
    r := r || ' | 6a FALHOU: finalizar_rota aceitou a rota de A';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE 'ROTA_NAO_ENCONTRADA%'
      THEN ' | 6a OK: finalizar_rota(A) = ROTA_NAO_ENCONTRADA'
      ELSE ' | 6a FALHOU: finalizar_rota(A) recusou por outro motivo (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.finalizar_rota(v_rota_b);
    SELECT status INTO v_txt FROM public.rotas WHERE id = v_rota_b;
    r := r || CASE WHEN v_txt = 'concluida'
      THEN ' | 6b OK: finalizar_rota conclui a rota de B'
      ELSE ' | 6b FALHOU: rota de B ficou ' || coalesce(v_txt, 'invisível') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6b FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. gestor de A
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO v_n FROM public.rotas WHERE id = v_rota_a;
    r := r || CASE WHEN v_n = 1
      THEN ' | 7a OK: gestor de A lê a rota de A (1)'
      ELSE ' | 7a FALHOU: gestor de A não lê a rota de A (' || v_n || ')' END;

    SELECT count(*) INTO v_n FROM public.paradas WHERE rota_id = v_rota_a;
    r := r || CASE WHEN v_n = 3
      THEN ' | 7b OK: gestor de A lê as 3 paradas de A'
      ELSE ' | 7b FALHOU: gestor de A lê ' || v_n || ' de 3 paradas de A' END;

    UPDATE public.rotas SET iniciada_em = now() WHERE id = v_rota_a;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 7c OK: gestor de A atualiza a rota de A (1)'
      ELSE ' | 7c FALHOU: gestor de A atualizou ' || v_n || ' rota(s) de A' END;

    UPDATE public.paradas SET observacoes = 'sonda m49' WHERE id = v_pa_real;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 7d OK: gestor de A atualiza a parada de A (1)'
      ELSE ' | 7d FALHOU: gestor de A atualizou ' || v_n || ' parada(s) de A' END;

    v_json := public.reordenar_paradas(ARRAY[v_pa_real], ARRAY[1]);
    r := r || CASE WHEN (v_json->>'success')::boolean = true
      THEN ' | 7e OK: gestor de A reordena a rota de A'
      ELSE ' | 7e FALHOU: reordenar_paradas recusou o gestor de A (' || v_json::text || ')' END;

    SELECT (SELECT count(*) FROM public.rotas WHERE id = v_rota_b)
         + (SELECT count(*) FROM public.paradas WHERE rota_id = v_rota_b)
      INTO v_n;
    r := r || CASE WHEN v_n = 0
      THEN ' | 7f OK: gestor de A não lê rota nem paradas de B (0)'
      ELSE ' | 7f FALHOU: gestor de A lê ' || v_n || ' linha(s) de B' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 8. gestor de B
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT (SELECT count(*) FROM public.rotas WHERE id = v_rota_b)
         + (SELECT count(*) FROM public.paradas WHERE rota_id = v_rota_b)
      INTO v_n;
    r := r || CASE WHEN v_n = 4
      THEN ' | 8a OK: gestor de B lê a rota e as 3 paradas de B (4)'
      ELSE ' | 8a FALHOU: gestor de B lê ' || v_n || ' de 4 linhas de B' END;

    SELECT (SELECT count(*) FROM public.rotas WHERE id = v_rota_a)
         + (SELECT count(*) FROM public.paradas WHERE rota_id = v_rota_a)
      INTO v_n;
    r := r || CASE WHEN v_n = 0
      THEN ' | 8b OK: gestor de B não lê rota nem paradas de A (0)'
      ELSE ' | 8b FALHOU: gestor de B lê ' || v_n || ' linha(s) de A' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. vínculo com A reativado (como postgres)
  -- ---------------------------------------------------------------------------
  UPDATE public.usuario_unidades SET ativo = true
   WHERE usuario_id = v_m AND unidade_id = v_ua;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT (SELECT count(*) FROM public.rotas WHERE id = v_rota_a)
         + (SELECT count(*) FROM public.paradas WHERE rota_id = v_rota_a)
      INTO v_n;
    r := r || CASE WHEN v_n = 4
      THEN ' | 9a OK: com o vínculo reativado, o motorista lê a rota e as 3 paradas de A (4)'
      ELSE ' | 9a FALHOU: com o vínculo reativado, o motorista lê ' || v_n || ' de 4 linhas de A' END;

    v_bool := public.pode_registrar_log_na_rota(v_rota_a);
    r := r || CASE WHEN v_bool = true
      THEN ' | 9b OK: pode_registrar_log_na_rota(A) volta a true'
      ELSE ' | 9b FALHOU: pode_registrar_log_na_rota(A) = ' || coalesce(v_bool::text, 'NULL') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 10. anon e privilégios
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('role', 'anon')::text, true);
    SET LOCAL ROLE anon;
    SELECT (SELECT count(*) FROM public.rotas WHERE id IN (v_rota_a, v_rota_b))
         + (SELECT count(*) FROM public.paradas WHERE rota_id IN (v_rota_a, v_rota_b))
      INTO v_n;
    r := r || CASE WHEN v_n = 0
      THEN ' | 10a OK: anon não lê nada (0)'
      ELSE ' | 10a FALHOU: anon lê ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || ' | 10a OK: anon sem acesso (' || SQLERRM || ')';
  WHEN OTHERS THEN
    r := r || ' | 10a FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    r := r || CASE
      WHEN NOT has_function_privilege('anon', 'public.finalizar_rota(uuid)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.reordenar_paradas(uuid[], integer[])', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.pode_registrar_log_na_rota(uuid)', 'EXECUTE')
       AND has_function_privilege('authenticated', 'public.finalizar_rota(uuid)', 'EXECUTE')
       AND has_function_privilege('authenticated', 'public.reordenar_paradas(uuid[], integer[])', 'EXECUTE')
       AND has_function_privilege('authenticated', 'public.pode_registrar_log_na_rota(uuid)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.registrar_sos(jsonb, uuid)', 'EXECUTE')
       AND has_function_privilege('authenticated', 'public.registrar_sos(jsonb, uuid)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.usuario_atual_ativo()', 'EXECUTE')
       AND has_function_privilege('authenticated', 'public.usuario_atual_ativo()', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.sos_sem_rota_quando_recusada()', 'EXECUTE')
      THEN ' | 10b OK: funções sem EXECUTE para anon, com EXECUTE para authenticated (a do gatilho, sem)'
      ELSE ' | 10b FALHOU: privilégios das funções fora do esperado' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 10b FALHOU: função ausente (' || SQLERRM || ')';
  END;

  -- 10c. gatilhos BEFORE INSERT de logs, em ordem alfabética (a de disparo)
  BEGIN
    SELECT string_agg(tgname::text, ',' ORDER BY tgname) INTO v_txt
      FROM pg_trigger
     WHERE tgrelid = 'public.logs'::regclass AND NOT tgisinternal
       AND (tgtype & 2) = 2 AND (tgtype & 4) = 4;
    r := r || CASE WHEN v_txt = 'logs_sos_sem_rota_quando_recusada,prevent_duplicate_log_trigger'
      THEN ' | 10c OK: o gatilho do SOS dispara antes da deduplicação'
      ELSE ' | 10c FALHOU: gatilhos BEFORE INSERT de logs: ' || coalesce(v_txt, 'nenhum') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 10c FALHOU: erro inesperado (' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 11. motorista desativado como pessoa, vínculo ativo em A
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m3, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    v_bool := public.usuario_atual_ativo();
    r := r || CASE WHEN v_bool = false
      THEN ' | 11a OK: usuario_atual_ativo() = false para a pessoa desativada'
      ELSE ' | 11a FALHOU: usuario_atual_ativo() = ' || coalesce(v_bool::text, 'NULL') END;

    SELECT (SELECT count(*) FROM public.rotas WHERE id = v_rota_m3)
         + (SELECT count(*) FROM public.paradas WHERE rota_id = v_rota_m3)
      INTO v_n;
    r := r || CASE WHEN v_n = 0
      THEN ' | 11b OK: pessoa desativada não lê a própria rota nem as paradas (0)'
      ELSE ' | 11b FALHOU: pessoa desativada lê ' || v_n || ' linha(s)' END;

    UPDATE public.rotas SET iniciada_em = now() WHERE id = v_rota_m3;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    UPDATE public.paradas SET status = 'concluida' WHERE id = v_p_m3;
    GET DIAGNOSTICS v_ret_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0 AND v_ret_n = 0
      THEN ' | 11c OK: pessoa desativada não atualiza rota nem parada (0/0)'
      ELSE ' | 11c FALHOU: pessoa desativada atualizou rota ' || v_n || ', parada ' || v_ret_n END;

    v_bool := public.pode_registrar_log_na_rota(v_rota_m3);
    r := r || CASE WHEN v_bool = false
      THEN ' | 11d OK: pode_registrar_log_na_rota = false para a pessoa desativada'
      ELSE ' | 11d FALHOU: pode_registrar_log_na_rota = ' || coalesce(v_bool::text, 'NULL') END;

    v_json := public.reordenar_paradas(ARRAY[v_p_m3], ARRAY[1]);
    r := r || CASE WHEN (v_json->>'success')::boolean = false
      THEN ' | 11e OK: reordenar_paradas recusa a pessoa desativada'
      ELSE ' | 11e FALHOU: reordenar_paradas aceitou a pessoa desativada' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 11a-11e FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m3, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.finalizar_rota(v_rota_m3);
    r := r || ' | 11f FALHOU: finalizar_rota aceitou a pessoa desativada';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE 'ROTA_NAO_ENCONTRADA%'
      THEN ' | 11f OK: finalizar_rota = ROTA_NAO_ENCONTRADA para a pessoa desativada'
      ELSE ' | 11f FALHOU: recusado por outro motivo (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m3, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
      VALUES (v_m3, v_rota_m3, 'sos_acionado', jsonb_build_object(
        'descricao', 'sonda m49 m3', 'parada_id', 'sonda-m49-m3'));
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 11g OK: SOS da pessoa desativada aceito (1)'
      ELSE ' | 11g FALHOU: SOS da pessoa desativada gravou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 11g FALHOU: SOS da pessoa desativada recusado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    SELECT count(*) INTO v_n FROM public.logs l
     WHERE l.usuario_id = v_m3 AND l.evento = 'sos_acionado'
       AND l.rota_id IS NULL AND (l.detalhes->>'rota_recusada')::boolean;
    r := r || CASE WHEN v_n = 1
      THEN ' | 11h OK: SOS da pessoa desativada gravado sem rota e rota_recusada'
      ELSE ' | 11h FALHOU: SOS da pessoa desativada fora do esperado (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 11h FALHOU: erro inesperado (' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 12. gestor com vínculo desativado em A
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_ga_off, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT (SELECT count(*) FROM public.rotas WHERE id IN (v_rota_a, v_rota_m3))
         + (SELECT count(*) FROM public.paradas WHERE rota_id IN (v_rota_a, v_rota_m3))
      INTO v_n;
    r := r || CASE WHEN v_n = 0
      THEN ' | 12a OK: gestor com vínculo desativado em A não lê rotas nem paradas de A (0)'
      ELSE ' | 12a FALHOU: gestor com vínculo desativado lê ' || v_n || ' linha(s) de A' END;

    UPDATE public.rotas SET iniciada_em = now() WHERE id = v_rota_a;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    UPDATE public.paradas SET observacoes = 'sonda m49' WHERE id = v_pa_real;
    GET DIAGNOSTICS v_ret_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0 AND v_ret_n = 0
      THEN ' | 12b OK: gestor com vínculo desativado não atualiza rota nem parada de A (0/0)'
      ELSE ' | 12b FALHOU: gestor com vínculo desativado atualizou rota ' || v_n || ', parada ' || v_ret_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 12 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 13. SOS de quem não tem nenhuma loja ativa
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m4, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_n := public.registrar_sos(jsonb_build_object(
      'descricao', 'sonda m49 sem loja', 'parada_id', 'sonda-m49-m4'), NULL);
    r := r || CASE WHEN v_n = 0
      THEN ' | 13a OK: SOS de quem não tem loja ativa aceito, 0 gestores avisados'
      ELSE ' | 13a FALHOU: SOS de quem não tem loja ativa avisou ' || v_n || ' gestor(es)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 13a FALHOU: SOS de quem não tem loja ativa recusado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    SELECT count(*) INTO v_n FROM public.logs l
     WHERE l.usuario_id = v_m4 AND l.evento = 'sos_acionado'
       AND l.rota_id IS NULL
       AND (l.detalhes->>'gestores_avisados')::int = 0;
    r := r || CASE WHEN v_n = 1
      THEN ' | 13b OK: o SOS de quem não tem loja ativa ficou gravado (gestores_avisados = 0)'
      ELSE ' | 13b FALHOU: SOS de quem não tem loja ativa fora do esperado (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 13b FALHOU: erro inesperado (' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 14. ramo do gestor pelo vínculo de gestor ativo em A
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gp_off, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT (SELECT count(*) FROM public.rotas WHERE id = v_rota_a)
         + (SELECT count(*) FROM public.paradas WHERE rota_id = v_rota_a)
      INTO v_n;
    r := r || CASE WHEN v_n = 4
      THEN ' | 14a OK: segundo gestor de A lê a rota e as 3 paradas de A (4)'
      ELSE ' | 14a FALHOU: segundo gestor de A lê ' || v_n || ' de 4 linhas de A' END;

    UPDATE public.rotas SET iniciada_em = now() WHERE id = v_rota_a;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 14b OK: segundo gestor de A atualiza a rota de A (1)'
      ELSE ' | 14b FALHOU: segundo gestor de A atualizou ' || v_n || ' rota(s)' END;

    v_bool := public.pode_registrar_log_na_rota(v_rota_a);
    r := r || CASE WHEN v_bool = true
      THEN ' | 14c OK: pode_registrar_log_na_rota(A) = true para o segundo gestor de A'
      ELSE ' | 14c FALHOU: pode_registrar_log_na_rota(A) = ' || coalesce(v_bool::text, 'NULL') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 14 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 15. checagem da rota com erro: o SOS não falha
  -- ---------------------------------------------------------------------------
  BEGIN
    ALTER FUNCTION public.usuario_atual_ativo() RENAME TO usuario_atual_ativo_sonda_m49;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    -- prova de que a checagem está mesmo falhando nesta janela
    BEGIN
      v_bool := public.pode_registrar_log_na_rota(v_rota_b);
      r := r || ' | 15a FALHOU: a checagem não falhou (' || coalesce(v_bool::text, 'NULL') || ')';
    EXCEPTION WHEN OTHERS THEN
      r := r || ' | 15a OK: a checagem da rota falha nesta janela (' || SQLERRM || ')';
    END;

    INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
      VALUES (v_m, v_rota_b, 'sos_acionado', jsonb_build_object(
        'descricao', 'sonda m49 erro direto', 'parada_id', 'sonda-m49-erro-direto',
        'rota_id', v_rota_b, 'rota_status', 'concluida'));
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 15b OK: SOS direto aceito com a checagem falhando (1)'
      ELSE ' | 15b FALHOU: SOS direto gravou ' || v_n || ' linha(s)' END;

    v_n := public.registrar_sos(jsonb_build_object(
      'descricao', 'sonda m49 erro rpc', 'parada_id', 'sonda-m49-erro-rpc',
      'rota_id', v_rota_b), v_rota_b);
    r := r || ' | 15c OK: registrar_sos não falhou com a checagem falhando (' || v_n || ' gestor(es))';

    RESET ROLE;
    ALTER FUNCTION public.usuario_atual_ativo_sonda_m49() RENAME TO usuario_atual_ativo;
  EXCEPTION WHEN OTHERS THEN
    -- a subtransação desfaz também a troca de nome
    r := r || ' | 15 FALHOU: o SOS falhou com a checagem falhando (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    SELECT count(*) INTO v_n FROM public.logs l
     WHERE l.usuario_id = v_m AND l.evento = 'sos_acionado'
       AND l.detalhes->>'parada_id' IN ('sonda-m49-erro-direto', 'sonda-m49-erro-rpc')
       AND l.rota_id IS NULL
       AND (l.detalhes->>'rota_recusada')::boolean
       AND NOT (l.detalhes ? 'rota_id') AND NOT (l.detalhes ? 'rota_status');
    r := r || CASE WHEN v_n = 2
      THEN ' | 15d OK: os 2 SOS da janela de erro gravados sem rota e rota_recusada'
      ELSE ' | 15d FALHOU: ' || v_n || ' de 2 SOS da janela de erro como esperado' END;

    r := r || CASE WHEN to_regprocedure('public.usuario_atual_ativo()') IS NOT NULL
      THEN ' | 15e OK: o helper voltou ao nome original'
      ELSE ' | 15e FALHOU: o helper não voltou ao nome original' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 15d-15e FALHOU: erro inesperado (' || SQLERRM || ')';
  END;

  RAISE EXCEPTION 'SONDA M49 (desfeita):%', r;
END
$$;
