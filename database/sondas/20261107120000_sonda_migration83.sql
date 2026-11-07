-- ============================================================================
-- Sonda transacional da Migration 83 (varredura de 07/11: aviso de expiração
-- pelo vínculo, lembrete na janela e uma vez por dia, conclusão de rota só sem
-- parada real aberta, retenção de notificações)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 83 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, saem FALHOU os casos
-- 1, 2, 3, 4, 5, 9, 10 e 11 (gestor legado avisado e o do vínculo não;
-- função de lembrete ausente; conclusão direta com parada aberta aceita;
-- limpeza ausente; catálogo); os casos 6, 7 e 8 já saem OK — são os
-- caminhos que precisam continuar valendo.
--
-- Cenário comum (não depende de dado real): lojas A e B; motorista M, ativo
-- em A; gestor GA, gestor ativo de A pelas duas fontes (coluna e vínculo);
-- gestor GV, gestor de A só pelo vínculo (a coluna `usuarios.unidade_id`
-- aponta para B); gestor GL, só pela coluna legada (vínculo de gestor em A
-- inativo). Cada caso monta a própria rota como postgres, sem sessão. As
-- escritas da API rodam como `authenticated` (SET LOCAL ROLE + claims do JWT),
-- com os corpos do app; a conferência roda como postgres. O bloco termina
-- SEMPRE em RAISE EXCEPTION, que desfaz tudo (inclusive as notificações e a
-- fila do pg_net). Leia o resultado na mensagem
-- "SONDA M83 (desfeita): N OK | N FALHOU ..." (o detalhe de cada caso sai
-- antes num RAISE NOTICE; a API corta mensagens de erro em ~1.200
-- caracteres, por isso a EXCEPTION leva só o resumo e o que falhou).
--
-- ATENÇÃO (caso 1): `expire_old_pending_routes` não recebe a hora; ela varre
-- as rotas reais vencidas naquele instante (normalmente nenhuma: o cron as
-- expira toda noite) e as atualiza dentro da transação, que o RAISE desfaz.
-- Rode fora da janela das 22:00 às 22:15 de Brasília. Os casos 2 e 3 usam
-- uma data de 2000 (sem horário de verão em julho) para não alcançar rota
-- real; o caso 9 usa retenção de 36.500 dias, que nenhuma linha real passa.
--
--    1. B-1: rota pendente de ontem em A expira → avisados GA, GV e M; GL
--       não; rota `nao_executada`
--    2. B-2 fora da janela: `lembrar_rotas_no_horario` com normal às 10:00 e
--       às 17:00 e final às 18:59 e às 22:30 → (0, 0) nos quatro; nenhuma
--       notificação
--    3. B-2 na janela e repetido: normal às 16:00 → 1 aviso; normal às 16:30
--       → 0; final às 20:00 → 1 urgente; final às 21:59 → 0; um aviso de
--       cada tipo na rota
--    4. B-4: M conclui por UPDATE direto com parada real pendente → P0001
--       ROTA_PARADAS_PENDENTES; rota segue `em_andamento`
--    5. B-4: GA (gestor) conclui por UPDATE direto com parada real
--       `em_andamento` → P0001 ROTA_PARADAS_PENDENTES; rota segue
--       `em_andamento`
--    6. M conclui por UPDATE direto com as paradas reais concluídas/puladas e
--       a chegada pendente (o app até a 1.14.2) → 1 linha; rota `concluida`
--    7. `finalizar_rota`: com as reais concluídas e a chegada pendente →
--       rota e chegada `concluida`; com parada real pendente → a própria
--       função recusa com ROTA_PARADAS_PENDENTES
--    8. sem sessão (postgres) conclui com parada real pendente → passa
--       (cron, painel e CLI, como na Migration 76)
--    9. B-5: `limpar_notificacoes_antigas(36500, 36500)` → apaga a lida de
--       40.000 dias e o log de 40.000 dias; ficam a lida de 36.000 dias, a
--       não lida de 40.000 dias e o log de 36.000 dias; resposta {1, 1,
--       completa}
--   10. B-5: retenção abaixo do mínimo (29 dias lidas; 6 dias logs) → 22023
--       nas duas; padrão 90/30 na assinatura
--   11. catálogo: as cinco funções com DEFINER/search_path/dono/ACL/COMMENT
--       da Migration 83 (a interna sem DEFINER e sem EXECUTE de ninguém da
--       API, nem do service_role); gatilho habilitado; índice novo; postgres
--       executa `gestores_ativos_da_unidade`
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_m uuid := gen_random_uuid();      -- motorista de A
  v_ga uuid := gen_random_uuid();     -- gestor de A pela coluna e pelo vínculo
  v_gv uuid := gen_random_uuid();     -- gestor de A só pelo vínculo
  v_gl uuid := gen_random_uuid();     -- gestor de A só pela coluna legada
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dia2000 date := DATE '2000-07-03';
  v_rota uuid;
  v_rota2 uuid;
  v_chegada uuid;
  v_n1 uuid;
  v_n2 uuid;
  v_n3 uuid;
  v_l1 uuid;
  v_l2 uuid;
  v_status text;
  v_status2 text;
  v_err text;
  v_err2 text;
  v_res jsonb;
  v_ok boolean;
  v_det text;
  v_n int;
  v_n2c int;
  v_n3c int;
  v_n4c int;
  v_found int;
  v_sent int;
  v_exp int;
  v_not int;
  v_args text;
  v_ok_n int;
  v_falhou_n int;
  v_falhas text;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);

  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,  'sonda-m83-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga, 'sonda-m83-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gv, 'sonda-m83-gv-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gl, 'sonda-m83-gl-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M83 A', 'Sonda'),
    (v_ub, 'Sonda M83 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m,  'Sonda motorista M', 'sonda-m83-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_ga, 'Sonda gestor GA',   'sonda-m83-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gv, 'Sonda gestor GV',   'sonda-m83-gv-' || v_sufixo || '@example.invalid', 'gestor',    v_ub, true),
    (v_gl, 'Sonda gestor GL',   'sonda-m83-gl-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,  v_ua, 'motorista', true,  true),
    (v_ga, v_ua, 'gestor',    true,  true),
    (v_gv, v_ub, 'gestor',    true,  true),
    (v_gv, v_ua, 'gestor',    true,  false),
    (v_gl, v_ua, 'gestor',    false, true);

  -- ---------------------------------------------------------------------------
  -- 1. B-1: aviso de expiração pelo vínculo ativo
  -- ---------------------------------------------------------------------------
  BEGIN
    v_rota := gen_random_uuid();
    INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
      (v_rota, v_ua, v_m, 'pendente', v_hoje - 1);
    INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
      (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
      (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente', true),
      (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente', false);

    SELECT e.expired_count, e.notifications_sent INTO v_exp, v_not
      FROM public.expire_old_pending_routes(false) AS e;

    SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
    SELECT count(*) FILTER (WHERE usuario_id = v_ga),
           count(*) FILTER (WHERE usuario_id = v_gv),
           count(*) FILTER (WHERE usuario_id = v_gl),
           count(*) FILTER (WHERE usuario_id = v_m)
      INTO v_n, v_n2c, v_n3c, v_n4c
      FROM public.notificacoes
     WHERE rota_id = v_rota AND tipo = 'rota_nao_executada';
    r := r || CASE WHEN v_status = 'nao_executada' AND v_n = 1 AND v_n2c = 1 AND v_n3c = 0 AND v_n4c = 1
      THEN ' | 1 OK: expiração avisa GA e GV (vínculo ativo) e M; GL (só a coluna legada) não'
      ELSE ' | 1 FALHOU: rota ' || coalesce(v_status, 'nula') || ', avisos GA=' || v_n || ' GV=' || v_n2c
           || ' GL=' || v_n3c || ' M=' || v_n4c || ' (expiradas no banco ' || coalesce(v_exp, -1) || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- Rota dos casos 2 e 3: pendente em 03/07/2000, de M.
  v_rota2 := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_rota2, v_ua, v_m, 'pendente', v_dia2000);
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_rota2, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'pendente', false),
    (v_rota2, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente', true),
    (v_rota2, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente', false);

  -- ---------------------------------------------------------------------------
  -- 2. B-2: fora da janela, nada
  -- ---------------------------------------------------------------------------
  BEGIN
    v_ok := true;
    v_det := '';
    FOR v_status, v_args IN
      SELECT x.urg, x.hora FROM (VALUES
        ('normal', '10:00'), ('normal', '17:00'), ('final', '18:59'), ('final', '22:30')
      ) AS x(urg, hora)
    LOOP
      SELECT l.routes_found, l.reminders_sent INTO v_found, v_sent
        FROM public.lembrar_rotas_no_horario(
               v_status,
               (v_dia2000 + v_args::time) AT TIME ZONE 'America/Sao_Paulo'
             ) AS l;
      IF NOT (v_found = 0 AND v_sent = 0) THEN
        v_ok := false;
        v_det := v_det || ' ' || v_status || ' ' || v_args || ' -> (' || v_found || ', ' || v_sent || ');';
      END IF;
    END LOOP;
    SELECT count(*) INTO v_n FROM public.notificacoes WHERE rota_id = v_rota2;
    r := r || CASE WHEN v_ok AND v_n = 0
      THEN ' | 2 OK: fora da janela (normal 10:00 e 17:00; final 18:59 e 22:30) não avisa'
      ELSE ' | 2 FALHOU:' || v_det || ' ' || v_n || ' notificação(ões)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 3. B-2: na janela avisa uma vez; repetido não avisa de novo
  -- ---------------------------------------------------------------------------
  BEGIN
    v_ok := true;
    v_det := '';
    FOR v_status, v_args, v_n IN
      SELECT x.urg, x.hora, x.esperado FROM (VALUES
        ('normal', '16:00', 1), ('normal', '16:30', 0), ('final', '20:00', 1), ('final', '21:59', 0)
      ) AS x(urg, hora, esperado)
    LOOP
      SELECT l.routes_found, l.reminders_sent INTO v_found, v_sent
        FROM public.lembrar_rotas_no_horario(
               v_status,
               (v_dia2000 + v_args::time) AT TIME ZONE 'America/Sao_Paulo'
             ) AS l;
      IF NOT (v_found = v_n AND v_sent = v_n) THEN
        v_ok := false;
        v_det := v_det || ' ' || v_status || ' ' || v_args || ' -> (' || v_found || ', ' || v_sent
                 || '), esperado ' || v_n || ';';
      END IF;
    END LOOP;
    SELECT count(*) FILTER (WHERE tipo = 'lembrete_rota_pendente' AND usuario_id = v_m),
           count(*) FILTER (WHERE tipo = 'lembrete_rota_urgente' AND usuario_id = v_m),
           count(*)
      INTO v_n, v_n2c, v_n3c
      FROM public.notificacoes WHERE rota_id = v_rota2;
    r := r || CASE WHEN v_ok AND v_n = 1 AND v_n2c = 1 AND v_n3c = 2
      THEN ' | 3 OK: na janela avisa uma vez por tipo (16:00 e 20:00); 16:30 e 21:59 não repetem'
      ELSE ' | 3 FALHOU:' || v_det || ' pendente=' || v_n || ' urgente=' || v_n2c || ' total=' || v_n3c END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 4. B-4: M conclui por UPDATE direto com parada real pendente
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_rota, v_ua, v_m, 'em_andamento', v_hoje, now() - interval '1 hour');
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, concluida_em) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false, now() - interval '1 hour'),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'concluida', true,  now() - interval '30 minutes'),
    (v_rota, 'entrega', 'sonda p2',      -7.1, -34.8, 2, 'pendente',  true,  NULL),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 3, 'pendente',  false, NULL);
  v_err := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.rotas SET status = 'concluida', concluida_em = now() WHERE id = v_rota;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    v_err := 'UPDATE aceito (' || v_n || ' linha)';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLSTATE || ' ' || SQLERRM;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
  r := r || CASE WHEN v_err LIKE 'P0001 ROTA_PARADAS_PENDENTES:%' AND v_status = 'em_andamento'
    THEN ' | 4 OK: motorista não conclui por UPDATE direto com parada real pendente (ROTA_PARADAS_PENDENTES)'
    ELSE ' | 4 FALHOU: ' || coalesce(v_err, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;

  -- ---------------------------------------------------------------------------
  -- 5. B-4: GA conclui por UPDATE direto com parada real em andamento
  -- ---------------------------------------------------------------------------
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_rota, v_ua, v_m, 'em_andamento', v_hoje, now() - interval '1 hour');
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, concluida_em) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida',    false, now() - interval '1 hour'),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'em_andamento', true,  NULL),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente',     false, NULL);
  v_err := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.rotas SET status = 'concluida', concluida_em = now() WHERE id = v_rota;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
    v_err := 'UPDATE aceito (' || v_n || ' linha)';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLSTATE || ' ' || SQLERRM;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
  r := r || CASE WHEN v_err LIKE 'P0001 ROTA_PARADAS_PENDENTES:%' AND v_status = 'em_andamento'
    THEN ' | 5 OK: gestor não conclui por UPDATE direto com parada real em andamento (ROTA_PARADAS_PENDENTES)'
    ELSE ' | 5 FALHOU: ' || coalesce(v_err, 'nulo') || ', rota ' || coalesce(v_status, 'nula') END;

  -- ---------------------------------------------------------------------------
  -- 6. M conclui por UPDATE direto com as reais concluídas/puladas (app 1.14.2)
  -- ---------------------------------------------------------------------------
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_rota, v_ua, v_m, 'em_andamento', v_hoje, now() - interval '1 hour');
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, concluida_em) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false, now() - interval '1 hour'),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'concluida', true,  now() - interval '30 minutes'),
    (v_rota, 'entrega', 'sonda p2',      -7.1, -34.8, 2, 'pulada',    true,  NULL),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 3, 'pendente',  false, NULL);
  v_err := NULL;
  v_n := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.rotas SET status = 'concluida', concluida_em = now() WHERE id = v_rota;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLSTATE || ' ' || SQLERRM;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
  r := r || CASE WHEN v_err IS NULL AND v_n = 1 AND v_status = 'concluida'
    THEN ' | 6 OK: motorista conclui por UPDATE direto com reais concluídas/puladas e chegada pendente'
    ELSE ' | 6 FALHOU: ' || coalesce(v_err, v_n || ' linha') || ', rota ' || coalesce(v_status, 'nula') END;

  -- ---------------------------------------------------------------------------
  -- 7. finalizar_rota segue concluindo (e recusando com parada real aberta)
  -- ---------------------------------------------------------------------------
  v_rota := gen_random_uuid();
  v_rota2 := gen_random_uuid();
  v_chegada := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_rota,  v_ua, v_m, 'em_andamento', v_hoje, now() - interval '1 hour'),
    (v_rota2, v_ua, v_m, 'em_andamento', v_hoje, now() - interval '1 hour');
  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, concluida_em) VALUES
    (gen_random_uuid(), v_rota,  'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false, now() - interval '1 hour'),
    (gen_random_uuid(), v_rota,  'entrega', 'sonda p1',      -7.1, -34.8, 1, 'concluida', true,  now() - interval '10 minutes'),
    (v_chegada,         v_rota,  'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente',  false, NULL),
    (gen_random_uuid(), v_rota2, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false, now() - interval '1 hour'),
    (gen_random_uuid(), v_rota2, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente',  true,  NULL),
    (gen_random_uuid(), v_rota2, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente',  false, NULL);
  v_err := NULL;
  v_err2 := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.finalizar_rota(v_rota);
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLSTATE || ' ' || SQLERRM;
  END;
  RESET ROLE;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.finalizar_rota(v_rota2);
    RESET ROLE;
    v_err2 := 'finalizar_rota aceita';
  EXCEPTION WHEN OTHERS THEN
    v_err2 := SQLSTATE || ' ' || SQLERRM;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
  SELECT status INTO v_status2 FROM public.paradas WHERE id = v_chegada;
  SELECT status INTO v_det FROM public.rotas WHERE id = v_rota2;
  r := r || CASE WHEN v_err IS NULL AND v_status = 'concluida' AND v_status2 = 'concluida'
                      AND v_err2 LIKE 'P0001 ROTA_PARADAS_PENDENTES:%' AND v_det = 'em_andamento'
    THEN ' | 7 OK: finalizar_rota conclui rota e chegada; com parada real pendente recusa (ROTA_PARADAS_PENDENTES)'
    ELSE ' | 7 FALHOU: finalizar ' || coalesce(v_err, 'sem erro') || ', rota ' || coalesce(v_status, 'nula')
         || ', chegada ' || coalesce(v_status2, 'nula') || '; com pendente ' || coalesce(v_err2, 'nulo')
         || ', rota ' || coalesce(v_det, 'nula') END;

  -- ---------------------------------------------------------------------------
  -- 8. sem sessão (postgres) conclui com parada real pendente
  -- ---------------------------------------------------------------------------
  v_rota := gen_random_uuid();
  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_rota, v_ua, v_m, 'em_andamento', v_hoje, now() - interval '1 hour');
  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_rota, 'entrega', 'sonda partida', -7.1, -34.8, 0, 'concluida', false),
    (v_rota, 'entrega', 'sonda p1',      -7.1, -34.8, 1, 'pendente',  true),
    (v_rota, 'entrega', 'sonda chegada', -7.1, -34.8, 2, 'pendente',  false);
  v_err := NULL;
  BEGIN
    UPDATE public.rotas SET status = 'concluida', concluida_em = now() WHERE id = v_rota;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLSTATE || ' ' || SQLERRM;
  END;
  SELECT status INTO v_status FROM public.rotas WHERE id = v_rota;
  r := r || CASE WHEN v_err IS NULL AND v_status = 'concluida'
    THEN ' | 8 OK: sessão sem usuário (cron/painel/CLI) segue concluindo'
    ELSE ' | 8 FALHOU: ' || coalesce(v_err, 'sem erro') || ', rota ' || coalesce(v_status, 'nula') END;

  -- ---------------------------------------------------------------------------
  -- 9. B-5: a limpeza respeita os dias
  -- ---------------------------------------------------------------------------
  BEGIN
    v_n1 := gen_random_uuid();
    v_n2 := gen_random_uuid();
    v_n3 := gen_random_uuid();
    v_l1 := gen_random_uuid();
    v_l2 := gen_random_uuid();
    INSERT INTO public.notificacoes (id, usuario_id, tipo, titulo, mensagem, lida, created_at) VALUES
      (v_n1, v_m, 'sonda_m83', 'sonda', 'lida antiga',     true,  now() - interval '40000 days'),
      (v_n2, v_m, 'sonda_m83', 'sonda', 'lida recente',    true,  now() - interval '36000 days'),
      (v_n3, v_m, 'sonda_m83', 'sonda', 'não lida antiga', false, now() - interval '40000 days');
    INSERT INTO public.push_notification_logs (id, notificacao_id, usuario_id, push_token, status, created_at) VALUES
      (v_l1, NULL, v_m, NULL, 'skipped', now() - interval '40000 days'),
      (v_l2, NULL, v_m, NULL, 'skipped', now() - interval '36000 days');

    v_res := public.limpar_notificacoes_antigas(36500, 36500);

    SELECT count(*) FILTER (WHERE id = v_n1),
           count(*) FILTER (WHERE id IN (v_n2, v_n3))
      INTO v_n, v_n2c
      FROM public.notificacoes WHERE id IN (v_n1, v_n2, v_n3);
    SELECT count(*) FILTER (WHERE id = v_l1),
           count(*) FILTER (WHERE id = v_l2)
      INTO v_n3c, v_n4c
      FROM public.push_notification_logs WHERE id IN (v_l1, v_l2);
    r := r || CASE WHEN v_n = 0 AND v_n2c = 2 AND v_n3c = 0 AND v_n4c = 1
                        AND v_res = jsonb_build_object('notificacoes_apagadas', 1, 'push_logs_apagados', 1, 'completa', true)
      THEN ' | 9 OK: apaga só a lida e o log além do prazo; ficam a lida recente, a não lida e o log recente'
      ELSE ' | 9 FALHOU: lida antiga ' || v_n || ', restantes ' || v_n2c || ', log antigo ' || v_n3c
           || ', log recente ' || v_n4c || ', resposta ' || coalesce(v_res::text, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 10. B-5: retenção abaixo do mínimo e padrão da assinatura
  -- ---------------------------------------------------------------------------
  BEGIN
    v_err := NULL;
    v_err2 := NULL;
    BEGIN
      v_res := public.limpar_notificacoes_antigas(29, 30);
      v_err := 'aceita';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLSTATE;
    END;
    BEGIN
      v_res := public.limpar_notificacoes_antigas(90, 6);
      v_err2 := 'aceita';
    EXCEPTION WHEN OTHERS THEN
      v_err2 := SQLSTATE;
    END;
    SELECT pg_get_function_arguments(p.oid) INTO v_args
      FROM pg_proc p
     WHERE p.oid = to_regprocedure('public.limpar_notificacoes_antigas(integer,integer)');
    r := r || CASE WHEN v_err = '22023' AND v_err2 = '22023'
                        AND v_args = 'p_dias_lidas integer DEFAULT 90, p_dias_push_logs integer DEFAULT 30'
      THEN ' | 10 OK: retenção abaixo do mínimo recusada (22023) e padrão 90/30'
      ELSE ' | 10 FALHOU: (29, 30) ' || coalesce(v_err, 'nulo') || ', (90, 6) ' || coalesce(v_err2, 'nulo')
           || ', argumentos ' || coalesce(v_args, 'função ausente') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 10 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 11. catálogo
  -- ---------------------------------------------------------------------------
  BEGIN
    v_ok := true;
    v_det := '';

    -- As três chamadas pelo service_role (cron): DEFINER, search_path public.
    SELECT count(*) INTO v_n
      FROM pg_proc p
     WHERE p.oid IN (to_regprocedure('public.expire_old_pending_routes(boolean)'),
                     to_regprocedure('public.remind_pending_routes(text)'),
                     to_regprocedure('public.limpar_notificacoes_antigas(integer,integer)'))
       AND p.prosecdef
       AND p.proconfig = ARRAY['search_path=public']
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.proacl IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
       AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
       AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
       AND has_function_privilege('service_role', p.oid, 'EXECUTE')
       AND obj_description(p.oid, 'pg_proc') LIKE 'Migration 83%';
    IF v_n <> 3 THEN
      v_ok := false;
      v_det := v_det || ' expire/remind/limpar no esperado: ' || v_n || ' de 3;';
    END IF;

    -- A interna: sem DEFINER, só o dono executa.
    SELECT count(*) INTO v_n
      FROM pg_proc p
     WHERE p.oid = to_regprocedure('public.lembrar_rotas_no_horario(text,timestamptz)')
       AND NOT p.prosecdef
       AND p.proconfig = ARRAY['search_path=public']
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.proacl IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
       AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
       AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
       AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
       AND obj_description(p.oid, 'pg_proc') LIKE 'Migration 83%';
    IF v_n <> 1 THEN
      v_ok := false;
      v_det := v_det || ' lembrar_rotas_no_horario fora do esperado;';
    END IF;

    -- A do gatilho: DEFINER, search_path vazio, ninguém da API executa.
    SELECT count(*) INTO v_n
      FROM pg_proc p
     WHERE p.oid = to_regprocedure('public.rota_status_pelo_gestor()')
       AND p.prosecdef
       AND p.proconfig = ARRAY['search_path=""']
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.proacl IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
       AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
       AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
       AND obj_description(p.oid, 'pg_proc') LIKE 'Migration 83%';
    IF v_n <> 1 THEN
      v_ok := false;
      v_det := v_det || ' rota_status_pelo_gestor fora do esperado;';
    END IF;

    SELECT count(*) INTO v_n
      FROM pg_trigger t
     WHERE t.tgrelid = 'public.rotas'::regclass
       AND t.tgname = 'trg_rota_status_pelo_gestor'
       AND t.tgenabled = 'O'
       AND t.tgfoid = to_regprocedure('public.rota_status_pelo_gestor()');
    IF v_n <> 1 THEN
      v_ok := false;
      v_det := v_det || ' gatilho ausente ou desabilitado;';
    END IF;

    IF to_regclass('public.idx_push_notification_logs_created_at') IS NULL THEN
      v_ok := false;
      v_det := v_det || ' índice de created_at ausente;';
    END IF;

    IF NOT has_function_privilege('postgres', 'public.gestores_ativos_da_unidade(uuid)', 'EXECUTE') THEN
      v_ok := false;
      v_det := v_det || ' postgres sem EXECUTE em gestores_ativos_da_unidade;';
    END IF;

    r := r || CASE WHEN v_ok
      THEN ' | 11 OK: catálogo (DEFINER, search_path, dono postgres, ACL, COMMENT da Migration 83; gatilho; índice)'
      ELSE ' | 11 FALHOU:' || v_det END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 11 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- Resumo (o detalhe vai no NOTICE; a EXCEPTION desfaz tudo)
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_ok_n FROM regexp_matches(r, '\| \d+ OK:', 'g');
  SELECT count(*) INTO v_falhou_n FROM regexp_matches(r, '\| \d+ FALHOU', 'g');
  SELECT coalesce(string_agg(x[1], ' '), '') INTO v_falhas
    FROM regexp_matches(r, '(\| \d+ FALHOU[^|]*)', 'g') AS x;

  RAISE NOTICE 'SONDA M83 detalhe:%', r;
  RAISE EXCEPTION 'SONDA M83 (desfeita): % OK | % FALHOU %', v_ok_n, v_falhou_n, v_falhas;
END
$$;
