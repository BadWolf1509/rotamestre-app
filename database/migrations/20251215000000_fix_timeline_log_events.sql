-- =============================================
-- Migration: Fix Timeline Log Events
-- Data: 2024-12-15
-- Descrição: Atualiza o trigger log_rota_status_change para criar
--            logs com eventos reconhecíveis pela timeline
-- =============================================

-- Problema:
-- O trigger atual cria logs com evento='status_changed', mas a
-- RouteTimeline procura por 'iniciou', 'start', 'concluiu', etc.
-- Isso faz a timeline ficar vazia.

-- Solução:
-- Atualizar o trigger para usar nomes de eventos descritivos
-- que a RouteTimeline possa reconhecer.

-- =============================================
-- Atualizar função log_rota_status_change
-- =============================================

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

-- =============================================
-- Verificação
-- =============================================

-- Mostrar função atualizada
SELECT
  proname AS "Função",
  'Atualizada' AS "Status"
FROM pg_proc
WHERE proname = 'log_rota_status_change';

-- =============================================
-- Comentário
-- =============================================

COMMENT ON FUNCTION log_rota_status_change() IS
'Trigger que cria logs quando o status de uma rota muda.
Eventos gerados:
- motorista_iniciou_rota: quando status muda de pendente para em_andamento
- motorista_concluiu_rota: quando status muda para concluida
- rota_cancelada: quando status muda para cancelada
- status_alterado: outras mudanças de status';
