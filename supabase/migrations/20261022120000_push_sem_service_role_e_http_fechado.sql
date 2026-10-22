-- ============================================================================
-- Migration 32: push sem a service_role antiga, extensão http fechada,
--               criar_notificacao sem push entre empresas
-- Date: 2026-10-22
-- Author: Wellinton Ribeiro
-- Purpose:
--   Em 22/10/2026 a `service_role` (JWT do segredo legado) apareceu no histórico
--   do repositório público, embutida também no webhook "send-push-notification"
--   do painel. As chaves antigas foram desligadas. Esta migration:
--   1. tira o webhook do painel (que guardava a chave em texto puro e duplicava
--      cada push) e faz o gatilho pg_net ser o único caminho, autenticado por um
--      segredo próprio lido do Vault (`push_webhook_secret`, cabeçalho
--      `x-push-secret`). O gatilho passa a repassar TODO insert: quem filtra os
--      tipos é a função — antes o gatilho só mandava 4 dos 17 tipos, e o push
--      só funcionava porque o webhook mandava todos;
--   2. fecha as funções da extensão `http` (`http_get`, `http_post`, ...), que
--      estavam executáveis por `anon` via /rest/v1/rpc — qualquer um com a chave
--      pública fazia o servidor do banco chamar qualquer URL. Nada no projeto as
--      usa (o push usa `pg_net`);
--   3. trava `criar_notificacao` na chamada direta (RPC): só gestor ativo,
--      só para quem é ativo numa loja onde ele é gestor; rota (se vier) da
--      loja dos dois; parada (se vier) da rota informada. Chamadas de dentro
--      dos gatilhos (`notify_*`, SECURITY DEFINER) NÃO passam pela trava — e
--      alguns gatilhos aceitam dado controlado pelo usuário (SOS forjado em
--      `logs`, `motorista_id` de outra loja em `rotas`): esse caminho de push
--      entre empresas continua aberto e fica para a Migration 33.
--
-- APLICAR PELO SQL EDITOR (tem REVOKE e DROP TRIGGER; o MCP recusa). Antes:
--   - o segredo `push_webhook_secret` precisa existir no Vault e ser IGUAL ao
--     secret `PUSH_WEBHOOK_SECRET` das Edge Functions;
--   - a `send-push-notification` nova (com a guarda) precisa estar publicada.
-- ============================================================================

BEGIN;

-- 1. Webhook do painel: guardava a service_role antiga em texto puro.
DROP TRIGGER IF EXISTS "send-push-notification" ON public.notificacoes;

-- 2. Gatilho pg_net: único caminho do push, com segredo do Vault.
CREATE OR REPLACE FUNCTION public.send_push_notification_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_segredo TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_segredo
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret';

  IF v_segredo IS NULL THEN
    RAISE WARNING '[Push] push_webhook_secret ausente no Vault; push não enviado (notificação %).', NEW.id;
    RETURN NEW;
  END IF;

  -- Repassa todo insert: a lista de tipos que viram push mora na função
  -- (PUSH_NOTIFICATION_TYPES em supabase/functions/send-push-notification).
  SELECT net.http_post(
    url := 'https://xezslsyxjivunmhhyxtd.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_segredo
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notificacoes',
      'record', jsonb_build_object(
        'id', NEW.id,
        'usuario_id', NEW.usuario_id,
        'tipo', NEW.tipo,
        'titulo', NEW.titulo,
        'mensagem', NEW.mensagem,
        'rota_id', NEW.rota_id,
        'parada_id', NEW.parada_id,
        'incidente_id', NEW.incidente_id
      )
    )
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[Push] Erro ao enviar push notification: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 3. Extensão http: ninguém de fora executa.
DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    JOIN pg_extension e ON e.oid = d.refobjid
    WHERE e.extname = 'http'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END
$$;

-- 4. criar_notificacao: trava na chamada direta (o caminho via gatilhos é a Migration 33).
CREATE OR REPLACE FUNCTION public.criar_notificacao(
  p_usuario_id uuid,
  p_tipo character varying,
  p_titulo character varying,
  p_mensagem text,
  p_rota_id uuid DEFAULT NULL::uuid,
  p_parada_id uuid DEFAULT NULL::uuid,
  p_incidente_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_notificacao_id UUID;
  v_chamador UUID := auth.uid();
BEGIN
  -- Chamada direta por um usuário (RPC). De dentro de gatilho (notify_*) ou
  -- sem usuário (service/cron) a regra não se aplica.
  IF pg_trigger_depth() = 0 AND v_chamador IS NOT NULL THEN
    -- Só gestor ativo, e só para quem é ativo numa loja onde ele é gestor.
    IF NOT EXISTS (
      SELECT 1
      FROM public.usuario_unidades c
      JOIN public.usuario_unidades d
        ON d.unidade_id = c.unidade_id AND d.usuario_id = p_usuario_id AND d.ativo
      WHERE c.usuario_id = v_chamador AND c.ativo AND c.papel = 'gestor'
    ) THEN
      RAISE EXCEPTION 'Sem permissão para notificar este usuário.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- A rota, se vier, é da loja dos dois (vínculo em duas lojas não cruza).
    IF p_rota_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.rotas r
      JOIN public.usuario_unidades c
        ON c.unidade_id = r.unidade_id AND c.usuario_id = v_chamador
       AND c.ativo AND c.papel = 'gestor'
      JOIN public.usuario_unidades d
        ON d.unidade_id = r.unidade_id AND d.usuario_id = p_usuario_id AND d.ativo
      WHERE r.id = p_rota_id
    ) THEN
      RAISE EXCEPTION 'Sem permissão para notificar sobre esta rota.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- A parada, se vier, é da rota informada (o deep-link do push usa as duas).
    IF p_parada_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.paradas pa
      WHERE pa.id = p_parada_id AND pa.rota_id = p_rota_id
    ) THEN
      RAISE EXCEPTION 'Parada não pertence à rota informada.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.notificacoes (
      usuario_id, tipo, titulo, mensagem, rota_id, parada_id, incidente_id
    ) VALUES (
      p_usuario_id, p_tipo, p_titulo, p_mensagem, p_rota_id, p_parada_id, p_incidente_id
    ) RETURNING id INTO v_notificacao_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  RETURN v_notificacao_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.criar_notificacao(uuid, character varying, character varying, text, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_notificacao(uuid, character varying, character varying, text, uuid, uuid, uuid) TO authenticated;

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- -- 4. criar_notificacao sem a trava: recriar o corpo anterior (INSERT direto,
-- --    EXCEPTION WHEN OTHERS THEN RETURN NULL) e GRANT EXECUTE ... TO anon.
-- -- 3. GRANT EXECUTE nas funções da extensão http para PUBLIC (laço igual ao acima).
-- -- 2. send_push_notification_trigger anterior: filtro tipos_push (4 tipos) e
-- --    net.http_post sem cabeçalho de segredo.
-- -- 1. O webhook do painel NÃO deve voltar: guardava a service_role em texto puro.
-- COMMIT;
