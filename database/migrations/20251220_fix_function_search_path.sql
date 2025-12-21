-- Migration: Corrigir search_path das funções para segurança
-- Data: 2025-12-20
-- Descrição:
--   Adiciona SET search_path = '' a todas as funções do schema public
--   Isso previne ataques de "search path injection"
--
-- Referência: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ============================================
-- FUNÇÃO: criar_notificacao
-- ============================================
CREATE OR REPLACE FUNCTION public.criar_notificacao(
  p_usuario_id uuid,
  p_tipo character varying,
  p_titulo character varying,
  p_mensagem text,
  p_rota_id uuid DEFAULT NULL::uuid,
  p_parada_id uuid DEFAULT NULL::uuid,
  p_incidente_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_notificacao_id UUID;
BEGIN
  INSERT INTO public.notificacoes (
    usuario_id,
    tipo,
    titulo,
    mensagem,
    rota_id,
    parada_id,
    incidente_id
  ) VALUES (
    p_usuario_id,
    p_tipo,
    p_titulo,
    p_mensagem,
    p_rota_id,
    p_parada_id,
    p_incidente_id
  ) RETURNING id INTO v_notificacao_id;

  RETURN v_notificacao_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;

-- ============================================
-- FUNÇÃO: notify_motorista_nova_rota_insert
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_motorista_nova_rota_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_unidade_nome VARCHAR;
  v_paradas_count INTEGER;
BEGIN
  IF NEW.motorista_id IS NOT NULL THEN
    SELECT nome INTO v_unidade_nome
    FROM public.unidades
    WHERE id = NEW.unidade_id;

    SELECT COUNT(*) INTO v_paradas_count
    FROM public.paradas
    WHERE rota_id = NEW.id
      AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);

    PERFORM public.criar_notificacao(
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
$function$;

-- ============================================
-- FUNÇÃO: notify_motorista_nova_rota
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_motorista_nova_rota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_unidade_nome VARCHAR;
  v_paradas_count INTEGER;
BEGIN
  IF (OLD.motorista_id IS NULL OR OLD.motorista_id IS DISTINCT FROM NEW.motorista_id)
     AND NEW.motorista_id IS NOT NULL THEN

    SELECT nome INTO v_unidade_nome
    FROM public.unidades
    WHERE id = NEW.unidade_id;

    SELECT COUNT(*) INTO v_paradas_count
    FROM public.paradas
    WHERE rota_id = NEW.id
      AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);

    PERFORM public.criar_notificacao(
      NEW.motorista_id,
      'nova_rota_atribuida',
      '🚗 Nova rota atribuída!',
      format('Você recebeu uma nova rota de %s com %s parada(s). Toque para ver detalhes.',
        COALESCE(v_unidade_nome, 'sua unidade'),
        v_paradas_count
      ),
      NEW.id,
      NULL,
      NULL
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================
-- FUNÇÃO: notify_rota_iniciada
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_rota_iniciada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
BEGIN
  IF NEW.status = 'em_andamento' AND OLD.status = 'pendente' THEN
    SELECT uu.usuario_id INTO v_gestor_id
    FROM public.usuario_unidades uu
    WHERE uu.unidade_id = NEW.unidade_id
      AND uu.papel = 'gestor'
      AND uu.ativo = true
    LIMIT 1;

    SELECT nome INTO v_motorista_nome
    FROM public.usuarios
    WHERE id = NEW.motorista_id;

    IF v_gestor_id IS NOT NULL THEN
      PERFORM public.criar_notificacao(
        v_gestor_id,
        'rota_iniciada',
        'Rota Iniciada',
        'O motorista ' || COALESCE(v_motorista_nome, 'Nao atribuido') || ' iniciou uma rota',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================
-- FUNÇÃO: notify_rota_concluida
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_rota_concluida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_total_paradas INT;
  v_paradas_concluidas INT;
BEGIN
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    SELECT uu.usuario_id INTO v_gestor_id
    FROM public.usuario_unidades uu
    WHERE uu.unidade_id = NEW.unidade_id
      AND uu.papel = 'gestor'
      AND uu.ativo = true
    LIMIT 1;

    SELECT nome INTO v_motorista_nome
    FROM public.usuarios
    WHERE id = NEW.motorista_id;

    SELECT
      COUNT(*) FILTER (WHERE is_checkpoint IS NULL OR is_checkpoint = TRUE),
      COUNT(*) FILTER (WHERE status = 'concluida' AND (is_checkpoint IS NULL OR is_checkpoint = TRUE))
    INTO v_total_paradas, v_paradas_concluidas
    FROM public.paradas
    WHERE rota_id = NEW.id;

    IF v_gestor_id IS NOT NULL THEN
      PERFORM public.criar_notificacao(
        v_gestor_id,
        'rota_concluida',
        'Rota Concluida',
        'O motorista ' || COALESCE(v_motorista_nome, 'Nao atribuido') ||
        ' finalizou a rota com ' || v_paradas_concluidas || '/' || v_total_paradas || ' paradas concluidas',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================
-- FUNÇÃO: notify_parada_pulada
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_parada_pulada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_unidade_id UUID;
BEGIN
  IF NEW.status = 'pulada' AND OLD.status != 'pulada' THEN
    SELECT r.unidade_id, u.nome
    INTO v_unidade_id, v_motorista_nome
    FROM public.rotas r
    LEFT JOIN public.usuarios u ON u.id = r.motorista_id
    WHERE r.id = NEW.rota_id;

    SELECT uu.usuario_id INTO v_gestor_id
    FROM public.usuario_unidades uu
    WHERE uu.unidade_id = v_unidade_id
      AND uu.papel = 'gestor'
      AND uu.ativo = true
    LIMIT 1;

    IF v_gestor_id IS NOT NULL THEN
      PERFORM public.criar_notificacao(
        v_gestor_id,
        'parada_pulada',
        'Parada Pulada',
        'O motorista ' || COALESCE(v_motorista_nome, 'Nao atribuido') ||
        ' pulou uma parada: ' || NEW.endereco,
        NEW.rota_id,
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================
-- FUNÇÃO: notify_parada_reaberta
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_parada_reaberta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_unidade_id UUID;
BEGIN
  IF NEW.status = 'pendente' AND OLD.status IN ('concluida', 'pulada') THEN
    SELECT r.unidade_id, u.nome
    INTO v_unidade_id, v_motorista_nome
    FROM public.rotas r
    LEFT JOIN public.usuarios u ON u.id = r.motorista_id
    WHERE r.id = NEW.rota_id;

    SELECT uu.usuario_id INTO v_gestor_id
    FROM public.usuario_unidades uu
    WHERE uu.unidade_id = v_unidade_id
      AND uu.papel = 'gestor'
      AND uu.ativo = true
    LIMIT 1;

    IF v_gestor_id IS NOT NULL THEN
      PERFORM public.criar_notificacao(
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
$function$;

-- ============================================
-- FUNÇÃO: notify_incidente_criado
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_incidente_criado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_categoria_label VARCHAR(100);
  v_unidade_id UUID;
BEGIN
  SELECT u.nome, uu.unidade_id
  INTO v_motorista_nome, v_unidade_id
  FROM public.usuarios u
  LEFT JOIN public.usuario_unidades uu ON uu.usuario_id = u.id AND uu.ativo = true AND uu.is_principal = true
  WHERE u.id = NEW.motorista_id
  LIMIT 1;

  IF v_unidade_id IS NULL THEN
    SELECT uu.unidade_id
    INTO v_unidade_id
    FROM public.usuario_unidades uu
    WHERE uu.usuario_id = NEW.motorista_id AND uu.ativo = true
    LIMIT 1;
  END IF;

  SELECT uu.usuario_id INTO v_gestor_id
  FROM public.usuario_unidades uu
  WHERE uu.unidade_id = v_unidade_id
    AND uu.papel = 'gestor'
    AND uu.ativo = true
  LIMIT 1;

  v_categoria_label := CASE NEW.categoria
    WHEN 'accident' THEN 'Acidente/Incidente'
    WHEN 'absent' THEN 'Cliente ausente'
    WHEN 'wrong_address' THEN 'Endereco incorreto'
    WHEN 'blocked' THEN 'Acesso bloqueado'
    WHEN 'vehicle' THEN 'Problema no veiculo'
    ELSE 'Outros'
  END;

  IF v_gestor_id IS NOT NULL THEN
    PERFORM public.criar_notificacao(
      v_gestor_id,
      'incidente_reportado',
      'Incidente Reportado',
      'O motorista ' || COALESCE(v_motorista_nome, 'Nao atribuido') ||
      ' reportou: ' || v_categoria_label || ' - ' || SUBSTRING(NEW.descricao, 1, 100),
      NEW.rota_id,
      NULL,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================
-- FUNÇÃO: notify_sos_acionado
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_sos_acionado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_unidade_id UUID;
  v_rota_endereco VARCHAR(255);
  v_motivo TEXT;
BEGIN
  IF NEW.evento != 'sos_acionado' THEN
    RETURN NEW;
  END IF;

  IF NEW.rota_id IS NOT NULL THEN
    SELECT r.unidade_id, p.endereco
    INTO v_unidade_id, v_rota_endereco
    FROM public.rotas r
    LEFT JOIN public.paradas p ON p.rota_id = r.id AND p.ordem = 1
    WHERE r.id = NEW.rota_id;
  END IF;

  IF v_unidade_id IS NULL AND NEW.usuario_id IS NOT NULL THEN
    SELECT uu.unidade_id
    INTO v_unidade_id
    FROM public.usuario_unidades uu
    WHERE uu.usuario_id = NEW.usuario_id
      AND uu.ativo = true
      AND uu.is_principal = true
    LIMIT 1;
  END IF;

  SELECT nome INTO v_motorista_nome
  FROM public.usuarios
  WHERE id = NEW.usuario_id;

  IF NEW.detalhes IS NOT NULL AND NEW.detalhes::jsonb ? 'motivo' THEN
    v_motivo := NEW.detalhes::jsonb->>'motivo';
  ELSE
    v_motivo := 'Emergência acionada';
  END IF;

  SELECT uu.usuario_id INTO v_gestor_id
  FROM public.usuario_unidades uu
  WHERE uu.unidade_id = v_unidade_id
    AND uu.papel = 'gestor'
    AND uu.ativo = true
  LIMIT 1;

  IF v_gestor_id IS NOT NULL THEN
    PERFORM public.criar_notificacao(
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
$function$;

-- ============================================
-- FUNÇÃO: expire_old_pending_routes
-- ============================================
CREATE OR REPLACE FUNCTION public.expire_old_pending_routes()
RETURNS TABLE(expired_count integer, notifications_sent integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  r RECORD;
  v_gestor_id UUID;
  v_motorista_nome VARCHAR;
  v_expired INTEGER := 0;
  v_notified INTEGER := 0;
BEGIN
  FOR r IN
    SELECT ro.id, ro.unidade_id, ro.motorista_id, ro.data
    FROM public.rotas ro
    WHERE ro.data < CURRENT_DATE
      AND ro.status = 'pendente'
  LOOP
    UPDATE public.rotas
    SET status = 'nao_executada'
    WHERE id = r.id;

    v_expired := v_expired + 1;

    SELECT id INTO v_gestor_id
    FROM public.usuarios
    WHERE unidade_id = r.unidade_id
      AND papel = 'gestor'
    LIMIT 1;

    IF r.motorista_id IS NOT NULL THEN
      SELECT nome INTO v_motorista_nome
      FROM public.usuarios
      WHERE id = r.motorista_id;
    ELSE
      v_motorista_nome := 'não atribuído';
    END IF;

    IF v_gestor_id IS NOT NULL THEN
      PERFORM public.criar_notificacao(
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

  expired_count := v_expired;
  notifications_sent := v_notified;
  RETURN NEXT;
END;
$function$;

-- ============================================
-- FUNÇÃO: notify_push_on_insert
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_push_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  user_token TEXT;
  tipos_push TEXT[] := ARRAY['nova_rota_atribuida', 'sos_acionado', 'incidente_reportado', 'rota_atrasada'];
BEGIN
  IF NOT (NEW.tipo = ANY(tipos_push)) THEN
    RETURN NEW;
  END IF;

  SELECT push_token INTO user_token
  FROM public.usuarios
  WHERE id = NEW.usuario_id;

  IF user_token IS NULL THEN
    INSERT INTO public.push_notification_logs (notificacao_id, usuario_id, status, error_message)
    VALUES (NEW.id, NEW.usuario_id, 'no_token', 'Usuário não tem push_token registrado');
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================
-- FUNÇÃO: send_push_notification_trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.send_push_notification_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  tipos_push TEXT[] := ARRAY['nova_rota_atribuida', 'sos_acionado', 'incidente_reportado', 'rota_atrasada'];
  edge_function_url TEXT;
  payload JSONB;
  request_id BIGINT;
BEGIN
  IF NOT (NEW.tipo = ANY(tipos_push)) THEN
    RETURN NEW;
  END IF;

  edge_function_url := 'https://xezslsyxjivunmhhyxtd.supabase.co/functions/v1/send-push-notification';

  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'notificacoes',
    'record', jsonb_build_object(
      'id', NEW.id,
      'usuario_id', NEW.usuario_id,
      'tipo', NEW.tipo,
      'titulo', NEW.titulo,
      'mensagem', NEW.mensagem,
      'rota_id', NEW.rota_id,
      'parada_id', NEW.parada_id,
      'incidente_id', NEW.incidente_id
    )
  );

  SELECT net.http_post(
    url := edge_function_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := payload
  ) INTO request_id;

  RAISE NOTICE '[Push] Requisição enviada para Edge Function, request_id: %', request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[Push] Erro ao enviar push notification: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Após executar, rode o Linter novamente no Supabase Dashboard
-- para confirmar que os warnings de function_search_path_mutable foram resolvidos
