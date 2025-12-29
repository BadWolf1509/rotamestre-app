-- ============================================
-- Migration: Adicionar status 'em_andamento' para paradas
-- Data: 2025-12-28
-- Descrição: Permite que uma parada tenha status 'em_andamento'
--            quando o motorista está navegando até ela
-- ============================================

-- 1. Remover a constraint existente
ALTER TABLE paradas DROP CONSTRAINT IF EXISTS paradas_status_check;

-- 2. Adicionar nova constraint com 'em_andamento'
ALTER TABLE paradas ADD CONSTRAINT paradas_status_check
  CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'pulada'));

-- 3. Verificação (rodar manualmente para confirmar)
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'paradas_status_check';

-- ============================================
-- ROLLBACK (se necessário):
-- ALTER TABLE paradas DROP CONSTRAINT IF EXISTS paradas_status_check;
-- ALTER TABLE paradas ADD CONSTRAINT paradas_status_check
--   CHECK (status IN ('pendente', 'concluida', 'pulada'));
-- ============================================
