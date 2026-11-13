-- ============================================================================
-- Sonda transacional da Migration 91 (aviso de cancelamento com tipo próprio)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 91 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, saem FALHOU os casos
-- 1, 5 e 6 (tipo antigo, linhas antigas não corrigidas, COMMENT antigo); os
-- outros já saem OK.
--
-- Cenário (não depende de dado real): lojas A e B; gestor GA, gestor ativo de
-- A; gestor GB, só de B; motoristas M1 (ativo em A) e M2 (perde o vínculo com
-- A depois de montado). As chamadas rodam como `authenticated` (SET LOCAL
-- ROLE + claims do JWT). O push enfileirado pelo gatilho de `notificacoes`
-- (pg_net) é desfeito com o resto. O bloco termina SEMPRE em RAISE EXCEPTION,
-- que desfaz tudo. Leia o resultado na mensagem
-- "SONDA M91 (desfeita): N OK | N FALHOU ..." (o detalhe sai antes num
-- RAISE NOTICE; a API corta mensagens de erro em ~1.200 caracteres).
--
--    1. GA cancela a rota pendente de M1 → 'cancelada'; 1 notificação para
--       M1, tipo rota_cancelada, "Rota cancelada pelo gestor", com a data da
--       rota e o nome da loja; nenhuma rota_nao_executada dessa rota
--    2. GA cancela de novo → 'ja_cancelada'; segue 1 notificação
--    3. GB (outra loja) cancela uma rota de A → 'sem_permissao'; nenhum aviso
--    4. GA cancela a rota de M2, que saiu da loja → 'cancelada', sem aviso
--       (criar_notificacao recusa; o aviso não desfaz a RPC)
--    5. linhas antigas: nenhuma notificação com o título do cancelamento
--       segue com tipo rota_nao_executada, e nenhuma rota_cancelada tem
--       outro título (a correção não pegou aviso de expiração)
--    6. catálogo: cancelar_rota DEFINER, search_path vazio, dona postgres,
--       sem EXECUTE de PUBLIC/anon, com EXECUTE de authenticated; corpo com
--       'rota_cancelada' e sem 'rota_nao_executada'; COMMENT da Migration 91
--    7. a expiração (expire_old_pending_routes) segue gravando
--       rota_nao_executada (só lida no catálogo; não é chamada)
--    8. o filtro do passo 2, sobre linhas plantadas: troca o cancelamento
--       antigo e poupa uma notificação de expiração
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();     -- loja A
  v_ub uuid := gen_random_uuid();     -- loja B
  v_ga uuid := gen_random_uuid();     -- gestor de A
  v_gb uuid := gen_random_uuid();     -- gestor só de B
  v_m1 uuid := gen_random_uuid();     -- ativo em A
  v_m2 uuid := gen_random_uuid();     -- perde o vínculo com A
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_r1 uuid := gen_random_uuid();     -- pendente de M1 (cancelar)
  v_r2 uuid := gen_random_uuid();     -- pendente de M1 (GB tenta)
  v_r3 uuid := gen_random_uuid();     -- pendente de M2 (sem vínculo)
  v_rotas uuid[];
  v_res text;
  v_status text;
  v_n int;
  v_n2 int;
  v_tipo text;
  v_msg text;
  v_ok_n int;
  v_falhou_n int;
  v_falhas text;
