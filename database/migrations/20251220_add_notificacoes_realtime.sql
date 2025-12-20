-- Migration: Adicionar tabela notificacoes ao Realtime
-- Data: 2025-12-20
-- Descrição: Adiciona a tabela notificacoes à publication supabase_realtime

-- Adicionar notificacoes à publication para Realtime funcionar
ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;
