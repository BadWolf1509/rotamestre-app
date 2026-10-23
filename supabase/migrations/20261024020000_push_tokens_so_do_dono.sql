-- ============================================================================
-- Migration 45: o token de push mora em `push_tokens`, visível só ao dono
-- Date: 2026-10-24
-- Author: Wellinton Ribeiro
--
-- RODAR PELO SQL EDITOR (tem REVOKE, que o MCP recusa). Uma transação só:
-- falhou uma parte, nada muda.
--
-- Purpose: `usuarios.push_token` era lido por quem enxerga a linha de
-- `usuarios` (colegas e gestores da mesma loja), e quem sabe um token consegue
-- registrá-lo para si (`registrar_push_token` aceita qualquer token no formato
-- Expo; o UPDATE direto das versões antigas também) — passando a receber os
-- pushes do dono e tirando-os dele. Não há como provar que o token é do
-- aparelho de quem chama; o que fecha é ninguém mais conseguir ler o token de
-- outra conta. Os logs de push também guardavam o token inteiro, legíveis pelo
-- gestor da loja.
--
-- O que muda:
--
-- 1. Tabela `push_tokens (token PK, usuario_id, atualizado_em)`: um aparelho,
--    uma conta (o token é a chave); uma conta, até 5 aparelhos. RLS: SELECT e
--    DELETE só do dono; nenhuma escrita direta da API (só funções DEFINER).
--    O DELETE do dono é o logout das versões novas do app.
--
-- 2. `gravar_push_token(usuario, token)` (DEFINER, sem EXECUTE para a API) é
--    a única porta de escrita: com sessão, só grava para a própria conta
--    (42501); valida o formato (ExponentPushToken[...] e ExpoPushToken[...]),
--    trava pelo token, faz upsert trocando o dono e corta os aparelhos além
--    dos 5 mais recentes (clock_timestamp, desempate pelo token).
--    `registrar_push_token(p_token)` (Migration 39) passa a gravar por ela e
--    não toca mais em `usuarios.push_token`.
--
-- 3. Compatibilidade: o app 1.14.2 grava o token por UPDATE direto em
--    `usuarios`. O gatilho `push_token_vai_para_push_tokens` (BEFORE UPDATE,
--    só quando chega token não nulo) move o token da PRÓPRIA linha para
--    `push_tokens` e devolve a coluna a NULL; token na linha de OUTRA conta é
--    recusado (42501). Service role (sem auth.uid()) passa.
--    Logout do 1.14.3: é `UPDATE ... SET push_token = NULL WHERE id = uid AND
--    push_token = <token>`. Com a coluna sempre NULL, o WHERE não casa linha
--    nenhuma: o UPDATE não faz nada e o gatilho nem dispara. Sem o token não
--    há como apagar só o daquele aparelho, e apagar TODOS os da conta
--    desligaria os outros aparelhos dela (e nem teria como disparar). Fica:
--    nessas versões o token sobrevive ao logout, como já acontecia no logout
--    offline, até outra conta entrar no aparelho (a RPC troca o dono) ou a
--    Expo o invalidar (o envio apaga o token morto). O app novo apaga de
--    `push_tokens` pelo token.
--
-- 4. Backfill: os tokens atuais vão para `push_tokens` (um dono por token, o
--    de `updated_at` mais recente) e a coluna é zerada. Depois, a CHECK
--    `usuarios_push_token_vazio` garante que ela não volta a guardar token
--    (vale também para INSERT; o gatilho roda antes da CHECK).
--
-- 5. Leitores: `notify_push_on_insert` (sem gatilho ligado em 23/10/2026,
--    mantida coerente) passa a olhar `push_tokens`. A Edge Function
--    `send-push-notification` lê de `push_tokens` e envia a todos os aparelhos
--    da conta — PUBLICAR A FUNÇÃO ANTES DESTA MIGRATION: sem a tabela ela cai
--    na coluna antiga; a função velha, depois da migration, leria a coluna
--    vazia e o push pararia de chegar.
--
-- 6. `push_notification_logs`: o token já gravado vira os 6 últimos caracteres
--    (o formato de `mascararToken` da função) e o token que a Expo devolve na
--    mensagem de erro sai de `error_message` e `response`. Irreversível de
--    propósito.
--
-- 7. UPDATE de `authenticated` em `usuarios` só nas colunas que o app escreve
--    (grep em src/ e app/ em 23/10/2026): nome, email, telefone, unidade_id,
--    foto_url, updated_at, ultimo_login, primeira_senha e push_token (o
--    UPDATE das versões antigas, levado pelo gatilho). Saem `id`, `created_at`
--    (ninguém escreve) e `ativo`: todo toggle de motorista passa pela RPC
--    `alternar_motorista_na_unidade` (DEFINER), e o ramo "própria linha" da
--    policy de UPDATE deixava um usuário desativado se reativar. `anon` já não
--    tinha UPDATE; o REVOKE repete por defesa.
--
-- A marca `rotamestre.push_rpc` da `trava_motorista_outra_loja` (Migration 39)
-- deixa de ser usada (a RPC não escreve mais em `usuarios`); fica, inofensiva.
-- ============================================================================

