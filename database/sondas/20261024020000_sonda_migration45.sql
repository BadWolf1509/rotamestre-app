-- ============================================================================
-- Sonda transacional da Migration 45 (rodar DEPOIS de aplicá-la, no SQL Editor)
-- ============================================================================
-- Banco único = produção, sem pgTAP. O bloco monta um cenário próprio dentro da
-- transação (não depende de dado real): uma loja, o motorista M e o gestor G
-- dela (G enxerga e alcança pela RLS a linha de M em `usuarios`). Tudo como
-- `authenticated` (SET LOCAL ROLE + claims do JWT), como o app faz.
--
-- Tem DELETE só de tokens que a própria sonda cria (o logout pelo DELETE do
-- dono, e a tentativa de G apagar o de M): por isso roda no SQL Editor, não
-- pelo MCP. Termina SEMPRE em RAISE EXCEPTION, que desfaz tudo. Leia
-- "SONDA M45 (desfeita): ...". Esperado: todas as linhas com OK (o 9 é INFO).
--
--   1. M registra pela RPC → linha (token, M) em push_tokens; coluna NULL
--   2. M vê o próprio token
--   3. G (mesma loja) não vê o token de M: nem em push_tokens, nem na coluna
--   4. G não insere nem altera em push_tokens (sem grant)
--   5. G não apaga o token de M (a RLS filtra: 0 linhas)
--   6. versão antiga: M grava por UPDATE direto em usuarios → vai para
--      push_tokens e a coluna fica NULL
--   7. G grava token na linha de M por UPDATE direto → EXIGE 42501 (a RLS
--      deixa o gestor alcançar a linha; quem recusa é o gatilho), nada gravado
--   8. G registra pela RPC o token do aparelho de M (o aparelho passou a G)
--      → o token troca de dono; M o perde
--   9. INFO: logout do 1.14.3 (UPDATE ... WHERE push_token = token) não casa
--      linha nenhuma; o token de M continua
--  10. logout novo: M apaga o próprio token de push_tokens (1 linha)
--  11. limite: M registra 7 aparelhos → ficam exatamente os lotes 3 a 7
--  12. RPC sem auth.uid() → 42501; formato inválido → 22023 (RPC e UPDATE)
--  13. anon não lê push_tokens nem executa a RPC
--   A. authenticated sem EXECUTE em gravar_push_token (A1) e na função do
--      gatilho (A2); com EXECUTE e sessão de M, o helper recusa gravar para
--      G (A3) → 42501
--   B. o próprio usuário segue atualizando ultimo_login, nome, telefone,
--      foto_url, primeira_senha, unidade_id e updated_at
--   C. UPDATE de id (C1) e de created_at (C2) → 42501
--   D. o gestor da loja edita nome, telefone e e-mail do motorista
--   E. service_role grava token (formato ExpoPushToken) na linha de M → vai
--      para push_tokens e a coluna fica NULL
--   F. RPC de conta sem linha em usuarios → 42501
--  14. M não reativa a própria conta (UPDATE de `ativo` sem grant)
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_u uuid := gen_random_uuid();      -- loja
  v_m uuid := gen_random_uuid();      -- motorista
  v_g uuid := gen_random_uuid();      -- gestor da mesma loja
  v_tok_m text;
  v_tok_m2 text;
  v_tok_g text;
  v_tok_e text;
  v_sem uuid := gen_random_uuid();    -- conta no Auth sem linha em usuarios
  v_restantes text[];
  v_esperados text[];
  v_dono uuid;
  v_col text;
  v_n int;
  i int;
