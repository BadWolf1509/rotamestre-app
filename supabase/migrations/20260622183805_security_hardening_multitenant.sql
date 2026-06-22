-- Migration: security_hardening_multitenant
-- Fecha furos multi-tenant (validado no banco vivo 2026-06-22).
-- Spec:  docs/superpowers/specs/2026-06-22-security-hardening-multitenant-design.md
-- Plano: docs/superpowers/plans/2026-06-22-security-hardening-multitenant.md
--
-- C1/C2: guard de tenant + search_path nas RPCs inserir_parada / reordenar_paradas.
-- C4:    revogar EXECUTE das funcoes platform-wide (cron usa service_role).
-- A1:    escopar push_notification_logs SELECT por unidade.
-- A3:    revogar views de anon + security_invoker nas 2 views DEFINER.
-- A4:    remover grant INSERT morto em notificacoes (RLS ja bloqueia; via criar_notificacao).

-- ============================================================
-- C1 - inserir_parada: guard (gestor da unidade da rota) + search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.inserir_parada(
  p_rota_id UUID,
  p_tipo TEXT,
  p_endereco TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_posicao_insercao INTEGER DEFAULT NULL,
  p_destinatario TEXT DEFAULT NULL,
  p_telefone TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chegada RECORD;
  v_new_ordem INTEGER;
  v_parada_count INTEGER;
  v_new_parada_id UUID;
BEGIN
  -- Authorization guard (mirrors paradas_insert): gestor ativo da unidade da rota
  IF NOT EXISTS (
    SELECT 1
    FROM public.rotas r
    JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
    WHERE r.id = p_rota_id
      AND uu.usuario_id = auth.uid()
      AND uu.papel = 'gestor'
      AND uu.ativo = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado: gestor da unidade da rota requerido.');
  END IF;

  SELECT COUNT(*) INTO v_parada_count
  FROM public.paradas
  WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false;

  SELECT id, ordem INTO v_chegada
  FROM public.paradas
  WHERE rota_id = p_rota_id AND is_checkpoint = false AND ordem > 0
  LIMIT 1;

  IF p_posicao_insercao IS NULL THEN
    v_new_ordem := v_parada_count + 1;
  ELSE
    v_new_ordem := p_posicao_insercao;
    UPDATE public.paradas
    SET ordem = ordem + 1000
    WHERE rota_id = p_rota_id
      AND is_checkpoint IS DISTINCT FROM false
      AND ordem >= p_posicao_insercao;
    UPDATE public.paradas
    SET ordem = ordem - 1000 + 1
    WHERE rota_id = p_rota_id
      AND is_checkpoint IS DISTINCT FROM false
      AND ordem >= 1000;
  END IF;

  IF v_chegada.id IS NOT NULL AND v_chegada.ordem <= v_new_ordem THEN
    UPDATE public.paradas
    SET ordem = GREATEST(v_chegada.ordem + 1, v_new_ordem + 1)
    WHERE id = v_chegada.id;
  END IF;

  INSERT INTO public.paradas (
    rota_id, tipo, endereco, latitude, longitude, ordem,
    destinatario, telefone, observacoes, status, is_checkpoint
  ) VALUES (
    p_rota_id, p_tipo, p_endereco, p_latitude, p_longitude, v_new_ordem,
    p_destinatario, p_telefone, p_observacoes, 'pendente', true
  )
  RETURNING id INTO v_new_parada_id;

  WITH ordered_paradas AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY ordem) AS new_ordem
    FROM public.paradas
    WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false
  )
  UPDATE public.paradas p
  SET ordem = op.new_ordem
  FROM ordered_paradas op
  WHERE p.id = op.id AND p.ordem != op.new_ordem;

  IF v_chegada.id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_parada_count
    FROM public.paradas
    WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false;
    UPDATE public.paradas
    SET ordem = v_parada_count + 1
    WHERE id = v_chegada.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'parada_id', v_new_parada_id, 'ordem', v_new_ordem);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- authenticated MANTEM EXECUTE de proposito (app chama via gestor logado); o guard interno acima verifica papel/unidade.
