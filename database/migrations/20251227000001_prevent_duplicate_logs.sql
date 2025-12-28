-- =============================================
-- Migration: Prevent Duplicate Log Entries
-- Data: 2025-12-27
-- Descrição: Adiciona trigger que previne inserção de logs duplicados
--            para o mesmo evento/rota dentro de 5 segundos
-- =============================================
--
-- PROBLEMA:
-- Apesar de existir apenas um trigger (log_rota_status_change),
-- logs duplicados de 'motorista_iniciou_rota' continuam aparecendo.
-- A fonte do segundo log não foi identificada no código.
--
-- SOLUÇÃO:
-- Criar trigger BEFORE INSERT que verifica se já existe um log
-- similar nos últimos 5 segundos e bloqueia a inserção duplicada.
--
-- =============================================

-- =============================================
-- SEÇÃO 1: Função para prevenir duplicatas
-- =============================================

CREATE OR REPLACE FUNCTION prevent_duplicate_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_count INTEGER;
BEGIN
  -- Verificar se já existe um log similar nos últimos 5 segundos
  -- Similar = mesmo rota_id + mesmo evento + mesmo usuario_id
  SELECT COUNT(*) INTO v_existing_count
  FROM logs
  WHERE rota_id IS NOT DISTINCT FROM NEW.rota_id
    AND evento = NEW.evento
    AND usuario_id IS NOT DISTINCT FROM NEW.usuario_id
    AND timestamp > NOW() - INTERVAL '5 seconds';

  -- Se já existe um log similar recente, bloquear inserção
  IF v_existing_count > 0 THEN
    RAISE NOTICE 'Log duplicado bloqueado: evento=%, rota_id=%, usuario_id=%',
      NEW.evento, NEW.rota_id, NEW.usuario_id;
    RETURN NULL; -- NULL cancela a inserção
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================
-- SEÇÃO 2: Criar trigger BEFORE INSERT
-- =============================================

DROP TRIGGER IF EXISTS prevent_duplicate_log_trigger ON logs;

CREATE TRIGGER prevent_duplicate_log_trigger
  BEFORE INSERT ON logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_log();

-- =============================================
-- SEÇÃO 3: Limpar logs duplicados existentes
-- =============================================

-- Remover logs duplicados mantendo apenas o mais antigo de cada grupo
-- (mesmo rota_id + mesmo evento dentro de 5 segundos)

WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY rota_id, evento, usuario_id,
                        DATE_TRUNC('second', timestamp)
           ORDER BY timestamp ASC
         ) as rn
  FROM logs
  WHERE evento = 'motorista_iniciou_rota'
)
DELETE FROM logs
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- =============================================
-- SEÇÃO 4: Verificação
-- =============================================

DO $$
DECLARE
  v_deleted INTEGER;
  v_remaining INTEGER;
BEGIN
  -- Contar quantos duplicados foram removidos (já executou acima)
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Contar logs restantes de motorista_iniciou_rota
  SELECT COUNT(*) INTO v_remaining
  FROM logs
  WHERE evento = 'motorista_iniciou_rota';

  RAISE NOTICE '';
  RAISE NOTICE '=== RESULTADO ===';
  RAISE NOTICE 'Logs motorista_iniciou_rota restantes: %', v_remaining;
  RAISE NOTICE 'Trigger prevent_duplicate_log_trigger: ATIVO';
  RAISE NOTICE '';
  RAISE NOTICE 'A partir de agora, logs duplicados serão automaticamente bloqueados.';
END $$;

-- =============================================
-- SEÇÃO 5: Documentação
-- =============================================

COMMENT ON FUNCTION prevent_duplicate_log() IS
'Trigger BEFORE INSERT que previne inserção de logs duplicados.
Um log é considerado duplicado se existe outro com:
- Mesmo rota_id
- Mesmo evento
- Mesmo usuario_id
- Criado nos últimos 5 segundos

Isso resolve o problema de logs duplicados de motorista_iniciou_rota
independentemente da fonte original do log duplicado.

Migration: 20251227000001_prevent_duplicate_logs.sql';

COMMENT ON TRIGGER prevent_duplicate_log_trigger ON logs IS
'Trigger que bloqueia inserção de logs duplicados (5 segundos)';
