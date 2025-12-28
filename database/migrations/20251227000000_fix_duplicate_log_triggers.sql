-- =============================================
-- Migration: Fix Duplicate Log Triggers
-- Data: 2025-12-27
-- Descrição: Remove triggers duplicados que estão criando logs
--            duplicados de 'motorista_iniciou_rota'
-- =============================================
--
-- PROBLEMA IDENTIFICADO:
-- Existem múltiplos triggers criando logs quando a rota muda de
-- status 'pendente' para 'em_andamento'. Isso causa duplicidade na timeline.
--
-- EVIDÊNCIA:
-- Para a mesma rota, foram encontrados 2 logs com evento 'motorista_iniciou_rota':
-- - Log 1: detalhes = {status_anterior, status_novo, motorista_id, timestamp}
--   (Criado pelo trigger log_rota_status_change da migration 20251215000000)
-- - Log 2: detalhes = {motorista_id, motorista_nome, unidade_nome}
--   (Criado por trigger desconhecido)
--
-- SOLUÇÃO:
-- 1. Identificar todos os triggers na tabela 'rotas' que podem criar logs
-- 2. Remover triggers duplicados/obsoletos
-- 3. Manter apenas o trigger correto (log_rota_status)
--
-- =============================================

-- =============================================
-- SEÇÃO 1: Diagnóstico - Listar triggers na tabela rotas
-- =============================================

DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  RAISE NOTICE '=== TRIGGERS NA TABELA ROTAS ===';

  FOR trigger_record IN
    SELECT
      t.tgname AS trigger_name,
      p.proname AS function_name,
      CASE t.tgenabled
        WHEN 'O' THEN 'ORIGIN'
        WHEN 'D' THEN 'DISABLED'
        WHEN 'R' THEN 'REPLICA'
        WHEN 'A' THEN 'ALWAYS'
      END AS enabled
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE c.relname = 'rotas'
      AND NOT t.tgisinternal
    ORDER BY t.tgname
  LOOP
    RAISE NOTICE 'Trigger: %, Function: %, Status: %',
      trigger_record.trigger_name,
      trigger_record.function_name,
      trigger_record.enabled;
  END LOOP;
END $$;

-- =============================================
-- SEÇÃO 2: Remover triggers duplicados/obsoletos
-- =============================================

-- Possíveis nomes de triggers que podem estar causando duplicidade
-- (baseado em convenções de nomenclatura do projeto)

-- Drop de triggers que podem estar duplicando logs
DROP TRIGGER IF EXISTS trigger_log_rota_status ON rotas;
DROP TRIGGER IF EXISTS log_rota_status_change ON rotas;
DROP TRIGGER IF EXISTS trigger_log_status_change ON rotas;
DROP TRIGGER IF EXISTS tr_log_rota_status ON rotas;
DROP TRIGGER IF EXISTS rota_status_log_trigger ON rotas;

-- Manter apenas o trigger padrão do projeto
-- O trigger correto é 'log_rota_status' que usa a função 'log_rota_status_change'

-- =============================================
-- SEÇÃO 3: Recriar o trigger único correto
-- =============================================

-- Primeiro, garantir que a função está na versão correta
-- (versão da migration 20251215000000_fix_timeline_log_events.sql)
CREATE OR REPLACE FUNCTION log_rota_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO logs (rota_id, usuario_id, evento, detalhes)
    VALUES (
      NEW.id,
      NEW.motorista_id,
      -- Usar nomes de eventos reconhecíveis pela timeline
      CASE
        WHEN NEW.status = 'em_andamento' AND OLD.status = 'pendente'
          THEN 'motorista_iniciou_rota'
        WHEN NEW.status = 'concluida'
          THEN 'motorista_concluiu_rota'
        WHEN NEW.status = 'cancelada'
          THEN 'rota_cancelada'
        WHEN NEW.status = 'nao_executada'
          THEN 'rota_expirada'
        ELSE 'status_alterado'
      END,
      jsonb_build_object(
        'status_anterior', OLD.status,
        'status_novo', NEW.status,
        'motorista_id', NEW.motorista_id,
        'timestamp', NOW()
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Remover o trigger padrão se existir, para recriar limpo
DROP TRIGGER IF EXISTS log_rota_status ON rotas;

-- Recriar o trigger único
CREATE TRIGGER log_rota_status
  AFTER UPDATE ON rotas
  FOR EACH ROW
  EXECUTE FUNCTION log_rota_status_change();

-- =============================================
-- SEÇÃO 4: Verificação final
-- =============================================

DO $$
DECLARE
  trigger_record RECORD;
  trigger_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TRIGGERS APÓS LIMPEZA ===';

  FOR trigger_record IN
    SELECT
      t.tgname AS trigger_name,
      p.proname AS function_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE c.relname = 'rotas'
      AND NOT t.tgisinternal
      AND p.proname LIKE '%log%'
    ORDER BY t.tgname
  LOOP
    trigger_count := trigger_count + 1;
    RAISE NOTICE 'Trigger: % -> Function: %',
      trigger_record.trigger_name,
      trigger_record.function_name;
  END LOOP;

  IF trigger_count = 1 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ SUCESSO: Apenas 1 trigger de log ativo na tabela rotas';
  ELSIF trigger_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ AVISO: Nenhum trigger de log encontrado - verifique!';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ AVISO: % triggers de log encontrados - pode haver duplicidade', trigger_count;
  END IF;
END $$;

-- =============================================
-- SEÇÃO 5: Comentários e documentação
-- =============================================

COMMENT ON FUNCTION log_rota_status_change() IS
'Trigger que cria logs quando o status de uma rota muda.
Eventos gerados:
- motorista_iniciou_rota: quando status muda de pendente para em_andamento
- motorista_concluiu_rota: quando status muda para concluida
- rota_cancelada: quando status muda para cancelada
- rota_expirada: quando status muda para nao_executada
- status_alterado: outras mudanças de status

IMPORTANTE: Este é o ÚNICO trigger que deve criar logs de mudança de status.
Não criar triggers adicionais que dupliquem esta funcionalidade.

Migration: 20251227000000_fix_duplicate_log_triggers.sql';

COMMENT ON TRIGGER log_rota_status ON rotas IS
'Trigger único para log de mudanças de status. Não duplicar!';
