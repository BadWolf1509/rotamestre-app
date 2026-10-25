-- ============================================================================
-- Sonda transacional da Migration 56 (rodar DEPOIS de aplicá-la, no SQL Editor)
-- ============================================================================
-- Banco único = produção. O bloco monta o cenário dentro da transação: loja A
-- com gestor GA, loja C com gestor GC, motorista M (com rota em A e dois
-- incidentes, um com rota e um sem) e motorista M2 (um incidente). Depois
-- EXCLUI o usuário M de auth.users, como faz o `delete-account`.
--
-- Tem DELETE (de usuário que a própria sonda cria): roda no SQL Editor, não
-- pelo MCP. Termina SEMPRE em RAISE EXCEPTION, que desfaz tudo. Leia
-- "SONDA M56 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. catálogo: motorista_id aceita NULL e a FK é ON DELETE SET NULL
--   2. excluir o motorista NÃO falha (o gatilho aceita o SET NULL)
--   3. os dois incidentes continuam, com motorista_id NULL
--   4. a loja e a rota do incidente ficam (só o vínculo da pessoa some)
--   5. o incidente de M2 não mudou
--   6. a rota de M continua, sem motorista (comportamento que já existia)
--   7. o gestor de A ainda VÊ os dois incidentes anonimizados
--   8. o gestor de C não vê nenhum
--   9. o gestor de A ainda altera o status de incidente anonimizado
--  10. INSERT com motorista_id NULL é recusado (23502)
--  11. um motorista não reporta em nome de NULL (policy de INSERT)
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_ua uuid := gen_random_uuid();
  v_uc uuid := gen_random_uuid();
  v_ga uuid := gen_random_uuid();
  v_gc uuid := gen_random_uuid();
  v_m uuid := gen_random_uuid();
  v_m2 uuid := gen_random_uuid();
  v_rota uuid := gen_random_uuid();
  v_inc_rota uuid := gen_random_uuid();
  v_inc_sem uuid := gen_random_uuid();
  v_inc_m2 uuid := gen_random_uuid();
  v_nulo boolean;
  v_fk text;
  v_n int;
  v_mot uuid;
  v_loja uuid;
  v_rt uuid;
