-- ============================================
-- Migration: Notificar TODOS os gestores da unidade
-- Data: 2025-12-21
-- Problema: A função expire_old_pending_routes usava LIMIT 1
-- para buscar o gestor, notificando apenas o primeiro.
-- Solução: Usar loop FOR para notificar TODOS os gestores.
-- ============================================

-- Recriar função para notificar TODOS os gestores
CREATE OR REPLACE FUNCTION expire_old_pending_routes()
RETURNS TABLE(
  expired_count INTEGER,
  notifications_sent INTEGER
) AS $$
DECLARE
  r RECORD;
  g RECORD;  -- Para loop de gestores
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

    -- Notificar TODOS os gestores da unidade (não apenas o primeiro!)
    FOR g IN
      SELECT id, nome
      FROM usuarios
      WHERE unidade_id = r.unidade_id
        AND papel = 'gestor'
    LOOP
      PERFORM criar_notificacao(
        g.id,
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
    END LOOP;

    -- Notificar MOTORISTA
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

-- Comentário atualizado
COMMENT ON FUNCTION expire_old_pending_routes IS 'Expira rotas pendentes do dia e notifica TODOS os gestores da unidade + motorista. Chamar via Edge Function às 22:00.';

-- ============================================
-- Também corrigir remind_pending_routes para notificar todos os gestores
-- (se no futuro quisermos notificar gestores sobre rotas pendentes)
-- ============================================
