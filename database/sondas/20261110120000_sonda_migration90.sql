-- ============================================================================
-- Sonda transacional da Migration 90 (desempenho por período e índices)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 90 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça tudo. Sem a migration, os casos saem FALHOU.
--
-- As versões ANTERIORES das duas funções (corpos da Migration 55 e da
-- Migration 89, iguais aos vivos em 10/11/2026: `prosrc` conferido por SELECT)
-- são recriadas aqui em `pg_temp`, para comparar a resposta nova com a antiga
-- linha a linha. Rodam como postgres com as claims do JWT de quem chama: o
-- corpo só depende de `auth.uid()`, e as originais são DEFINER de postgres.
-- Também somem com o RAISE (e com o fim da sessão).
--
-- Cenário (não depende de dado real): lojas A e B; GA gestor ativo de A, GB
-- de B; M1 motorista ativo em A e em B; M2 motorista só em A. Rotas nascem
-- como postgres, sem sessão, já no status final. H = hoje em São Paulo.
--   M1 em A (datas relativas a H):
--     r1 H     concluida  10,00 km  60 min   paradas: partida, 2 concluídas
--                                            (true e NULL), 1 pulada, chegada
--     r2 H-7   concluida  20,00 km 120 min
--     r3 H-8   concluida  30,00 km  30 min   1 parada concluída
--     r4 H-2   cancelada   5,00 km           1 parada pendente
--     r5 H-1   em_andamento 1,00 km (iniciada, sem concluida_em)
--     r6 H-3   concluida   2,00 km  25 h  (fora do tempo médio: >= 24 h)
--     r7 H+1   pendente    1,00 km
--     r9 H-4   concluida   0,00 km   0 min (fora do tempo médio: diferença 0)
--   M1 em B: r8 H concluida 100,00 km 45 min, 1 parada concluída
--   M2 em A (datas fixas): 31/10 concluida 1 km 30 min; 01/11 concluida 2 km
--     40 min; 15/11 cancelada 4 km; 30/11 concluida 8 km 50 min; 01/12
--     concluida 16 km 60 min.
-- As chamadas às funções novas rodam como `authenticated` (SET LOCAL ROLE +
-- claims). O bloco termina SEMPRE em RAISE EXCEPTION. Leia o resultado na
-- mensagem "SONDA M90 (desfeita): N OK | N FALHOU ..." (detalhe no NOTICE).
--
--    1. chamada antiga resumo(m, p_dias): igual à versão anterior (pg_temp)
--       para GA e M1 com p_dias 7, 0, 30 e NULL, posicional e nomeada; e
--       os números esperados de GA com 7; p_dias negativo segue 22023
--    2. resumo(m, NULL, 01/11, 30/11) conta só as rotas de novembro; só p_de
--       e só p_ate também recortam
--    3. p_de/p_ate com p_dias: o período vence (até com p_dias negativo)
--    4. tempo_medio_minutos: 90 (GA, 7 dias), 70 (GA, tudo), 63,75 (M1,
--       tudo), 45 (M2, novembro), NULL sem rota com tempo
--    5. desempenho_motorista_na_loja(m, u) sem período: igual à versão
--       anterior (pg_temp), posicional e nomeada, e os números esperados
--    6. desempenho_motorista_na_loja com período recorta (novembro; só p_de;
--       só p_ate; H-7 a H)
--    7. recusa: SEM_PERMISSAO (gestor de outra loja, com e sem período;
--       motorista; sem sessão) e 42501 do resumo (gestor sem vínculo com o
--       motorista, sem sessão)
--    8. os dois índices existem, com as colunas e a ordem pedidas
--    9. catálogo: assinaturas antigas fora, novas DEFINER, STABLE,
--       search_path vazio, dona postgres, sem EXECUTE de PUBLIC/anon, com
--       authenticated e service_role, COMMENT da Migration 90, resumo com
--       tempo_medio_minutos no retorno
-- ============================================================================