BEGIN
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_ga, 'sonda-m56-ga-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_gc, 'sonda-m56-gc-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m,  'sonda-m56-m-'  || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_m2, 'sonda-m56-m2-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES
    (v_ua, 'Sonda M56 A', 'Sonda'),
    (v_uc, 'Sonda M56 C', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id) VALUES
    (v_ga, 'Sonda gestor A', 'sonda-m56-ga-' || v_sufixo || '@example.invalid', 'gestor', v_ua),
    (v_gc, 'Sonda gestor C', 'sonda-m56-gc-' || v_sufixo || '@example.invalid', 'gestor', v_uc),
    (v_m,  'Sonda motorista', 'sonda-m56-m-' || v_sufixo || '@example.invalid', 'motorista', v_ua),
    (v_m2, 'Sonda motorista 2', 'sonda-m56-m2-' || v_sufixo || '@example.invalid', 'motorista', v_ua);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_ga, v_ua, 'gestor', true, true),
    (v_gc, v_uc, 'gestor', true, true),
    (v_m,  v_ua, 'motorista', true, false),
    (v_m2, v_ua, 'motorista', true, false);

  INSERT INTO public.rotas (id, unidade_id, motorista_id) VALUES (v_rota, v_ua, v_m);

  INSERT INTO public.incidentes (id, motorista_id, rota_id, categoria, descricao, endereco, status) VALUES
    (v_inc_rota, v_m,  v_rota, 'other', 'sonda m56 com rota', 'sonda', 'aberto'),
    (v_inc_sem,  v_m,  NULL,   'other', 'sonda m56 sem rota', 'sonda', 'aberto'),
    (v_inc_m2,   v_m2, NULL,   'other', 'sonda m56 do m2',    'sonda', 'aberto');

  -- 1. catálogo
  SELECT (is_nullable = 'YES') INTO v_nulo FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'incidentes' AND column_name = 'motorista_id';
  SELECT pg_get_constraintdef(oid) INTO v_fk FROM pg_constraint
   WHERE conname = 'incidentes_motorista_id_fkey' AND conrelid = 'public.incidentes'::regclass;
  r := r || CASE WHEN v_nulo AND v_fk ILIKE '%ON DELETE SET NULL%'
    THEN ' | 1 OK: coluna nullable e FK SET NULL'
    ELSE ' | 1 FALHOU: nullable=' || COALESCE(v_nulo::text, 'NULL') || ' fk=' || COALESCE(v_fk, 'NULL') END;

  -- 2. exclusão do motorista (o que o delete-account faz)
  BEGIN
    DELETE FROM auth.users WHERE id = v_m;
    r := r || ' | 2 OK: excluir o motorista não falhou';
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 2 FALHOU: excluir o motorista falhou (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- 3-4. os incidentes ficam, anonimizados, com loja e rota
  SELECT count(*) INTO v_n FROM public.incidentes
   WHERE id IN (v_inc_rota, v_inc_sem) AND motorista_id IS NULL;
  r := r || CASE WHEN v_n = 2
    THEN ' | 3 OK: os 2 incidentes continuam, com motorista_id NULL'
    ELSE ' | 3 FALHOU: ' || v_n || ' de 2 anonimizados (apagados pelo CASCADE?)' END;

  SELECT unidade_id, rota_id INTO v_loja, v_rt FROM public.incidentes WHERE id = v_inc_rota;
  r := r || CASE WHEN v_loja = v_ua AND v_rt = v_rota
    THEN ' | 4 OK: loja e rota preservadas'
    ELSE ' | 4 FALHOU: loja=' || COALESCE(v_loja::text, 'NULL') || ' rota=' || COALESCE(v_rt::text, 'NULL') END;

  -- 5. o de M2 não mudou
  SELECT motorista_id INTO v_mot FROM public.incidentes WHERE id = v_inc_m2;
  r := r || CASE WHEN v_mot = v_m2
    THEN ' | 5 OK: incidente de M2 intacto'
    ELSE ' | 5 FALHOU: motorista_id=' || COALESCE(v_mot::text, 'NULL') END;

  -- 6. a rota fica sem motorista
  SELECT motorista_id INTO v_mot FROM public.rotas WHERE id = v_rota;
  r := r || CASE WHEN FOUND AND v_mot IS NULL
    THEN ' | 6 OK: rota continua, sem motorista'
    ELSE ' | 6 FALHOU: rota ausente ou ainda com motorista' END;

  -- 7 e 9. gestor de A (como authenticated)
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_ga, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.incidentes WHERE id IN (v_inc_rota, v_inc_sem);
    r := r || CASE WHEN v_n = 2
      THEN ' | 7 OK: gestor de A vê os 2 anonimizados'
      ELSE ' | 7 FALHOU: gestor de A vê ' || v_n || ' de 2' END;

    UPDATE public.incidentes SET status = 'em_analise' WHERE id = v_inc_sem;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 9 OK: gestor de A altera o status do anonimizado'
      ELSE ' | 9 FALHOU: UPDATE afetou ' || v_n || ' linhas' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 7/9 FALHOU: erro inesperado (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- 8. gestor de C não vê
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_gc, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.incidentes WHERE id IN (v_inc_rota, v_inc_sem);
    r := r || CASE WHEN v_n = 0
      THEN ' | 8 OK: gestor de C não vê nenhum'
      ELSE ' | 8 FALHOU: gestor de C vê ' || v_n END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- 10. INSERT sem motorista é recusado pelo gatilho
  BEGIN
    INSERT INTO public.incidentes (motorista_id, categoria, descricao, endereco, status)
      VALUES (NULL, 'other', 'sonda m56 sem dono', 'sonda', 'aberto');
    r := r || ' | 10 FALHOU: INSERT com motorista NULL passou';
  EXCEPTION
    WHEN not_null_violation THEN
      r := r || ' | 10 OK: INSERT sem motorista recusado (' || SQLSTATE || ')';
    WHEN OTHERS THEN
      r := r || ' | 10 FALHOU: recusou por outro motivo (' || SQLSTATE || ' ' || SQLERRM || ')';
  END;

  -- 11. M2 não reporta em nome de NULL (a policy exige motorista_id = auth.uid())
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.incidentes (motorista_id, categoria, descricao, endereco, status)
      VALUES (NULL, 'other', 'sonda m56 nulo', 'sonda', 'aberto');
    r := r || ' | 11 FALHOU: M2 inseriu com motorista NULL';
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 11 OK: M2 recusado (' || SQLSTATE || ')';
  END;
  RESET ROLE;

  RAISE EXCEPTION 'SONDA M56 (desfeita):%', r;
END
$$;
