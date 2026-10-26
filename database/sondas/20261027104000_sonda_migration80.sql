-- ============================================================================
-- Sonda transacional da Migration 80 (`vw_performance_motoristas` pelo
-- realizado)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 80 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, saem FALHOU os casos
-- 1, 2 e 3 (a view soma todas as rotas e usa o tempo estimado) e o 5
-- (catálogo: o comentário da Migration 80); o caso 4 já sai OK.
--
-- Cenário comum (não depende de dado real), montado como postgres, sem
-- sessão, e lido como postgres: loja A; motorista M com cinco rotas —
--   R1 concluida, 120 min reais, 10 km, 30 min estimados;
--   R2 concluida, 60 min reais, 20 km, 30 min estimados;
--   R3 concluida, 30 h entre início e fim (fora da média), 5 km;
--   R4 cancelada, 100 km, 500 min estimados;
--   R5 nao_executada, 50 km;
-- e motorista M2 só com uma rota cancelada (40 km, 90 min estimados). O bloco
-- termina SEMPRE em RAISE EXCEPTION, que desfaz tudo. Leia o resultado na
-- mensagem "SONDA M80 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. M: `distancia_total_km` = 35 (só as concluídas)
--   2. M: `tempo_medio_minutos` = 90 (média real de R1 e R2; R3 fica fora)
--   3. M2: distância e tempo NULL (nenhuma rota concluída)
--   4. M: as demais colunas não mudam — 5 rotas, 3 concluídas, 1 cancelada,
--      1 não executada, taxa de execução 75,0
--   5. catálogo: `security_invoker=true`, SELECT para authenticated, nada
--      para anon, as duas colunas `numeric`, comentário da Migration 80
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_m uuid := gen_random_uuid();      -- motorista com cinco rotas
  v_m2 uuid := gen_random_uuid();     -- motorista só com rota cancelada
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dist numeric;
  v_tempo numeric;
  v_dist2 numeric;
  v_tempo2 numeric;
  v_total bigint;
  v_conc bigint;
  v_canc bigint;
  v_nexe bigint;
  v_taxa numeric;
  v_n int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,  'sonda-m80-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m2, 'sonda-m80-m2-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M80 A', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m,  'Sonda motorista M',  'sonda-m80-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_m2, 'Sonda motorista M2', 'sonda-m80-m2-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,  v_ua, 'motorista', true, true),
    (v_m2, v_ua, 'motorista', true, true);

  INSERT INTO public.rotas (unidade_id, motorista_id, status, data, iniciada_em, concluida_em, distancia_total, tempo_total) VALUES
    (v_ua, v_m,  'concluida',     v_hoje - 3, now() - interval '3 hours',  now() - interval '1 hour',  10, 30),
    (v_ua, v_m,  'concluida',     v_hoje - 2, now() - interval '2 hours',  now() - interval '1 hour',  20, 30),
    (v_ua, v_m,  'concluida',     v_hoje - 4, now() - interval '31 hours', now() - interval '1 hour',   5, 30),
    (v_ua, v_m,  'cancelada',     v_hoje - 1, NULL,                        NULL,                       100, 500),
    (v_ua, v_m,  'nao_executada', v_hoje - 5, NULL,                        NULL,                        50, 40),
    (v_ua, v_m2, 'cancelada',     v_hoje - 1, NULL,                        NULL,                        40, 90);

  SELECT distancia_total_km, tempo_medio_minutos, total_rotas, rotas_concluidas,
         rotas_canceladas, rotas_nao_executadas, taxa_execucao
    INTO v_dist, v_tempo, v_total, v_conc, v_canc, v_nexe, v_taxa
    FROM public.vw_performance_motoristas WHERE id = v_m;
  SELECT distancia_total_km, tempo_medio_minutos
    INTO v_dist2, v_tempo2
    FROM public.vw_performance_motoristas WHERE id = v_m2;

  -- 1. distância só das concluídas
  r := r || CASE WHEN v_dist = 35
    THEN ' | 1 OK: distancia_total_km soma só as rotas concluídas (35)'
    ELSE ' | 1 FALHOU: distancia_total_km ' || coalesce(v_dist::text, 'nula') END;

  -- 2. tempo médio real
  r := r || CASE WHEN round(v_tempo) = 90
    THEN ' | 2 OK: tempo_medio_minutos é a média real das concluídas, sem a de 30 h (90)'
    ELSE ' | 2 FALHOU: tempo_medio_minutos ' || coalesce(round(v_tempo, 1)::text, 'nulo') END;

  -- 3. sem rota concluída
  r := r || CASE WHEN v_dist2 IS NULL AND v_tempo2 IS NULL
    THEN ' | 3 OK: motorista sem rota concluída fica com distância e tempo nulos'
    ELSE ' | 3 FALHOU: distância ' || coalesce(v_dist2::text, 'nula') || ', tempo ' || coalesce(v_tempo2::text, 'nulo') END;

  -- 4. demais colunas
  r := r || CASE WHEN v_total = 5 AND v_conc = 3 AND v_canc = 1 AND v_nexe = 1 AND v_taxa = 75.0
    THEN ' | 4 OK: contagens e taxa de execução não mudam'
    ELSE ' | 4 FALHOU: total ' || coalesce(v_total::text, '-') || ', concluídas ' || coalesce(v_conc::text, '-')
         || ', canceladas ' || coalesce(v_canc::text, '-') || ', não executadas ' || coalesce(v_nexe::text, '-')
         || ', taxa ' || coalesce(v_taxa::text, '-') END;

  -- 5. catálogo
  BEGIN
    SELECT count(*) INTO v_n
      FROM pg_class c
     WHERE c.oid = 'public.vw_performance_motoristas'::regclass
       AND 'security_invoker=true' = ANY (c.reloptions)
       AND has_table_privilege('authenticated', c.oid, 'SELECT')
       AND NOT has_table_privilege('anon', c.oid, 'SELECT')
       AND (SELECT format_type(a.atttypid, a.atttypmod) FROM pg_attribute a
             WHERE a.attrelid = c.oid AND a.attname = 'distancia_total_km') = 'numeric'
       AND (SELECT format_type(a.atttypid, a.atttypmod) FROM pg_attribute a
             WHERE a.attrelid = c.oid AND a.attname = 'tempo_medio_minutos') = 'numeric'
       AND obj_description(c.oid, 'pg_class') LIKE 'Migration 80:%';
    r := r || CASE WHEN v_n = 1
      THEN ' | 5 OK: security_invoker, SELECT só de authenticated, colunas numeric, comentário da Migration 80'
      ELSE ' | 5 FALHOU: view fora do esperado (' || coalesce(obj_description('public.vw_performance_motoristas'::regclass, 'pg_class'), 'sem comentário') || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  RAISE EXCEPTION 'SONDA M80 (desfeita):%', r;
END
$$;
