-- ============================================
-- MIGRATION CONSOLIDADA v1.4.0: Sistema de Expiração de Rotas
-- Data: 2025-12-21
-- ============================================
--
-- Este arquivo consolida 6 migrações na ORDEM CORRETA de execução:
-- 1. Adicionar status 'nao_executada' ao constraint (CRÍTICO - PRIMEIRO!)
-- 2. Criar funções remind_pending_routes e expire_old_pending_routes
-- 3. Atualizar view vw_performance_motoristas com métricas de expiração
-- 4. Adicionar parâmetro de urgência à função de lembrete
-- 5. Habilitar REPLICA IDENTITY FULL para notificacoes (Realtime)
-- 6. Atualizar função para notificar TODOS os gestores
--
-- INSTRUÇÕES:
-- 1. Abrir Supabase Dashboard → SQL Editor
-- 2. Colar este script inteiro
-- 3. Clicar em "Run"
-- 4. Verificar resultado de cada seção
--
-- ============================================

-- ============================================
-- SEÇÃO 1: Adicionar status 'nao_executada' ao constraint
-- CRÍTICO: Deve ser executado PRIMEIRO!
-- ============================================

-- Remover constraint existente
ALTER TABLE rotas DROP CONSTRAINT IF EXISTS rotas_status_check;

-- Adicionar nova constraint com 'nao_executada'
ALTER TABLE rotas ADD CONSTRAINT rotas_status_check
  CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada', 'nao_executada'));

-- Comentário para documentação
COMMENT ON COLUMN rotas.status IS 'Status da rota: pendente (aguardando início), em_andamento (motorista executando), concluida (todas paradas finalizadas), cancelada (cancelada pelo gestor), nao_executada (expirou sem ser concluída)';

-- Verificação
DO $$
BEGIN
  RAISE NOTICE '✅ SEÇÃO 1: Status nao_executada adicionado ao constraint';
END $$;

-- ============================================
-- SEÇÃO 2: Criar função remind_pending_routes (versão básica)
-- Esta será sobrescrita pela SEÇÃO 4 com parâmetro de urgência
-- ============================================

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
  FOR r IN
    SELECT ro.id, ro.unidade_id, ro.motorista_id, ro.data
    FROM rotas ro
    WHERE ro.data = CURRENT_DATE
      AND ro.status = 'pendente'
      AND ro.motorista_id IS NOT NULL
  LOOP
    v_found := v_found + 1;
    SELECT nome INTO v_motorista_nome FROM usuarios WHERE id = r.motorista_id;
    SELECT nome INTO v_unidade_nome FROM unidades WHERE id = r.unidade_id;
    SELECT COUNT(*) INTO v_paradas_count FROM paradas
    WHERE rota_id = r.id AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);

    PERFORM criar_notificacao(
      r.motorista_id,
      'lembrete_rota_pendente',
      '⏰ Lembrete: Rota pendente!',
      format('Você ainda tem uma rota pendente para hoje com %s parada(s). Expediente termina às 17h!', v_paradas_count),
      r.id, NULL, NULL
    );
    v_sent := v_sent + 1;
  END LOOP;

  routes_found := v_found;
  reminders_sent := v_sent;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION remind_pending_routes TO authenticated;
GRANT EXECUTE ON FUNCTION remind_pending_routes TO service_role;
COMMENT ON FUNCTION remind_pending_routes IS 'Envia lembrete aos motoristas com rotas pendentes do dia. Chamar via Edge Function às 16:00.';

DO $$
BEGIN
  RAISE NOTICE '✅ SEÇÃO 2: Função remind_pending_routes criada';
END $$;

