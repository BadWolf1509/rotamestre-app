-- ============================================================================
-- Sonda transacional da Migration 50 (bucket fotos-entrega: comprovante
-- vinculado é preservado; o acesso por loja segue o cadastro ativo)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 50 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas.
--
-- O bloco monta um cenário próprio (não depende de dado real): lojas A e B,
-- gestor de A, gestor de A inativo no cadastro (vínculo ativo), motorista M
-- de A (dono das fotos), outro motorista de A, motorista de A inativo no
-- cadastro (vínculo ativo), motorista com o vínculo de A desativado e um
-- motorista de B. Uma rota de M em A com três paradas e um incidente; as
-- linhas de `storage.objects` entram direto como postgres (só metadados; nada
-- vai para o armazenamento de arquivos). As consultas rodam como
-- `authenticated` (SET LOCAL ROLE + claims do JWT). O DELETE em
-- `storage.objects` liga `storage.allow_delete_query` só nesta transação,
-- como a Storage API faz. O bloco termina SEMPRE em RAISE EXCEPTION, que
-- desfaz tudo. Leia o resultado na mensagem "SONDA M50 (desfeita): ...".
-- Esperado: todas as linhas com OK.
--
--   1. M (dono) não remove foto vinculada: parada por path, parada por URL
--      legada, `foto_comprovante`, incidente e o caminho registrado pela fila
--      offline em `logs` (1h); o dono com o vínculo de A desativado, que não
--      enxerga a parada, também não remove a foto ligada a ela (1g — é o caso
--      que exige o helper SECURITY DEFINER); os objetos continuam lá
--   2. M remove o próprio upload sem vínculo, e a própria foto de perfil
--      atual (troca de avatar)
--   3. fluxo do app: M sobe uma foto nova na pasta da loja e a remove (o
--      desfazer de `uploadELinkFotoParada`)
--   4. correção pelo gestor: a foto que o gestor de A tira da parada deixa de
--      ser referência, e o dono remove o objeto antigo
--   5. quem não é dono não remove: gestor de A, motorista de B
--   6. pode_apagar_foto_entrega: true só para objeto do próprio dono sem
--      vínculo; false para objeto de outro (sem resposta sobre terceiros)
--   7. leitura por loja: gestor de A, gestor de A inativo no cadastro, M
--      (dono) e o outro motorista ativo de A leem a foto; motorista inativo
--      no cadastro, motorista com vínculo de A desativado e motorista de B
--      não leem
--   8. o motorista inativo no cadastro lê e remove o próprio upload sem
--      vínculo (ramo do dono)
--   9. upload na pasta da loja: aceito para o gestor inativo no cadastro e
--      para o motorista ativo; recusado (42501) para o motorista inativo no
--      cadastro, que ainda sobe foto de perfil
--  10. perfil e incidente: o gestor de A lê a foto de perfil de M e a do
--      incidente; o motorista de B não lê nenhuma das duas
--  11. anon: sem EXECUTE nos dois helpers e sem leitura no bucket
--  12. as três policies trocadas são as únicas do bucket fotos-entrega,
--      todas authenticated, sem UPDATE/ALL
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_g uuid := gen_random_uuid();      -- gestor de A
  v_gp uuid := gen_random_uuid();     -- gestor de A inativo no cadastro, vínculo ativo
  v_m uuid := gen_random_uuid();      -- motorista de A, dono das fotos
  v_m3 uuid := gen_random_uuid();     -- outro motorista ativo de A
  v_m2 uuid := gen_random_uuid();     -- motorista de A inativo no cadastro, vínculo ativo
  v_m4 uuid := gen_random_uuid();     -- motorista com o vínculo de A desativado
  v_mb uuid := gen_random_uuid();     -- motorista de B
  v_rota uuid := gen_random_uuid();
  v_p1 uuid := gen_random_uuid();
  v_p2 uuid := gen_random_uuid();
  v_p3 uuid := gen_random_uuid();
  v_inc uuid := gen_random_uuid();
  -- objetos
  o_path text;     -- parada por path
  o_url text;      -- parada por URL legada
  o_comp text;     -- foto_comprovante
  o_inc text;      -- incidente
  o_orfao text;    -- upload de M sem vínculo
  o_perfil text;   -- foto de perfil atual de M
  o_novo text;     -- upload feito como authenticated (fluxo do app)
  o_orfao2 text;   -- outro upload de M sem vínculo (tentativas de terceiros)
  o_m2 text;       -- upload do motorista inativo no cadastro, sem vínculo
  o_gp text;       -- upload do gestor inativo no cadastro
  o_m2_loja text;  -- tentativa do motorista inativo na pasta da loja
  o_m2_perfil text;
  o_m3 text;       -- upload do outro motorista ativo
  o_m4 text;       -- foto vinculada cujo dono não enxerga a parada
  o_log text;      -- caminho registrado pela fila offline em logs
  v_n int;
  v_bool boolean;
