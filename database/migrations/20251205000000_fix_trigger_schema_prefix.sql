-- =============================================
-- Migration: Fix Trigger Schema Prefix
-- =============================================
-- Data: 2025-12-05
-- Descrição: Corrige triggers que referenciam 'usuarios' sem schema prefix
-- Problema: "relation usuarios does not exist" - ERROR 42P01
-- Solução: Usar 'public.usuarios' em todas as referências
--
-- Triggers afetados:
-- - notify_rota_iniciada
-- - notify_rota_concluida
-- - notify_parada_pulada
-- - notify_incidente_criado

-- =============================================
-- FIX: notify_rota_iniciada
-- =============================================
CREATE OR REPLACE FUNCTION notify_rota_iniciada()
RETURNS TRIGGER AS $$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
BEGIN
  -- Quando rota muda de 'pendente' para 'em_andamento'
  IF NEW.status = 'em_andamento' AND OLD.status = 'pendente' THEN
    -- Buscar gestor da unidade (multi-unidade via usuario_unidades)
    SELECT uu.usuario_id INTO v_gestor_id
    FROM public.usuario_unidades uu
    WHERE uu.unidade_id = NEW.unidade_id
      AND uu.papel = 'gestor'
      AND uu.ativo = true
    LIMIT 1;

    -- Buscar nome do motorista
    SELECT nome INTO v_motorista_nome
    FROM public.usuarios
    WHERE id = NEW.motorista_id;

    IF v_gestor_id IS NOT NULL THEN
      PERFORM criar_notificacao(
        v_gestor_id,
        'rota_iniciada',
        'Rota Iniciada',
        'O motorista ' || COALESCE(v_motorista_nome, 'Não atribuído') || ' iniciou uma rota',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FIX: notify_rota_concluida
-- =============================================
CREATE OR REPLACE FUNCTION notify_rota_concluida()
RETURNS TRIGGER AS $$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_total_paradas INT;
  v_paradas_concluidas INT;
BEGIN
  -- Quando rota é concluída
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    -- Buscar gestor via usuario_unidades
    SELECT uu.usuario_id INTO v_gestor_id
    FROM public.usuario_unidades uu
    WHERE uu.unidade_id = NEW.unidade_id
      AND uu.papel = 'gestor'
      AND uu.ativo = true
    LIMIT 1;

    -- Buscar nome do motorista
    SELECT nome INTO v_motorista_nome
    FROM public.usuarios
    WHERE id = NEW.motorista_id;

    -- Contar paradas
    SELECT
      COUNT(*) FILTER (WHERE is_checkpoint IS NULL OR is_checkpoint = TRUE),
      COUNT(*) FILTER (WHERE status = 'concluida' AND (is_checkpoint IS NULL OR is_checkpoint = TRUE))
    INTO v_total_paradas, v_paradas_concluidas
    FROM public.paradas
    WHERE rota_id = NEW.id;

    IF v_gestor_id IS NOT NULL THEN
      PERFORM criar_notificacao(
        v_gestor_id,
        'rota_concluida',
        'Rota Concluída',
        'O motorista ' || COALESCE(v_motorista_nome, 'Não atribuído') ||
        ' finalizou a rota com ' || v_paradas_concluidas || '/' || v_total_paradas || ' paradas concluídas',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FIX: notify_parada_pulada
-- =============================================
CREATE OR REPLACE FUNCTION notify_parada_pulada()
RETURNS TRIGGER AS $$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_unidade_id UUID;
BEGIN
  -- Quando parada muda para 'pulada'
  IF NEW.status = 'pulada' AND OLD.status != 'pulada' THEN
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
        'parada_pulada',
        'Parada Pulada',
        'O motorista ' || COALESCE(v_motorista_nome, 'Não atribuído') ||
        ' pulou uma parada: ' || NEW.endereco,
        NEW.rota_id,
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FIX: notify_incidente_criado
-- =============================================
CREATE OR REPLACE FUNCTION notify_incidente_criado()
RETURNS TRIGGER AS $$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_categoria_label VARCHAR(100);
  v_unidade_id UUID;
BEGIN
  -- Buscar nome do motorista e sua unidade
  SELECT u.nome, uu.unidade_id
  INTO v_motorista_nome, v_unidade_id
  FROM public.usuarios u
  JOIN public.usuario_unidades uu ON uu.usuario_id = u.id AND uu.ativo = true AND uu.is_principal = true
  WHERE u.id = NEW.motorista_id
  LIMIT 1;

  -- Se não tem unidade principal, pegar qualquer uma
  IF v_unidade_id IS NULL THEN
    SELECT uu.unidade_id
    INTO v_unidade_id
    FROM public.usuario_unidades uu
    WHERE uu.usuario_id = NEW.motorista_id AND uu.ativo = true
    LIMIT 1;
  END IF;

  -- Buscar gestor via usuario_unidades
  SELECT uu.usuario_id INTO v_gestor_id
  FROM public.usuario_unidades uu
  WHERE uu.unidade_id = v_unidade_id
    AND uu.papel = 'gestor'
    AND uu.ativo = true
  LIMIT 1;

  -- Label da categoria
  v_categoria_label := CASE NEW.categoria
    WHEN 'accident' THEN 'Acidente/Incidente'
    WHEN 'absent' THEN 'Cliente ausente'
    WHEN 'wrong_address' THEN 'Endereço incorreto'
    WHEN 'blocked' THEN 'Acesso bloqueado'
    WHEN 'vehicle' THEN 'Problema no veículo'
    ELSE 'Outros'
  END;

  IF v_gestor_id IS NOT NULL THEN
    PERFORM criar_notificacao(
      v_gestor_id,
      'incidente_reportado',
      'Incidente Reportado',
      'O motorista ' || COALESCE(v_motorista_nome, 'Não atribuído') ||
      ' reportou: ' || v_categoria_label || ' - ' || SUBSTRING(NEW.descricao, 1, 100),
      NEW.rota_id,
      NULL,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FIX: Políticas RLS do motorista_locations
-- =============================================
-- Esta policy também referencia 'usuarios' sem schema prefix

DROP POLICY IF EXISTS "Gestores podem ver localizacao da sua unidade" ON public.motorista_locations;

CREATE POLICY "Gestores podem ver localizacao da sua unidade"
  ON public.motorista_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades my_uu
      JOIN public.usuario_unidades motorista_uu ON motorista_uu.unidade_id = my_uu.unidade_id
      WHERE my_uu.usuario_id = (SELECT auth.uid())
        AND my_uu.papel = 'gestor'
        AND my_uu.ativo = true
        AND motorista_uu.usuario_id = motorista_locations.motorista_id
        AND motorista_uu.ativo = true
    )
  );

-- =============================================
-- VALIDAÇÃO
-- =============================================

-- Verificar que as funções foram atualizadas
SELECT
  proname AS "Função",
  'Atualizada' AS "Status"
FROM pg_proc
WHERE proname IN (
  'notify_rota_iniciada',
  'notify_rota_concluida',
  'notify_parada_pulada',
  'notify_incidente_criado'
);
