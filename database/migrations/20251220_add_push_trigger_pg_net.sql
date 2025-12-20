-- Migration: Trigger para enviar Push via pg_net
-- Data: 2025-12-20
-- Descrição: Usa pg_net para chamar Edge Function diretamente do trigger

-- 1. Habilitar extensão pg_net (já disponível no Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Função que envia push notification via Edge Function
CREATE OR REPLACE FUNCTION send_push_notification_trigger()
RETURNS TRIGGER AS $$
DECLARE
  tipos_push TEXT[] := ARRAY['nova_rota_atribuida', 'sos_acionado', 'incidente_reportado', 'rota_atrasada'];
  edge_function_url TEXT;
  payload JSONB;
  request_id BIGINT;
BEGIN
  -- Verificar se tipo requer push
  IF NOT (NEW.tipo = ANY(tipos_push)) THEN
    RETURN NEW;
  END IF;

  -- URL da Edge Function
  -- Formato: https://<project-ref>.supabase.co/functions/v1/<function-name>
  edge_function_url := 'https://xezslsyxjivunmhhyxtd.supabase.co/functions/v1/send-push-notification';

  -- Payload para a Edge Function
  payload := jsonb_build_object(
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
  );

  -- Chamar Edge Function via pg_net (assíncrono, não bloqueia a transação)
  -- Nota: A Edge Function foi deployada com --no-verify-jwt, então não precisa de auth
  SELECT net.http_post(
    url := edge_function_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := payload
  ) INTO request_id;

  -- Log da tentativa (opcional, para debug)
  RAISE NOTICE '[Push] Requisição enviada para Edge Function, request_id: %', request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Não falhar a transação se o push falhar
  RAISE WARNING '[Push] Erro ao enviar push notification: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar trigger na tabela notificacoes
DROP TRIGGER IF EXISTS trigger_send_push_notification ON notificacoes;
CREATE TRIGGER trigger_send_push_notification
  AFTER INSERT ON notificacoes
  FOR EACH ROW
  EXECUTE FUNCTION send_push_notification_trigger();

-- 4. Comentário
COMMENT ON FUNCTION send_push_notification_trigger() IS
'Trigger que envia push notification via Edge Function usando pg_net';

-- 5. Verificar se trigger foi criado
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_send_push_notification'
  ) THEN
    RAISE NOTICE '✅ Trigger trigger_send_push_notification criado com sucesso';
  ELSE
    RAISE WARNING '❌ Trigger não foi criado';
  END IF;
END $$;
