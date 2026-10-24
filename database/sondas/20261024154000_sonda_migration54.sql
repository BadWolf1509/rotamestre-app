-- ============================================================================
-- Sonda transacional da Migration 54 (rodar DEPOIS de aplicá-la)
-- ============================================================================
-- Banco único = produção, sem pgTAP. O bloco monta um cenário próprio dentro da
-- transação (não depende de dado real): duas lojas (U e U2), um gestor de cada
-- (G em U, G2 em U2) e seis motoristas. As ações saem como `authenticated`
-- (SET LOCAL ROLE + claims do JWT) e o bloco termina SEMPRE em RAISE
-- EXCEPTION, que desfaz tudo (inclusive logs e notificações dos gatilhos). Não
-- tem DELETE. Leia o resultado na mensagem "SONDA M54 (desfeita): ...".
-- Esperado: todas as linhas com OK. Rodada ANTES da migration, os casos 1, 2 e
-- 4 saem FALHOU (é a falha que ela fecha) — o 1 desativa M com rota aberta.
--
-- Review Focus 5: o gestor desativa um motorista com uma rota em andamento e
-- duas pendentes — a desativação é recusada e o erro traz as três rotas (1, 2).
-- Sem rota aberta, desativa normalmente (3).
--
-- Motoristas:
--   M   só em U; rotas em U: 1 em_andamento + 2 pendentes (+ 1 concluída)
--   M2  só em U; rotas em U: concluída, cancelada e não executada
--   M3  em U e U2; 1 rota pendente em U
--   M4  em U e U2; 1 rota pendente só em U2
--   M5  só em U, já desativado, com 1 rota pendente em U
--   M6  só em U, ativo, sem rota (recebe as rotas de M no caso 8)
--
--   1. G desativa M: P0001, HINT = sentinela, DETAIL com as 3 rotas (ids
--      certos, em andamento primeiro, nenhuma concluída); M segue ativo
--   2. a MESSAGE conta "3 rotas abertas" e manda reatribuir ou cancelar
--   3. G desativa M2 (sem rota aberta): 'pessoa', usuarios.ativo = false
--   4. G desativa M3 (atende outra loja, rota aberta em U): recusa; o vínculo
--      de U segue ativo (a via do vínculo também é bloqueada)
--   5. G desativa M4 (rota aberta só em U2): 'vinculo' — rota de outra loja
--      não bloqueia nem aparece
--   6. G reativa M5 (inativo com rota pendente): 'pessoa', ativo = true
--      (reativar nunca é bloqueado)
--   7. G2 (gestor de outra loja) desativa M em U: 42501, como antes
--   8. G reatribui as pendentes de M a M6 e cancela a em andamento; aí
--      desativar M passa ('pessoa') — o caminho que a tela indica funciona
--   9. EXECUTE: authenticated sim, anon não (grants preservados)
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_u uuid := gen_random_uuid();
  v_u2 uuid := gen_random_uuid();
  v_g uuid := gen_random_uuid();
  v_g2 uuid := gen_random_uuid();
  v_m uuid := gen_random_uuid();
  v_m2 uuid := gen_random_uuid();
  v_m3 uuid := gen_random_uuid();
  v_m4 uuid := gen_random_uuid();
  v_m5 uuid := gen_random_uuid();
  v_m6 uuid := gen_random_uuid();
  v_r_and uuid := gen_random_uuid();   -- M, em andamento
  v_r_p1 uuid := gen_random_uuid();    -- M, pendente (amanhã)
  v_r_p2 uuid := gen_random_uuid();    -- M, pendente (depois de amanhã)
  v_r_conc uuid := gen_random_uuid();  -- M, concluída (não entra)
  v_ret text;
  v_msg text;
  v_state text;
  v_hint text;
  v_det text;
  v_json json;
  v_ok boolean;
  v_ativo boolean;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres, antes de trocar de papel)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role)
  SELECT id, 'sonda-m54-' || rotulo || '-' || v_sufixo || '@example.invalid',
         'authenticated', 'authenticated'
  FROM (VALUES (v_g, 'g'), (v_g2, 'g2'), (v_m, 'm'), (v_m2, 'm2'), (v_m3, 'm3'),
               (v_m4, 'm4'), (v_m5, 'm5'), (v_m6, 'm6')) AS t(id, rotulo);

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_u, 'Sonda M54', 'Sonda'),
    (v_u2, 'Sonda M54 outra', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id)
  SELECT id, 'Sonda ' || rotulo,
         'sonda-m54-' || rotulo || '-' || v_sufixo || '@example.invalid',
         papel, loja
  FROM (VALUES (v_g, 'g', 'gestor', v_u), (v_g2, 'g2', 'gestor', v_u2),
               (v_m, 'm', 'motorista', v_u), (v_m2, 'm2', 'motorista', v_u),
               (v_m3, 'm3', 'motorista', v_u), (v_m4, 'm4', 'motorista', v_u),
               (v_m5, 'm5', 'motorista', v_u), (v_m6, 'm6', 'motorista', v_u))
       AS t(id, rotulo, papel, loja);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_g,  v_u,  'gestor',    true, true),
    (v_g2, v_u2, 'gestor',    true, true),
    (v_m,  v_u,  'motorista', true, true),
    (v_m2, v_u,  'motorista', true, true),
    (v_m3, v_u,  'motorista', true, true),
    (v_m3, v_u2, 'motorista', true, false),
    (v_m4, v_u,  'motorista', true, true),
    (v_m4, v_u2, 'motorista', true, false),
    (v_m5, v_u,  'motorista', true, true),
    (v_m6, v_u,  'motorista', true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, data, status) VALUES
    (v_r_and,  v_u, v_m, current_date,     'em_andamento'),
    (v_r_p1,   v_u, v_m, current_date + 1, 'pendente'),
    (v_r_p2,   v_u, v_m, current_date + 2, 'pendente'),
    (v_r_conc, v_u, v_m, current_date - 1, 'concluida');

  INSERT INTO public.rotas (unidade_id, motorista_id, data, status) VALUES
    (v_u,  v_m2, current_date - 3, 'concluida'),
    (v_u,  v_m2, current_date - 2, 'cancelada'),
    (v_u,  v_m2, current_date - 1, 'nao_executada'),
    (v_u,  v_m3, current_date + 1, 'pendente'),
    (v_u2, v_m4, current_date + 1, 'pendente'),
    (v_u,  v_m5, current_date + 1, 'pendente');

  -- M5 desativado depois de receber a rota (sem usuário: a trava não se aplica).
  UPDATE public.usuarios SET ativo = false WHERE id = v_m5;

  -- ---------------------------------------------------------------------------
  -- 1 e 2. G desativa M (1 em andamento + 2 pendentes)
  -- ---------------------------------------------------------------------------
  v_ret := NULL; v_msg := NULL; v_state := NULL; v_hint := NULL; v_det := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_ret := public.alternar_motorista_na_unidade(v_m, v_u, false);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT, v_state = RETURNED_SQLSTATE,
      v_hint = PG_EXCEPTION_HINT, v_det = PG_EXCEPTION_DETAIL;
  END;
  RESET ROLE;
  SELECT ativo INTO v_ativo FROM public.usuarios WHERE id = v_m;
  v_ok := false;
  BEGIN
    v_json := v_det::json;
    v_ok := json_array_length(v_json) = 3
      AND v_json->0->>'id' = v_r_and::text
      AND v_json->0->>'status' = 'em_andamento'
      AND v_json->0->>'data' = current_date::text
      AND (SELECT array_agg(e->>'id' ORDER BY e->>'id') FROM json_array_elements(v_json) e)
          = (SELECT array_agg(x ORDER BY x) FROM unnest(ARRAY[v_r_and::text, v_r_p1::text, v_r_p2::text]) x);
  EXCEPTION WHEN OTHERS THEN
    v_ok := false;
  END;
  r := r || CASE WHEN v_ret IS NULL AND v_state = 'P0001'
      AND v_hint = 'MOTORISTA_COM_ROTA_ABERTA' AND v_ok AND v_ativo
    THEN ' | 1 OK: recusado (P0001 + sentinela), DETAIL com as 3 rotas, em andamento primeiro; M segue ativo'
    ELSE ' | 1 FALHOU: ret=' || COALESCE(v_ret, '-') || ' state=' || COALESCE(v_state, '-')
         || ' hint=' || COALESCE(v_hint, '-') || ' detail=' || COALESCE(v_det, '-')
         || ' ativo=' || COALESCE(v_ativo::text, 'NULL') END;

  r := r || CASE WHEN v_msg LIKE '%3 rotas abertas%' AND v_msg LIKE '%Reatribua%cancele%'
    THEN ' | 2 OK: a mensagem conta 3 rotas abertas e indica o caminho'
    ELSE ' | 2 FALHOU: msg=' || COALESCE(v_msg, '-') END;

  -- ---------------------------------------------------------------------------
  -- 3. G desativa M2 (sem rota aberta)
  -- ---------------------------------------------------------------------------
  v_ret := NULL; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_ret := public.alternar_motorista_na_unidade(v_m2, v_u, false);
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  SELECT ativo INTO v_ativo FROM public.usuarios WHERE id = v_m2;
  r := r || CASE WHEN v_ret = 'pessoa' AND v_msg IS NULL AND v_ativo = false
    THEN ' | 3 OK: sem rota aberta, desativado (pessoa)'
    ELSE ' | 3 FALHOU: ret=' || COALESCE(v_ret, '-') || ' erro=' || COALESCE(v_msg, '-')
         || ' ativo=' || COALESCE(v_ativo::text, 'NULL') END;

  -- ---------------------------------------------------------------------------
  -- 4. G desativa M3 (atende outra loja; rota aberta em U)
  -- ---------------------------------------------------------------------------
  v_ret := NULL; v_state := NULL; v_hint := NULL; v_det := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_ret := public.alternar_motorista_na_unidade(v_m3, v_u, false);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE,
      v_hint = PG_EXCEPTION_HINT, v_det = PG_EXCEPTION_DETAIL;
  END;
  RESET ROLE;
  SELECT ativo INTO v_ativo FROM public.usuario_unidades
  WHERE usuario_id = v_m3 AND unidade_id = v_u;
  r := r || CASE WHEN v_ret IS NULL AND v_state = 'P0001'
      AND v_hint = 'MOTORISTA_COM_ROTA_ABERTA' AND json_array_length(v_det::json) = 1
      AND v_ativo
    THEN ' | 4 OK: via do vínculo também recusada; vínculo de U segue ativo'
    ELSE ' | 4 FALHOU: ret=' || COALESCE(v_ret, '-') || ' state=' || COALESCE(v_state, '-')
         || ' hint=' || COALESCE(v_hint, '-') || ' vinculo=' || COALESCE(v_ativo::text, 'NULL') END;

  -- ---------------------------------------------------------------------------
  -- 5. G desativa M4 (rota aberta só em U2)
  -- ---------------------------------------------------------------------------
  v_ret := NULL; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_ret := public.alternar_motorista_na_unidade(v_m4, v_u, false);
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  SELECT ativo INTO v_ativo FROM public.usuario_unidades
  WHERE usuario_id = v_m4 AND unidade_id = v_u;
  r := r || CASE WHEN v_ret = 'vinculo' AND v_msg IS NULL AND v_ativo = false
    THEN ' | 5 OK: rota de outra loja não bloqueia; vínculo de U desativado'
    ELSE ' | 5 FALHOU: ret=' || COALESCE(v_ret, '-') || ' erro=' || COALESCE(v_msg, '-')
         || ' vinculo=' || COALESCE(v_ativo::text, 'NULL') END;

  -- ---------------------------------------------------------------------------
  -- 6. G reativa M5 (inativo, com rota pendente)
  -- ---------------------------------------------------------------------------
  v_ret := NULL; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_ret := public.alternar_motorista_na_unidade(v_m5, v_u, true);
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  SELECT ativo INTO v_ativo FROM public.usuarios WHERE id = v_m5;
  r := r || CASE WHEN v_ret = 'pessoa' AND v_msg IS NULL AND v_ativo
    THEN ' | 6 OK: reativar com rota pendente passa'
    ELSE ' | 6 FALHOU: ret=' || COALESCE(v_ret, '-') || ' erro=' || COALESCE(v_msg, '-')
         || ' ativo=' || COALESCE(v_ativo::text, 'NULL') END;

  -- ---------------------------------------------------------------------------
  -- 7. G2 (gestor de outra loja) desativa M em U
  -- ---------------------------------------------------------------------------
  v_ret := NULL; v_state := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_ret := public.alternar_motorista_na_unidade(v_m, v_u, false);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
  END;
  RESET ROLE;
  r := r || CASE WHEN v_ret IS NULL AND v_state = '42501'
    THEN ' | 7 OK: gestor de outra loja recusado (42501) antes de qualquer lista'
    ELSE ' | 7 FALHOU: ret=' || COALESCE(v_ret, '-') || ' state=' || COALESCE(v_state, '-') END;

  -- ---------------------------------------------------------------------------
  -- 8. reatribuir as pendentes e cancelar a em andamento libera a desativação
  -- ---------------------------------------------------------------------------
  v_ret := NULL; v_msg := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.rotas SET motorista_id = v_m6 WHERE id IN (v_r_p1, v_r_p2);
    UPDATE public.rotas SET status = 'cancelada' WHERE id = v_r_and;
    v_ret := public.alternar_motorista_na_unidade(v_m, v_u, false);
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  SELECT ativo INTO v_ativo FROM public.usuarios WHERE id = v_m;
  r := r || CASE WHEN v_ret = 'pessoa' AND v_msg IS NULL AND v_ativo = false
    THEN ' | 8 OK: depois de reatribuir/cancelar, M desativado'
    ELSE ' | 8 FALHOU: ret=' || COALESCE(v_ret, '-') || ' erro=' || COALESCE(v_msg, '-')
         || ' ativo=' || COALESCE(v_ativo::text, 'NULL') END;

  -- ---------------------------------------------------------------------------
  -- 9. grants preservados
  -- ---------------------------------------------------------------------------
  r := r || CASE WHEN has_function_privilege('authenticated',
        'public.alternar_motorista_na_unidade(uuid,uuid,boolean)', 'EXECUTE')
      AND NOT has_function_privilege('anon',
        'public.alternar_motorista_na_unidade(uuid,uuid,boolean)', 'EXECUTE')
    THEN ' | 9 OK: EXECUTE para authenticated, não para anon'
    ELSE ' | 9 FALHOU: grants mudaram' END;

  RAISE EXCEPTION 'SONDA M54 (desfeita):%', r;
END
$$;
