-- Migration: Habilitar Supabase Realtime para rotas e paradas
-- Data: 2025-12-20
-- Descrição: Adiciona as tabelas rotas e paradas à publication supabase_realtime
--            para permitir atualizações em tempo real no app do motorista

-- Habilitar Realtime para a tabela rotas
ALTER PUBLICATION supabase_realtime ADD TABLE rotas;

-- Habilitar Realtime para a tabela paradas
ALTER PUBLICATION supabase_realtime ADD TABLE paradas;