-- Versão anterior de resumo_desempenho_motorista (corpo da Migration 55).
CREATE FUNCTION pg_temp.resumo_m55(
  p_motorista_id uuid,
  p_dias integer DEFAULT NULL
)
RETURNS TABLE (
  desde date,
  total_rotas integer,
  rotas_concluidas integer,
  rotas_canceladas integer,
  distancia_total numeric,
  total_paradas integer,
  paradas_concluidas integer,
  paradas_puladas integer,
  entregas_em_rotas_concluidas integer
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ativo boolean := public.usuario_atual_ativo();
  v_desde date;
BEGIN
  IF v_uid IS NULL OR p_motorista_id IS NULL OR NOT (
    (v_uid = p_motorista_id AND v_ativo)
    OR EXISTS (
      SELECT 1
      FROM public.usuario_unidades g
      JOIN public.usuario_unidades m
        ON m.unidade_id = g.unidade_id
       AND m.usuario_id = p_motorista_id
       AND m.papel = 'motorista'
      WHERE g.usuario_id = v_uid
        AND g.papel = 'gestor' AND g.ativo
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ver os números deste motorista.'
      USING ERRCODE = '42501';
  END IF;

  IF p_dias IS NOT NULL THEN
    IF p_dias < 0 THEN
      RAISE EXCEPTION 'Período inválido: p_dias não pode ser negativo.'
        USING ERRCODE = '22023';
    END IF;
    v_desde := (now() AT TIME ZONE 'America/Sao_Paulo')::date - p_dias;
  END IF;

  RETURN QUERY
  WITH rv AS (
    SELECT r.id, r.status AS st, r.distancia_total AS km
    FROM public.rotas r
    WHERE r.motorista_id = p_motorista_id
      AND (v_desde IS NULL OR r.data >= v_desde)
      AND EXISTS (
        SELECT 1
        FROM public.usuario_unidades uu
        WHERE uu.usuario_id = v_uid AND uu.unidade_id = r.unidade_id AND uu.ativo AND (uu.papel = 'gestor' OR (r.motorista_id = v_uid AND v_ativo))
      )
  ),
  pr AS (
    SELECT p.status AS st, rv.st AS st_rota
    FROM rv
    JOIN public.paradas p ON p.rota_id = rv.id
    WHERE p.is_checkpoint IS DISTINCT FROM false
  ),
  tr AS (
    SELECT
      count(*)::integer AS n,
      (count(*) FILTER (WHERE rv.st = 'concluida'))::integer AS conc,
      (count(*) FILTER (WHERE rv.st = 'cancelada'))::integer AS canc,
      COALESCE(sum(rv.km), 0)::numeric AS km
    FROM rv
  ),
  tp AS (
    SELECT
      count(*)::integer AS n,
      (count(*) FILTER (WHERE pr.st = 'concluida'))::integer AS conc,
      (count(*) FILTER (WHERE pr.st = 'pulada'))::integer AS pul,
      (count(*) FILTER (WHERE pr.st = 'concluida' AND pr.st_rota = 'concluida'))::integer AS entregas
    FROM pr
  )
  SELECT v_desde, tr.n, tr.conc, tr.canc, tr.km, tp.n, tp.conc, tp.pul, tp.entregas
  FROM tr CROSS JOIN tp;
END;
$$;

-- Versão anterior de desempenho_motorista_na_loja (corpo da Migration 89).
CREATE FUNCTION pg_temp.desempenho_m89(
  p_motorista_id uuid,
  p_unidade_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuario_unidades uu
     WHERE uu.usuario_id = auth.uid()
       AND uu.unidade_id = p_unidade_id
       AND uu.papel::text = 'gestor'
       AND uu.ativo = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'SEM_PERMISSAO',
      'error', 'Você não tem acesso de gestor a esta loja.');
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'total_rotas', count(r.id),
    'rotas_concluidas', count(r.id) FILTER (WHERE r.status::text = 'concluida'),
    'rotas_em_andamento', count(r.id) FILTER (WHERE r.status::text = 'em_andamento'),
    'rotas_nao_executadas', count(r.id) FILTER (WHERE r.status::text = 'nao_executada'),
    'rotas_canceladas', count(r.id) FILTER (WHERE r.status::text = 'cancelada'),
    'taxa_execucao', CASE
      WHEN count(r.id) FILTER (WHERE r.status::text IN ('concluida', 'nao_executada')) > 0
        THEN round(
          count(r.id) FILTER (WHERE r.status::text = 'concluida')::numeric * 100::numeric
          / count(r.id) FILTER (WHERE r.status::text IN ('concluida', 'nao_executada'))::numeric,
          1
        )
      ELSE 100.0
    END,
    'distancia_total_km', sum(r.distancia_total) FILTER (WHERE r.status::text = 'concluida'),
    'tempo_medio_minutos', avg(extract(epoch FROM r.concluida_em - r.iniciada_em) / 60) FILTER (
      WHERE r.status::text = 'concluida'
        AND r.iniciada_em IS NOT NULL
        AND r.concluida_em IS NOT NULL
        AND r.concluida_em > r.iniciada_em
        AND r.concluida_em - r.iniciada_em < interval '24 hours'
    )
  )
    INTO v_resultado
    FROM public.rotas r
   WHERE r.motorista_id = p_motorista_id
     AND r.unidade_id = p_unidade_id;

  RETURN v_resultado;
END;
$$;

DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_gb uuid := gen_random_uuid();     -- gestor de B
  v_m1 uuid := gen_random_uuid();     -- motorista em A e em B
  v_m2 uuid := gen_random_uuid();     -- motorista só em A
  v_r1 uuid := gen_random_uuid();
  v_r3 uuid := gen_random_uuid();
  v_r4 uuid := gen_random_uuid();
  v_r8 uuid := gen_random_uuid();
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_agora timestamptz := now();
  v_quem uuid;
  v_dias integer;
  v_novo text;
  v_antigo text;
  v_nomeado text;
  v_dif text;
  v_n int;
  v_t1 numeric;
  v_t2 numeric;
  v_t3 numeric;
  v_t4 numeric;
  v_t5 numeric;
  v_t5_nulo boolean;
  v_a jsonb;
  v_b jsonb;
  v_c jsonb;
  v_d jsonb;
  v_e jsonb;
  v_erro1 text;
  v_erro2 text;
  v_erro3 text;
  v_det text;
  v_ok_n int;
  v_falhou_n int;
  v_falhas text;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_ga, 'sonda-m90-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m90-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m1, 'sonda-m90-m1-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m2, 'sonda-m90-m2-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M90 A', 'Sonda'),
    (v_ub, 'Sonda M90 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_ga, 'Sonda gestor A',     'sonda-m90-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gb, 'Sonda gestor B',     'sonda-m90-gb-' || v_sufixo || '@example.invalid', 'gestor',    v_ub, true),
    (v_m1, 'Sonda motorista M1', 'sonda-m90-m1-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_m2, 'Sonda motorista M2', 'sonda-m90-m2-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_ga, v_ua, 'gestor',    true, true),
    (v_gb, v_ub, 'gestor',    true, true),
    (v_m1, v_ua, 'motorista', true, true),
    (v_m1, v_ub, 'motorista', true, false),
    (v_m2, v_ua, 'motorista', true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, distancia_total, iniciada_em, concluida_em) VALUES
    -- M1 em A
    (v_r1, v_ua, v_m1, 'concluida',    v_hoje,      10.00, v_agora - interval '60 minutes',  v_agora),
    (gen_random_uuid(), v_ua, v_m1, 'concluida',    v_hoje - 7,  20.00, v_agora - interval '3 hours', v_agora - interval '1 hour'),
    (v_r3, v_ua, v_m1, 'concluida',    v_hoje - 8,  30.00, v_agora - interval '30 minutes',  v_agora),
    (v_r4, v_ua, v_m1, 'cancelada',    v_hoje - 2,   5.00, NULL, NULL),
    (gen_random_uuid(), v_ua, v_m1, 'em_andamento', v_hoje - 1,   1.00, v_agora - interval '10 minutes', NULL),
    (gen_random_uuid(), v_ua, v_m1, 'concluida',    v_hoje - 3,   2.00, v_agora - interval '26 hours', v_agora - interval '1 hour'),
    (gen_random_uuid(), v_ua, v_m1, 'pendente',     v_hoje + 1,   1.00, NULL, NULL),
    (gen_random_uuid(), v_ua, v_m1, 'concluida',    v_hoje - 4,   0.00, v_agora, v_agora),
    -- M1 em B
    (v_r8, v_ub, v_m1, 'concluida',    v_hoje,     100.00, v_agora - interval '45 minutes', v_agora),
    -- M2 em A, datas fixas
    (gen_random_uuid(), v_ua, v_m2, 'concluida', DATE '2026-10-31',  1.00, v_agora - interval '30 minutes', v_agora),
    (gen_random_uuid(), v_ua, v_m2, 'concluida', DATE '2026-11-01',  2.00, v_agora - interval '40 minutes', v_agora),
    (gen_random_uuid(), v_ua, v_m2, 'cancelada', DATE '2026-11-15',  4.00, NULL, NULL),
    (gen_random_uuid(), v_ua, v_m2, 'concluida', DATE '2026-11-30',  8.00, v_agora - interval '50 minutes', v_agora),
    (gen_random_uuid(), v_ua, v_m2, 'concluida', DATE '2026-12-01', 16.00, v_agora - interval '60 minutes', v_agora);

  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint) VALUES
    (v_r1, 'entrega', 'Partida',  -7.1, -34.8, 0, 'concluida', false),
    (v_r1, 'entrega', 'Rua 1, 1', -7.2, -34.8, 1, 'concluida', true),
    (v_r1, 'entrega', 'Rua 1, 2', -7.3, -34.8, 2, 'concluida', NULL),
    (v_r1, 'entrega', 'Rua 1, 3', -7.4, -34.8, 3, 'pulada',    true),
    (v_r1, 'entrega', 'Chegada',  -7.1, -34.8, 4, 'concluida', false),
    (v_r3, 'entrega', 'Rua 3, 1', -7.5, -34.8, 1, 'concluida', true),
    (v_r4, 'entrega', 'Rua 4, 1', -7.6, -34.8, 1, 'pendente',  true),
    (v_r8, 'entrega', 'Rua 8, 1', -7.7, -34.8, 1, 'concluida', true);

  -- ---------------------------------------------------------------------------
  -- 1. chamada antiga resumo(m, p_dias): igual à versão anterior
  -- ---------------------------------------------------------------------------
  BEGIN
    v_dif := '';
    FOREACH v_quem IN ARRAY ARRAY[v_ga, v_m1] LOOP
      FOREACH v_dias IN ARRAY ARRAY[7, 0, 30, NULL]::integer[] LOOP
        PERFORM set_config('request.jwt.claims', json_build_object('sub', v_quem, 'role', 'authenticated')::text, true);
        SELECT row(x.desde, x.total_rotas, x.rotas_concluidas, x.rotas_canceladas, x.distancia_total,
                   x.total_paradas, x.paradas_concluidas, x.paradas_puladas, x.entregas_em_rotas_concluidas)::text
          INTO v_antigo FROM pg_temp.resumo_m55(v_m1, v_dias) x;
        SET LOCAL ROLE authenticated;
        SELECT row(x.desde, x.total_rotas, x.rotas_concluidas, x.rotas_canceladas, x.distancia_total,
                   x.total_paradas, x.paradas_concluidas, x.paradas_puladas, x.entregas_em_rotas_concluidas)::text
          INTO v_novo FROM public.resumo_desempenho_motorista(v_m1, v_dias) x;
        SELECT row(x.desde, x.total_rotas, x.rotas_concluidas, x.rotas_canceladas, x.distancia_total,
                   x.total_paradas, x.paradas_concluidas, x.paradas_puladas, x.entregas_em_rotas_concluidas)::text
          INTO v_nomeado FROM public.resumo_desempenho_motorista(p_motorista_id => v_m1, p_dias => v_dias) x;
        RESET ROLE;
        IF v_novo IS DISTINCT FROM v_antigo OR v_nomeado IS DISTINCT FROM v_antigo THEN
          v_dif := v_dif || format(' [%s dias=%s: antiga %s, nova %s, nomeada %s]',
            CASE WHEN v_quem = v_ga THEN 'GA' ELSE 'M1' END, coalesce(v_dias::text, 'NULL'),
            v_antigo, v_novo, v_nomeado);
        END IF;
      END LOOP;
    END LOOP;

    -- Números esperados de GA com 7 dias (r1, r2, r4, r5, r6, r7, r9).
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT row(x.desde, x.total_rotas, x.rotas_concluidas, x.rotas_canceladas, x.distancia_total,
               x.total_paradas, x.paradas_concluidas, x.paradas_puladas, x.entregas_em_rotas_concluidas)::text
      INTO v_novo FROM public.resumo_desempenho_motorista(v_m1, 7) x;
    -- p_dias negativo segue recusado com 22023, como antes.
    BEGIN
      PERFORM * FROM public.resumo_desempenho_motorista(v_m1, -1);
      v_erro1 := 'sem erro';
    EXCEPTION WHEN OTHERS THEN
      v_erro1 := SQLSTATE;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);

    r := r || CASE WHEN v_dif = ''
                    AND v_novo = row(v_hoje - 7, 7, 4, 1, 39.00::numeric, 4, 2, 1, 2)::text
                    AND v_erro1 = '22023'
      THEN ' | 1 OK: resumo(m, p_dias) igual à versão anterior (GA e M1; 7, 0, 30, NULL; posicional e nomeada), 7 dias = 7 rotas/39 km, negativo 22023'
      ELSE ' | 1 FALHOU:' || v_dif || ' GA 7 dias ' || coalesce(v_novo, 'nulo') || ', negativo ' || coalesce(v_erro1, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 2. resumo com p_de/p_ate: só novembro
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT row(x.desde, x.total_rotas, x.rotas_concluidas, x.rotas_canceladas, x.distancia_total)::text
      INTO v_novo FROM public.resumo_desempenho_motorista(v_m2, NULL, DATE '2026-11-01', DATE '2026-11-30') x;
    SELECT row(x.desde, x.total_rotas, x.distancia_total)::text
      INTO v_antigo FROM public.resumo_desempenho_motorista(v_m2, NULL, DATE '2026-11-15', NULL) x;
    SELECT row(x.desde, x.total_rotas, x.distancia_total)::text
      INTO v_nomeado FROM public.resumo_desempenho_motorista(p_motorista_id => v_m2, p_ate => DATE '2026-10-31') x;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    r := r || CASE WHEN v_novo = row(DATE '2026-11-01', 3, 2, 1, 14.00::numeric)::text
                    AND v_antigo = row(DATE '2026-11-15', 3, 28.00::numeric)::text
                    AND v_nomeado = row(NULL::date, 1, 1.00::numeric)::text
      THEN ' | 2 OK: resumo de 01/11 a 30/11 conta só novembro (3 rotas, 14 km); só p_de e só p_ate recortam'
      ELSE ' | 2 FALHOU: novembro ' || coalesce(v_novo, 'nulo') || ', só p_de ' || coalesce(v_antigo, 'nulo')
           || ', só p_ate ' || coalesce(v_nomeado, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 3. p_de/p_ate vencem p_dias
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT row(x.desde, x.total_rotas, x.rotas_concluidas, x.rotas_canceladas, x.distancia_total)::text
      INTO v_novo FROM public.resumo_desempenho_motorista(v_m2, 1, DATE '2026-11-01', DATE '2026-11-30') x;
    SELECT row(x.desde, x.total_rotas, x.rotas_concluidas, x.rotas_canceladas, x.distancia_total)::text
      INTO v_antigo FROM public.resumo_desempenho_motorista(v_m2, 3650, DATE '2026-11-01', DATE '2026-11-30') x;
    -- p_dias negativo com período: ignorado, sem 22023.
    BEGIN
      SELECT row(x.desde, x.total_rotas, x.rotas_concluidas, x.rotas_canceladas, x.distancia_total)::text
        INTO v_nomeado FROM public.resumo_desempenho_motorista(v_m2, -5, DATE '2026-11-01', DATE '2026-11-30') x;
    EXCEPTION WHEN OTHERS THEN
      v_nomeado := 'erro ' || SQLSTATE;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    r := r || CASE WHEN v_novo = row(DATE '2026-11-01', 3, 2, 1, 14.00::numeric)::text
                    AND v_antigo = v_novo AND v_nomeado = v_novo
      THEN ' | 3 OK: com p_de/p_ate, p_dias (1, 3650, -5) é ignorado'
      ELSE ' | 3 FALHOU: p_dias 1 ' || coalesce(v_novo, 'nulo') || ', 3650 ' || coalesce(v_antigo, 'nulo')
           || ', -5 ' || coalesce(v_nomeado, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 4. tempo_medio_minutos (fórmula do cabeçalho do Histórico)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT x.tempo_medio_minutos INTO v_t1 FROM public.resumo_desempenho_motorista(v_m1, 7) x;
    SELECT x.tempo_medio_minutos INTO v_t2 FROM public.resumo_desempenho_motorista(v_m1) x;
    SELECT x.tempo_medio_minutos INTO v_t4 FROM public.resumo_desempenho_motorista(v_m2, NULL, DATE '2026-11-01', DATE '2026-11-30') x;
    SELECT x.tempo_medio_minutos, x.tempo_medio_minutos IS NULL AND x.total_rotas = 1
      INTO v_t5, v_t5_nulo FROM public.resumo_desempenho_motorista(v_m2, NULL, DATE '2026-11-15', DATE '2026-11-15') x;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT x.tempo_medio_minutos INTO v_t3 FROM public.resumo_desempenho_motorista(v_m1, NULL) x;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    r := r || CASE WHEN round(v_t1, 2) = 90 AND round(v_t2, 2) = 70 AND round(v_t3, 2) = 63.75
                    AND round(v_t4, 2) = 45 AND v_t5_nulo
      THEN ' | 4 OK: tempo médio 90 (7 dias), 70 (tudo), 63,75 (M1, com a loja B), 45 (novembro), NULL sem rota com tempo'
      ELSE ' | 4 FALHOU: 7 dias ' || coalesce(v_t1::text, 'nulo') || ', tudo ' || coalesce(v_t2::text, 'nulo')
           || ', M1 ' || coalesce(v_t3::text, 'nulo') || ', novembro ' || coalesce(v_t4::text, 'nulo')
           || ', sem tempo ' || coalesce(v_t5::text, 'nulo') || '/' || coalesce(v_t5_nulo::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 5. desempenho_motorista_na_loja(m, u) sem período: igual à anterior
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    v_b := pg_temp.desempenho_m89(v_m1, v_ua);
    v_d := pg_temp.desempenho_m89(v_m2, v_ua);
    SET LOCAL ROLE authenticated;
    v_a := public.desempenho_motorista_na_loja(v_m1, v_ua);
    v_c := public.desempenho_motorista_na_loja(p_motorista_id => v_m1, p_unidade_id => v_ua);
    v_e := public.desempenho_motorista_na_loja(v_m2, v_ua);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    r := r || CASE WHEN v_a = v_b AND v_c = v_b AND v_e = v_d
                    AND (v_a->>'success')::boolean
                    AND (v_a->>'total_rotas')::int = 8
                    AND (v_a->>'rotas_concluidas')::int = 5
                    AND (v_a->>'rotas_em_andamento')::int = 1
                    AND (v_a->>'rotas_nao_executadas')::int = 0
                    AND (v_a->>'rotas_canceladas')::int = 1
                    AND (v_a->>'taxa_execucao')::numeric = 100.0
                    AND (v_a->>'distancia_total_km')::numeric = 62.00
                    AND round((v_a->>'tempo_medio_minutos')::numeric, 2) = 70
      THEN ' | 5 OK: na_loja(m, u) igual à versão anterior (posicional e nomeada): 8 rotas, 62 km, 70 min'
      ELSE ' | 5 FALHOU: nova ' || coalesce(v_a::text, 'nulo') || ', anterior ' || coalesce(v_b::text, 'nulo')
           || ', nomeada ' || coalesce(v_c::text, 'nulo') || ', M2 nova ' || coalesce(v_e::text, 'nulo')
           || ', M2 anterior ' || coalesce(v_d::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 6. desempenho_motorista_na_loja com período recorta
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_a := public.desempenho_motorista_na_loja(v_m2, v_ua, DATE '2026-11-01', DATE '2026-11-30');
    v_b := public.desempenho_motorista_na_loja(v_m2, v_ua, DATE '2026-11-15', NULL);
    v_c := public.desempenho_motorista_na_loja(p_motorista_id => v_m2, p_unidade_id => v_ua, p_ate => DATE '2026-10-31');
    v_d := public.desempenho_motorista_na_loja(v_m1, v_ua, v_hoje - 7, v_hoje);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    r := r || CASE WHEN (v_a->>'success')::boolean
                    AND (v_a->>'total_rotas')::int = 3
                    AND (v_a->>'rotas_concluidas')::int = 2
                    AND (v_a->>'rotas_canceladas')::int = 1
                    AND (v_a->>'distancia_total_km')::numeric = 10.00
                    AND round((v_a->>'tempo_medio_minutos')::numeric, 2) = 45
                    AND (v_b->>'total_rotas')::int = 3
                    AND (v_b->>'distancia_total_km')::numeric = 24.00
                    AND (v_c->>'total_rotas')::int = 1
                    AND (v_c->>'distancia_total_km')::numeric = 1.00
                    AND (v_d->>'total_rotas')::int = 6
                    AND (v_d->>'rotas_concluidas')::int = 4
                    AND (v_d->>'distancia_total_km')::numeric = 32.00
                    AND round((v_d->>'tempo_medio_minutos')::numeric, 2) = 90
      THEN ' | 6 OK: na_loja com período recorta (novembro 3 rotas/10 km; só p_de; só p_ate; H-7 a H sem a futura)'
      ELSE ' | 6 FALHOU: novembro ' || coalesce(v_a::text, 'nulo') || ', só p_de ' || coalesce(v_b::text, 'nulo')
           || ', só p_ate ' || coalesce(v_c::text, 'nulo') || ', H-7 a H ' || coalesce(v_d::text, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 7. recusas: SEM_PERMISSAO e 42501
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_a := public.desempenho_motorista_na_loja(v_m1, v_ua);
    v_b := public.desempenho_motorista_na_loja(v_m1, v_ua, DATE '2026-11-01', DATE '2026-11-30');
    -- GB não tem vínculo com M2 (só em A): o resumo recusa com 42501.
    BEGIN
      PERFORM * FROM public.resumo_desempenho_motorista(v_m2, NULL, DATE '2026-11-01', DATE '2026-11-30');
      v_erro2 := 'sem erro';
    EXCEPTION WHEN OTHERS THEN
      v_erro2 := SQLSTATE;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_c := public.desempenho_motorista_na_loja(v_m1, v_ua, v_hoje - 7, v_hoje);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_d := public.desempenho_motorista_na_loja(v_m1, v_ua, DATE '2026-11-01', DATE '2026-11-30');
    BEGIN
      PERFORM * FROM public.resumo_desempenho_motorista(v_m1, 7);
      v_erro3 := 'sem erro';
    EXCEPTION WHEN OTHERS THEN
      v_erro3 := SQLSTATE;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n
      FROM unnest(ARRAY[v_a, v_b, v_c, v_d]) AS x
     WHERE x->>'success' = 'false'
       AND x->>'code' = 'SEM_PERMISSAO'
       AND x ? 'error'
       AND NOT x ? 'total_rotas';
    r := r || CASE WHEN v_n = 4 AND v_erro2 = '42501' AND v_erro3 = '42501'
      THEN ' | 7 OK: SEM_PERMISSAO (outra loja com e sem período, motorista, sem sessão); resumo 42501 (sem vínculo, sem sessão)'
      ELSE ' | 7 FALHOU: outra loja ' || coalesce(v_a::text, 'nulo') || ', com período ' || coalesce(v_b::text, 'nulo')
           || ', motorista ' || coalesce(v_c::text, 'nulo') || ', sem sessão ' || coalesce(v_d::text, 'nulo')
           || ', resumo sem vínculo ' || coalesce(v_erro2, 'nulo') || ', resumo sem sessão ' || coalesce(v_erro3, 'nulo') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 8. índices
  -- ---------------------------------------------------------------------------
  BEGIN
    SELECT count(*) INTO v_n
      FROM pg_indexes i
     WHERE i.schemaname = 'public'
       AND (
         (i.indexname = 'idx_rotas_unidade_data_id'
          AND i.indexdef = 'CREATE INDEX idx_rotas_unidade_data_id ON public.rotas USING btree (unidade_id, data DESC, id DESC)')
         OR
         (i.indexname = 'idx_incidentes_unidade_created_id'
          AND i.indexdef = 'CREATE INDEX idx_incidentes_unidade_created_id ON public.incidentes USING btree (unidade_id, created_at DESC, id DESC)')
       );
    r := r || CASE WHEN v_n = 2
      THEN ' | 8 OK: idx_rotas_unidade_data_id e idx_incidentes_unidade_created_id existem'
      ELSE ' | 8 FALHOU: ' || v_n || ' de 2 índices com a definição esperada' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 9. catálogo
  -- ---------------------------------------------------------------------------
  BEGIN
    v_det := '';
    IF to_regprocedure('public.resumo_desempenho_motorista(uuid, integer)') IS NOT NULL
       OR to_regprocedure('public.desempenho_motorista_na_loja(uuid, uuid)') IS NOT NULL THEN
      v_det := v_det || ' assinatura antiga ainda existe;';
    END IF;
    SELECT count(*) INTO v_n
      FROM pg_proc p
     WHERE p.oid IN (
             to_regprocedure('public.resumo_desempenho_motorista(uuid, integer, date, date)'),
             to_regprocedure('public.desempenho_motorista_na_loja(uuid, uuid, date, date)'))
       AND p.prosecdef
       AND p.provolatile = 's'
       AND p.proconfig = ARRAY['search_path=""']
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.proacl IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
       AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
       AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
       AND has_function_privilege('service_role', p.oid, 'EXECUTE')
       AND obj_description(p.oid, 'pg_proc') LIKE 'Migration 90%';
    IF v_n <> 2 THEN
      v_det := v_det || ' ' || v_n || ' de 2 funções com DEFINER/STABLE/search_path/dono/ACL/COMMENT;';
    END IF;
    IF (SELECT pg_get_function_result(to_regprocedure('public.resumo_desempenho_motorista(uuid, integer, date, date)')))
       IS DISTINCT FROM 'TABLE(desde date, total_rotas integer, rotas_concluidas integer, rotas_canceladas integer, distancia_total numeric, total_paradas integer, paradas_concluidas integer, paradas_puladas integer, entregas_em_rotas_concluidas integer, tempo_medio_minutos numeric)' THEN
      v_det := v_det || ' retorno do resumo fora do esperado;';
    END IF;
    IF (SELECT pg_get_function_result(to_regprocedure('public.desempenho_motorista_na_loja(uuid, uuid, date, date)')))
       IS DISTINCT FROM 'jsonb' THEN
      v_det := v_det || ' retorno do na_loja fora do esperado;';
    END IF;
    r := r || CASE WHEN v_det = ''
      THEN ' | 9 OK: catálogo (assinaturas antigas fora; DEFINER, STABLE, search_path vazio, dono, ACL, COMMENT, retornos)'
      ELSE ' | 9 FALHOU:' || v_det END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- Resumo (o detalhe vai no NOTICE; a EXCEPTION desfaz tudo)
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_ok_n FROM regexp_matches(r, '\| \d+ OK:', 'g');
  SELECT count(*) INTO v_falhou_n FROM regexp_matches(r, '\| \d+ FALHOU', 'g');
  SELECT coalesce(string_agg(x[1], ' '), '') INTO v_falhas
    FROM regexp_matches(r, '(\| \d+ FALHOU[^|]*)', 'g') AS x;

  RAISE NOTICE 'SONDA M90 detalhe:%', r;
  RAISE EXCEPTION 'SONDA M90 (desfeita): % OK | % FALHOU %', v_ok_n, v_falhou_n, v_falhas;
END
$$;
