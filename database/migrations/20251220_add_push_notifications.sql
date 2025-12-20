-- Migration: Adicionar suporte a Push Notifications
-- Data: 2025-12-20
-- Descrição: Adiciona coluna push_token na tabela usuarios e webhook para enviar push

-- 1. Adicionar coluna push_token na tabela usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 2. Criar índice para busca rápida por token
CREATE INDEX IF NOT EXISTS idx_usuarios_push_token ON usuarios(push_token) WHERE push_token IS NOT NULL;

-- 3. Adicionar coluna push_enviado na tabela notificacoes para rastrear envios
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS push_enviado BOOLEAN DEFAULT FALSE;
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS push_enviado_at TIMESTAMPTZ;

-- 4. Criar tabela de log de push notifications
CREATE TABLE IF NOT EXISTS push_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacao_id UUID REFERENCES notificacoes(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  push_token TEXT,
  status TEXT NOT NULL, -- 'sent', 'failed', 'no_token'
  response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RLS para push_notification_logs (apenas admin pode ver)
ALTER TABLE push_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode ver logs de push" ON push_notification_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND papel = 'admin'
    )
  );

-- 6. Comentários para documentação
COMMENT ON COLUMN usuarios.push_token IS 'Expo Push Token para notificações mobile';
COMMENT ON COLUMN notificacoes.push_enviado IS 'Indica se push notification foi enviado';
COMMENT ON TABLE push_notification_logs IS 'Log de tentativas de envio de push notifications';

-- ============================================================
-- WEBHOOK CONFIGURATION (via Supabase Dashboard)
-- ============================================================
--
-- Para completar a configuração de push notifications, configure um
-- Database Webhook no Supabase Dashboard:
--
-- 1. Acesse: Supabase Dashboard > Database > Webhooks
-- 2. Clique em "Create a new hook"
-- 3. Configure:
--    - Name: send-push-notification
--    - Table: notificacoes
--    - Events: INSERT
--    - Type: Supabase Edge Functions
--    - Edge Function: send-push-notification
--    - HTTP Headers: Authorization: Bearer [SUPABASE_SERVICE_ROLE_KEY]
--
-- Ou via CLI:
-- supabase webhooks create send-push-notification \
--   --table notificacoes \
--   --events INSERT \
--   --function send-push-notification
--
-- ============================================================

-- 7. Habilitar extensão http para chamadas alternativas
CREATE EXTENSION IF NOT EXISTS http;

-- 8. Função alternativa para enviar push via trigger (opcional)
-- Use apenas se preferir trigger em vez de webhook
CREATE OR REPLACE FUNCTION notify_push_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  user_token TEXT;
  tipos_push TEXT[] := ARRAY['nova_rota_atribuida', 'sos_acionado', 'incidente_reportado', 'rota_atrasada'];
BEGIN
  -- Verificar se tipo requer push
  IF NOT (NEW.tipo = ANY(tipos_push)) THEN
    RETURN NEW;
  END IF;

  -- Buscar push token do usuário
  SELECT push_token INTO user_token
  FROM usuarios
  WHERE id = NEW.usuario_id;

  -- Se não tem token, apenas logar e sair
  IF user_token IS NULL THEN
    INSERT INTO push_notification_logs (notificacao_id, usuario_id, status, error_message)
    VALUES (NEW.id, NEW.usuario_id, 'no_token', 'Usuário não tem push_token registrado');
    RETURN NEW;
  END IF;

  -- Marcar para processamento (webhook ou job externo fará o envio)
  -- A Edge Function será chamada via Database Webhook configurado no Dashboard

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário explicativo
COMMENT ON FUNCTION notify_push_on_insert() IS
'Função auxiliar para logging. O envio real é feito via Database Webhook + Edge Function';
