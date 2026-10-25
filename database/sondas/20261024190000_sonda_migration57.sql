-- ============================================================================
-- Sonda transacional da Migration 57 (foto de comprovante vinculada não é
-- desfeita pelo motorista)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 57 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Os casos 4 dependem também da
-- Migration 50 (já aplicada).
--
-- O bloco monta um cenário próprio (não depende de dado real): loja A,
-- gestor de A e motorista M de A. Uma rota de M em A com cinco paradas
-- (concluída com foto, outra concluída com foto, concluída sem foto, aberta
-- com foto e `foto_comprovante`, pulada com foto) e dois incidentes de M (com
-- e sem foto). As linhas de `storage.objects` entram direto como postgres (só
-- metadados). As consultas rodam como `authenticated` (SET LOCAL ROLE +
-- claims do JWT). O bloco termina SEMPRE em RAISE EXCEPTION, que desfaz tudo.
-- Leia o resultado na mensagem "SONDA M57 (desfeita): ...".
-- Esperado: todas as linhas com OK.
--
--   1. motorista M: não zera nem troca a foto da parada concluída, não reabre
--      a parada concluída com foto (sozinho ou junto com a foto), não zera a
--      foto nem o `foto_comprovante` da parada aberta, não zera nem troca a
--      foto do incidente; ao fim, as fotos continuam como estavam
--   2. motorista M: a ligação tardia NULL → valor da fila offline (mesma forma
--      do app: `foto_url IS NULL` no WHERE) passa em parada concluída; o
--      UPDATE com o mesmo valor passa; a nova foto em parada aberta passa;
--      NULL → valor no incidente passa; concluir a parada aberta e editar
--      outra coluna da parada concluída passam
--   3. gestor de A: zera a foto da parada concluída, reabre a parada pulada
--      com foto e zera a foto do incidente
--   4. com a Migration 50: o motorista tenta zerar a foto e, em seguida,
--      remover o objeto — os dois passos são recusados e o objeto fica
--   5. sem sessão (chave secreta, jobs): a mudança passa
--   6. catálogo: os dois gatilhos habilitados; as duas funções DEFINER com
--      `search_path` vazio e sem EXECUTE para anon/authenticated
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_g uuid := gen_random_uuid();      -- gestor de A
  v_m uuid := gen_random_uuid();      -- motorista de A, dono das fotos
  v_rota uuid := gen_random_uuid();
  v_pc uuid := gen_random_uuid();     -- concluída com foto
  v_pc2 uuid := gen_random_uuid();    -- outra concluída com foto (caso 4)
  v_ps uuid := gen_random_uuid();     -- concluída sem foto (ligação tardia)
  v_pa uuid := gen_random_uuid();     -- aberta com foto e foto_comprovante
  v_pp uuid := gen_random_uuid();     -- pulada com foto
  v_inc uuid := gen_random_uuid();    -- incidente com foto
  v_inc2 uuid := gen_random_uuid();   -- incidente sem foto
  o_pc text;
  o_pc2 text;
  o_pa text;
  o_pa_comp text;
  o_pp text;
  o_inc text;
  o_tardia text;
  o_nova text;
  o_inc2 text;
  v_n int;
  v_txt text;
