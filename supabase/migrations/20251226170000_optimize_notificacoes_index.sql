-- ============================================
-- Migration: Otimizar índices da tabela notificacoes
-- Data: 2025-12-26
-- Problema: Queries de notificações lentas (~1300ms)
-- Solução: Índice composto para filtro + ordenação
-- ============================================
-- Nota (harmonização 2026-07): aplicada no banco live em 2025-12-26 manualmente
-- com CREATE INDEX CONCURRENTLY. Este arquivo mantém a forma TRANSACIONAL (sem
-- CONCURRENTLY) porque `supabase db push` roda migrations dentro de transação e
-- CONCURRENTLY não roda em transação; em ambiente fresh a tabela nasce vazia
-- (sem risco de lock). Cópias em database/ e supabase/ são idênticas.

-- O índice composto permite que o PostgreSQL:
-- 1. Filtre rapidamente por usuario_id (índice B-tree)
-- 2. Retorne os resultados já ordenados por created_at DESC
-- 3. Aplique LIMIT 50 de forma eficiente (early termination)
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_created
ON notificacoes(usuario_id, created_at DESC);

-- Comentário explicativo
COMMENT ON INDEX idx_notificacoes_usuario_created IS
'Índice composto para otimizar query de listagem de notificações por usuário ordenadas por data';

-- Analisar tabela para atualizar estatísticas do planner
ANALYZE notificacoes;
