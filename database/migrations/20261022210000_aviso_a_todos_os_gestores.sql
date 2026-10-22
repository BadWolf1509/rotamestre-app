-- ============================================================================
-- Migration 35: avisos da loja vão a todos os gestores ativos
-- Date: 2026-10-22
-- Author: Wellinton Ribeiro
-- Purpose:
--   Os seis gatilhos que avisam o gestor (`notify_sos_acionado`,
--   `notify_incidente_criado`, `notify_parada_pulada`, `notify_parada_reaberta`,
--   `notify_rota_iniciada`, `notify_rota_concluida`) escolhiam o destinatário
--   com `SELECT ... LIMIT 1` sem ORDER BY: numa loja com dois gestores ativos,
--   só um recebia — qual, ficava a critério do plano de execução. Um SOS podia
--   chegar a quem não está de plantão e nunca ao outro.
--
--   Agora todos os gestores com vínculo ativo na loja recebem, pelo helper
--   `gestores_ativos_da_unidade` (fonte única do critério). O critério não
--   muda: vínculo `gestor` ativo em `usuario_unidades`. Para loja com um gestor
--   só — todas, hoje — o comportamento é idêntico.
--
--   Fora de propósito: `get_gestor_contato` e `get_gestor_principal` devolvem
--   UM contato por desenho (principal primeiro, com ordem determinística).
--
-- Medido em produção (22/10/2026): nenhuma loja tem mais de um gestor ativo;
-- 3 lojas paradas desde 02/2026 têm como único gestor uma pessoa com
-- `usuarios.ativo = false` — continuam recebendo como antes (o critério não
-- passou a exigir `usuarios.ativo`).
--
-- Só CREATE OR REPLACE FUNCTION + REVOKE no helper novo (o default ACL do
-- Supabase o concede a PUBLIC, anon, authenticated e service_role; os três
-- primeiros perdem o EXECUTE).
--
-- APLICAR COMO `postgres` (SQL Editor). Os gatilhos rodam como `postgres` e
-- precisam de EXECUTE no helper; se ele nascer com outro dono, a falha fica
-- FORA do EXCEPTION da criar_notificacao e derruba o UPDATE/INSERT que disparou
-- o gatilho (concluir rota, pular parada, SOS). Conferir depois:
--   SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE proname = 'gestores_ativos_da_unidade';  -- postgres
--   SELECT has_function_privilege('postgres', 'public.gestores_ativos_da_unidade(uuid)', 'EXECUTE');  -- true
-- ============================================================================

BEGIN;