REVOKE EXECUTE ON FUNCTION public.inserir_parada(uuid, text, text, double precision, double precision, integer, text, text, text) FROM PUBLIC, anon;

-- ============================================================
-- C2 - reordenar_paradas: guard (motorista dono OU gestor da unidade) + search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.reordenar_paradas(
  p_parada_ids UUID[],
  p_novas_ordens INTEGER[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
  v_rota_id UUID;
  v_i INTEGER;
BEGIN
  IF array_length(p_parada_ids, 1) != array_length(p_novas_ordens, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Arrays must have same length');
  END IF;

  v_count := array_length(p_parada_ids, 1);
  IF v_count IS NULL OR v_count = 0 THEN
    RETURN jsonb_build_object('success', true, 'updated', 0);
  END IF;

  SELECT rota_id INTO v_rota_id FROM public.paradas WHERE id = p_parada_ids[1];
  IF v_rota_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parada not found');
  END IF;

  -- Authorization guard (mirrors paradas_update): motorista dono OU gestor da unidade
  IF NOT EXISTS (
    SELECT 1
    FROM public.rotas r
    WHERE r.id = v_rota_id
      AND (
        r.motorista_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.usuario_unidades uu
          WHERE uu.usuario_id = auth.uid()
            AND uu.papel = 'gestor'
            AND uu.unidade_id = r.unidade_id
            AND uu.ativo = true
        )
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado.');
  END IF;

  FOR v_i IN 1..v_count LOOP
    UPDATE public.paradas SET ordem = 1000 + v_i
    WHERE id = p_parada_ids[v_i] AND rota_id = v_rota_id;
  END LOOP;

  FOR v_i IN 1..v_count LOOP
    UPDATE public.paradas SET ordem = p_novas_ordens[v_i]
    WHERE id = p_parada_ids[v_i] AND rota_id = v_rota_id;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'updated', v_count);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- authenticated MANTEM EXECUTE de proposito (app chama via gestor/motorista logado); o guard interno acima verifica autorizacao.
REVOKE EXECUTE ON FUNCTION public.reordenar_paradas(uuid[], integer[]) FROM PUBLIC, anon;

-- ============================================================
-- C4 - revogar funcoes platform-wide (cron usa service_role, que mantem EXECUTE)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.expire_old_pending_routes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remind_pending_routes(text) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- A1 - push_notification_logs: escopar SELECT por unidade (espelha logs_select)
-- ============================================================
DROP POLICY IF EXISTS "push_notification_logs_select_optimized" ON public.push_notification_logs;
CREATE POLICY "push_notification_logs_select_scoped" ON public.push_notification_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.usuario_unidades my_uu
    JOIN public.usuario_unidades target_uu ON target_uu.unidade_id = my_uu.unidade_id
    WHERE my_uu.usuario_id = (SELECT auth.uid())
      AND my_uu.papel = 'gestor'
      AND my_uu.ativo = true
      AND target_uu.usuario_id = push_notification_logs.usuario_id
      AND target_uu.ativo = true
  )
);

-- ============================================================
-- A3 - views: revogar anon (grant ALL) + security_invoker nas 2 views DEFINER
-- ============================================================
REVOKE ALL ON public.vw_rotas_resumo, public.vw_performance_motoristas,
              public.vw_paradas_com_vinculo, public.admin_dashboard_metrics FROM anon;
ALTER VIEW public.vw_performance_motoristas SET (security_invoker = true);
ALTER VIEW public.admin_dashboard_metrics  SET (security_invoker = true);
REVOKE ALL ON public.admin_dashboard_metrics FROM authenticated;

-- ============================================================
-- A4 - notificacoes: remover grant INSERT morto (RLS ja bloqueia; via criar_notificacao)
-- ============================================================
REVOKE INSERT ON public.notificacoes FROM PUBLIC, anon, authenticated;
