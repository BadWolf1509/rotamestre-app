-- ============================================================================
-- Sonda transacional da Migration 74 (sequências de public sem privilégio
-- para `anon`)
-- ============================================================================
-- Banco único = produção, sem pgTAP. Rodar com a Migration 74 já valendo na
-- mesma sessão: depois de aplicá-la, ou, para conferir antes, na MESMA
-- execução que o corpo da migration (sem o BEGIN/COMMIT dela), para que o
-- RAISE do fim desfaça as duas coisas. Sem a migration, os casos 1, 2 e 3
-- saem FALHOU (é o vermelho esperado); 4 e 5 saem OK nos dois momentos.
--
-- A sonda lê o catálogo (pg_default_acl, has_sequence_privilege) e não grava
-- em tabela nenhuma. Os únicos objetos que ela cria são uma sequência e uma
-- tabela com coluna serial, de nome único, para conferir os privilégios-padrão;
-- o RAISE do fim os desfaz.
--
-- Rodar como `postgres`: o privilégio-padrão da migration é `FOR ROLE
-- postgres`, então os casos 2 e 3 só provam algo se os objetos forem criados
-- pelo `postgres`. A CLI (`db query --linked`) roda como `postgres`. Leia o
-- resultado na mensagem "SONDA M74 (desfeita): ...". Esperado: todas as
-- linhas com OK.
--
--   1. pg_default_acl do postgres em public, sequências (`S`): sem `anon`
--   2. sequência criada agora em public: `anon` sem USAGE, SELECT e UPDATE;
--      `authenticated` e `service_role` com USAGE
--   3. tabela nova com coluna serial: `anon` sem USAGE na sequência dela
--   4. nenhuma sequência existente de public com privilégio de `anon`
--      (conferido antes de criar os objetos da sonda)
--   5. current_user = 'postgres' (pré-condição dos casos 2 e 3)
-- ============================================================================
DO $$
DECLARE
  r text := '';
  v_sufixo text := replace(gen_random_uuid()::text, '-', '');
  v_papel text := current_user;
  v_n int;
  v_m int;
  v_lista text;
  v_antes text;
  v_seq regclass;
  v_serial regclass;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 4 (medido primeiro, antes de a sonda criar sequências). Aparece na posição 4.
  -- ---------------------------------------------------------------------------
  SELECT count(*), string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO v_n, v_lista
    FROM pg_class c
   CROSS JOIN (VALUES ('SELECT'), ('UPDATE'), ('USAGE')) AS p(priv)
   WHERE c.relnamespace = 'public'::regnamespace
     AND c.relkind = 'S'
     AND has_sequence_privilege('anon', c.oid, p.priv);
  v_antes := CASE WHEN v_n = 0
    THEN ' | 4 OK: nenhuma sequência de public com privilégio de anon'
    ELSE ' | 4 FALHOU: ' || v_n || ' privilégio(s) de anon em sequências (' || left(v_lista, 200) || ')' END;

  -- ---------------------------------------------------------------------------
  -- 1. padrão do postgres em public, sequências: sem anon
  -- ---------------------------------------------------------------------------
  SELECT count(*), string_agg(a.privilege_type, ',' ORDER BY a.privilege_type)
    INTO v_n, v_lista
    FROM pg_default_acl d
   CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE d.defaclrole = 'postgres'::regrole
     AND d.defaclnamespace = 'public'::regnamespace
     AND d.defaclobjtype = 'S'
     AND a.grantee = 'anon'::regrole;
  SELECT count(*) INTO v_m
    FROM pg_default_acl d
   CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE d.defaclrole = 'postgres'::regrole
     AND d.defaclnamespace = 'public'::regnamespace
     AND d.defaclobjtype = 'S'
     AND a.grantee IN ('authenticated'::regrole, 'service_role'::regrole);
  r := r || CASE WHEN v_n = 0 AND v_m > 0
    THEN ' | 1 OK: padrão do postgres em public dá a anon nada nas sequências'
    ELSE ' | 1 FALHOU: padrão do postgres em public dá a anon ' || COALESCE(v_lista, 'nada')
         || '; entradas de authenticated/service_role = ' || v_m END;

  -- ---------------------------------------------------------------------------
  -- 2. sequência criada agora em public
  -- ---------------------------------------------------------------------------
  IF v_papel <> 'postgres' THEN
    r := r || ' | 2 FALHOU: sonda rodando como ' || v_papel || ', não postgres (o padrão é FOR ROLE postgres)';
  ELSE
    EXECUTE format('CREATE SEQUENCE public.%I', 'sonda_m74_' || v_sufixo);
    v_seq := to_regclass('public.' || quote_ident('sonda_m74_' || v_sufixo));
    SELECT count(*) INTO v_n
      FROM (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) AS p(priv)
     WHERE has_sequence_privilege('anon', v_seq, p.priv);
    r := r || CASE WHEN v_seq IS NOT NULL AND v_n = 0
                    AND has_sequence_privilege('authenticated', v_seq, 'USAGE')
                    AND has_sequence_privilege('service_role', v_seq, 'USAGE')
      THEN ' | 2 OK: sequência nova sem USAGE/SELECT/UPDATE para anon e com USAGE para authenticated e service_role'
      ELSE ' | 2 FALHOU: sequência nova com ' || v_n || ' privilégio(s) de anon'
           || CASE WHEN v_seq IS NOT NULL AND has_sequence_privilege('authenticated', v_seq, 'USAGE') THEN '' ELSE ', authenticated sem USAGE' END
           || CASE WHEN v_seq IS NOT NULL AND has_sequence_privilege('service_role', v_seq, 'USAGE') THEN '' ELSE ', service_role sem USAGE' END END;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3. tabela nova com coluna serial
  -- ---------------------------------------------------------------------------
  IF v_papel <> 'postgres' THEN
    r := r || ' | 3 FALHOU: sonda rodando como ' || v_papel || ', não postgres (o padrão é FOR ROLE postgres)';
  ELSE
    EXECUTE format('CREATE TABLE public.%I (id serial)', 'sonda_m74_t_' || v_sufixo);
    v_serial := to_regclass('public.' || quote_ident('sonda_m74_t_' || v_sufixo || '_id_seq'));
    r := r || CASE WHEN v_serial IS NOT NULL
                    AND NOT has_sequence_privilege('anon', v_serial, 'USAGE')
                    AND NOT has_sequence_privilege('anon', v_serial, 'SELECT')
                    AND NOT has_sequence_privilege('anon', v_serial, 'UPDATE')
                    AND has_sequence_privilege('authenticated', v_serial, 'USAGE')
      THEN ' | 3 OK: sequência de coluna serial nova sem privilégio para anon'
      ELSE ' | 3 FALHOU: sequência de coluna serial '
           || CASE WHEN v_serial IS NULL THEN 'não encontrada' ELSE 'nova com privilégio de anon' END END;
  END IF;

  -- 4 (calculado no início)
  r := r || v_antes;

  -- ---------------------------------------------------------------------------
  -- 5. papel da sessão
  -- ---------------------------------------------------------------------------
  r := r || CASE WHEN v_papel = 'postgres'
    THEN ' | 5 OK: sonda rodando como postgres'
    ELSE ' | 5 FALHOU: sonda rodando como ' || v_papel END;

  RAISE EXCEPTION 'SONDA M74 (desfeita):%', r;
END
$$;