BEGIN;

-- Se algum lock demorar (usuarios é lida em toda requisição do app), a
-- migration falha inteira em 5 s em vez de enfileirar a API atrás dela.
-- Rodar de novo num horário calmo.
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 6. Logs de push sem o token inteiro (primeiro: os ~1.656 UPDATEs não tocam
--    em usuarios e não devem rodar com o lock da FK e do ALTER TABLE abaixo)
-- ---------------------------------------------------------------------------
UPDATE public.push_notification_logs SET push_token = '…' || right(push_token, 6) WHERE push_token IS NOT NULL AND push_token NOT LIKE '…%';

UPDATE public.push_notification_logs
   SET error_message = regexp_replace(error_message, 'Expo(nent)?PushToken\[[^]]+\]', '…', 'g')
 WHERE error_message ~ 'Expo(nent)?PushToken\[';

UPDATE public.push_notification_logs
   SET response = regexp_replace(response::text, 'Expo(nent)?PushToken\[[^]"]+\]', '…', 'g')::jsonb
 WHERE response::text ~ 'Expo(nent)?PushToken\[';

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
CREATE TABLE public.push_tokens (
  token text PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX push_tokens_usuario_id_idx ON public.push_tokens (usuario_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- O Supabase concede tudo à API em tabela nova do schema public.
REVOKE ALL ON public.push_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.push_tokens TO authenticated;

CREATE POLICY push_tokens_select_dono ON public.push_tokens
  FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

CREATE POLICY push_tokens_delete_dono ON public.push_tokens
  FOR DELETE TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

COMMENT ON TABLE public.push_tokens IS
  'Token de push por aparelho (token = chave: um aparelho, uma conta). Só o dono lê e apaga; escrita só por gravar_push_token. Migration 45.';

-- ---------------------------------------------------------------------------
-- 2. Única porta de escrita
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gravar_push_token(p_usuario uuid, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Defesa em profundidade: a função não tem EXECUTE para a API, mas se
  -- algum dia for chamada com sessão (outra função DEFINER, grant por
  -- engano), só grava para a própria conta. Service role chega sem uid.
  IF v_uid IS NOT NULL AND v_uid <> p_usuario THEN
    RAISE EXCEPTION 'O token de push só pode ser gravado pela própria conta.'
      USING ERRCODE = '42501';
  END IF;

  IF p_token IS NULL
     OR length(p_token) > 200
     OR p_token !~ '^Expo(nent)?PushToken\[[^]]+\]$' THEN
    RAISE EXCEPTION 'Token de push fora do formato Expo.'
      USING ERRCODE = '22023';
  END IF;

  -- Duas contas registrando o mesmo token ao mesmo tempo: uma de cada vez.
  PERFORM pg_advisory_xact_lock(hashtext(p_token));

  -- O aparelho é de uma conta por vez: quem tinha este token o perde.
  -- clock_timestamp(), não now(): now() é o mesmo na transação inteira, e
  -- dois registros na mesma transação empatariam no corte abaixo.
  INSERT INTO public.push_tokens (token, usuario_id, atualizado_em)
  VALUES (p_token, p_usuario, clock_timestamp())
  ON CONFLICT (token) DO UPDATE
    SET usuario_id = EXCLUDED.usuario_id,
        atualizado_em = EXCLUDED.atualizado_em;

  -- Até 5 aparelhos por conta: sem isso, uma conta poderia acumular tokens
  -- e cada notificação dela viraria um envio por token. Não é fronteira de
  -- segurança. O token desempata quando o horário empata (backfill).
  DELETE FROM public.push_tokens
   WHERE usuario_id = p_usuario
     AND token NOT IN (
       SELECT token FROM public.push_tokens
        WHERE usuario_id = p_usuario
        ORDER BY atualizado_em DESC, token
        LIMIT 5
     );
END;
$$;

REVOKE ALL ON FUNCTION public.gravar_push_token(uuid, text) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.gravar_push_token(uuid, text) IS
  'Grava o token de push para a conta (troca o dono; até 5 aparelhos por conta). Sem EXECUTE para a API: só registrar_push_token e o gatilho de usuarios chamam. Migration 45.';

CREATE OR REPLACE FUNCTION public.registrar_push_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão necessária para registrar o push.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_uid) THEN
    RAISE EXCEPTION 'Perfil não encontrado para registrar o push.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.gravar_push_token(v_uid, p_token);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_push_token(text) TO authenticated;

COMMENT ON FUNCTION public.registrar_push_token(text) IS
  'Grava o token de push na conta logada, em push_tokens (um aparelho, uma conta). Migrations 39 e 45.';

-- ---------------------------------------------------------------------------
-- 3. Backfill: a coluna esvazia
-- ---------------------------------------------------------------------------
INSERT INTO public.push_tokens (token, usuario_id, atualizado_em)
SELECT DISTINCT ON (u.push_token) u.push_token, u.id, now()
  FROM public.usuarios u
 WHERE u.push_token IS NOT NULL
   AND length(u.push_token) <= 200
   AND u.push_token ~ '^Expo(nent)?PushToken\[[^]]+\]$'
 ORDER BY u.push_token, u.updated_at DESC NULLS LAST
ON CONFLICT (token) DO NOTHING;

UPDATE public.usuarios SET push_token = NULL WHERE push_token IS NOT NULL;

ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_push_token_vazio CHECK (push_token IS NULL);

COMMENT ON COLUMN public.usuarios.push_token IS
  'Sempre NULL (CHECK usuarios_push_token_vazio). O token mora em push_tokens; UPDATE de versões antigas do app é levado pelo gatilho push_token_vai_para_push_tokens. Migration 45.';

-- ---------------------------------------------------------------------------
-- 4. Compatibilidade com o UPDATE direto das versões antigas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mover_push_token_para_tabela()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Service role (Edge Function, painel) chega sem auth.uid(). Pela API, só o
  -- dono da linha: o gestor alcança a linha do motorista pela RLS de UPDATE.
  IF v_uid IS NOT NULL AND v_uid <> OLD.id THEN
    RAISE EXCEPTION 'O token de push só pode ser gravado pela própria conta.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.gravar_push_token(OLD.id, NEW.push_token);
  NEW.push_token := NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.mover_push_token_para_tabela() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.mover_push_token_para_tabela() IS
  'Leva para push_tokens o token gravado por UPDATE direto em usuarios (app até 1.14.2) e devolve a coluna a NULL; só na própria linha. Migration 45.';

-- Roda antes de trava_motorista_outra_loja e update_usuarios_updated_at
-- (ordem alfabética dos BEFORE): elas já veem a coluna NULL.
CREATE OR REPLACE TRIGGER push_token_vai_para_push_tokens
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW
  WHEN (NEW.push_token IS NOT NULL)
  EXECUTE FUNCTION public.mover_push_token_para_tabela();

-- ---------------------------------------------------------------------------
-- 5. Leitor no banco
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_push_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  tipos_push TEXT[] := ARRAY['nova_rota_atribuida', 'sos_acionado', 'incidente_reportado', 'rota_atrasada'];
BEGIN
  IF NOT (NEW.tipo = ANY(tipos_push)) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.push_tokens WHERE usuario_id = NEW.usuario_id
  ) THEN
    INSERT INTO public.push_notification_logs (notificacao_id, usuario_id, status, error_message)
    VALUES (NEW.id, NEW.usuario_id, 'no_token', 'Usuário não tem push_token registrado');
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. UPDATE de usuarios só nas colunas que o app escreve
-- ---------------------------------------------------------------------------
-- O REVOKE de tabela também tira os grants de coluna; o GRANT reconcede a lista.
REVOKE UPDATE ON public.usuarios FROM authenticated, anon;
GRANT UPDATE (
  nome, email, telefone, unidade_id, foto_url, updated_at,
  ultimo_login, primeira_senha, push_token
) ON public.usuarios TO authenticated;

COMMIT;

-- ============================================================================
-- CONFERÊNCIA (só SELECT; rodar depois de aplicar)
-- ============================================================================
-- 1. Coluna vazia e tokens migrados (esperado: 0 e o número de antes — 7 em
--    23/10/2026):
-- SELECT (SELECT count(*) FROM public.usuarios WHERE push_token IS NOT NULL) AS na_coluna,
--        (SELECT count(*) FROM public.push_tokens) AS na_tabela;
--
-- 2. RLS ligada e só as duas policies do dono:
-- SELECT relrowsecurity FROM pg_class WHERE oid = 'public.push_tokens'::regclass;
-- SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'push_tokens';
--
-- 3. Grants da API em push_tokens (esperado: authenticated SELECT e DELETE;
--    anon nada):
-- SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type)
--   FROM information_schema.role_table_grants
--  WHERE table_schema = 'public' AND table_name = 'push_tokens'
--    AND grantee IN ('anon', 'authenticated')
--  GROUP BY grantee;
--
-- 4. Funções: DEFINER, search_path vazio; EXECUTE da API só na RPC:
-- SELECT p.oid::regprocedure, p.prosecdef, p.proconfig,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
--   FROM pg_proc p
--  WHERE p.oid IN ('public.gravar_push_token(uuid, text)'::regprocedure,
--                  'public.registrar_push_token(text)'::regprocedure,
--                  'public.mover_push_token_para_tabela()'::regprocedure);
--
-- 5. Gatilho e CHECK:
-- SELECT tgname, tgenabled, pg_get_triggerdef(oid) FROM pg_trigger
--  WHERE tgrelid = 'public.usuarios'::regclass AND tgname = 'push_token_vai_para_push_tokens';
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.usuarios'::regclass AND conname = 'usuarios_push_token_vazio';
--
-- 6. Nenhuma função lê mais a coluna (esperado: só trava_motorista_outra_loja,
--    que só a compara, e as três desta migration, que a zeram ou a citam):
-- SELECT p.oid::regprocedure FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.prosrc ILIKE '%push_token%';
--
-- 7. Logs sem token inteiro (esperado: 0, 0, 0):
-- SELECT count(*) FILTER (WHERE push_token NOT LIKE '…%') AS token,
--        count(*) FILTER (WHERE error_message ~ 'Expo(nent)?PushToken\[') AS erro,
--        count(*) FILTER (WHERE response::text ~ 'Expo(nent)?PushToken\[') AS resposta
--   FROM public.push_notification_logs WHERE push_token IS NOT NULL
--      OR error_message IS NOT NULL OR response IS NOT NULL;
--
-- 8. UPDATE de usuarios para a API (esperado: as 9 colunas para authenticated,
--    nada para anon, nenhum grant de tabela):
-- SELECT grantee, string_agg(column_name, ', ' ORDER BY column_name)
--   FROM information_schema.column_privileges
--  WHERE table_schema = 'public' AND table_name = 'usuarios'
--    AND privilege_type = 'UPDATE' AND grantee IN ('authenticated', 'anon')
--  GROUP BY grantee;
-- SELECT grantee FROM information_schema.role_table_grants
--  WHERE table_schema = 'public' AND table_name = 'usuarios'
--    AND privilege_type = 'UPDATE' AND grantee IN ('authenticated', 'anon');
--
-- 9. Versão registrada:
-- SELECT version FROM supabase_migrations.schema_migrations
--  WHERE version = '20261024020000';

