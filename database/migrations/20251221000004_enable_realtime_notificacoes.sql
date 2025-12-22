-- ============================================
-- Migration: Configurar Realtime para tabela notificacoes
-- Data: 2025-12-21
-- Problema: O hook useNotifications depende de Realtime para
-- atualizar o contador do sino em tempo real.
-- ============================================

-- Habilitar REPLICA IDENTITY FULL para incluir todos os campos nos eventos
-- (necessário para que o Realtime envie o payload completo)
-- Nota: A tabela já estava na publication supabase_realtime, mas com
-- REPLICA IDENTITY DEFAULT que só envia a primary key.
ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;

-- Comentário
COMMENT ON TABLE public.notificacoes IS 'Notificações para gestores/motoristas sobre eventos nas rotas. Realtime habilitado com REPLICA IDENTITY FULL.';
