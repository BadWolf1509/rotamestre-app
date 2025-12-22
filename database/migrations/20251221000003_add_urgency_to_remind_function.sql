-- ============================================
-- Migration: Adicionar parâmetro de urgência à função de lembrete
-- Data: 2025-12-21
-- Descrição:
--   Atualiza remind_pending_routes para aceitar parâmetro p_urgency:
--   - 'normal': Lembrete padrão às 16:00
--   - 'final': Aviso URGENTE às 20:00 (2h antes da expiração)
--
--   O motorista recebe mensagens diferenciadas baseadas no nível de urgência.
-- ============================================

-- Dropar função existente para recriar com novo parâmetro
DROP FUNCTION IF EXISTS remind_pending_routes();

-- Recriar função COM parâmetro de urgência
CREATE OR REPLACE FUNCTION remind_pending_routes(
  p_urgency TEXT DEFAULT 'normal'  -- 'normal' (16:00) ou 'final' (20:00)
)
RETURNS TABLE(
  routes_found INTEGER,
  reminders_sent INTEGER
) AS $$
DECLARE
  r RECORD;
  v_motorista_nome VARCHAR;
  v_unidade_nome VARCHAR;
  v_paradas_count INTEGER;
  v_found INTEGER := 0;
  v_sent INTEGER := 0;
  v_titulo VARCHAR;
  v_mensagem VARCHAR;
  v_tipo_notificacao VARCHAR;
BEGIN
  -- Encontrar todas as rotas pendentes do dia atual
  FOR r IN
    SELECT ro.id, ro.unidade_id, ro.motorista_id, ro.data
    FROM rotas ro
    WHERE ro.data = CURRENT_DATE
      AND ro.status = 'pendente'
      AND ro.motorista_id IS NOT NULL
  LOOP
    v_found := v_found + 1;

    -- Buscar nome do motorista
    SELECT nome INTO v_motorista_nome
    FROM usuarios
    WHERE id = r.motorista_id;

    -- Buscar nome da unidade
    SELECT nome INTO v_unidade_nome
    FROM unidades
    WHERE id = r.unidade_id;

    -- Contar paradas (excluindo checkpoints)
    SELECT COUNT(*) INTO v_paradas_count
    FROM paradas
    WHERE rota_id = r.id
      AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);

    -- Definir mensagem baseada na urgência
    IF p_urgency = 'final' THEN
      -- Aviso FINAL às 20:00 - 2h antes da expiração
      v_tipo_notificacao := 'lembrete_rota_urgente';
      v_titulo := '🚨 URGENTE: Rota expira em 2 horas!';
      v_mensagem := format(
        'Sua rota com %s parada(s) expira às 22:00! Inicie agora ou ela será marcada como não executada.',
        v_paradas_count
      );
    ELSE
      -- Lembrete normal às 16:00
      v_tipo_notificacao := 'lembrete_rota_pendente';
      v_titulo := '⏰ Lembrete: Rota pendente!';
      v_mensagem := format(
        'Você ainda tem uma rota pendente para hoje com %s parada(s). Expediente termina às 17h!',
        v_paradas_count
      );
    END IF;

    -- Notificar MOTORISTA com lembrete apropriado
    PERFORM criar_notificacao(
      r.motorista_id,
      v_tipo_notificacao,
      v_titulo,
      v_mensagem,
      r.id,
      NULL,
      NULL
    );
    v_sent := v_sent + 1;

  END LOOP;

  -- Retornar estatísticas
  routes_found := v_found;
  reminders_sent := v_sent;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Grant para permitir chamada via RPC
GRANT EXECUTE ON FUNCTION remind_pending_routes(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION remind_pending_routes(TEXT) TO service_role;

-- Comentário atualizado
COMMENT ON FUNCTION remind_pending_routes(TEXT) IS
  'Envia lembrete aos motoristas com rotas pendentes. Param p_urgency: "normal" (16:00) ou "final" (20:00 - 2h antes expiração).';

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Após executar, teste:
-- SELECT * FROM remind_pending_routes('normal');  -- Lembrete padrão
-- SELECT * FROM remind_pending_routes('final');   -- Aviso urgente
