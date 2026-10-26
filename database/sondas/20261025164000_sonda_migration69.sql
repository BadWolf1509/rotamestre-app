-- ============================================================================
-- Sonda transacional da Migration 69 (privilégios-padrão da API: função nova
-- sem EXECUTE para PUBLIC/anon, e `anon` só com leitura nas tabelas)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 69 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os casos 1, 4, 5, 6, 7
-- e 9 saem FALHOU (é o vermelho esperado); 2, 3 e 8 saem OK nos dois momentos.
--
-- A sonda lê o catálogo (has_table_privilege, has_function_privilege,
-- pg_default_acl, proacl) e não grava em tabela nenhuma. Os únicos objetos
-- que ela cria são duas funções (em public e em extensions, sem CREATE
-- EXTENSION) e uma tabela vazia, de nome único, para conferir
-- os privilégios-padrão; o RAISE do fim as desfaz. Consulta de catálogo que
-- não encontra o objeto sai FALHOU em vez de abortar (to_regclass,
-- to_regprocedure).
--
-- Rodar como `postgres`: o privilégio-padrão da migration é `FOR ROLE
-- postgres`, então os casos 6, 7 e 9 só provam algo se as funções e a tabela forem
-- criadas pelo `postgres`. A CLI (`db query --linked`) roda como `postgres`
-- (conferido em 25/10/2026); se `current_user` for outro papel, os casos 6, 7
-- e 9 saem FALHOU dizendo qual. Leia o resultado na mensagem
-- "SONDA M69 (desfeita): ...". Esperado: todas as linhas com OK.
--
--   1. nenhuma tabela/visão de public com INSERT, UPDATE ou DELETE para anon
--   2. authenticated mantém o que o app usa (mesma lista do caso 6 da sonda
--      M64, por coluna; usuario_unidades só leitura)
--   3. anon mantém SELECT onde tinha (as doze tabelas medidas em 25/10)
--   4. pg_default_acl do postgres em public, tabelas: anon só com SELECT
--   5. pg_default_acl do postgres em public, funções: sem anon; e existe a
--      entrada global (defaclnamespace = 0) do postgres para funções, sem
--      PUBLIC
--   6. função criada agora em public: anon sem EXECUTE, proacl sem PUBLIC,
--      authenticated e service_role com EXECUTE
--   7. tabela criada agora em public: anon sem INSERT/UPDATE/DELETE e com
--      SELECT; authenticated com os quatro; service_role com INSERT
--   8. funções existentes intocadas: authenticated executa
--      finalizar_rota(uuid); anon ainda executa calcular_distancia (fora do
--      escopo, SECURITY INVOKER)
--   9. função criada agora em extensions (como faria uma extensão futura do
--      postgres): authenticated e service_role com EXECUTE; anon e PUBLIC sem
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_papel text := current_user;
  v_n int;
  v_m int;
  v_k int;
  v_lista text;
  v_funcao text;
  v_tabela text;
  v_oid oid;
  v_rel regclass;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1. nenhuma escrita para anon em public
  -- ---------------------------------------------------------------------------
  SELECT count(*), string_agg(c.relname || '/' || p.priv, ', ' ORDER BY c.relname, p.priv)
    INTO v_n, v_lista
    FROM pg_class c
   CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE')) AS p(priv)
   WHERE c.relnamespace = 'public'::regnamespace
     AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
     AND (has_table_privilege('anon', c.oid, p.priv)
          OR (p.priv <> 'DELETE' AND has_any_column_privilege('anon', c.oid, p.priv)));
  r := r || CASE WHEN v_n = 0
    THEN ' | 1 OK: nenhuma tabela de public com INSERT/UPDATE/DELETE para anon'
    ELSE ' | 1 FALHOU: anon escreve em ' || v_n || ' (' || left(v_lista, 200) || ')' END;

  -- ---------------------------------------------------------------------------
  -- 2. o que o app usa com sessão segue concedido a authenticated
  -- ---------------------------------------------------------------------------
  SELECT count(*), string_agg(t.tabela || '/' || t.priv, ', ')
    INTO v_n, v_lista
    FROM (VALUES
      ('incidentes', 'SELECT'), ('incidentes', 'INSERT'), ('incidentes', 'UPDATE'), ('incidentes', 'DELETE'),
      ('logs', 'SELECT'), ('logs', 'INSERT'),
      ('paradas', 'SELECT'), ('paradas', 'INSERT'), ('paradas', 'UPDATE'), ('paradas', 'DELETE'),
      ('rotas', 'SELECT'), ('rotas', 'INSERT'), ('rotas', 'UPDATE'), ('rotas', 'DELETE'),
      ('unidades', 'SELECT'), ('unidades', 'UPDATE'),
      ('usuarios', 'SELECT'), ('usuarios', 'UPDATE'),
      ('usuario_unidades', 'SELECT')
    ) AS t(tabela, priv)
   -- Por coluna basta (rotas e usuarios têm UPDATE por coluna). DELETE só
   -- existe na tabela. Tabela ausente conta como faltando.
   WHERE to_regclass('public.' || t.tabela) IS NULL
      OR NOT CASE WHEN t.priv = 'DELETE'
        THEN has_table_privilege('authenticated', to_regclass('public.' || t.tabela), t.priv)
        ELSE has_any_column_privilege('authenticated', to_regclass('public.' || t.tabela), t.priv) END;
  v_rel := to_regclass('public.usuario_unidades');
  IF v_n = 0 AND v_rel IS NOT NULL
     AND NOT has_table_privilege('authenticated', v_rel, 'INSERT')
     AND NOT has_table_privilege('authenticated', v_rel, 'UPDATE')
     AND NOT has_table_privilege('authenticated', v_rel, 'DELETE') THEN
    r := r || ' | 2 OK: SELECT/INSERT/UPDATE/DELETE do app seguem concedidos a authenticated; usuario_unidades segue só leitura';
  ELSE
    r := r || ' | 2 FALHOU: faltam ' || v_n || ' (' || COALESCE(v_lista, 'usuario_unidades ausente ou com escrita') || ')';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3. anon mantém SELECT onde tinha
  -- ---------------------------------------------------------------------------
  SELECT count(*), string_agg(t.tabela, ', ')
    INTO v_n, v_lista
    FROM (VALUES
      ('admin_logs'), ('incidentes'), ('logs'), ('motorista_locations'),
      ('notificacoes'), ('paradas'), ('plan_prices'), ('push_notification_logs'),
      ('rotas'), ('unidades'), ('usuario_unidades'), ('usuarios')
    ) AS t(tabela)
   WHERE to_regclass('public.' || t.tabela) IS NULL
      OR NOT has_any_column_privilege('anon', to_regclass('public.' || t.tabela), 'SELECT');
  r := r || CASE WHEN v_n = 0
    THEN ' | 3 OK: anon mantém SELECT nas tabelas em que tinha (rotas, usuarios, ...)'
    ELSE ' | 3 FALHOU: anon perdeu SELECT em ' || v_n || ' (' || v_lista || ')' END;

  -- ---------------------------------------------------------------------------
  -- 4. padrão do postgres em public, tabelas: anon só com SELECT
  -- ---------------------------------------------------------------------------
  SELECT count(*) FILTER (WHERE a.privilege_type <> 'SELECT'),
         count(*) FILTER (WHERE a.privilege_type = 'SELECT'),
         string_agg(a.privilege_type, ',' ORDER BY a.privilege_type)
    INTO v_n, v_m, v_lista
    FROM pg_default_acl d
   CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE d.defaclrole = 'postgres'::regrole
     AND d.defaclnamespace = 'public'::regnamespace
     AND d.defaclobjtype = 'r'
     AND a.grantee = 'anon'::regrole;
  r := r || CASE WHEN v_n = 0 AND v_m = 1
    THEN ' | 4 OK: padrão do postgres em public dá a anon só SELECT nas tabelas'
    ELSE ' | 4 FALHOU: padrão do postgres em public dá a anon ' || COALESCE(v_lista, 'nada') END;

  -- ---------------------------------------------------------------------------
  -- 5. padrão do postgres para funções: public sem anon; global sem PUBLIC
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_n
    FROM pg_default_acl d
   CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE d.defaclrole = 'postgres'::regrole
     AND d.defaclnamespace = 'public'::regnamespace
     AND d.defaclobjtype = 'f'
     AND a.grantee = 'anon'::regrole;
  SELECT count(*) INTO v_m
    FROM pg_default_acl d
   WHERE d.defaclrole = 'postgres'::regrole
     AND d.defaclnamespace = 0
     AND d.defaclobjtype = 'f'
     AND NOT EXISTS (SELECT 1 FROM aclexplode(d.defaclacl) a WHERE a.grantee = 0);
  r := r || CASE WHEN v_n = 0 AND v_m = 1
    THEN ' | 5 OK: padrão de funções do postgres sem anon em public e sem PUBLIC no global'
    ELSE ' | 5 FALHOU: anon no padrão de public = ' || v_n || '; entrada global sem PUBLIC = ' || v_m END;

  -- ---------------------------------------------------------------------------
  -- 6. função criada agora em public
  -- ---------------------------------------------------------------------------
  IF v_papel <> 'postgres' THEN
    r := r || ' | 6 FALHOU: sonda rodando como ' || v_papel || ', não postgres (o padrão é FOR ROLE postgres)';
  ELSE
    v_funcao := 'sonda_m69_' || v_sufixo;
    EXECUTE format('CREATE FUNCTION public.%I() RETURNS integer LANGUAGE sql AS %L', v_funcao, 'select 1');
    v_oid := to_regprocedure('public.' || quote_ident(v_funcao) || '()');
    SELECT count(*) INTO v_n
      FROM pg_proc p
     CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
     WHERE p.oid = v_oid AND a.grantee = 0;
    r := r || CASE WHEN v_oid IS NOT NULL
                    AND NOT has_function_privilege('anon', v_oid, 'EXECUTE')
                    AND v_n = 0
                    AND has_function_privilege('authenticated', v_oid, 'EXECUTE')
                    AND has_function_privilege('service_role', v_oid, 'EXECUTE')
      THEN ' | 6 OK: função nova sem EXECUTE para anon e PUBLIC, com EXECUTE para authenticated e service_role'
      ELSE ' | 6 FALHOU: função nova com proacl ' || COALESCE((SELECT p.proacl::text FROM pg_proc p WHERE p.oid = v_oid), 'nula (padrão embutido)') END;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 7. tabela criada agora em public
  -- ---------------------------------------------------------------------------
  IF v_papel <> 'postgres' THEN
    r := r || ' | 7 FALHOU: sonda rodando como ' || v_papel || ', não postgres (o padrão é FOR ROLE postgres)';
  ELSE
    v_tabela := 'sonda_m69_' || v_sufixo;
    EXECUTE format('CREATE TABLE public.%I (id integer)', v_tabela);
    v_rel := to_regclass('public.' || quote_ident(v_tabela));
    SELECT count(*) INTO v_n
      FROM (VALUES ('INSERT'), ('UPDATE'), ('DELETE')) AS p(priv)
     WHERE has_table_privilege('anon', v_rel, p.priv);
    SELECT count(*) INTO v_m
      FROM (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS p(priv)
     WHERE has_table_privilege('authenticated', v_rel, p.priv);
    r := r || CASE WHEN v_n = 0 AND v_m = 4 AND has_table_privilege('anon', v_rel, 'SELECT')
                    AND has_table_privilege('service_role', v_rel, 'INSERT')
      THEN ' | 7 OK: tabela nova dá a anon só SELECT, a authenticated os quatro e a service_role INSERT'
      ELSE ' | 7 FALHOU: tabela nova com ' || v_n || ' escrita(s) para anon, ' || v_m || ' de 4 para authenticated'
           || CASE WHEN has_table_privilege('service_role', v_rel, 'INSERT') THEN '' ELSE ', service_role sem INSERT' END END;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 8. funções existentes intocadas
  -- ---------------------------------------------------------------------------
  v_oid := to_regprocedure('public.finalizar_rota(uuid)');
  r := r || CASE WHEN v_oid IS NOT NULL
                  AND has_function_privilege('authenticated', v_oid, 'EXECUTE')
                  AND to_regprocedure('public.calcular_distancia(double precision, double precision, double precision, double precision)') IS NOT NULL
                  AND has_function_privilege('anon', to_regprocedure('public.calcular_distancia(double precision, double precision, double precision, double precision)'), 'EXECUTE')
    THEN ' | 8 OK: authenticated executa finalizar_rota(uuid) e anon segue executando calcular_distancia'
    ELSE ' | 8 FALHOU: ACL de função existente mudou (ou a função não foi encontrada)' END;

  -- ---------------------------------------------------------------------------
  -- 9. função criada agora em extensions (como faria uma extensão futura)
  -- ---------------------------------------------------------------------------
  IF v_papel <> 'postgres' THEN
    r := r || ' | 9 FALHOU: sonda rodando como ' || v_papel || ', não postgres (o padrão é FOR ROLE postgres)';
  ELSE
    v_funcao := 'sonda_m69_' || v_sufixo;
    EXECUTE format('CREATE FUNCTION extensions.%I() RETURNS integer LANGUAGE sql AS %L', v_funcao, 'select 1');
    v_oid := to_regprocedure('extensions.' || quote_ident(v_funcao) || '()');
    -- ACL efetiva: proacl nula equivale ao padrão embutido (dono + PUBLIC).
    SELECT count(*) FILTER (WHERE a.grantee = 'authenticated'::regrole),
           count(*) FILTER (WHERE a.grantee = 'service_role'::regrole),
           count(*) FILTER (WHERE a.grantee IN (0, 'anon'::regrole))
      INTO v_n, v_m, v_k
      FROM pg_proc p
     CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
     WHERE p.oid = v_oid AND a.privilege_type = 'EXECUTE';
    r := r || CASE WHEN v_oid IS NOT NULL AND v_n = 1 AND v_m = 1 AND v_k = 0
                    AND NOT has_function_privilege('anon', v_oid, 'EXECUTE')
      THEN ' | 9 OK: função nova em extensions com EXECUTE para authenticated e service_role, sem anon e PUBLIC'
      ELSE ' | 9 FALHOU: função nova em extensions com proacl ' || COALESCE((SELECT p.proacl::text FROM pg_proc p WHERE p.oid = v_oid), 'nula (padrão embutido)') END;
  END IF;

  RAISE EXCEPTION 'SONDA M69 (desfeita):%', r;
END
$$;