BEGIN
  o_pc      := v_ua || '/' || v_rota || '/' || v_pc  || '_1.jpg';
  o_pc2     := v_ua || '/' || v_rota || '/' || v_pc2 || '_2.jpg';
  o_pa      := v_ua || '/' || v_rota || '/' || v_pa  || '_3.jpg';
  o_pa_comp := v_ua || '/' || v_rota || '/' || v_pa  || '_4.jpg';
  o_pp      := v_ua || '/' || v_rota || '/' || v_pp  || '_5.jpg';
  o_inc     := 'incidentes/sonda_m57_' || v_sufixo || '_6.jpg';
  o_tardia  := v_ua || '/' || v_rota || '/' || v_ps  || '_7.jpg';
  o_nova    := v_ua || '/' || v_rota || '/' || v_pa  || '_8.jpg';
  o_inc2    := 'incidentes/sonda_m57_' || v_sufixo || '_9.jpg';

  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_g, 'sonda-m57-g-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m, 'sonda-m57-m-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M57 A', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_g, 'Sonda gestor A', 'sonda-m57-g-' || v_sufixo || '@example.invalid', 'gestor', v_ua, true),
    (v_m, 'Sonda motorista', 'sonda-m57-m-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_g, v_ua, 'gestor', true, true),
    (v_m, v_ua, 'motorista', true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_rota, v_ua, v_m, 'em_andamento');

  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, foto_url, foto_comprovante) VALUES
    (v_pc,  v_rota, 'entrega', 'Sonda 1', -7.1, -34.8, 1, 'concluida',    true, o_pc,  NULL),
    (v_pc2, v_rota, 'entrega', 'Sonda 2', -7.1, -34.8, 2, 'concluida',    true, o_pc2, NULL),
    (v_ps,  v_rota, 'entrega', 'Sonda 3', -7.1, -34.8, 3, 'concluida',    true, NULL,  NULL),
    (v_pa,  v_rota, 'entrega', 'Sonda 4', -7.1, -34.8, 4, 'em_andamento', true, o_pa,  o_pa_comp),
    (v_pp,  v_rota, 'entrega', 'Sonda 5', -7.1, -34.8, 5, 'pulada',       true, o_pp,  NULL);

  INSERT INTO public.incidentes (id, motorista_id, rota_id, unidade_id, categoria, descricao, endereco, status, foto_url) VALUES
    (v_inc,  v_m, v_rota, v_ua, 'other', 'sonda m57', 'sonda', 'aberto', o_inc),
    (v_inc2, v_m, v_rota, v_ua, 'other', 'sonda m57 sem foto', 'sonda', 'aberto', NULL);

  INSERT INTO storage.objects (bucket_id, name, owner, owner_id) VALUES
    ('fotos-entrega', o_pc2, v_m, v_m::text);

  PERFORM set_config('storage.allow_delete_query', 'true', true);

  -- ---------------------------------------------------------------------------
  -- 1. motorista M: recusas (cada tentativa no próprio bloco)
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET foto_url = NULL WHERE id = v_pc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 1a FALHOU: motorista zerou a foto da parada concluída (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE 'FOTO_VINCULADA%'
      THEN ' | 1a OK: motorista não zera a foto da parada concluída'
      ELSE ' | 1a FALHOU: erro inesperado (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET foto_url = o_nova WHERE id = v_pc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 1b FALHOU: motorista trocou a foto da parada concluída (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE 'FOTO_VINCULADA%'
      THEN ' | 1b OK: motorista não troca a foto da parada concluída'
      ELSE ' | 1b FALHOU: erro inesperado (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET status = 'pendente', concluida_em = NULL WHERE id = v_pc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 1c FALHOU: motorista reabriu a parada concluída com foto (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE 'FOTO_VINCULADA%'
      THEN ' | 1c OK: motorista não reabre a parada concluída com foto'
      ELSE ' | 1c FALHOU: erro inesperado (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET status = 'pendente', foto_url = o_nova WHERE id = v_pc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 1d FALHOU: motorista reabriu e trocou a foto numa instrução só (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE 'FOTO_VINCULADA%'
      THEN ' | 1d OK: motorista não reabre e troca a foto numa instrução só'
      ELSE ' | 1d FALHOU: erro inesperado (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET foto_url = NULL WHERE id = v_pa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 1e FALHOU: motorista zerou a foto da parada aberta (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE 'FOTO_VINCULADA%'
      THEN ' | 1e OK: motorista não zera a foto da parada aberta'
      ELSE ' | 1e FALHOU: erro inesperado (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET foto_comprovante = NULL WHERE id = v_pa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 1f FALHOU: motorista zerou foto_comprovante (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE 'FOTO_VINCULADA%'
      THEN ' | 1f OK: motorista não zera foto_comprovante'
      ELSE ' | 1f FALHOU: erro inesperado (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET foto_url = NULL WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 1g FALHOU: motorista zerou a foto do incidente (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE 'FOTO_VINCULADA%'
      THEN ' | 1g OK: motorista não zera a foto do incidente'
      ELSE ' | 1g FALHOU: erro inesperado (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.incidentes SET foto_url = o_inc2 WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 1h FALHOU: motorista trocou a foto do incidente (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE 'FOTO_VINCULADA%'
      THEN ' | 1h OK: motorista não troca a foto do incidente'
      ELSE ' | 1h FALHOU: erro inesperado (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', '', true);
  SELECT count(*) INTO v_n FROM public.paradas
   WHERE (id = v_pc AND foto_url = o_pc AND status = 'concluida')
      OR (id = v_pa AND foto_url = o_pa AND foto_comprovante = o_pa_comp);
  SELECT foto_url INTO v_txt FROM public.incidentes WHERE id = v_inc;
  r := r || CASE WHEN v_n = 2 AND v_txt = o_inc
    THEN ' | 1i OK: fotos e status seguem como estavam'
    ELSE ' | 1i FALHOU: ' || v_n || ' de 2 paradas intactas; incidente = ' || coalesce(v_txt, 'NULL') END;

  -- ---------------------------------------------------------------------------
  -- 2. motorista M: o que continua passando
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    -- `subirFotoDaFilaOffline`: UPDATE só com foto_url nula
    UPDATE public.paradas SET foto_url = o_tardia WHERE id = v_ps AND foto_url IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 2a OK: ligação tardia NULL → valor em parada concluída (1)'
      ELSE ' | 2a FALHOU: ligação tardia gravou ' || v_n END;

    -- a mesma forma em parada que já tem foto não pega linha (sem erro)
    UPDATE public.paradas SET foto_url = o_nova WHERE id = v_pc AND foto_url IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 2b OK: ligação tardia em parada com foto não pega linha (0)'
      ELSE ' | 2b FALHOU: ligação tardia sobrescreveu (' || v_n || ')' END;

    UPDATE public.paradas SET foto_url = o_pc WHERE id = v_pc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 2c OK: UPDATE com o mesmo valor passa (1)'
      ELSE ' | 2c FALHOU: UPDATE com o mesmo valor gravou ' || v_n END;

    -- nova foto antes de concluir (`uploadELinkFotoParada`, sem condição)
    UPDATE public.paradas SET foto_url = o_nova WHERE id = v_pa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 2d OK: nova foto em parada aberta (1)'
      ELSE ' | 2d FALHOU: nova foto em parada aberta gravou ' || v_n END;

    UPDATE public.incidentes SET foto_url = o_inc2 WHERE id = v_inc2;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 2e OK: NULL → valor no incidente (1)'
      ELSE ' | 2e FALHOU: NULL → valor no incidente gravou ' || v_n END;

    UPDATE public.paradas SET status = 'concluida', concluida_em = now() WHERE id = v_pa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 2f OK: motorista conclui a parada aberta com foto (1)'
      ELSE ' | 2f FALHOU: conclusão gravou ' || v_n END;

    UPDATE public.paradas SET observacoes = 'sonda m57' WHERE id = v_pc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 2g OK: outra coluna da parada concluída segue editável (1)'
      ELSE ' | 2g FALHOU: edição de observacoes gravou ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 3. gestor de A corrige
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    UPDATE public.paradas SET foto_url = NULL WHERE id = v_pc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 3a OK: gestor zera a foto da parada concluída (1)'
      ELSE ' | 3a FALHOU: gestor gravou ' || v_n END;

    UPDATE public.paradas SET status = 'pendente', concluida_em = NULL WHERE id = v_pp;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 3b OK: gestor reabre a parada pulada com foto (1)'
      ELSE ' | 3b FALHOU: gestor reabriu ' || v_n END;

    UPDATE public.incidentes SET foto_url = NULL WHERE id = v_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 3c OK: gestor zera a foto do incidente (1)'
      ELSE ' | 3c FALHOU: gestor gravou ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. com a Migration 50: os dois passos são recusados
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET foto_url = NULL WHERE id = v_pc2;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 4a FALHOU: o primeiro passo passou (' || v_n || ')';
  EXCEPTION WHEN OTHERS THEN
    r := r || CASE WHEN SQLERRM LIKE 'FOTO_VINCULADA%'
      THEN ' | 4a OK: o primeiro passo é recusado'
      ELSE ' | 4a FALHOU: erro inesperado (' || SQLERRM || ')' END;
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM storage.objects WHERE bucket_id = 'fotos-entrega' AND name = o_pc2;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 4b OK: o objeto vinculado não é removido pelo dono (0)'
      ELSE ' | 4b FALHOU: o dono removeu o objeto (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4b FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', '', true);
  SELECT count(*) INTO v_n FROM storage.objects WHERE bucket_id = 'fotos-entrega' AND name = o_pc2;
  SELECT foto_url INTO v_txt FROM public.paradas WHERE id = v_pc2;
  r := r || CASE WHEN v_n = 1 AND v_txt = o_pc2
    THEN ' | 4c OK: objeto e referência continuam'
    ELSE ' | 4c FALHOU: objeto ' || v_n || ', referência ' || coalesce(v_txt, 'NULL') END;

  -- ---------------------------------------------------------------------------
  -- 5. sem sessão (como postgres, sem claims)
  -- ---------------------------------------------------------------------------
  BEGIN
    UPDATE public.paradas SET foto_url = NULL WHERE id = v_pc2;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 5 OK: sem sessão, a mudança passa (1)'
      ELSE ' | 5 FALHOU: sem sessão gravou ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 6. catálogo
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_n
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE t.tgenabled = 'O'
     AND ((c.relname = 'paradas' AND t.tgname = 'trg_paradas_foto_vinculada_preservada')
       OR (c.relname = 'incidentes' AND t.tgname = 'trg_incidentes_foto_vinculada_preservada'));
  r := r || CASE WHEN v_n = 2
    THEN ' | 6a OK: os dois gatilhos habilitados'
    ELSE ' | 6a FALHOU: ' || v_n || ' de 2 gatilhos' END;

  SELECT count(*) INTO v_n FROM pg_proc
   WHERE proname IN ('paradas_foto_vinculada_preservada', 'incidentes_foto_vinculada_preservada')
     AND prosecdef
     AND proconfig = ARRAY['search_path=""']
     AND NOT has_function_privilege('anon', oid, 'EXECUTE')
     AND NOT has_function_privilege('authenticated', oid, 'EXECUTE');
  r := r || CASE WHEN v_n = 2
    THEN ' | 6b OK: funções DEFINER, search_path vazio, sem EXECUTE para anon/authenticated'
    ELSE ' | 6b FALHOU: ' || v_n || ' de 2 funções como esperado' END;

  RAISE EXCEPTION 'SONDA M57 (desfeita):%', r;
END
$$;
