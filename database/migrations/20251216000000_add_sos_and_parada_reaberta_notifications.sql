-- =============================================
-- Migration: Add SOS and Parada Reaberta Notifications
-- =============================================
-- Data: 2025-12-16
-- Descrição: Adiciona triggers de notificação para eventos críticos
--
-- Novos triggers:
-- - notify_sos_acionado: Notifica gestor quando motorista aciona SOS (EMERGÊNCIA)
-- - notify_parada_reaberta: Notifica gestor quando parada volta para pendente
--
-- Estes eventos são importantes para o gestor acompanhar em tempo real:
-- - SOS: Situação de emergência que requer ação imediata
-- - Parada Reaberta: Indica que algo deu errado e parada precisa ser refeita

-- =============================================
-- TRIGGER: notify_sos_acionado (CRÍTICO)
-- =============================================
-- Dispara quando um log de 'sos_acionado' é inserido
-- Este é um evento de EMERGÊNCIA que deve ser tratado com prioridade máxima

CREATE OR REPLACE FUNCTION notify_sos_acionado()
RETURNS TRIGGER AS $$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_unidade_id UUID;
  v_rota_endereco VARCHAR(255);
  v_motivo TEXT;
BEGIN
  -- Apenas processar logs de SOS
  IF NEW.evento != 'sos_acionado' THEN
    RETURN NEW;
  END IF;

  -- Buscar unidade através da rota (se existir)
  IF NEW.rota_id IS NOT NULL THEN
    SELECT r.unidade_id, p.endereco
    INTO v_unidade_id, v_rota_endereco
    FROM public.rotas r
    LEFT JOIN public.paradas p ON p.rota_id = r.id AND p.ordem = 1
    WHERE r.id = NEW.rota_id;
  END IF;

  -- Se não tem rota, buscar unidade do usuário
  IF v_unidade_id IS NULL AND NEW.usuario_id IS NOT NULL THEN
    SELECT uu.unidade_id
    INTO v_unidade_id
    FROM public.usuario_unidades uu
    WHERE uu.usuario_id = NEW.usuario_id
      AND uu.ativo = true
      AND uu.is_principal = true
    LIMIT 1;
  END IF;

  -- Buscar nome do motorista
  SELECT nome INTO v_motorista_nome
  FROM public.usuarios
  WHERE id = NEW.usuario_id;

  -- Extrair motivo dos detalhes (se disponível)
  IF NEW.detalhes IS NOT NULL AND NEW.detalhes::jsonb ? 'motivo' THEN
    v_motivo := NEW.detalhes::jsonb->>'motivo';
  ELSE
    v_motivo := 'Emergência acionada';
  END IF;

  -- Buscar gestor via usuario_unidades
  SELECT uu.usuario_id INTO v_gestor_id
  FROM public.usuario_unidades uu
  WHERE uu.unidade_id = v_unidade_id
    AND uu.papel = 'gestor'
    AND uu.ativo = true
  LIMIT 1;

  IF v_gestor_id IS NOT NULL THEN
    PERFORM criar_notificacao(
      v_gestor_id,
      'sos_acionado',
      '🚨 SOS - EMERGÊNCIA',
      'O motorista ' || COALESCE(v_motorista_nome, 'Não identificado') ||
      ' acionou o botão de emergência! ' || COALESCE(v_motivo, ''),
      NEW.rota_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na tabela logs
DROP TRIGGER IF EXISTS trigger_notify_sos_acionado ON public.logs;
CREATE TRIGGER trigger_notify_sos_acionado
  AFTER INSERT ON public.logs
  FOR EACH ROW
  WHEN (NEW.evento = 'sos_acionado')
  EXECUTE FUNCTION notify_sos_acionado();

-- =============================================
-- TRIGGER: notify_parada_reaberta
-- =============================================
-- Dispara quando uma parada muda de 'concluida' ou 'pulada' para 'pendente'
-- Isso indica que a parada precisa ser refeita

CREATE OR REPLACE FUNCTION notify_parada_reaberta()
RETURNS TRIGGER AS $$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_unidade_id UUID;
BEGIN
  -- Quando parada volta para 'pendente' de outro status
  IF NEW.status = 'pendente' AND OLD.status IN ('concluida', 'pulada') THEN
    -- Buscar unidade_id e nome do motorista através da rota
    SELECT r.unidade_id, u.nome
    INTO v_unidade_id, v_motorista_nome
    FROM public.rotas r
    LEFT JOIN public.usuarios u ON u.id = r.motorista_id
    WHERE r.id = NEW.rota_id;

    -- Buscar gestor via usuario_unidades
    SELECT uu.usuario_id INTO v_gestor_id
    FROM public.usuario_unidades uu
    WHERE uu.unidade_id = v_unidade_id
      AND uu.papel = 'gestor'
      AND uu.ativo = true
    LIMIT 1;

    IF v_gestor_id IS NOT NULL THEN
      PERFORM criar_notificacao(
        v_gestor_id,
        'parada_reaberta',
        'Parada Reaberta',
        'A parada #' || NEW.ordem || ' foi reaberta: ' ||
        SUBSTRING(NEW.endereco, 1, 50) ||
        CASE WHEN v_motorista_nome IS NOT NULL
          THEN ' (Motorista: ' || v_motorista_nome || ')'
          ELSE ''
        END,
        NEW.rota_id,
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na tabela paradas
DROP TRIGGER IF EXISTS trigger_notify_parada_reaberta ON public.paradas;
CREATE TRIGGER trigger_notify_parada_reaberta
  AFTER UPDATE ON public.paradas
  FOR EACH ROW
  WHEN (NEW.status = 'pendente' AND OLD.status IN ('concluida', 'pulada'))
  EXECUTE FUNCTION notify_parada_reaberta();

-- =============================================
-- ADICIONAR TIPOS AO ENUM (se necessário)
-- =============================================
-- Nota: A coluna 'tipo' em notificacoes é VARCHAR, não enum
-- Então não precisa alterar schema, apenas documentar os novos tipos

COMMENT ON FUNCTION notify_sos_acionado IS
  'Notifica gestor quando motorista aciona botão SOS de emergência. PRIORIDADE MÁXIMA.';

COMMENT ON FUNCTION notify_parada_reaberta IS
  'Notifica gestor quando uma parada que estava concluída/pulada volta para pendente.';

-- =============================================
-- VALIDAÇÃO
-- =============================================

-- Verificar que as funções foram criadas
SELECT
  proname AS "Função",
  'Criada' AS "Status"
FROM pg_proc
WHERE proname IN (
  'notify_sos_acionado',
  'notify_parada_reaberta'
);

-- Verificar triggers
SELECT
  tgname AS "Trigger",
  'Ativo' AS "Status"
FROM pg_trigger
WHERE tgname IN (
  'trigger_notify_sos_acionado',
  'trigger_notify_parada_reaberta'
);