-- 1. Fonte única de quem é avisado pela loja.
-- Sem SECURITY DEFINER: só os gatilhos (SECURITY DEFINER de postgres) chamam.
CREATE OR REPLACE FUNCTION public.gestores_ativos_da_unidade(p_unidade_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT DISTINCT uu.usuario_id
  FROM public.usuario_unidades uu
  WHERE uu.unidade_id = p_unidade_id
    AND uu.papel = 'gestor'
    AND uu.ativo = true;
$function$;

REVOKE EXECUTE ON FUNCTION public.gestores_ativos_da_unidade(uuid) FROM PUBLIC, anon, authenticated;

-- 2. SOS
CREATE OR REPLACE FUNCTION public.notify_sos_acionado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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

  FOR v_gestor_id IN SELECT public.gestores_ativos_da_unidade(v_unidade_id) LOOP
    PERFORM public.criar_notificacao(
      v_gestor_id,
      'sos_acionado',
      '🚨 SOS - EMERGÊNCIA',
      'O motorista ' || COALESCE(v_motorista_nome, 'Não identificado') ||
      ' acionou o botão de emergência! ' || COALESCE(v_motivo, ''),
      NEW.rota_id
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 3. Incidente (corpo da Migration 34; só o destinatário muda)
CREATE OR REPLACE FUNCTION public.notify_incidente_criado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_categoria_label VARCHAR(100);
  v_unidade_id UUID;
  v_rota_id UUID;
BEGIN
  SELECT u.nome INTO v_motorista_nome
  FROM public.usuarios u
  WHERE u.id = NEW.motorista_id;

  -- Rota do próprio motorista: a loja é a dela.
  IF NEW.rota_id IS NOT NULL THEN
    SELECT r.unidade_id, r.id
    INTO v_unidade_id, v_rota_id
    FROM public.rotas r
    WHERE r.id = NEW.rota_id
      AND r.motorista_id = NEW.motorista_id;
  END IF;

  IF v_unidade_id IS NULL THEN
    SELECT uu.unidade_id
    INTO v_unidade_id
    FROM public.usuario_unidades uu
    WHERE uu.usuario_id = NEW.motorista_id AND uu.ativo = true AND uu.is_principal = true
    LIMIT 1;
  END IF;

  IF v_unidade_id IS NULL THEN
    SELECT uu.unidade_id
    INTO v_unidade_id
    FROM public.usuario_unidades uu
    WHERE uu.usuario_id = NEW.motorista_id AND uu.ativo = true
    LIMIT 1;
  END IF;

  v_categoria_label := CASE NEW.categoria
    WHEN 'accident' THEN 'Acidente/Incidente'
    WHEN 'absent' THEN 'Cliente ausente'
    WHEN 'wrong_address' THEN 'Endereco incorreto'
    WHEN 'blocked' THEN 'Acesso bloqueado'
    WHEN 'vehicle' THEN 'Problema no veiculo'
    ELSE 'Outros'
  END;

  FOR v_gestor_id IN SELECT public.gestores_ativos_da_unidade(v_unidade_id) LOOP
    PERFORM public.criar_notificacao(
      v_gestor_id,
      'incidente_reportado',
      'Incidente Reportado',
      'O motorista ' || COALESCE(v_motorista_nome, 'Nao atribuido') ||
      ' reportou: ' || v_categoria_label || ' - ' || SUBSTRING(NEW.descricao, 1, 100),
      v_rota_id,
      NULL,
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 4. Parada pulada
CREATE OR REPLACE FUNCTION public.notify_parada_pulada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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

    FOR v_gestor_id IN SELECT public.gestores_ativos_da_unidade(v_unidade_id) LOOP
      PERFORM public.criar_notificacao(
        v_gestor_id,
        'parada_pulada',
        'Parada Pulada',
        'O motorista ' || COALESCE(v_motorista_nome, 'Nao atribuido') ||
        ' pulou uma parada: ' || NEW.endereco,
        NEW.rota_id,
        NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Parada reaberta
CREATE OR REPLACE FUNCTION public.notify_parada_reaberta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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

    FOR v_gestor_id IN SELECT public.gestores_ativos_da_unidade(v_unidade_id) LOOP
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
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- 6. Rota iniciada
CREATE OR REPLACE FUNCTION public.notify_rota_iniciada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
BEGIN
  IF NEW.status = 'em_andamento' AND OLD.status = 'pendente' THEN
    SELECT nome INTO v_motorista_nome
    FROM public.usuarios
    WHERE id = NEW.motorista_id;

    FOR v_gestor_id IN SELECT public.gestores_ativos_da_unidade(NEW.unidade_id) LOOP
      PERFORM public.criar_notificacao(
        v_gestor_id,
        'rota_iniciada',
        'Rota Iniciada',
        'O motorista ' || COALESCE(v_motorista_nome, 'Nao atribuido') || ' iniciou uma rota',
        NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

-- 7. Rota concluída
CREATE OR REPLACE FUNCTION public.notify_rota_concluida()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_total_paradas INT;
  v_paradas_concluidas INT;
BEGIN
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    SELECT nome INTO v_motorista_nome
    FROM public.usuarios
    WHERE id = NEW.motorista_id;

    SELECT
      COUNT(*) FILTER (WHERE is_checkpoint IS NULL OR is_checkpoint = TRUE),
      COUNT(*) FILTER (WHERE status = 'concluida' AND (is_checkpoint IS NULL OR is_checkpoint = TRUE))
    INTO v_total_paradas, v_paradas_concluidas
    FROM public.paradas
    WHERE rota_id = NEW.id;

    FOR v_gestor_id IN SELECT public.gestores_ativos_da_unidade(NEW.unidade_id) LOOP
      PERFORM public.criar_notificacao(
        v_gestor_id,
        'rota_concluida',
        'Rota Concluida',
        'O motorista ' || COALESCE(v_motorista_nome, 'Nao atribuido') ||
        ' finalizou a rota com ' || v_paradas_concluidas || '/' || v_total_paradas || ' paradas concluidas',
        NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.gestores_ativos_da_unidade(uuid) IS
  'Migration 35: quem os gatilhos notify_* avisam pela loja (todo vínculo gestor ativo). Uso interno dos gatilhos.';

COMMIT;

-- ROLLBACK:
-- Em cada um dos seis gatilhos, trocar o laço
--   FOR v_gestor_id IN SELECT public.gestores_ativos_da_unidade(<unidade>) LOOP
--     PERFORM public.criar_notificacao(...);
--   END LOOP;
-- pelo formato anterior
--   SELECT uu.usuario_id INTO v_gestor_id
--   FROM public.usuario_unidades uu
--   WHERE uu.unidade_id = <unidade> AND uu.papel = 'gestor' AND uu.ativo = true
--   LIMIT 1;
--   IF v_gestor_id IS NOT NULL THEN
--     PERFORM public.criar_notificacao(...);
--   END IF;
-- (em notify_rota_iniciada/_concluida o SELECT do gestor vinha antes do nome do
-- motorista; a ordem não muda o resultado). Só DEPOIS de restaurar os seis —
-- senão os gatilhos chamam uma função inexistente e derrubam a operação:
-- DROP FUNCTION IF EXISTS public.gestores_ativos_da_unidade(uuid);
