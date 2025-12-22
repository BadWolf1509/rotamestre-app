-- ============================================
-- Migration: Adicionar status 'nao_executada' às rotas
-- Data: 2025-12-21
-- Descrição:
--   Corrige o CHECK constraint da tabela rotas para incluir
--   o status 'nao_executada' usado pela função de expiração.
--
-- CRÍTICO: Sem esta migration, a função expire_old_pending_routes()
-- falhará com erro de constraint violation.
-- ============================================

-- Remover constraint existente
ALTER TABLE rotas DROP CONSTRAINT IF EXISTS rotas_status_check;

-- Adicionar nova constraint com 'nao_executada'
ALTER TABLE rotas ADD CONSTRAINT rotas_status_check
  CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada', 'nao_executada'));

-- Comentário para documentação
COMMENT ON COLUMN rotas.status IS 'Status da rota: pendente (aguardando início), em_andamento (motorista executando), concluida (todas paradas finalizadas), cancelada (cancelada pelo gestor), nao_executada (expirou sem ser concluída)';

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Após executar, verifique se o constraint foi atualizado:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'rotas_status_check';
