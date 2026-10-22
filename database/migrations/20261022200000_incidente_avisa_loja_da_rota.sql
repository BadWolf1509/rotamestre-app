-- ============================================================================
-- Migration 34: incidente avisa o gestor da loja da rota
-- Date: 2026-10-22
-- Author: Wellinton Ribeiro
-- Purpose:
--   `notify_incidente_criado` escolhia a loja pelo vínculo PRINCIPAL do
--   motorista, ignorando a rota do incidente. Com motorista que atende duas
--   lojas (Migration 31), o incidente de uma rota da loja B ia para o gestor da
--   loja A — que nem enxerga a rota.
--
--   Agora, se o incidente traz `rota_id` e a rota é do próprio motorista do
--   incidente, a loja é a da rota. Senão, o comportamento de antes (vínculo
--   principal, depois qualquer vínculo ativo). A conferência do motorista é
--   necessária porque `incidentes_insert` só exige `motorista_id = auth.uid()`:
--   sem ela, um `rota_id` alheio mandaria o texto do incidente ao gestor de
--   outra empresa. Pelo mesmo motivo, a notificação só leva `rota_id` quando a
--   rota foi aceita. Não se confere o vínculo do motorista com a loja da rota:
--   se ele foi desativado lá, o incidente da rota dele ainda vai ao gestor dela,
--   que é o dono da rota.
--
-- Medido em produção (22/10/2026): 26 incidentes, 23 com rota, todos de rota
-- do próprio motorista e da mesma loja que o vínculo principal — nenhum caiu no
-- caso errado ainda.
--
-- Só CREATE OR REPLACE FUNCTION (corpo novo, mesma assinatura e mesmo gatilho).
-- ============================================================================

BEGIN;

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
      v_rota_id,
      NULL,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- CREATE OR REPLACE FUNCTION public.notify_incidente_criado()
--  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
-- AS $function$
-- DECLARE
--   v_gestor_id UUID;
--   v_motorista_nome VARCHAR(255);
--   v_categoria_label VARCHAR(100);
--   v_unidade_id UUID;
-- BEGIN
--   SELECT u.nome, uu.unidade_id
--   INTO v_motorista_nome, v_unidade_id
--   FROM public.usuarios u
--   LEFT JOIN public.usuario_unidades uu ON uu.usuario_id = u.id AND uu.ativo = true AND uu.is_principal = true
--   WHERE u.id = NEW.motorista_id
--   LIMIT 1;
--   IF v_unidade_id IS NULL THEN
--     SELECT uu.unidade_id INTO v_unidade_id
--     FROM public.usuario_unidades uu
--     WHERE uu.usuario_id = NEW.motorista_id AND uu.ativo = true
--     LIMIT 1;
--   END IF;
--   SELECT uu.usuario_id INTO v_gestor_id
--   FROM public.usuario_unidades uu
--   WHERE uu.unidade_id = v_unidade_id AND uu.papel = 'gestor' AND uu.ativo = true
--   LIMIT 1;
--   v_categoria_label := CASE NEW.categoria
--     WHEN 'accident' THEN 'Acidente/Incidente'
--     WHEN 'absent' THEN 'Cliente ausente'
--     WHEN 'wrong_address' THEN 'Endereco incorreto'
--     WHEN 'blocked' THEN 'Acesso bloqueado'
--     WHEN 'vehicle' THEN 'Problema no veiculo'
--     ELSE 'Outros'
--   END;
--   IF v_gestor_id IS NOT NULL THEN
--     PERFORM public.criar_notificacao(
--       v_gestor_id, 'incidente_reportado', 'Incidente Reportado',
--       'O motorista ' || COALESCE(v_motorista_nome, 'Nao atribuido') ||
--       ' reportou: ' || v_categoria_label || ' - ' || SUBSTRING(NEW.descricao, 1, 100),
--       NEW.rota_id, NULL, NEW.id);
--   END IF;
--   RETURN NEW;
-- END;
-- $function$;
-- COMMIT;
