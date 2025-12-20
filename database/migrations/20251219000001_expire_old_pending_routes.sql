-- ============================================
-- Migration: Expirar Rotas Pendentes de Dias Anteriores
-- Data: 2025-12-19
-- Descrição: Função para marcar rotas pendentes antigas como não executadas
--            e notificar o gestor
-- ============================================

-- Função para expirar rotas pendentes de dias anteriores
-- Deve ser chamada via Edge Function ou cron job às 07:00
CREATE OR REPLACE FUNCTION expire_old_pending_routes()
RETURNS TABLE(
  expired_count INTEGER,
  notifications_sent INTEGER
) AS $$
DECLARE
  r RECORD;
  v_gestor_id UUID;
  v_motorista_nome VARCHAR;
  v_expired INTEGER := 0;
  v_notified INTEGER := 0;
BEGIN
  -- Encontrar todas as rotas pendentes de dias anteriores
  FOR r IN
    SELECT ro.id, ro.unidade_id, ro.motorista_id, ro.data
    FROM rotas ro
    WHERE ro.data < CURRENT_DATE
      AND ro.status = 'pendente'
  LOOP
    -- Atualizar status para nao_executada
    UPDATE rotas
    SET status = 'nao_executada'
    WHERE id = r.id;

    v_expired := v_expired + 1;

    -- Buscar gestor da unidade
    SELECT id INTO v_gestor_id
    FROM usuarios
    WHERE unidade_id = r.unidade_id
      AND papel = 'gestor'
    LIMIT 1;

    -- Buscar nome do motorista
    IF r.motorista_id IS NOT NULL THEN
      SELECT nome INTO v_motorista_nome
      FROM usuarios
      WHERE id = r.motorista_id;
    ELSE
      v_motorista_nome := 'não atribuído';
    END IF;

    -- Notificar gestor
    IF v_gestor_id IS NOT NULL THEN
      PERFORM criar_notificacao(
        v_gestor_id,
        'rota_nao_executada',
        '⚠️ Rota não executada',
        format('A rota de %s atribuída a %s não foi executada.',
          TO_CHAR(r.data, 'DD/MM'),
          COALESCE(v_motorista_nome, 'motorista não identificado')
        ),
        r.id,
        NULL,
        NULL
      );
      v_notified := v_notified + 1;
    END IF;
  END LOOP;

  -- Retornar estatísticas
  expired_count := v_expired;
  notifications_sent := v_notified;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant para permitir chamada via RPC
GRANT EXECUTE ON FUNCTION expire_old_pending_routes TO authenticated;
GRANT EXECUTE ON FUNCTION expire_old_pending_routes TO service_role;

-- Comentários
COMMENT ON FUNCTION expire_old_pending_routes IS 'Expira rotas pendentes de dias anteriores e notifica gestores. Chamar via Edge Function às 07:00.';