BEGIN
  o_path   := v_ua || '/' || v_rota || '/' || v_p1 || '_1.jpg';
  o_url    := v_ua || '/' || v_rota || '/' || v_p2 || '_2.jpg';
  o_comp   := v_ua || '/' || v_rota || '/' || v_p3 || '_3.jpg';
  o_inc    := 'incidentes/sonda_m50_' || v_sufixo || '.jpg';
  o_orfao  := v_ua || '/' || v_rota || '/' || v_p1 || '_5.jpg';
  o_perfil := 'perfis/perfil_' || v_m || '_6.jpg';
  o_novo   := v_ua || '/' || v_rota || '/' || v_p1 || '_7.jpg';
  o_orfao2 := v_ua || '/' || v_rota || '/' || v_p1 || '_8.jpg';
  o_m2     := v_ua || '/' || v_rota || '/' || v_p1 || '_9.jpg';
  o_gp     := v_ua || '/' || v_rota || '/' || v_p1 || '_10.jpg';
  o_m2_loja := v_ua || '/' || v_rota || '/' || v_p1 || '_11.jpg';
  o_m2_perfil := 'perfis/perfil_' || v_m2 || '_12.jpg';
  o_m3     := v_ua || '/' || v_rota || '/' || v_p1 || '_13.jpg';
  o_m4     := v_ua || '/' || v_rota || '/' || v_p3 || '_14.jpg';
  o_log    := v_ua || '/' || v_rota || '/' || v_p2 || '_15.jpg';

  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_g,  'sonda-m50-g-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gp, 'sonda-m50-gp-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m,  'sonda-m50-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m3, 'sonda-m50-m3-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m2, 'sonda-m50-m2-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m4, 'sonda-m50-m4-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_mb, 'sonda-m50-mb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M50 A', 'Sonda'),
    (v_ub, 'Sonda M50 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo, foto_url) VALUES
    (v_g,  'Sonda gestor A', 'sonda-m50-g-' || v_sufixo || '@example.invalid', 'gestor', v_ua, true, NULL),
    (v_gp, 'Sonda gestor A inativo', 'sonda-m50-gp-' || v_sufixo || '@example.invalid', 'gestor', v_ua, false, NULL),
    (v_m,  'Sonda motorista', 'sonda-m50-m-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true, o_perfil),
    (v_m3, 'Sonda motorista 3', 'sonda-m50-m3-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true, NULL),
    (v_m2, 'Sonda motorista inativo', 'sonda-m50-m2-' || v_sufixo || '@example.invalid', 'motorista', v_ua, false, NULL),
    (v_m4, 'Sonda motorista sem A', 'sonda-m50-m4-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true, NULL),
    (v_mb, 'Sonda motorista B', 'sonda-m50-mb-' || v_sufixo || '@example.invalid', 'motorista', v_ub, true, NULL);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_g,  v_ua, 'gestor', true, true),
    (v_gp, v_ua, 'gestor', true, true),
    (v_m,  v_ua, 'motorista', true, true),
    (v_m3, v_ua, 'motorista', true, true),
    (v_m2, v_ua, 'motorista', true, true),
    (v_m4, v_ua, 'motorista', false, true),
    (v_mb, v_ub, 'motorista', true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, status) VALUES
    (v_rota, v_ua, v_m, 'em_andamento');

  INSERT INTO public.paradas (id, rota_id, tipo, endereco, latitude, longitude, ordem, status, is_checkpoint, foto_url, foto_comprovante) VALUES
    (v_p1, v_rota, 'entrega', 'Sonda partida', -7.1, -34.8, 0, 'concluida', false, o_path, NULL),
    (v_p2, v_rota, 'entrega', 'Sonda parada',  -7.1, -34.8, 1, 'concluida', true,
      'https://exemplo.invalid/storage/v1/object/public/fotos-entrega/' || o_url, NULL),
    (v_p3, v_rota, 'entrega', 'Sonda chegada', -7.1, -34.8, 2, 'pendente',  false, o_m4, o_comp);

  INSERT INTO public.incidentes (id, motorista_id, rota_id, unidade_id, categoria, descricao, endereco, status, foto_url)
    VALUES (v_inc, v_m, v_rota, v_ua, 'other', 'sonda m50', 'sonda', 'aberto', o_inc);

  INSERT INTO storage.objects (bucket_id, name, owner, owner_id) VALUES
    ('fotos-entrega', o_path,   v_m,  v_m::text),
    ('fotos-entrega', o_url,    v_m,  v_m::text),
    ('fotos-entrega', o_comp,   v_m,  v_m::text),
    ('fotos-entrega', o_inc,    v_m,  v_m::text),
    ('fotos-entrega', o_orfao,  v_m,  v_m::text),
    ('fotos-entrega', o_perfil, v_m,  v_m::text),
    ('fotos-entrega', o_orfao2, v_m,  v_m::text),
    ('fotos-entrega', o_m2,     v_m2, v_m2::text),
    ('fotos-entrega', o_m4,     v_m4, v_m4::text),
    ('fotos-entrega', o_log,    v_m,  v_m::text);

  -- o registro que `subirFotoDaFilaOffline` grava quando não liga a foto
  INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
    VALUES (v_m, v_rota, 'foto_comprovante_sem_vinculo',
      jsonb_build_object('parada_id', v_p2, 'foto_path', o_log));

  -- a Storage API liga isto antes do DELETE; só nesta transação
  PERFORM set_config('storage.allow_delete_query', 'true', true);

  -- ---------------------------------------------------------------------------
  -- 1. M (dono) não remove foto vinculada
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    DELETE FROM storage.objects WHERE bucket_id = 'fotos-entrega' AND name = o_path;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 1a OK: dono não remove foto vinculada à parada por path (0)'
      ELSE ' | 1a FALHOU: dono removeu foto vinculada por path (' || v_n || ')' END;

    DELETE FROM storage.objects WHERE bucket_id = 'fotos-entrega' AND name = o_url;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 1b OK: dono não remove foto vinculada por URL legada (0)'
      ELSE ' | 1b FALHOU: dono removeu foto vinculada por URL legada (' || v_n || ')' END;

    DELETE FROM storage.objects WHERE bucket_id = 'fotos-entrega' AND name = o_comp;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 1c OK: dono não remove foto de foto_comprovante (0)'
      ELSE ' | 1c FALHOU: dono removeu foto de foto_comprovante (' || v_n || ')' END;

    DELETE FROM storage.objects WHERE bucket_id = 'fotos-entrega' AND name = o_inc;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 1d OK: dono não remove foto vinculada ao incidente (0)'
      ELSE ' | 1d FALHOU: dono removeu foto do incidente (' || v_n || ')' END;

    -- a remoção em lote (como `storage.remove([...])`) também preserva
    DELETE FROM storage.objects WHERE bucket_id = 'fotos-entrega'
       AND name IN (o_path, o_url, o_comp, o_inc);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 1e OK: remoção em lote das quatro vinculadas não pega linha (0)'
      ELSE ' | 1e FALHOU: remoção em lote removeu ' || v_n END;

    DELETE FROM storage.objects WHERE bucket_id = 'fotos-entrega' AND name = o_log;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 1h OK: dono não remove o comprovante registrado pela fila offline em logs (0)'
      ELSE ' | 1h FALHOU: dono removeu o comprovante registrado em logs (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- dono de foto vinculada que NÃO enxerga a parada (vínculo com A
  -- desativado): a checagem não pode depender do RLS de quem apaga
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m4, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO v_n FROM public.paradas WHERE id = v_p3;
    r := r || CASE WHEN v_n = 0
      THEN ' | 1g0 OK: o dono (vínculo de A desativado) não enxerga a parada (0)'
      ELSE ' | 1g0 FALHOU: o dono enxerga a parada (' || v_n || '); o caso 1g perde o sentido' END;

    DELETE FROM storage.objects WHERE bucket_id = 'fotos-entrega' AND name = o_m4;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 1g OK: dono que não enxerga a parada não remove a foto vinculada (0)'
      ELSE ' | 1g FALHOU: dono que não enxerga a parada removeu a foto vinculada (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1g FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  SELECT count(*) INTO v_n FROM storage.objects
   WHERE bucket_id = 'fotos-entrega' AND name IN (o_path, o_url, o_comp, o_inc, o_m4, o_log);
  r := r || CASE WHEN v_n = 6
    THEN ' | 1f OK: as 6 fotos vinculadas continuam no bucket'
    ELSE ' | 1f FALHOU: restaram ' || v_n || ' de 6 fotos vinculadas' END;

  -- ---------------------------------------------------------------------------
  -- 2-3. M remove o que não tem vínculo; fluxo de upload e desfazer do app
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    DELETE FROM storage.objects WHERE bucket_id = 'fotos-entrega' AND name = o_orfao;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 2a OK: dono remove o próprio upload sem vínculo (1)'
      ELSE ' | 2a FALHOU: dono não removeu o upload sem vínculo (' || v_n || ')' END;

    DELETE FROM storage.objects WHERE bucket_id = 'fotos-entrega' AND name = o_perfil;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 2b OK: dono remove a própria foto de perfil atual (troca de avatar) (1)'
      ELSE ' | 2b FALHOU: dono não removeu a foto de perfil (' || v_n || ')' END;

    INSERT INTO storage.objects (bucket_id, name, owner, owner_id)
      VALUES ('fotos-entrega', o_novo, v_m, v_m::text);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 3a OK: motorista ativo sobe foto na pasta da loja (1)'
      ELSE ' | 3a FALHOU: upload na pasta da loja gravou ' || v_n END;

    DELETE FROM storage.objects WHERE bucket_id = 'fotos-entrega' AND name = o_novo;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 3b OK: o desfazer do upload sem vínculo remove o objeto (1)'
      ELSE ' | 3b FALHOU: o desfazer não removeu (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2-3 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 4. correção pelo gestor: a foto deixa de ser referência e o dono remove
  --    o objeto antigo
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.paradas SET foto_url = NULL WHERE id = v_p1;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 4a OK: o gestor de A corrige a foto da parada (1)'
      ELSE ' | 4a FALHOU: a correção do gestor gravou ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4a FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM storage.objects WHERE bucket_id = 'fotos-entrega' AND name = o_path;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 4b OK: depois da correção do gestor, o dono remove o objeto antigo (1)'
      ELSE ' | 4b FALHOU: depois da correção, o dono não removeu (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4b FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 5. quem não é dono não remove
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM storage.objects WHERE bucket_id = 'fotos-entrega' AND name IN (o_orfao2, o_url);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 5a OK: gestor de A não remove foto de motorista (0)'
      ELSE ' | 5a FALHOU: gestor removeu ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5a FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_mb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM storage.objects WHERE bucket_id = 'fotos-entrega' AND name IN (o_orfao2, o_url);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 5b OK: motorista de B não remove foto de A (0)'
      ELSE ' | 5b FALHOU: motorista de B removeu ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5b FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. pode_apagar_foto_entrega
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_bool := public.pode_apagar_foto_entrega(o_orfao2);
    r := r || CASE WHEN v_bool
      THEN ' | 6a OK: true para o próprio objeto sem vínculo'
      ELSE ' | 6a FALHOU: ' || coalesce(v_bool::text, 'NULL') || ' para o próprio objeto sem vínculo' END;
    v_bool := public.pode_apagar_foto_entrega(o_url);
    r := r || CASE WHEN NOT v_bool
      THEN ' | 6b OK: false para o próprio objeto vinculado'
      ELSE ' | 6b FALHOU: ' || coalesce(v_bool::text, 'NULL') || ' para o próprio objeto vinculado' END;
    v_bool := public.pode_apagar_foto_entrega('nao/existe_' || v_sufixo || '.jpg');
    r := r || CASE WHEN NOT v_bool
      THEN ' | 6c OK: false para objeto inexistente'
      ELSE ' | 6c FALHOU: true para objeto inexistente' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6a-6c FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_mb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_bool := public.pode_apagar_foto_entrega(o_orfao2);
    r := r || CASE WHEN NOT v_bool
      THEN ' | 6d OK: false para objeto sem vínculo de outra pessoa'
      ELSE ' | 6d FALHOU: true para objeto de outra pessoa' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6d FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 7. leitura por loja (o_url segue vinculada e é de M)
  -- ---------------------------------------------------------------------------
  DECLARE
    v_quem uuid;
    v_rotulo text;
    v_espera int;
    v_codigo text;
  BEGIN
    FOR v_codigo, v_quem, v_rotulo, v_espera IN
      SELECT * FROM (VALUES
        ('7a', v_g,  'gestor de A', 1),
        ('7b', v_gp, 'gestor de A inativo no cadastro', 1),
        ('7c', v_m,  'motorista dono', 1),
        ('7d', v_m3, 'outro motorista ativo de A', 1),
        ('7e', v_m2, 'motorista inativo no cadastro', 0),
        ('7f', v_m4, 'motorista com vínculo de A desativado', 0),
        ('7g', v_mb, 'motorista de B', 0)
      ) AS t(c, u, rot, esp)
    LOOP
      BEGIN
        PERFORM set_config('request.jwt.claims',
          json_build_object('sub', v_quem, 'role', 'authenticated')::text, true);
        SET LOCAL ROLE authenticated;
        SELECT count(*) INTO v_n FROM storage.objects
         WHERE bucket_id = 'fotos-entrega' AND name = o_url;
        r := r || CASE WHEN v_n = v_espera
          THEN ' | ' || v_codigo || ' OK: ' || v_rotulo || ' lê a foto da loja: ' || v_n
          ELSE ' | ' || v_codigo || ' FALHOU: ' || v_rotulo || ' lê ' || v_n || ' (esperado ' || v_espera || ')' END;
      EXCEPTION WHEN OTHERS THEN
        r := r || ' | ' || v_codigo || ' FALHOU: erro inesperado (' || SQLERRM || ')';
      END;
      RESET ROLE;
    END LOOP;
  END;

  -- ---------------------------------------------------------------------------
  -- 8. motorista inativo no cadastro: o próprio upload sem vínculo
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM storage.objects
     WHERE bucket_id = 'fotos-entrega' AND name = o_m2;
    r := r || CASE WHEN v_n = 1
      THEN ' | 8a OK: inativo no cadastro lê o próprio upload (1)'
      ELSE ' | 8a FALHOU: inativo no cadastro lê ' || v_n || ' do próprio upload' END;
    DELETE FROM storage.objects WHERE bucket_id = 'fotos-entrega' AND name = o_m2;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 8b OK: inativo no cadastro remove o próprio upload sem vínculo (1)'
      ELSE ' | 8b FALHOU: inativo no cadastro não removeu (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 9. upload na pasta da loja
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gp, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO storage.objects (bucket_id, name, owner, owner_id)
      VALUES ('fotos-entrega', o_gp, v_gp, v_gp::text);
    r := r || ' | 9a OK: gestor inativo no cadastro sobe foto na pasta da loja';
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9a FALHOU: gestor inativo no cadastro recusado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m3, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO storage.objects (bucket_id, name, owner, owner_id)
      VALUES ('fotos-entrega', o_m3, v_m3, v_m3::text);
    r := r || ' | 9b OK: motorista ativo sobe foto na pasta da loja';
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9b FALHOU: motorista ativo recusado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO storage.objects (bucket_id, name, owner, owner_id)
      VALUES ('fotos-entrega', o_m2_loja, v_m2, v_m2::text);
    r := r || ' | 9c FALHOU: inativo no cadastro subiu foto na pasta da loja';
  EXCEPTION
    WHEN insufficient_privilege THEN
      r := r || ' | 9c OK: inativo no cadastro recusado na pasta da loja (42501)';
    WHEN OTHERS THEN
      r := r || ' | 9c FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO storage.objects (bucket_id, name, owner, owner_id)
      VALUES ('fotos-entrega', o_m2_perfil, v_m2, v_m2::text);
    r := r || ' | 9d OK: inativo no cadastro ainda sobe foto de perfil';
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9d FALHOU: foto de perfil recusada (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 10. perfil e incidente (a foto de perfil de M foi removida no 2b; volta
  --     como objeto novo para a leitura)
  -- ---------------------------------------------------------------------------
  INSERT INTO storage.objects (bucket_id, name, owner, owner_id)
    VALUES ('fotos-entrega', o_perfil, v_m, v_m::text);

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM storage.objects
     WHERE bucket_id = 'fotos-entrega' AND name IN (o_perfil, o_inc);
    r := r || CASE WHEN v_n = 2
      THEN ' | 10a OK: gestor de A lê a foto de perfil de M e a do incidente (2)'
      ELSE ' | 10a FALHOU: gestor de A lê ' || v_n || ' de 2' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 10a FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_mb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM storage.objects
     WHERE bucket_id = 'fotos-entrega' AND name IN (o_perfil, o_inc);
    r := r || CASE WHEN v_n = 0
      THEN ' | 10b OK: motorista de B não lê perfil nem incidente de A (0)'
      ELSE ' | 10b FALHOU: motorista de B lê ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 10b FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 11. anon
  -- ---------------------------------------------------------------------------
  BEGIN
    r := r || CASE WHEN NOT has_function_privilege('anon', 'public.minhas_unidades_com_acesso()', 'EXECUTE')
                    AND NOT has_function_privilege('anon', 'public.pode_apagar_foto_entrega(text)', 'EXECUTE')
      THEN ' | 11a OK: anon sem EXECUTE nos dois helpers'
      ELSE ' | 11a FALHOU: anon executa um dos helpers' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 11a FALHOU: erro inesperado (' || SQLERRM || ')';
  END;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    SET LOCAL ROLE anon;
    SELECT count(*) INTO v_n FROM storage.objects
     WHERE bucket_id = 'fotos-entrega' AND name IN (o_url, o_inc, o_perfil, o_orfao2);
    r := r || CASE WHEN v_n = 0
      THEN ' | 11b OK: anon não lê o bucket (0)'
      ELSE ' | 11b FALHOU: anon lê ' || v_n END;
  EXCEPTION
    WHEN insufficient_privilege THEN
      r := r || ' | 11b OK: anon recusado (42501)';
    WHEN OTHERS THEN
      r := r || ' | 11b FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 12. catálogo
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname IN ('fotos-entrega select', 'fotos-entrega insert', 'fotos-entrega delete')
     AND roles = '{authenticated}'
     AND coalesce(qual, '') NOT ILIKE '%get_my_unidade_ids%'
     AND coalesce(with_check, '') NOT ILIKE '%get_my_unidade_ids%';
  r := r || CASE WHEN v_n = 3
    THEN ' | 12a OK: as 3 policies do bucket, authenticated, pelo helper novo'
    ELSE ' | 12a FALHOU: ' || v_n || ' de 3 policies como esperado' END;

  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND (coalesce(qual, '') ILIKE '%fotos-entrega%'
       OR coalesce(with_check, '') ILIKE '%fotos-entrega%')
     AND (cmd IN ('UPDATE', 'ALL')
       OR policyname NOT IN
          ('fotos-entrega select', 'fotos-entrega insert', 'fotos-entrega delete'));
  r := r || CASE WHEN v_n = 0
    THEN ' | 12b OK: nenhuma policy de UPDATE/ALL nem outra no bucket fotos-entrega'
    ELSE ' | 12b FALHOU: ' || v_n || ' policy(s) a mais' END;

  RAISE EXCEPTION 'SONDA M50 (desfeita):%', r;
END
$$;
