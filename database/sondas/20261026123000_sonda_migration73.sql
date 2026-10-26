-- ============================================================================
-- Sonda transacional da Migration 73 (coluna `paradas.observacao_pulo` e
-- gatilho `trg_paradas_observacao_do_gestor`)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 73 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os casos 1, 2, 3, 4,
-- 6, 8, 10 e 15 saem FALHOU (é o vermelho esperado: a coluna não existe, 42703, e
-- o motorista ainda substitui `observacoes`); os casos 5, 7, 9, 11, 12, 13,
-- 14 e 16 saem OK antes e depois (são o comportamento que a migration preserva).
--
-- Os UPDATEs reproduzem o corpo que o app manda pelo PostgREST:
--   - pulo/conclusão do motorista (`src/lib/motorista/filaAcoesParada.ts`,
--     `atualizarSeAberta`): `.update(dados).eq('id', …).in('status',
--     ['pendente','em_andamento']).select('id')`, com `dados` =
--     `{status:'pulada', motivo_skip, observacoes?}` (1.14.6/1.14.7) ou
--     `{status:'pulada', motivo_skip, observacao_pulo?}` (1.14.8), e
--     `{status:'concluida', concluida_em}` na conclusão;
--   - avanço para a próxima (`avancarProxima`): `{status:'em_andamento'}`
--     com `.eq('status','pendente')`;
--   - retomar parada pulada (`app/motorista/_screens/checkpoints.tsx`,
--     `updateParadaStatus(id, 'pendente')`): `{status:'pendente'}`;
--   - edição pelo gestor (`useEditStopForm.ts`): endereco, latitude,
--     longitude, destinatario, telefone, observacoes, tipo, com
--     `.eq('status','pendente')`.
-- O `.select('id')` vira `WITH u AS (UPDATE … RETURNING id) SELECT count(*)`
-- — a contagem de linhas que o app confere.
--
-- Cenário (não depende de dado real), montado como postgres, sem sessão: loja
-- A e B; motorista M, ativo em A; gestor GA, gestor ativo de A; gestor GB,
-- gestor ativo só de B. Rota R
-- `em_andamento` de M com partida (ordem 0, `concluida`) e chegada (ordem
-- 900, `pendente`), as duas com `is_checkpoint = false`; cada caso de 1 a 11
-- cria a própria parada em R (ordem própria) com `observacoes = 'instrução do
-- gestor'`. Os casos 12 a 14 montam a própria rota. As chamadas rodam como
-- `authenticated` (SET LOCAL ROLE + claims do JWT); a conferência roda como
-- postgres, com as claims limpas. Avisos de parada pulada/reaberta (e o pedido
-- de push enfileirado pelo `pg_net`) vão só para GA e são desfeitos junto. O
-- bloco termina SEMPRE em RAISE EXCEPTION, que desfaz tudo. Leia o resultado
-- na mensagem "SONDA M73 (desfeita): ...". Esperado: todas as linhas com OK.
--
--    1. M (corpo 1.14.7) pula com `observacoes = 'Ficou para amanhã'` → 1
--       linha; `observacoes` igual; `observacao_pulo = 'Ficou para amanhã'`
--    2. M (corpo 1.14.8) pula com `observacao_pulo = 'Portão fechado'` → 1
--       linha; `observacao_pulo` gravado; `observacoes` igual
--    3. M (corpo 1.14.7, sem texto) pula parada com `observacao_pulo` antigo
--       → `observacao_pulo` antigo fica (aceito: o pulo sem texto não o
--       limpa); `observacoes` igual
--    4. M muda só `observacoes` de parada pendente → 1 linha (sucesso sem
--       efeito); `observacoes` igual
--    5. GA edita a parada pendente com o corpo do `useEditStopForm` → 1
--       linha; todos os campos mudam, inclusive `observacoes`
--    6. GA pula com `observacoes = 'gestor pulou'` → `observacoes` muda;
--       `observacao_pulo` nulo
--    7. sem sessão (postgres) muda `observacoes` → muda
--    8. M retoma a parada do caso 1 (`pulada → pendente`) → `observacao_pulo`
--       preservado; `observacoes` igual
--    9. M tenta tirar a foto de uma parada pulada com foto → P0001
--       FOTO_VINCULADA (o gatilho de foto segue valendo); parada igual
--   10. catálogo: coluna `text` nula, authenticated com UPDATE na coluna,
--       gatilho habilitado BEFORE UPDATE, função SECURITY DEFINER, search_path
--       vazio, dono postgres, sem EXECUTE para PUBLIC, anon e authenticated
--   11. M conclui (corpo 1.14.7) a parada em andamento e avança a próxima →
--       1 linha cada; `concluida` com `concluida_em`, próxima `em_andamento`;
--       1 log `parada_concluida`; `observacoes` iguais
--   12. GA, rota pendente: `inserir_parada` (com `p_observacoes`) e
--       `reordenar_paradas` → `success` nos dois; parada nova com a
--       observação pedida; ordens trocadas; `observacoes` das outras iguais
--   13. M, rota em andamento sem parada aberta: `finalizar_rota` → rota e
--       chegada `concluida`; `observacoes` da pulada igual
--   14. GA `cancelar_rota` (rota em andamento com parada em andamento) →
--       'cancelada', parada `pendente`; GA `reativar_rota` (rota
--       `nao_executada` com parada pulada) → 'reativada', parada `pendente`;
--       `observacoes` iguais nas duas
--   15. M (corpo 1.14.8) pula com `observacao_pulo = 'Ficou para amanhã'`,
--       retoma e pula de novo com o mesmo texto → `observacao_pulo = 'Ficou
--       para amanhã'`; `observacoes` igual
--   16. GB (gestor de outra loja) faz UPDATE de `observacoes` → 0 linhas;
--       `observacoes` igual
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_m uuid := gen_random_uuid();      -- motorista de A
  v_ga uuid := gen_random_uuid();     -- gestor ativo de A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_gb uuid := gen_random_uuid();     -- gestor ativo só de B
  v_p15 uuid := gen_random_uuid();
  v_p16 uuid := gen_random_uuid();
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_obs constant text := 'instrução do gestor';
  v_r uuid := gen_random_uuid();      -- rota R (casos 1 a 11)
  v_p1 uuid := gen_random_uuid();
  v_p2 uuid := gen_random_uuid();
  v_p3 uuid := gen_random_uuid();
  v_p4 uuid := gen_random_uuid();
  v_p5 uuid := gen_random_uuid();
  v_p6 uuid := gen_random_uuid();
  v_p7 uuid := gen_random_uuid();
  v_p9 uuid := gen_random_uuid();
  v_p11 uuid := gen_random_uuid();
  v_p11b uuid := gen_random_uuid();
  v_r12 uuid := gen_random_uuid();    -- rota do caso 12
  v_q1 uuid := gen_random_uuid();
  v_q2 uuid := gen_random_uuid();
  v_r13 uuid := gen_random_uuid();    -- rota do caso 13
  v_s2 uuid := gen_random_uuid();
  v_s3 uuid := gen_random_uuid();     -- chegada da rota do caso 13
  v_r14a uuid := gen_random_uuid();   -- rota cancelada no caso 14
  v_r14b uuid := gen_random_uuid();   -- rota reativada no caso 14
  v_t1 uuid := gen_random_uuid();
  v_t2 uuid := gen_random_uuid();
  v_fn regprocedure;
  v_res text;
  v_res2 text;
  v_json jsonb;
  v_json2 jsonb;
  v_nova uuid;
  v_n int;
  v_n2 int;
  v_n3 int;
  v_n4 int;
  v_txt text;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);

  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m,  'sonda-m73-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_ga, 'sonda-m73-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m73-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M73 A', 'Sonda'),
    (v_ub, 'Sonda M73 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_m,  'Sonda motorista M', 'sonda-m73-m-'  || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_ga, 'Sonda gestor A',    'sonda-m73-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gb, 'Sonda gestor B',    'sonda-m73-gb-' || v_sufixo || '@example.invalid', 'gestor',    v_ub, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m,  v_ua, 'motorista', true, true),
    (v_ga, v_ua, 'gestor',    true, true),
    (v_gb, v_ub, 'gestor',    true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
    (v_r, v_ua, v_m, 'em_andamento', v_hoje, now());

  INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, concluida_em, observacoes) VALUES
    (v_r, 'entrega', 'sonda partida', -7.1, -34.8, 0,   'concluida', false, now(), 'Ponto de partida'),
    (v_r, 'entrega', 'sonda chegada', -7.1, -34.8, 900, 'pendente',  false, NULL,  'Ponto de chegada');

  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, observacoes, motivo_skip, foto_url, concluida_em) VALUES
    (v_p1,   v_r, 'entrega', 'sonda p1',  -7.1, -34.8, 1,  'em_andamento', true, v_obs, NULL,    NULL,          NULL),
    (v_p2,   v_r, 'entrega', 'sonda p2',  -7.1, -34.8, 2,  'pendente',     true, v_obs, NULL,    NULL,          NULL),
    (v_p3,   v_r, 'entrega', 'sonda p3',  -7.1, -34.8, 3,  'pendente',     true, v_obs, NULL,    NULL,          NULL),
    (v_p4,   v_r, 'entrega', 'sonda p4',  -7.1, -34.8, 4,  'pendente',     true, v_obs, NULL,    NULL,          NULL),
    (v_p5,   v_r, 'entrega', 'sonda p5',  -7.1, -34.8, 5,  'pendente',     true, v_obs, NULL,    NULL,          NULL),
    (v_p6,   v_r, 'entrega', 'sonda p6',  -7.1, -34.8, 6,  'pendente',     true, v_obs, NULL,    NULL,          NULL),
    (v_p7,   v_r, 'entrega', 'sonda p7',  -7.1, -34.8, 7,  'pendente',     true, v_obs, NULL,    NULL,          NULL),
    (v_p9,   v_r, 'entrega', 'sonda p9',  -7.1, -34.8, 9,  'pulada',       true, v_obs, 'outro', 'sonda/x.jpg', now()),
    (v_p11,  v_r, 'entrega', 'sonda p11', -7.1, -34.8, 11, 'pendente',     true, v_obs, NULL,    NULL,          NULL),
    (v_p11b, v_r, 'entrega', 'sonda p12', -7.1, -34.8, 12, 'pendente',     true, v_obs, NULL,    NULL,          NULL),
    (v_p15,  v_r, 'entrega', 'sonda p15', -7.1, -34.8, 15, 'pendente',     true, v_obs, NULL,    NULL,          NULL),
    (v_p16,  v_r, 'entrega', 'sonda p16', -7.1, -34.8, 16, 'pendente',     true, v_obs, NULL,    NULL,          NULL);

  -- ---------------------------------------------------------------------------
  -- 1. M (corpo 1.14.7) pula com texto em observacoes
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    WITH u AS (
      UPDATE public.paradas
         SET status = 'pulada', motivo_skip = 'outro', observacoes = 'Ficou para amanhã'
       WHERE id = v_p1 AND status IN ('pendente', 'em_andamento')
      RETURNING id
    ) SELECT count(*) INTO v_n FROM u;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n2 FROM public.paradas
     WHERE id = v_p1 AND status = 'pulada' AND motivo_skip = 'outro'
       AND observacoes = v_obs AND observacao_pulo = 'Ficou para amanhã';
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1
      THEN ' | 1 OK: pulo do app instalado: 1 linha, observação do gestor igual, texto do pulo em observacao_pulo'
      ELSE ' | 1 FALHOU: linhas ' || v_n || ', parada no esperado ' || v_n2 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 2. M (corpo 1.14.8) pula com observacao_pulo
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    WITH u AS (
      UPDATE public.paradas
         SET status = 'pulada', motivo_skip = 'outro', observacao_pulo = 'Portão fechado'
       WHERE id = v_p2 AND status IN ('pendente', 'em_andamento')
      RETURNING id
    ) SELECT count(*) INTO v_n FROM u;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n2 FROM public.paradas
     WHERE id = v_p2 AND status = 'pulada'
       AND observacoes = v_obs AND observacao_pulo = 'Portão fechado';
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1
      THEN ' | 2 OK: pulo do app novo: observacao_pulo gravado, observação do gestor igual'
      ELSE ' | 2 FALHOU: linhas ' || v_n || ', parada no esperado ' || v_n2 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 3. M (corpo 1.14.7, sem texto) pula parada com observacao_pulo antigo
  -- ---------------------------------------------------------------------------
  BEGIN
    UPDATE public.paradas SET observacao_pulo = 'texto de um pulo anterior' WHERE id = v_p3;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    WITH u AS (
      UPDATE public.paradas
         SET status = 'pulada', motivo_skip = 'cliente_ausente'
       WHERE id = v_p3 AND status IN ('pendente', 'em_andamento')
      RETURNING id
    ) SELECT count(*) INTO v_n FROM u;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n2 FROM public.paradas
     WHERE id = v_p3 AND status = 'pulada' AND motivo_skip = 'cliente_ausente'
       AND observacoes = v_obs AND observacao_pulo = 'texto de um pulo anterior';
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1
      THEN ' | 3 OK: pulo sem texto do app instalado: observacao_pulo antigo fica (aceito), observação do gestor igual'
      ELSE ' | 3 FALHOU: linhas ' || v_n || ', parada no esperado ' || v_n2 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 4. M muda só observacoes de parada pendente
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    WITH u AS (
      UPDATE public.paradas SET observacoes = 'texto do motorista'
       WHERE id = v_p4
      RETURNING id
    ) SELECT count(*) INTO v_n FROM u;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n2 FROM public.paradas
     WHERE id = v_p4 AND status = 'pendente' AND observacoes = v_obs;
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1
      THEN ' | 4 OK: motorista recebe 1 linha e a observação do gestor fica igual'
      ELSE ' | 4 FALHOU: linhas ' || v_n || ', observação igual ' || v_n2 || ' (' || coalesce((SELECT observacoes FROM public.paradas WHERE id = v_p4), 'nula') || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 5. GA edita a parada pendente (corpo do useEditStopForm)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    WITH u AS (
      UPDATE public.paradas
         SET endereco = 'sonda p5 editada', latitude = -7.2, longitude = -34.9,
             destinatario = 'Sonda destinatário', telefone = '83999990000',
             observacoes = 'gestor mudou', tipo = 'retirada'
       WHERE id = v_p5 AND status = 'pendente'
      RETURNING id
    ) SELECT count(*) INTO v_n FROM u;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n2 FROM public.paradas
     WHERE id = v_p5 AND endereco = 'sonda p5 editada' AND latitude = -7.2 AND longitude = -34.9
       AND destinatario = 'Sonda destinatário' AND telefone = '83999990000'
       AND observacoes = 'gestor mudou' AND tipo = 'retirada';
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1
      THEN ' | 5 OK: edição do gestor: 1 linha, todos os campos mudam, inclusive observacoes'
      ELSE ' | 5 FALHOU: linhas ' || v_n || ', parada no esperado ' || v_n2 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 6. GA pula com observacoes
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    WITH u AS (
      UPDATE public.paradas
         SET status = 'pulada', motivo_skip = 'outro', observacoes = 'gestor pulou'
       WHERE id = v_p6 AND status IN ('pendente', 'em_andamento')
      RETURNING id
    ) SELECT count(*) INTO v_n FROM u;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n2 FROM public.paradas
     WHERE id = v_p6 AND status = 'pulada'
       AND observacoes = 'gestor pulou' AND observacao_pulo IS NULL;
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1
      THEN ' | 6 OK: gestor pula: observacoes muda, observacao_pulo nulo'
      ELSE ' | 6 FALHOU: linhas ' || v_n || ', parada no esperado ' || v_n2 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 7. sem sessão (postgres) muda observacoes
  -- ---------------------------------------------------------------------------
  BEGIN
    UPDATE public.paradas SET observacoes = 'ajuste sem sessão' WHERE id = v_p7;
    SELECT count(*) INTO v_n FROM public.paradas WHERE id = v_p7 AND observacoes = 'ajuste sem sessão';
    r := r || CASE WHEN v_n = 1
      THEN ' | 7 OK: sem sessão (postgres, chave secreta, cron) muda observacoes'
      ELSE ' | 7 FALHOU: observacoes não mudou sem sessão' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 8. M retoma a parada do caso 1 (corpo do checkpoints.tsx)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    WITH u AS (
      UPDATE public.paradas SET status = 'pendente'
       WHERE id = v_p1
      RETURNING id
    ) SELECT count(*) INTO v_n FROM u;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n2 FROM public.paradas
     WHERE id = v_p1 AND status = 'pendente'
       AND observacoes = v_obs AND observacao_pulo = 'Ficou para amanhã';
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1
      THEN ' | 8 OK: motorista retoma a pulada: observacao_pulo preservado, observação do gestor igual'
      ELSE ' | 8 FALHOU: linhas ' || v_n || ', parada no esperado ' || v_n2 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 9. M tenta tirar a foto de parada pulada com foto
  -- ---------------------------------------------------------------------------
  v_txt := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
      UPDATE public.paradas SET foto_url = NULL, observacoes = 'texto do motorista' WHERE id = v_p9;
      v_txt := 'UPDATE aceito sem erro';
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE <> 'P0001' OR SQLERRM NOT LIKE 'FOTO_VINCULADA:%' THEN
        v_txt := 'erro diferente (' || SQLSTATE || ' ' || SQLERRM || ')';
      END IF;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n FROM public.paradas
     WHERE id = v_p9 AND status = 'pulada' AND foto_url = 'sonda/x.jpg' AND observacoes = v_obs;
    r := r || CASE WHEN v_txt IS NULL AND v_n = 1
      THEN ' | 9 OK: tirar a foto de parada pulada segue recusado com P0001 FOTO_VINCULADA; parada igual'
      ELSE ' | 9 FALHOU: ' || coalesce(v_txt, 'parada mudou') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 10. catálogo (lido sem abortar quando a coluna e a função ainda não existem)
  -- ---------------------------------------------------------------------------
  BEGIN
    v_fn := to_regprocedure('public.paradas_observacao_do_gestor()');
    SELECT count(*) INTO v_n
      FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.table_name = 'paradas'
       AND c.column_name = 'observacao_pulo' AND c.data_type = 'text'
       AND c.is_nullable = 'YES' AND c.column_default IS NULL;
    IF v_n <> 1 THEN
      r := r || ' | 10 FALHOU: coluna paradas.observacao_pulo text nula não existe';
    ELSIF v_fn IS NULL THEN
      r := r || ' | 10 FALHOU: public.paradas_observacao_do_gestor() não existe';
    ELSE
      SELECT count(*) INTO v_n2
        FROM pg_proc p
        JOIN pg_trigger t ON t.tgfoid = p.oid
       WHERE p.oid = v_fn
         AND t.tgrelid = 'public.paradas'::regclass
         AND t.tgname = 'trg_paradas_observacao_do_gestor'
         AND t.tgenabled = 'O'
         AND (t.tgtype & 2) = 2      -- BEFORE
         AND (t.tgtype & 1) = 1      -- FOR EACH ROW
         AND (t.tgtype & 16) = 16    -- UPDATE
         AND (t.tgtype & 4) = 0      -- não INSERT
         AND (t.tgtype & 8) = 0      -- não DELETE
         AND p.prosecdef
         AND p.proconfig = ARRAY['search_path=""']
         AND pg_get_userbyid(p.proowner) = 'postgres'
         AND p.proacl IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
         AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
         AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
         AND has_column_privilege('authenticated', 'public.paradas', 'observacao_pulo', 'UPDATE')
         AND has_column_privilege('authenticated', 'public.paradas', 'observacao_pulo', 'SELECT')
         AND NOT has_column_privilege('anon', 'public.paradas', 'observacao_pulo', 'UPDATE');
      r := r || CASE WHEN v_n2 = 1
        THEN ' | 10 OK: coluna text nula com UPDATE de authenticated; gatilho BEFORE UPDATE habilitado; função DEFINER, search_path vazio, dono postgres, sem EXECUTE para PUBLIC, anon e authenticated'
        ELSE ' | 10 FALHOU: catálogo fora do esperado (' || coalesce((SELECT coalesce(p.proacl::text, 'proacl nulo') || ' / ' || coalesce(p.proconfig::text, 'sem config') FROM pg_proc p WHERE p.oid = v_fn), 'sem linha') || ')' END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 10 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 11. M conclui (corpo 1.14.7) e avança a próxima
  -- ---------------------------------------------------------------------------
  BEGIN
    UPDATE public.paradas SET status = 'em_andamento' WHERE id = v_p11;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    WITH u AS (
      UPDATE public.paradas
         SET status = 'concluida', concluida_em = now()
       WHERE id = v_p11 AND status IN ('pendente', 'em_andamento')
      RETURNING id
    ) SELECT count(*) INTO v_n FROM u;
    WITH u AS (
      UPDATE public.paradas SET status = 'em_andamento'
       WHERE id = v_p11b AND status = 'pendente'
      RETURNING id
    ) SELECT count(*) INTO v_n2 FROM u;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n3 FROM public.paradas
     WHERE (id = v_p11  AND status = 'concluida'    AND concluida_em IS NOT NULL AND observacoes = v_obs)
        OR (id = v_p11b AND status = 'em_andamento' AND observacoes = v_obs);
    SELECT count(*) INTO v_n4 FROM public.logs
     WHERE rota_id = v_r AND evento = 'parada_concluida' AND detalhes->>'parada_id' = v_p11::text;
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1 AND v_n3 = 2 AND v_n4 = 1
      THEN ' | 11 OK: conclusão e avanço do app instalado: 1 linha cada, 1 log parada_concluida, observações iguais'
      ELSE ' | 11 FALHOU: linhas ' || v_n || '/' || v_n2 || ', paradas no esperado ' || v_n3 || ' de 2, logs ' || v_n4 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 11 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 12. GA: inserir_parada e reordenar_paradas numa rota pendente
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
      (v_r12, v_ua, v_m, 'pendente', v_hoje);
    INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, observacoes) VALUES
      (v_r12, 'entrega', 'sonda partida 12', -7.1, -34.8, 0, 'pendente', false, 'Ponto de partida'),
      (v_r12, 'entrega', 'sonda chegada 12', -7.1, -34.8, 3, 'pendente', false, 'Ponto de chegada');
    INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, observacoes) VALUES
      (v_q1, v_r12, 'entrega', 'sonda q1', -7.1, -34.8, 1, 'pendente', true, v_obs),
      (v_q2, v_r12, 'entrega', 'sonda q2', -7.1, -34.8, 2, 'pendente', true, v_obs);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_json := public.inserir_parada(v_r12, 'entrega', 'sonda nova', -7.1, -34.8, 1, NULL, NULL, 'observação da parada nova');
    v_nova := (v_json->>'parada_id')::uuid;
    v_json2 := public.reordenar_paradas(ARRAY[v_q1, v_q2], ARRAY[3, 2]);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n FROM public.paradas
     WHERE (id = v_nova AND ordem = 1 AND observacoes = 'observação da parada nova')
        OR (id = v_q1   AND ordem = 3 AND observacoes = v_obs)
        OR (id = v_q2   AND ordem = 2 AND observacoes = v_obs);
    r := r || CASE WHEN (v_json->>'success')::boolean AND (v_json2->>'success')::boolean AND v_n = 3
      THEN ' | 12 OK: inserir_parada e reordenar_paradas do gestor seguem com success; observações iguais'
      ELSE ' | 12 FALHOU: inserir ' || coalesce(v_json::text, 'nulo') || ', reordenar ' || coalesce(v_json2::text, 'nulo') || ', paradas no esperado ' || v_n || ' de 3' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 12 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 13. M: finalizar_rota numa rota em andamento sem parada aberta
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
      (v_r13, v_ua, v_m, 'em_andamento', v_hoje, now());
    INSERT INTO public.paradas (rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, concluida_em, observacoes) VALUES
      (v_r13, 'entrega', 'sonda partida 13', -7.1, -34.8, 0, 'concluida', false, now(), 'Ponto de partida'),
      (v_r13, 'entrega', 'sonda s1',         -7.1, -34.8, 1, 'concluida', true,  now(), v_obs);
    INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, motivo_skip, observacoes) VALUES
      (v_s2, v_r13, 'entrega', 'sonda s2',         -7.1, -34.8, 2, 'pulada',   true,  'outro', v_obs),
      (v_s3, v_r13, 'entrega', 'sonda chegada 13', -7.1, -34.8, 3, 'pendente', false, NULL,    'Ponto de chegada');
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.finalizar_rota(v_r13);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n FROM public.rotas WHERE id = v_r13 AND status = 'concluida' AND concluida_em IS NOT NULL;
    SELECT count(*) INTO v_n2 FROM public.paradas
     WHERE (id = v_s3 AND status = 'concluida' AND concluida_em IS NOT NULL)
        OR (id = v_s2 AND status = 'pulada' AND observacoes = v_obs);
    r := r || CASE WHEN v_n = 1 AND v_n2 = 2
      THEN ' | 13 OK: finalizar_rota do motorista conclui rota e chegada; observação da pulada igual'
      ELSE ' | 13 FALHOU: rota no esperado ' || v_n || ', paradas no esperado ' || v_n2 || ' de 2' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 13 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 14. GA: cancelar_rota e reativar_rota
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data, iniciada_em) VALUES
      (v_r14a, v_ua, v_m, 'em_andamento', v_hoje, now());
    INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
      (v_r14b, v_ua, v_m, 'nao_executada', v_hoje - 3);
    INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, motivo_skip, concluida_em, observacoes) VALUES
      (v_t1, v_r14a, 'entrega', 'sonda t1', -7.1, -34.8, 1, 'em_andamento', true, NULL,    NULL,  v_obs),
      (v_t2, v_r14b, 'entrega', 'sonda t2', -7.1, -34.8, 1, 'pulada',       true, 'outro', now(), v_obs);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_r14a);
    v_res2 := public.reativar_rota(v_r14b);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n FROM public.paradas
     WHERE (id = v_t1 AND status = 'pendente' AND observacoes = v_obs)
        OR (id = v_t2 AND status = 'pendente' AND observacoes = v_obs);
    r := r || CASE WHEN v_res = 'cancelada' AND v_res2 = 'reativada' AND v_n = 2
      THEN ' | 14 OK: cancelar_rota e reativar_rota do gestor seguem; paradas pendentes com observações iguais'
      ELSE ' | 14 FALHOU: cancelar ' || coalesce(v_res, 'nulo') || ', reativar ' || coalesce(v_res2, 'nulo') || ', paradas no esperado ' || v_n || ' de 2' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 14 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 15. M (corpo 1.14.8) pula, retoma e pula de novo com o mesmo texto
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    WITH u AS (
      UPDATE public.paradas
         SET status = 'pulada', motivo_skip = 'outro', observacao_pulo = 'Ficou para amanhã'
       WHERE id = v_p15 AND status IN ('pendente', 'em_andamento')
      RETURNING id
    ) SELECT count(*) INTO v_n FROM u;
    WITH u AS (
      UPDATE public.paradas SET status = 'pendente'
       WHERE id = v_p15
      RETURNING id
    ) SELECT count(*) INTO v_n2 FROM u;
    WITH u AS (
      UPDATE public.paradas
         SET status = 'pulada', motivo_skip = 'outro', observacao_pulo = 'Ficou para amanhã'
       WHERE id = v_p15 AND status IN ('pendente', 'em_andamento')
      RETURNING id
    ) SELECT count(*) INTO v_n3 FROM u;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n4 FROM public.paradas
     WHERE id = v_p15 AND status = 'pulada'
       AND observacoes = v_obs AND observacao_pulo = 'Ficou para amanhã';
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1 AND v_n3 = 1 AND v_n4 = 1
      THEN ' | 15 OK: app novo pula, retoma e pula de novo com o mesmo texto: observacao_pulo fica, observação do gestor igual'
      ELSE ' | 15 FALHOU: linhas ' || v_n || '/' || v_n2 || '/' || v_n3 || ', parada no esperado ' || v_n4 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 15 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 16. GB (gestor de outra loja) muda observacoes
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    WITH u AS (
      UPDATE public.paradas SET observacoes = 'texto de outra loja'
       WHERE id = v_p16
      RETURNING id
    ) SELECT count(*) INTO v_n FROM u;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n2 FROM public.paradas WHERE id = v_p16 AND observacoes = v_obs;
    r := r || CASE WHEN v_n = 0 AND v_n2 = 1
      THEN ' | 16 OK: gestor de outra loja: 0 linhas, observação igual'
      ELSE ' | 16 FALHOU: linhas ' || v_n || ', observação igual ' || v_n2 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 16 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  RAISE EXCEPTION 'SONDA M73 (desfeita):%', r;
END
$$;