BEGIN
  v_tok_m := 'ExponentPushToken[sonda-m45-m-' || v_sufixo || ']';
  v_tok_m2 := 'ExponentPushToken[sonda-m45-m2-' || v_sufixo || ']';
  v_tok_g := 'ExponentPushToken[sonda-m45-g-' || v_sufixo || ']';
  v_tok_e := 'ExpoPushToken[sonda-m45-e-' || v_sufixo || ']';

  -- ---------------------------------------------------------------------------
  -- Cenário (como postgres)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (v_m, 'sonda-m45-m-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_g, 'sonda-m45-g-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated'),
    (v_sem, 'sonda-m45-sem-' || v_sufixo || '@example.invalid', 'authenticated', 'authenticated');

  INSERT INTO public.unidades (id, nome, cidade) VALUES (v_u, 'Sonda M45', 'Sonda');

  INSERT INTO public.usuarios (id, nome, email, papel, unidade_id) VALUES
    (v_m, 'Sonda motorista', 'sonda-m45-m-' || v_sufixo || '@example.invalid', 'motorista', v_u),
    (v_g, 'Sonda gestor', 'sonda-m45-g-' || v_sufixo || '@example.invalid', 'gestor', v_u);

  INSERT INTO public.usuario_unidades (usuario_id, unidade_id, papel, ativo, is_principal) VALUES
    (v_m, v_u, 'motorista', true, true),
    (v_g, v_u, 'gestor', true, true);

  -- ---------------------------------------------------------------------------
  -- 1-2. M registra pela RPC e vê o próprio token
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.registrar_push_token(v_tok_m);
    SELECT count(*) INTO v_n FROM public.push_tokens WHERE token = v_tok_m;
    r := r || CASE WHEN v_n = 1
      THEN ' | 2 OK: M vê o próprio token'
      ELSE ' | 2 FALHOU: M não vê o próprio token (' || v_n || ')' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 1-2 FALHOU: M não registrou (' || SQLERRM || ')';
  END;
  RESET ROLE;

  SELECT usuario_id INTO v_dono FROM public.push_tokens WHERE token = v_tok_m;
  SELECT push_token INTO v_col FROM public.usuarios WHERE id = v_m;
  r := r || CASE WHEN v_dono = v_m AND v_col IS NULL
    THEN ' | 1 OK: RPC gravou (token, M) em push_tokens; coluna NULL'
    ELSE ' | 1 FALHOU: dono=' || COALESCE(v_dono::text, 'NULL')
         || ' coluna=' || COALESCE(v_col, 'NULL') END;

  -- ---------------------------------------------------------------------------
  -- 3-5. G, da mesma loja, não vê, não escreve, não apaga
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.push_tokens WHERE usuario_id = v_m;
    SELECT push_token INTO v_col FROM public.usuarios WHERE id = v_m;
    r := r || CASE WHEN v_n = 0 AND v_col IS NULL
      THEN ' | 3 OK: G não vê o token de M (tabela 0, coluna NULL)'
      ELSE ' | 3 FALHOU: G vê ' || v_n || ' token(s); coluna=' || COALESCE(v_col, 'NULL') END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 3 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.push_tokens (token, usuario_id) VALUES (v_tok_g, v_g);
    r := r || ' | 4a FALHOU: G inseriu em push_tokens';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | 4a OK: G não insere (42501)';
    WHEN OTHERS THEN r := r || ' | 4a FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.push_tokens SET usuario_id = v_g WHERE token = v_tok_m;
    r := r || ' | 4b FALHOU: G executou UPDATE em push_tokens';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | 4b OK: G não altera (42501)';
    WHEN OTHERS THEN r := r || ' | 4b FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.push_tokens WHERE token = v_tok_m;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 5 OK: G não apaga o token de M (0 linhas)'
      ELSE ' | 5 FALHOU: G apagou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 5 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 6. Versão antiga: UPDATE direto do próprio token
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.usuarios SET push_token = v_tok_m2 WHERE id = v_m;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 6 FALHOU: UPDATE direto do próprio token recusado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  SELECT usuario_id INTO v_dono FROM public.push_tokens WHERE token = v_tok_m2;
  SELECT push_token INTO v_col FROM public.usuarios WHERE id = v_m;
  r := r || CASE WHEN v_dono = v_m AND v_col IS NULL
    THEN ' | 6 OK: UPDATE direto levado para push_tokens; coluna NULL'
    ELSE ' | 6 FALHOU: dono=' || COALESCE(v_dono::text, 'NULL')
         || ' coluna=' || COALESCE(v_col, 'NULL') END;

  -- ---------------------------------------------------------------------------
  -- 7. G grava token na linha de M por UPDATE direto
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.usuarios SET push_token = v_tok_g WHERE id = v_m;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    -- A RLS de UPDATE deixa o gestor alcançar a linha do motorista da loja:
    -- quem tem de recusar é o gatilho. 0 linhas aqui seria cenário errado.
    r := r || ' | 7 FALHOU: sem 42501 (' || v_n || ' linha(s))';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | 7 OK: G recusado (42501)';
    WHEN OTHERS THEN r := r || ' | 7 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  SELECT count(*) INTO v_n FROM public.push_tokens WHERE token = v_tok_g;
  IF v_n <> 0 THEN
    r := r || ' | 7 FALHOU: o token de G foi parar em push_tokens';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 8. O aparelho passa a G: RPC troca o dono
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.registrar_push_token(v_tok_m);
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 8 FALHOU: RPC de G recusada (' || SQLERRM || ')';
  END;
  RESET ROLE;

  SELECT usuario_id INTO v_dono FROM public.push_tokens WHERE token = v_tok_m;
  r := r || CASE WHEN v_dono = v_g
    THEN ' | 8 OK: o token trocou de dono (M → G)'
    ELSE ' | 8 FALHOU: dono=' || COALESCE(v_dono::text, 'NULL') END;

  -- ---------------------------------------------------------------------------
  -- 9. INFO: logout do 1.14.3
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.usuarios SET push_token = NULL
     WHERE id = v_m AND push_token = v_tok_m2;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || ' | 9 INFO: logout do 1.14.3 casou ' || v_n || ' linha(s)';
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 9 FALHOU: logout do 1.14.3 deu erro (' || SQLERRM || ')';
  END;
  RESET ROLE;

  SELECT count(*) INTO v_n FROM public.push_tokens WHERE token = v_tok_m2;
  r := r || ' | 9 INFO: token de M depois do logout antigo: ' || v_n;

  -- ---------------------------------------------------------------------------
  -- 10. Logout novo: M apaga o próprio token
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.push_tokens WHERE token = v_tok_m2;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | 10 OK: M apagou o próprio token (1 linha)'
      ELSE ' | 10 FALHOU: M apagou ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 10 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 11. Até 5 aparelhos por conta
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    FOR i IN 1..7 LOOP
      PERFORM public.registrar_push_token(
        'ExponentPushToken[sonda-m45-lote-' || i || '-' || v_sufixo || ']');
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | 11 FALHOU: registro em lote recusado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- Ficam exatamente os 5 mais recentes (lotes 3 a 7), não só 5 quaisquer.
  SELECT array_agg(token ORDER BY token) INTO v_restantes FROM public.push_tokens WHERE usuario_id = v_m;
  SELECT array_agg(t ORDER BY t) INTO v_esperados
    FROM (SELECT 'ExponentPushToken[sonda-m45-lote-' || g || '-' || v_sufixo || ']' AS t
            FROM generate_series(3, 7) AS g) e;
  r := r || CASE WHEN v_restantes IS NOT DISTINCT FROM v_esperados
    THEN ' | 11 OK: 7 registros, ficam os lotes 3 a 7'
    ELSE ' | 11 FALHOU: ficaram ' || COALESCE(array_length(v_restantes, 1), 0)
         || ' (esperado: lotes 3 a 7)' END;

  -- ---------------------------------------------------------------------------
  -- 12. Sem sessão e formato inválido
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM public.registrar_push_token(v_tok_g);
    r := r || ' | 12a FALHOU: RPC aceitou sem auth.uid()';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | 12a OK: RPC sem auth.uid() → 42501';
    WHEN OTHERS THEN r := r || ' | 12a FALHOU: erro inesperado (' || SQLERRM || ')';
  END;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.registrar_push_token('qualquer-coisa');
    r := r || ' | 12b FALHOU: RPC aceitou token inválido';
  EXCEPTION
    WHEN invalid_parameter_value THEN r := r || ' | 12b OK: RPC com token inválido → 22023';
    WHEN OTHERS THEN r := r || ' | 12b FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.usuarios SET push_token = 'qualquer-coisa' WHERE id = v_m;
    r := r || ' | 12c FALHOU: UPDATE direto aceitou token inválido';
  EXCEPTION
    WHEN invalid_parameter_value THEN r := r || ' | 12c OK: UPDATE com token inválido → 22023';
    WHEN OTHERS THEN r := r || ' | 12c FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 13. anon
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', '', true);
    SET LOCAL ROLE anon;
    SELECT count(*) INTO v_n FROM public.push_tokens;
    r := r || ' | 13a FALHOU: anon leu push_tokens (' || v_n || ')';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | 13a OK: anon não lê push_tokens';
    WHEN OTHERS THEN r := r || ' | 13a FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    SET LOCAL ROLE anon;
    PERFORM public.registrar_push_token(v_tok_g);
    r := r || ' | 13b FALHOU: anon executou a RPC';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | 13b OK: anon sem EXECUTE';
    WHEN OTHERS THEN r := r || ' | 13b FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- A. As funções internas não abrem porta
  -- ---------------------------------------------------------------------------
  -- A1. authenticated chama gravar_push_token para outra conta: sem EXECUTE.
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.gravar_push_token(v_g, v_tok_g);
    r := r || ' | A1 FALHOU: authenticated executou gravar_push_token';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | A1 OK: authenticated sem EXECUTE em gravar_push_token (42501)';
    WHEN OTHERS THEN r := r || ' | A1 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- A2. authenticated chama a função do gatilho direto: sem EXECUTE.
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.mover_push_token_para_tabela();
    r := r || ' | A2 FALHOU: authenticated executou mover_push_token_para_tabela';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | A2 OK: authenticated sem EXECUTE em mover_push_token_para_tabela (42501)';
    WHEN OTHERS THEN r := r || ' | A2 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- A3. Mesmo com EXECUTE (aqui como postgres), com sessão de M não grava
  -- para G: a checagem de auth.uid() dentro do helper.
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    PERFORM public.gravar_push_token(v_g, v_tok_g);
    r := r || ' | A3 FALHOU: helper gravou para outra conta com sessão de M';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | A3 OK: helper recusa outra conta com sessão (42501)';
    WHEN OTHERS THEN r := r || ' | A3 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;

  -- ---------------------------------------------------------------------------
  -- B. UPDATEs legítimos do próprio usuário seguem funcionando
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.usuarios
       SET ultimo_login = now(),
           nome = 'Sonda motorista (B)',
           telefone = '83' || lpad((floor(random() * 1e9))::bigint::text, 9, '0'),
           foto_url = 'perfis/sonda-m45-' || v_sufixo || '.jpg',
           primeira_senha = false,
           unidade_id = v_u,
           updated_at = now()
     WHERE id = v_m;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | B OK: o próprio usuário atualiza ultimo_login, nome, telefone, foto_url, primeira_senha, unidade_id e updated_at'
      ELSE ' | B FALHOU: ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | B FALHOU: UPDATE legítimo recusado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- C. id e created_at não se alteram pela API
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.usuarios SET id = gen_random_uuid() WHERE id = v_m;
    r := r || ' | C1 FALHOU: UPDATE de id aceito';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | C1 OK: UPDATE de id recusado (42501)';
    WHEN OTHERS THEN r := r || ' | C1 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.usuarios SET created_at = now() - interval '1 year' WHERE id = v_m;
    r := r || ' | C2 FALHOU: UPDATE de created_at aceito';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | C2 OK: UPDATE de created_at recusado (42501)';
    WHEN OTHERS THEN r := r || ' | C2 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- D. O gestor da loja edita nome, telefone e e-mail do motorista
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_g, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.usuarios
       SET nome = 'Sonda motorista (D)',
           telefone = '83' || lpad((floor(random() * 1e9))::bigint::text, 9, '0'),
           email = 'sonda-m45-d-' || v_sufixo || '@example.invalid'
     WHERE id = v_m;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 1
      THEN ' | D OK: gestor atualiza nome, telefone e e-mail do motorista'
      ELSE ' | D FALHOU: ' || v_n || ' linha(s)' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | D FALHOU: edição do gestor recusada (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- E. service_role grava token na linha de M: vai para push_tokens
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('role', 'service_role')::text, true);
    SET LOCAL ROLE service_role;
    UPDATE public.usuarios SET push_token = v_tok_e WHERE id = v_m;
  EXCEPTION WHEN OTHERS THEN
    r := r || ' | E FALHOU: UPDATE do service_role recusado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  SELECT usuario_id INTO v_dono FROM public.push_tokens WHERE token = v_tok_e;
  SELECT push_token INTO v_col FROM public.usuarios WHERE id = v_m;
  r := r || CASE WHEN v_dono = v_m AND v_col IS NULL
    THEN ' | E OK: token do service_role (ExpoPushToken) movido para push_tokens; coluna NULL'
    ELSE ' | E FALHOU: dono=' || COALESCE(v_dono::text, 'NULL')
         || ' coluna=' || COALESCE(v_col, 'NULL') END;

  -- ---------------------------------------------------------------------------
  -- F. Conta sem linha em usuarios: a RPC recusa
  -- ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_sem, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.registrar_push_token(v_tok_g);
    r := r || ' | F FALHOU: RPC aceitou conta sem perfil';
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | F OK: RPC de conta sem perfil → 42501';
    WHEN OTHERS THEN r := r || ' | F FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  -- ---------------------------------------------------------------------------
  -- 14. M não se reativa (UPDATE de `ativo` sem grant)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.usuarios SET ativo = false WHERE id = v_m;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.usuarios SET ativo = true WHERE id = v_m;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r := r || CASE WHEN v_n = 0
      THEN ' | 14 OK: M desativado não alcança a própria linha (0 linhas)'
      ELSE ' | 14 FALHOU: M se reativou' END;
  EXCEPTION
    WHEN insufficient_privilege THEN r := r || ' | 14 OK: M não se reativa (42501)';
    WHEN OTHERS THEN r := r || ' | 14 FALHOU: erro inesperado (' || SQLERRM || ')';
  END;
  RESET ROLE;

  RAISE EXCEPTION 'SONDA M45 (desfeita):%', r;
END
$$;