-- ROLLBACK:
-- Volta a coluna como fonte do token (reabre a leitura do token por colegas).
-- O mascaramento dos logs NÃO volta. Publicar a send-push-notification
-- anterior junto.
-- BEGIN;
-- DROP TRIGGER IF EXISTS push_token_vai_para_push_tokens ON public.usuarios;
-- DROP FUNCTION IF EXISTS public.mover_push_token_para_tabela();
-- ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_push_token_vazio;
-- UPDATE public.usuarios u SET push_token = t.token
--   FROM (SELECT DISTINCT ON (usuario_id) usuario_id, token
--           FROM public.push_tokens ORDER BY usuario_id, atualizado_em DESC) t
--  WHERE u.id = t.usuario_id;
-- -- registrar_push_token: recriar com o corpo da Migration 39
-- -- (database/migrations/20261023010000_push_token_de_uma_conta_so.sql).
-- -- notify_push_on_insert: recriar com `SELECT push_token INTO user_token
-- -- FROM public.usuarios WHERE id = NEW.usuario_id` no lugar do EXISTS.
-- DROP FUNCTION IF EXISTS public.gravar_push_token(uuid, text);
-- DROP TABLE IF EXISTS public.push_tokens;
-- COMMENT ON COLUMN public.usuarios.push_token IS NULL;
-- REVOKE UPDATE ON public.usuarios FROM authenticated, anon;
-- GRANT UPDATE (
--   id, nome, email, unidade_id, telefone, ativo, created_at, updated_at,
--   primeira_senha, foto_url, ultimo_login, push_token
-- ) ON public.usuarios TO authenticated;
-- COMMIT;
