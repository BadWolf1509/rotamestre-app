-- ============================================
-- Migration: Notificação "Nova Rota Atribuída"
-- Data: 2025-12-19
-- Descrição: Trigger para notificar motorista quando rota é atribuída
-- ============================================

-- Trigger: Notificar motorista quando rota é atribuída
CREATE OR REPLACE FUNCTION notify_motorista_nova_rota()
RETURNS TRIGGER AS $$
DECLARE
  v_unidade_nome VARCHAR;
  v_paradas_count INTEGER;
BEGIN
  -- Só dispara quando motorista_id é preenchido (nova atribuição)
  -- OLD.motorista_id IS NULL = rota estava sem motorista
  -- NEW.motorista_id IS NOT NULL = rota agora tem motorista
  IF (OLD.motorista_id IS NULL OR OLD.motorista_id IS DISTINCT FROM NEW.motorista_id)
     AND NEW.motorista_id IS NOT NULL THEN

    -- Buscar nome da unidade
    SELECT nome INTO v_unidade_nome
    FROM unidades
    WHERE id = NEW.unidade_id;

    -- Contar paradas (excluindo checkpoints de partida/chegada)
    SELECT COUNT(*) INTO v_paradas_count
    FROM paradas
    WHERE rota_id = NEW.id
      AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);

    -- Criar notificação para o MOTORISTA
    PERFORM criar_notificacao(
      NEW.motorista_id,  -- Destinatário: motorista
      'nova_rota_atribuida',
      '🚗 Nova rota atribuída!',
      format('Você recebeu uma nova rota de %s com %s parada(s). Toque para ver detalhes.',
        COALESCE(v_unidade_nome, 'sua unidade'),
        v_paradas_count
      ),
      NEW.id,  -- rota_id
      NULL,    -- parada_id
      NULL     -- incidente_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_nova_rota_atribuida ON rotas;

-- Criar novo trigger
CREATE TRIGGER trigger_nova_rota_atribuida
  AFTER UPDATE ON rotas
  FOR EACH ROW
  EXECUTE FUNCTION notify_motorista_nova_rota();

-- Também notificar quando rota é criada já com motorista atribuído
CREATE OR REPLACE FUNCTION notify_motorista_nova_rota_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_unidade_nome VARCHAR;
  v_paradas_count INTEGER;
BEGIN
  -- Só dispara se motorista_id já estiver preenchido na criação
  IF NEW.motorista_id IS NOT NULL THEN

    -- Buscar nome da unidade
    SELECT nome INTO v_unidade_nome
    FROM unidades
    WHERE id = NEW.unidade_id;

    -- Contar paradas (pode ser 0 se paradas forem adicionadas depois)
    SELECT COUNT(*) INTO v_paradas_count
    FROM paradas
    WHERE rota_id = NEW.id
      AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);

    -- Criar notificação para o MOTORISTA
    PERFORM criar_notificacao(
      NEW.motorista_id,
      'nova_rota_atribuida',
      '🚗 Nova rota atribuída!',
      format('Você recebeu uma nova rota de %s. Toque para ver detalhes.',
        COALESCE(v_unidade_nome, 'sua unidade')
      ),
      NEW.id,
      NULL,
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_nova_rota_atribuida_insert ON rotas;

-- Criar trigger para INSERT
CREATE TRIGGER trigger_nova_rota_atribuida_insert
  AFTER INSERT ON rotas
  FOR EACH ROW
  EXECUTE FUNCTION notify_motorista_nova_rota_insert();

-- Comentários
COMMENT ON FUNCTION notify_motorista_nova_rota IS 'Notifica motorista quando rota é atribuída a ele (UPDATE)';
COMMENT ON FUNCTION notify_motorista_nova_rota_insert IS 'Notifica motorista quando rota é criada já com motorista atribuído (INSERT)';