-- ============================================
-- SEÇÃO 3: Criar/Atualizar função expire_old_pending_routes
-- ============================================

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
  FOR r IN
    SELECT ro.id, ro.unidade_id, ro.motorista_id, ro.data
    FROM rotas ro
    WHERE ro.data <= CURRENT_DATE
      AND ro.status = 'pendente'
  LOOP
    UPDATE rotas SET status = 'nao_executada' WHERE id = r.id;
    v_expired := v_expired + 1;

    IF r.motorista_id IS NOT NULL THEN
      SELECT nome INTO v_motorista_nome FROM usuarios WHERE id = r.motorista_id;
    ELSE
      v_motorista_nome := 'não atribuído';
    END IF;

    SELECT nome INTO v_unidade_nome FROM unidades WHERE id = r.unidade_id;
    SELECT COUNT(*) INTO v_paradas_count FROM paradas
    WHERE rota_id = r.id AND status = 'pendente' AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);

    SELECT id INTO v_gestor_id FROM usuarios
    WHERE unidade_id = r.unidade_id AND papel = 'gestor' LIMIT 1;

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
        r.id, NULL, NULL
      );
      v_notified := v_notified + 1;
    END IF;

    IF r.motorista_id IS NOT NULL THEN
      PERFORM criar_notificacao(
        r.motorista_id,
        'rota_nao_executada',
        '❌ Rota não executada',
        format('Sua rota de %s não foi executada e foi encerrada. %s parada(s) ficaram pendentes. Entre em contato com seu gestor se necessário.',
          TO_CHAR(r.data, 'DD/MM'),
          v_paradas_count
        ),
        r.id, NULL, NULL
      );
      v_notified := v_notified + 1;
    END IF;
  END LOOP;

  expired_count := v_expired;
  notifications_sent := v_notified;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION expire_old_pending_routes IS 'Expira rotas pendentes do dia e notifica GESTOR e MOTORISTA. Chamar via Edge Function às 22:00.';

DO $$
BEGIN
  RAISE NOTICE '✅ SEÇÃO 3: Função expire_old_pending_routes criada';
END $$;

-- ============================================
-- SEÇÃO 4: Atualizar view vw_performance_motoristas
-- ============================================

DROP VIEW IF EXISTS vw_performance_motoristas CASCADE;

CREATE VIEW vw_performance_motoristas AS
SELECT
  u.id,
  u.nome,
  u.unidade_id,
  un.nome as unidade_nome,
  COUNT(r.id) as total_rotas,
  COUNT(r.id) FILTER (WHERE r.status = 'concluida') as rotas_concluidas,
  COUNT(r.id) FILTER (WHERE r.status = 'em_andamento') as rotas_em_andamento,
  COUNT(r.id) FILTER (WHERE r.status = 'nao_executada') as rotas_nao_executadas,
  COUNT(r.id) FILTER (WHERE r.status = 'cancelada') as rotas_canceladas,
  CASE
    WHEN COUNT(r.id) FILTER (WHERE r.status IN ('concluida', 'nao_executada')) > 0
    THEN ROUND(
      COUNT(r.id) FILTER (WHERE r.status = 'concluida')::DECIMAL * 100 /
      COUNT(r.id) FILTER (WHERE r.status IN ('concluida', 'nao_executada')),
      1
    )
    ELSE 100.0
  END as taxa_execucao,
  SUM(r.distancia_total) as distancia_total_km,
  AVG(r.tempo_total) as tempo_medio_minutos
FROM usuarios u
LEFT JOIN rotas r ON r.motorista_id = u.id
LEFT JOIN unidades un ON u.unidade_id = un.id
WHERE u.papel = 'motorista' AND u.ativo = true
GROUP BY u.id, u.nome, u.unidade_id, un.nome;

COMMENT ON VIEW vw_performance_motoristas IS 'KPIs de performance dos motoristas incluindo taxa de execução de rotas';

DO $$
BEGIN
  RAISE NOTICE '✅ SEÇÃO 4: View vw_performance_motoristas atualizada';
END $$;

-- ============================================
-- SEÇÃO 5: Atualizar remind_pending_routes com parâmetro de urgência
-- ============================================

DROP FUNCTION IF EXISTS remind_pending_routes();

