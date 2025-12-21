-- ============================================
-- Migration: Lembrete de Rota Pendente e Expiração com Notificação ao Motorista
-- Data: 2025-12-21
-- Descrição:
--   1. Função para enviar lembrete às 16:00 sobre rotas pendentes do dia
--   2. Atualizar função de expiração para notificar TAMBÉM o motorista às 22:00
-- ============================================

-- ============================================
-- PARTE 1: Função de Lembrete (16:00)
-- ============================================

-- Função para enviar lembretes sobre rotas pendentes do dia atual
-- Deve ser chamada via Edge Function ou cron job às 16:00
CREATE OR REPLACE FUNCTION remind_pending_routes()
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

    -- Notificar MOTORISTA com lembrete
    PERFORM criar_notificacao(
      r.motorista_id,
      'lembrete_rota_pendente',
      '⏰ Lembrete: Rota pendente!',
      format('Você ainda tem uma rota pendente para hoje com %s parada(s). Expediente termina às 17h!',
        v_paradas_count
      ),
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
GRANT EXECUTE ON FUNCTION remind_pending_routes TO authenticated;
GRANT EXECUTE ON FUNCTION remind_pending_routes TO service_role;

-- Comentário
COMMENT ON FUNCTION remind_pending_routes IS 'Envia lembrete aos motoristas com rotas pendentes do dia. Chamar via Edge Function às 16:00.';

-- ============================================
-- PARTE 2: Atualizar Função de Expiração (22:00)
-- ============================================

-- Substituir função existente para TAMBÉM notificar o motorista
CREATE OR REPLACE FUNCTION expire_old_pending_routes()
RETURNS TABLE(
  expired_count INTEGER,
  notifications_sent INTEGER
) AS $$
DECLARE
  r RECORD;
  v_gestor_id UUID;
  v_motorista_nome VARCHAR;
  v_unidade_nome VARCHAR;
  v_paradas_count INTEGER;
  v_expired INTEGER := 0;
  v_notified INTEGER := 0;
BEGIN
  -- Encontrar todas as rotas pendentes de HOJE (às 22:00, ainda é o mesmo dia)
  -- E também rotas de dias anteriores que por algum motivo não foram processadas
  FOR r IN
    SELECT ro.id, ro.unidade_id, ro.motorista_id, ro.data
    FROM rotas ro
    WHERE ro.data <= CURRENT_DATE
      AND ro.status = 'pendente'
  LOOP
    -- Atualizar status para nao_executada
    UPDATE rotas
    SET status = 'nao_executada'
    WHERE id = r.id;

    v_expired := v_expired + 1;

    -- Buscar nome do motorista
    IF r.motorista_id IS NOT NULL THEN
      SELECT nome INTO v_motorista_nome
      FROM usuarios
      WHERE id = r.motorista_id;
    ELSE
      v_motorista_nome := 'não atribuído';
    END IF;

    -- Buscar nome da unidade
    SELECT nome INTO v_unidade_nome
    FROM unidades
    WHERE id = r.unidade_id;

    -- Contar paradas que não foram concluídas
    SELECT COUNT(*) INTO v_paradas_count
    FROM paradas
    WHERE rota_id = r.id
      AND status = 'pendente'
      AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);

    -- Buscar gestor da unidade
    SELECT id INTO v_gestor_id
    FROM usuarios
    WHERE unidade_id = r.unidade_id
      AND papel = 'gestor'
    LIMIT 1;

    -- Notificar GESTOR
    IF v_gestor_id IS NOT NULL THEN
      PERFORM criar_notificacao(
        v_gestor_id,
        'rota_nao_executada',
        '⚠️ Rota não executada',
        format('A rota de %s atribuída a %s não foi executada. %s parada(s) ficaram pendentes.',
          TO_CHAR(r.data, 'DD/MM'),
          COALESCE(v_motorista_nome, 'motorista não identificado'),
          v_paradas_count
        ),
        r.id,
        NULL,
        NULL
      );
      v_notified := v_notified + 1;
    END IF;

    -- Notificar MOTORISTA (NOVO!)
    IF r.motorista_id IS NOT NULL THEN
      PERFORM criar_notificacao(
        r.motorista_id,
        'rota_nao_executada',
        '❌ Rota não executada',
        format('Sua rota de %s não foi executada e foi encerrada. %s parada(s) ficaram pendentes. Entre em contato com seu gestor se necessário.',
          TO_CHAR(r.data, 'DD/MM'),
          v_paradas_count
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Comentários atualizados
COMMENT ON FUNCTION expire_old_pending_routes IS 'Expira rotas pendentes do dia e notifica GESTOR e MOTORISTA. Chamar via Edge Function às 22:00.';

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Após executar, verifique se as funções foram criadas:
-- SELECT proname, prosrc FROM pg_proc WHERE proname IN ('remind_pending_routes', 'expire_old_pending_routes');