BEGIN
  v_rotas := ARRAY[v_r1, v_r2, v_r3];

  -- ---------------------------------------------------------------------------
  -- Cenário comum (como postgres)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_ga, 'sonda-m91-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gb, 'sonda-m91-gb-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m1, 'sonda-m91-m1-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m2, 'sonda-m91-m2-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M91 A', 'Sonda'),
    (v_ub, 'Sonda M91 B', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id, ativo) VALUES
    (v_ga, 'Sonda gestor A',     'sonda-m91-ga-' || v_sufixo || '@example.invalid', 'gestor',    v_ua, true),
    (v_gb, 'Sonda gestor B',     'sonda-m91-gb-' || v_sufixo || '@example.invalid', 'gestor',    v_ub, true),
    (v_m1, 'Sonda motorista M1', 'sonda-m91-m1-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true),
    (v_m2, 'Sonda motorista M2', 'sonda-m91-m2-' || v_sufixo || '@example.invalid', 'motorista', v_ua, true);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_ga, v_ua, 'gestor',    true, true),
    (v_gb, v_ub, 'gestor',    true, true),
    (v_m1, v_ua, 'motorista', true, true),
    (v_m2, v_ua, 'motorista', true, true);

  INSERT INTO public.rotas (id, unidade_id, motorista_id, status, data) VALUES
    (v_r1, v_ua, v_m1, 'pendente', v_hoje + 2),
    (v_r2, v_ua, v_m1, 'pendente', v_hoje + 3),
    (v_r3, v_ua, v_m2, 'pendente', v_hoje + 2);

  UPDATE public.usuario_unidades SET ativo = false WHERE usuario_id = v_m2 AND unidade_id = v_ua;

  -- ---------------------------------------------------------------------------
  -- 1. cancelar avisa M1 com o tipo rota_cancelada
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_r1);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_r1;
    SELECT count(*), max(tipo), max(mensagem) INTO v_n, v_tipo, v_msg
      FROM public.notificacoes
     WHERE rota_id = v_r1 AND usuario_id = v_m1 AND titulo = 'Rota cancelada pelo gestor';
    SELECT count(*) INTO v_n2 FROM public.notificacoes
     WHERE rota_id = v_r1 AND tipo = 'rota_nao_executada';
    r := r || CASE WHEN v_res = 'cancelada' AND v_status = 'cancelada' AND v_n = 1
                    AND v_tipo = 'rota_cancelada' AND v_n2 = 0
                    AND position(to_char(v_hoje + 2, 'DD/MM/YYYY') in v_msg) > 0
                    AND position('Sonda M91 A' in v_msg) > 0
      THEN ' | 1 OK: cancelada avisa M1 com rota_cancelada (data e loja)'
      ELSE ' | 1 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula')
           || ', avisos ' || v_n || ', tipo ' || coalesce(v_tipo, 'nulo')
           || ', rota_nao_executada ' || v_n2 || ', msg ' || coalesce(v_msg, 'nula') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 2. ja_cancelada não avisa de novo
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_r1);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT count(*) INTO v_n FROM public.notificacoes
     WHERE rota_id = v_r1 AND titulo = 'Rota cancelada pelo gestor';
    r := r || CASE WHEN v_res = 'ja_cancelada' AND v_n = 1
      THEN ' | 2 OK: ja_cancelada não avisa de novo'
      ELSE ' | 2 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', avisos ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 3. sem_permissao (gestor de outra loja) não cancela nem avisa
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gb, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_r2);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_r2;
    SELECT count(*) INTO v_n FROM public.notificacoes
     WHERE rota_id = v_r2 AND titulo = 'Rota cancelada pelo gestor';
    r := r || CASE WHEN v_res = 'sem_permissao' AND v_status = 'pendente' AND v_n = 0
      THEN ' | 3 OK: sem_permissao (outra loja) não cancela nem avisa'
      ELSE ' | 3 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula')
           || ', avisos ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 4. motorista que saiu da loja: cancela, sem aviso
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_res := public.cancelar_rota(v_r3);
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM public.rotas WHERE id = v_r3;
    SELECT count(*) INTO v_n FROM public.notificacoes WHERE rota_id = v_r3 AND usuario_id = v_m2;
    r := r || CASE WHEN v_res = 'cancelada' AND v_status = 'cancelada' AND v_n = 0
      THEN ' | 4 OK: M2 fora da loja: cancela sem aviso'
      ELSE ' | 4 FALHOU: resultado ' || coalesce(v_res, 'nulo') || ', rota ' || coalesce(v_status, 'nula')
           || ', avisos ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 4 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ---------------------------------------------------------------------------
  -- 5. linhas antigas corrigidas, e só elas
  -- ---------------------------------------------------------------------------
  BEGIN
    SELECT count(*) INTO v_n FROM public.notificacoes
     WHERE tipo = 'rota_nao_executada' AND titulo = 'Rota cancelada pelo gestor';
    SELECT count(*) INTO v_n2 FROM public.notificacoes
     WHERE tipo = 'rota_cancelada' AND titulo <> 'Rota cancelada pelo gestor';
    r := r || CASE WHEN v_n = 0 AND v_n2 = 0
      THEN ' | 5 OK: nenhum cancelamento com o tipo antigo; nenhuma expiração virou rota_cancelada'
      ELSE ' | 5 FALHOU: ' || v_n || ' cancelamento(s) com rota_nao_executada, '
           || v_n2 || ' rota_cancelada com outro título' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 8. o filtro do passo 2 pega o cancelamento antigo e poupa a expiração
  --     (linhas plantadas como postgres; o UPDATE é o da migration, restrito
  --     às linhas da sonda)
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, rota_id) VALUES
      (v_m1, 'rota_nao_executada', 'Rota cancelada pelo gestor', 'sonda M91: cancelamento antigo', v_r2),
      (v_m1, 'rota_nao_executada', '⚠️ Rota não executada',     'sonda M91: expiração',          v_r2);
    UPDATE public.notificacoes
       SET tipo = 'rota_cancelada'
     WHERE tipo = 'rota_nao_executada'
       AND titulo = 'Rota cancelada pelo gestor'
       AND rota_id = v_r2;
    SELECT count(*) FILTER (WHERE titulo = 'Rota cancelada pelo gestor' AND tipo = 'rota_cancelada'),
           count(*) FILTER (WHERE titulo = '⚠️ Rota não executada' AND tipo = 'rota_nao_executada')
      INTO v_n, v_n2
      FROM public.notificacoes WHERE rota_id = v_r2 AND usuario_id = v_m1;
    r := r || CASE WHEN v_n = 1 AND v_n2 = 1
      THEN ' | 8 OK: o filtro troca o cancelamento antigo e poupa a expiração'
      ELSE ' | 8 FALHOU: cancelamentos trocados ' || v_n || ', expirações intactas ' || v_n2 END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 6. catálogo de cancelar_rota
  -- ---------------------------------------------------------------------------
  BEGIN
    SELECT count(*) INTO v_n
      FROM pg_proc p
     WHERE p.oid = to_regprocedure('public.cancelar_rota(uuid)')
       AND p.prosecdef
       AND p.proconfig = ARRAY['search_path=""']
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.proacl IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
       AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
       AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
       AND position('''rota_cancelada''' in p.prosrc) > 0
       AND position('rota_nao_executada' in p.prosrc) = 0
       AND obj_description(p.oid, 'pg_proc') LIKE 'Migration 91%';
    r := r || CASE WHEN v_n = 1
      THEN ' | 6 OK: catálogo (DEFINER, search_path vazio, dono, ACL, tipo novo, COMMENT)'
      ELSE ' | 6 FALHOU: cancelar_rota fora do esperado' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- 7. a expiração segue com rota_nao_executada
  -- ---------------------------------------------------------------------------
  BEGIN
    SELECT count(*) INTO v_n FROM pg_proc p
     WHERE p.proname = 'expire_old_pending_routes'
       AND p.pronamespace = 'public'::regnamespace
       AND position('rota_nao_executada' in p.prosrc) > 0
       AND position('rota_cancelada' in p.prosrc) = 0;
    r := r || CASE WHEN v_n >= 1
      THEN ' | 7 OK: expire_old_pending_routes segue gravando rota_nao_executada'
      ELSE ' | 7 FALHOU: expire_old_pending_routes sem rota_nao_executada' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- Sanidade: nenhum aviso de cancelamento escapou para fora das rotas da sonda.
  SELECT count(*) INTO v_n FROM public.notificacoes
   WHERE usuario_id IN (v_m1, v_m2)
     AND titulo = 'Rota cancelada pelo gestor'
     AND rota_id <> ALL (v_rotas);
  IF v_n <> 0 THEN
    r := r || ' | 9 FALHOU: ' || v_n || ' aviso(s) fora das rotas da sonda';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Resumo (o detalhe vai no NOTICE; a EXCEPTION desfaz tudo)
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_ok_n FROM regexp_matches(r, '\| \d+ OK:', 'g');
  SELECT count(*) INTO v_falhou_n FROM regexp_matches(r, '\| \d+ FALHOU', 'g');
  SELECT coalesce(string_agg(x[1], ' '), '') INTO v_falhas
    FROM regexp_matches(r, '(\| \d+ FALHOU[^|]*)', 'g') AS x;

  RAISE NOTICE 'SONDA M91 detalhe:%', r;
  RAISE EXCEPTION 'SONDA M91 (desfeita): % OK | % FALHOU %', v_ok_n, v_falhou_n, v_falhas;
END
$$;