CREATE OR REPLACE FUNCTION remind_pending_routes(
  p_urgency TEXT DEFAULT 'normal'
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
  FOR r IN
    SELECT ro.id, ro.unidade_id, ro.motorista_id, ro.data
    FROM rotas ro
    WHERE ro.data = CURRENT_DATE
      AND ro.status = 'pendente'
      AND ro.motorista_id IS NOT NULL
  LOOP
    v_found := v_found + 1;
    SELECT nome INTO v_motorista_nome FROM usuarios WHERE id = r.motorista_id;
    SELECT nome INTO v_unidade_nome FROM unidades WHERE id = r.unidade_id;
    SELECT COUNT(*) INTO v_paradas_count FROM paradas
    WHERE rota_id = r.id AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);

    IF p_urgency = 'final' THEN
      v_tipo_notificacao := 'lembrete_rota_urgente';
      v_titulo := '🚨 URGENTE: Rota expira em 2 horas!';
      v_mensagem := format(
        'Sua rota com %s parada(s) expira às 22:00! Inicie agora ou ela será marcada como não executada.',
        v_paradas_count
      );
    ELSE
      v_tipo_notificacao := 'lembrete_rota_pendente';
      v_titulo := '⏰ Lembrete: Rota pendente!';
      v_mensagem := format(
        'Você ainda tem uma rota pendente para hoje com %s parada(s). Expediente termina às 17h!',
        v_paradas_count
      );
    END IF;

    PERFORM criar_notificacao(
      r.motorista_id,
      v_tipo_notificacao,
      v_titulo,
      v_mensagem,
      r.id, NULL, NULL
    );
    v_sent := v_sent + 1;
  END LOOP;

  routes_found := v_found;
  reminders_sent := v_sent;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION remind_pending_routes(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION remind_pending_routes(TEXT) TO service_role;
COMMENT ON FUNCTION remind_pending_routes(TEXT) IS
  'Envia lembrete aos motoristas com rotas pendentes. Param p_urgency: "normal" (16:00) ou "final" (20:00 - 2h antes expiração).';

DO $$
BEGIN
  RAISE NOTICE '✅ SEÇÃO 5: Função remind_pending_routes atualizada com parâmetro de urgência';
END $$;

-- ============================================
-- SEÇÃO 6: Habilitar REPLICA IDENTITY FULL para notificacoes
-- ============================================

ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;
COMMENT ON TABLE public.notificacoes IS 'Notificações para gestores/motoristas sobre eventos nas rotas. Realtime habilitado com REPLICA IDENTITY FULL.';

DO $$
BEGIN
  RAISE NOTICE '✅ SEÇÃO 6: REPLICA IDENTITY FULL habilitado para notificacoes';
END $$;

-- ============================================
-- SEÇÃO 7: Atualizar expire para notificar TODOS os gestores
-- ============================================

CREATE OR REPLACE FUNCTION expire_old_pending_routes()
RETURNS TABLE(
  expired_count INTEGER,
  notifications_sent INTEGER
) AS $$
DECLARE
  r RECORD;
  g RECORD;
  v_motorista_nome VARCHAR;
  v_unidade_nome VARCHAR;
  v_paradas_count INTEGER;
  v_expired INTEGER := 0;
  v_notified INTEGER := 0;
BEGIN
  FOR r IN
    SELECT ro.id, ro.unidade_id, ro.motorista_id, ro.data
    FROM rotas ro
    WHERE ro.data <= CURRENT_DATE
      AND ro.status = 'pendente'
  LOOP
    UPDATE rotas SET status = 'nao_executada' WHERE id = r.id;
    v_expired := v_expired + 1;

    IF r.motorista_id IS NOT NULL THEN
      SELECT nome INTO v_motorista_nome FROM usuarios WHERE id = r.motorista_id;
    ELSE
      v_motorista_nome := 'não atribuído';
    END IF;

    SELECT nome INTO v_unidade_nome FROM unidades WHERE id = r.unidade_id;
    SELECT COUNT(*) INTO v_paradas_count FROM paradas
    WHERE rota_id = r.id AND status = 'pendente' AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);

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
        r.id, NULL, NULL
      );
      v_notified := v_notified + 1;
    END LOOP;

    IF r.motorista_id IS NOT NULL THEN
      PERFORM criar_notificacao(
        r.motorista_id,
        'rota_nao_executada',
        '❌ Rota não executada',
        format('Sua rota de %s não foi executada e foi encerrada. %s parada(s) ficaram pendentes. Entre em contato com seu gestor se necessário.',
          TO_CHAR(r.data, 'DD/MM'),
          v_paradas_count
        ),
        r.id, NULL, NULL
      );
      v_notified := v_notified + 1;
    END IF;
  END LOOP;

  expired_count := v_expired;
  notifications_sent := v_notified;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION expire_old_pending_routes IS 'Expira rotas pendentes do dia e notifica TODOS os gestores da unidade + motorista. Chamar via Edge Function às 22:00.';

DO $$
BEGIN
  RAISE NOTICE '✅ SEÇÃO 7: Função expire_old_pending_routes atualizada para notificar todos gestores';
END $$;

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '🎉 MIGRATION v1.4.0 CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Verificações sugeridas:';
  RAISE NOTICE '1. SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = ''rotas_status_check'';';
  RAISE NOTICE '2. SELECT * FROM remind_pending_routes(''normal'');';
  RAISE NOTICE '3. SELECT * FROM vw_performance_motoristas LIMIT 5;';
  RAISE NOTICE '';
END $$;
