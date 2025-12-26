-- ============================================
-- Migration: Otimizar índices da tabela notificacoes
-- Data: 2025-12-26
-- Problema: Queries de notificações lentas (~1300ms)
-- Solução: Índice composto para filtro + ordenação
-- ============================================

-- Índice composto: usuario_id + created_at DESC
-- Permite filtrar por usuário e retornar já ordenado
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_created
ON notificacoes(usuario_id, created_at DESC);

-- Comentário explicativo
COMMENT ON INDEX idx_notificacoes_usuario_created IS
'Índice composto para otimizar query de listagem de notificações por usuário ordenadas por data';
