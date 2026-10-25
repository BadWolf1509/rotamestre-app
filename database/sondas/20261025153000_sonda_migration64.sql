-- ============================================================================
-- Sonda transacional da Migration 64 (API sem privilégios de manutenção nas
-- tabelas)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 64 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os casos 1 a 5, 8 e 9
-- saem FALHOU (é o vermelho esperado); 6 e 7 saem OK nos dois momentos.
--
-- A sonda lê o catálogo (has_table_privilege, pg_default_acl) e não executa
-- TRUNCATE em tabela nenhuma. O único objeto que ela cria é uma tabela vazia
-- de nome único, para conferir os privilégios-padrão; o RAISE do fim a
-- desfaz. Rodar como `postgres` (dono das tabelas de public). Leia o
-- resultado na mensagem "SONDA M64 (desfeita): ...". Esperado: todas as
-- linhas com OK.
--
--   1. nenhuma tabela/visão de public com TRUNCATE para anon/authenticated
--   2. nem TRIGGER
--   3. nem REFERENCES
--   4. nem MAINTAIN
--   5. unidades, em particular: sem TRUNCATE e sem TRIGGER
--   6. o que o app usa segue concedido (SELECT/INSERT/UPDATE/DELETE de
--      authenticated nas tabelas principais; usuario_unidades só leitura)
--   7. service_role intocado (TRUNCATE em unidades)
--   8. privilégios-padrão do postgres em public sem os quatro para
--      anon/authenticated
--   9. tabela criada agora nasce sem os quatro e com SELECT
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_priv text;
  v_caso text;
  v_n int;
  v_lista text;
  v_tabela text;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1 a 4. nenhum dos quatro privilégios em public para anon/authenticated
  -- ---------------------------------------------------------------------------
  FOR v_caso, v_priv IN VALUES ('1', 'TRUNCATE'), ('2', 'TRIGGER'), ('3', 'REFERENCES'), ('4', 'MAINTAIN') LOOP
    SELECT count(*), string_agg(c.relname || '/' || g.papel, ', ' ORDER BY c.relname, g.papel)
      INTO v_n, v_lista
      FROM pg_class c
     CROSS JOIN (VALUES ('anon'), ('authenticated')) AS g(papel)
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
       AND has_table_privilege(g.papel, c.oid, v_priv);
    r := r || CASE WHEN v_n = 0
      THEN ' | ' || v_caso || ' OK: nenhuma tabela de public com ' || v_priv || ' para anon/authenticated'
      ELSE ' | ' || v_caso || ' FALHOU: ' || v_priv || ' em ' || v_n || ' (' || left(v_lista, 200) || ')' END;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- 5. unidades
  -- ---------------------------------------------------------------------------
  r := r || CASE WHEN NOT has_table_privilege('anon', 'public.unidades', 'TRUNCATE')
                  AND NOT has_table_privilege('authenticated', 'public.unidades', 'TRUNCATE')
                  AND NOT has_table_privilege('anon', 'public.unidades', 'TRIGGER')
                  AND NOT has_table_privilege('authenticated', 'public.unidades', 'TRIGGER')
    THEN ' | 5 OK: unidades sem TRUNCATE e TRIGGER para anon/authenticated'
    ELSE ' | 5 FALHOU: unidades ainda com TRUNCATE ou TRIGGER para a API' END;

  -- ---------------------------------------------------------------------------
  -- 6. o que o app usa segue concedido
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
   -- Por coluna basta (rotas e usuarios têm UPDATE por coluna; unidades pode
   -- passar a ter SELECT por coluna). DELETE só existe na tabela.
   WHERE NOT CASE WHEN t.priv = 'DELETE'
     THEN has_table_privilege('authenticated', ('public.' || t.tabela)::regclass, t.priv)
     ELSE has_any_column_privilege('authenticated', ('public.' || t.tabela)::regclass, t.priv) END;
  IF v_n = 0 AND NOT has_table_privilege('authenticated', 'public.usuario_unidades', 'INSERT')
     AND NOT has_table_privilege('authenticated', 'public.usuario_unidades', 'UPDATE')
     AND NOT has_table_privilege('authenticated', 'public.usuario_unidades', 'DELETE') THEN
    r := r || ' | 6 OK: SELECT/INSERT/UPDATE/DELETE do app seguem concedidos; usuario_unidades segue só leitura';
  ELSE
    r := r || ' | 6 FALHOU: faltam ' || v_n || ' (' || COALESCE(v_lista, 'usuario_unidades com escrita') || ')';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 7. service_role intocado
  -- ---------------------------------------------------------------------------
  r := r || CASE WHEN has_table_privilege('service_role', 'public.unidades', 'TRUNCATE')
    THEN ' | 7 OK: service_role mantém TRUNCATE em unidades'
    ELSE ' | 7 FALHOU: service_role perdeu TRUNCATE em unidades' END;

  -- ---------------------------------------------------------------------------
  -- 8. privilégios-padrão do postgres em public
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_n
    FROM pg_default_acl d
   CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE d.defaclrole = 'postgres'::regrole
     AND d.defaclnamespace = 'public'::regnamespace
     AND d.defaclobjtype = 'r'
     AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)
     AND a.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN');
  r := r || CASE WHEN v_n = 0
    THEN ' | 8 OK: padrão do postgres em public sem os quatro para anon/authenticated'
    ELSE ' | 8 FALHOU: padrão do postgres ainda concede ' || v_n || ' deles' END;

  -- ---------------------------------------------------------------------------
  -- 9. tabela criada agora
  -- ---------------------------------------------------------------------------
  v_tabela := 'sonda_m64_' || v_sufixo;
  EXECUTE format('CREATE TABLE public.%I (id integer)', v_tabela);
  SELECT count(*) INTO v_n
    FROM (VALUES ('anon'), ('authenticated')) AS g(papel)
   CROSS JOIN (VALUES ('TRUNCATE'), ('TRIGGER'), ('REFERENCES'), ('MAINTAIN')) AS p(priv)
   WHERE has_table_privilege(g.papel, ('public.' || quote_ident(v_tabela))::regclass, p.priv);
  r := r || CASE WHEN v_n = 0 AND has_table_privilege('authenticated', ('public.' || quote_ident(v_tabela))::regclass, 'SELECT')
    THEN ' | 9 OK: tabela nova nasce sem os quatro e com SELECT'
    ELSE ' | 9 FALHOU: tabela nova com ' || v_n || ' dos quatro (ou sem SELECT)' END;

  RAISE EXCEPTION 'SONDA M64 (desfeita):%', r;
END
$$;
