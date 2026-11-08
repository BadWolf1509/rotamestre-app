-- ============================================================================
-- Migration 86: aviso ao motorista ao cancelar e ao reativar a rota
-- Date: 2026-11-08
-- Author: Wellinton Ribeiro
-- Purpose:
--   Achado B-11 da varredura de 07/11: cancelar ou reativar a rota pelo
--   gestor não avisava o motorista. Decisão do gestor: avisar nos dois casos,
--   com push.
--
--   `cancelar_rota(uuid)` e `reativar_rota(uuid)` recriadas a partir das
--   versões vivas (Migrations 70 e 78, conferidas no catálogo em 08/11, iguais
--   ao repositório), acrescentando só um bloco logo antes do
--   `RETURN 'cancelada'` / `RETURN 'reativada'`, que chama
--   `criar_notificacao` para o motorista da rota (rota sem motorista não
--   avisa ninguém). Os outros resultados (`ja_cancelada`, `situacao_mudou`,
--   `sem_permissao`, `motorista_indisponivel`) saem antes do bloco e não
--   avisam.
--
--   - Cancelada: tipo `rota_nao_executada`, título "Rota cancelada pelo
--     gestor", mensagem com a data da rota e a loja.
--   - Reativada: tipo `nova_rota_atribuida`, título "Rota reativada",
--     mensagem com a loja e a data nova (hoje, São Paulo).
--   O push sai pelo gatilho que já existe em `notificacoes`
--   (`send_push_notification_trigger` → Edge Function
--   `send-push-notification`), que só envia os tipos da lista dela; os dois
--   estão lá. Motorista sem token só não recebe o push: a notificação fica no
--   sino do app.
--
--   A notificação não pode impedir a RPC de concluir: o bloco tem EXCEPTION
--   próprio, que desfaz só o aviso e deixa WARNING no log. Isso cobre também
--   a recusa da própria `criar_notificacao` na chamada direta (ela confere,
--   pela loja de quem chama, que o motorista é ativo nela): cancelar a rota de
--   um motorista que já saiu da loja continua cancelando, sem aviso.
--
--   Alternativas consideradas:
--     Tipo: (a) reaproveitar tipos que o app e o push já tratam (escolhida):
--          `rota_nao_executada` leva o motorista ao Histórico, que lista a
--          rota cancelada, e `nova_rota_atribuida` leva à Início, onde a rota
--          reativada está pendente para hoje. O título e a mensagem vêm da
--          notificação; do tipo saem só ícone, cor, destino do toque e
--          prioridade do push. Funciona sem publicar Edge Function nem
--          lançar versão do app; (b) tipos novos `rota_cancelada` e
--          `rota_reativada`: exigiriam acrescentá-los à lista de push da
--          `send-push-notification` (sem isso o push é descartado calado),
--          ao destino do toque e ao ícone no app, e as versões já instaladas
--          mostrariam o ícone genérico sem destino no toque.
--     Onde: (a) dentro das RPCs (escolhida: o aviso sai só do resultado
--          `cancelada`/`reativada`, que é o caminho único dessas transições
--          desde as Migrations 75/76); (b) gatilho AFTER UPDATE em `rotas`,
--          como `notify_rota_iniciada`: teria de reconhecer as transições
--          pelo par de status (nao_executada → pendente também é a da
--          reativação) e separaria o aviso da regra que o motiva.
--
--   APLICAR COMO `postgres`.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

-- ----------------------------------------------------------------------------
-- 1. cancelar_rota (corpo da Migration 70 + aviso)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_rota(p_rota_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'sem_permissao';
  END IF;

  -- Só trava a rota de quem pode cancelá-la.
  SELECT r.status INTO v_status
    FROM public.rotas r
   WHERE r.id = p_rota_id
     AND EXISTS (
       SELECT 1 FROM public.usuario_unidades uu
        WHERE uu.usuario_id = auth.uid()
          AND uu.unidade_id = r.unidade_id
          AND uu.papel::text = 'gestor'
          AND uu.ativo = true
     )
   FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RETURN 'sem_permissao';
  END IF;

  IF v_status = 'cancelada' THEN
    RETURN 'ja_cancelada';
  END IF;

  IF v_status NOT IN ('pendente', 'em_andamento') THEN
    RETURN 'situacao_mudou';
  END IF;

  -- Trava as paradas da rota antes de mexer: um UPDATE de parada pelo
  -- motorista ainda sem commit não toca na linha de rotas, então só a trava
  -- da rota não o espera (o mesmo cuidado de finalizar_rota).
  PERFORM 1 FROM public.paradas p WHERE p.rota_id = p_rota_id FOR NO KEY UPDATE;

  UPDATE public.paradas
     SET status = 'pendente'
   WHERE rota_id = p_rota_id
     AND status = 'em_andamento';

  UPDATE public.rotas
     SET status = 'cancelada'
   WHERE id = p_rota_id;

  -- Aviso ao motorista (Migration 86). Bloco à parte: um erro no aviso
  -- desfaz só o aviso (WARNING no log), nunca o cancelamento.
  DECLARE
    v_aviso_motorista uuid;
    v_aviso_data date;
    v_aviso_loja text;
  BEGIN
    SELECT r.motorista_id, r.data, un.nome
      INTO v_aviso_motorista, v_aviso_data, v_aviso_loja
      FROM public.rotas r
      LEFT JOIN public.unidades un ON un.id = r.unidade_id
     WHERE r.id = p_rota_id;

    IF v_aviso_motorista IS NOT NULL THEN
      PERFORM public.criar_notificacao(
        v_aviso_motorista,
        'rota_nao_executada',
        'Rota cancelada pelo gestor',
        format(
          'A rota de %s (%s) foi cancelada pelo gestor e não precisa mais ser feita.',
          coalesce(to_char(v_aviso_data, 'DD/MM/YYYY'), 'data não definida'),
          coalesce(v_aviso_loja, 'sua loja')
        ),
        p_rota_id
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'cancelar_rota: aviso ao motorista não gravado (rota %): % %', p_rota_id, SQLSTATE, SQLERRM;
  END;

  RETURN 'cancelada';
END;
$$;

ALTER FUNCTION public.cancelar_rota(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cancelar_rota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_rota(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.cancelar_rota(uuid) IS
  'Migration 86 (sobre a 70): o gestor ativo da loja cancela a rota pendente ou em andamento; a parada em_andamento volta a pendente na mesma transação; ao cancelar, avisa o motorista (criar_notificacao, tipo rota_nao_executada, com push), sem que um erro no aviso desfaça o cancelamento. Devolve cancelada | ja_cancelada | situacao_mudou | sem_permissao.';

-- ----------------------------------------------------------------------------
-- 2. reativar_rota (corpo da Migration 78 + aviso)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reativar_rota(p_rota_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_motorista_id uuid;
  v_unidade_id uuid;
  v_hoje date;
  v_nome text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'sem_permissao';
  END IF;

  -- Só trava a rota de quem pode reativá-la.
  SELECT r.status, r.motorista_id, r.unidade_id
    INTO v_status, v_motorista_id, v_unidade_id
    FROM public.rotas r
   WHERE r.id = p_rota_id
     AND EXISTS (
       SELECT 1 FROM public.usuario_unidades uu
        WHERE uu.usuario_id = auth.uid()
          AND uu.unidade_id = r.unidade_id
          AND uu.papel::text = 'gestor'
          AND uu.ativo = true
     )
   FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RETURN 'sem_permissao';
  END IF;

  IF v_status <> 'nao_executada' THEN
    RETURN 'situacao_mudou';
  END IF;

  -- A regra de criar_rota_com_paradas: vínculo ativo de motorista na loja da
  -- rota e cadastro ativo. Rota sem motorista reativa (o gestor atribui).
  IF v_motorista_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.usuario_unidades uu
      JOIN public.usuarios u ON u.id = uu.usuario_id
     WHERE uu.usuario_id = v_motorista_id
       AND uu.unidade_id = v_unidade_id
       AND uu.papel::text = 'motorista'
       AND uu.ativo = true
       AND u.ativo = true
  ) THEN
    RETURN 'motorista_indisponivel';
  END IF;

  -- Trava as paradas da rota antes de mexer (o mesmo cuidado de
  -- cancelar_rota e finalizar_rota): uma escrita do motorista ainda sem
  -- commit numa parada concluida não casaria com o filtro abaixo.
  PERFORM 1 FROM public.paradas p WHERE p.rota_id = p_rota_id FOR NO KEY UPDATE;

  v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  UPDATE public.rotas
     SET status = 'pendente',
         data = v_hoje,
         iniciada_em = NULL,
         concluida_em = NULL
   WHERE id = p_rota_id;

  UPDATE public.paradas
     SET status = 'pendente',
         concluida_em = NULL
   WHERE rota_id = p_rota_id
     AND status <> 'concluida';

  SELECT u.nome INTO v_nome
    FROM public.usuarios u
   WHERE u.id = auth.uid();

  INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
  VALUES (
    auth.uid(),
    p_rota_id,
    'rota_reativada',
    jsonb_build_object('nova_data', v_hoje, 'reativado_por', v_nome)
  );

  -- Aviso ao motorista (Migration 86). Bloco à parte: um erro no aviso
  -- desfaz só o aviso (WARNING no log), nunca a reativação.
  DECLARE
    v_aviso_motorista uuid := v_motorista_id;
    v_aviso_loja text;
  BEGIN
    IF v_aviso_motorista IS NOT NULL THEN
      SELECT un.nome INTO v_aviso_loja
        FROM public.unidades un
       WHERE un.id = v_unidade_id;

      PERFORM public.criar_notificacao(
        v_aviso_motorista,
        'nova_rota_atribuida',
        'Rota reativada',
        format(
          'A rota de %s foi reativada pelo gestor para hoje, %s.',
          coalesce(v_aviso_loja, 'sua loja'),
          coalesce(to_char(v_hoje, 'DD/MM/YYYY'), 'data não definida')
        ),
        p_rota_id
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'reativar_rota: aviso ao motorista não gravado (rota %): % %', p_rota_id, SQLSTATE, SQLERRM;
  END;

  RETURN 'reativada';
END;
$$;

ALTER FUNCTION public.reativar_rota(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reativar_rota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reativar_rota(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.reativar_rota(uuid) IS
  'Migration 86 (sobre a 78): o gestor ativo da loja reabre a rota nao_executada para hoje (São Paulo) e as paradas não concluídas, numa transação, com log rota_reativada; ao reativar, avisa o motorista (criar_notificacao, tipo nova_rota_atribuida, com push), sem que um erro no aviso desfaça a reativação. Resultado: reativada | situacao_mudou | motorista_indisponivel (motorista sem vínculo ativo de motorista na loja ou desativado; nada muda) | sem_permissao.';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl,
--        position('criar_notificacao' in p.prosrc) > 0 AS avisa,
--        obj_description(p.oid, 'pg_proc') AS comentario
--   FROM pg_proc p
--  WHERE p.oid IN (to_regprocedure('public.cancelar_rota(uuid)'),
--                  to_regprocedure('public.reativar_rota(uuid)'));
-- ============================================================================

-- ROLLBACK:
-- -- Volta as duas RPCs aos corpos das Migrations 70 e 78, sem o aviso.
-- BEGIN;
-- SET LOCAL lock_timeout = '3s';
-- CREATE OR REPLACE FUNCTION public.cancelar_rota(p_rota_id uuid)
-- RETURNS text
-- LANGUAGE plpgsql
-- VOLATILE
-- SECURITY DEFINER
-- SET search_path = ''
-- AS $$
-- DECLARE
--   v_status text;
-- BEGIN
--   IF auth.uid() IS NULL THEN
--     RETURN 'sem_permissao';
--   END IF;
--
--   -- Só trava a rota de quem pode cancelá-la.
--   SELECT r.status INTO v_status
--     FROM public.rotas r
--    WHERE r.id = p_rota_id
--      AND EXISTS (
--        SELECT 1 FROM public.usuario_unidades uu
--         WHERE uu.usuario_id = auth.uid()
--           AND uu.unidade_id = r.unidade_id
--           AND uu.papel::text = 'gestor'
--           AND uu.ativo = true
--      )
--    FOR NO KEY UPDATE;
--
--   IF NOT FOUND THEN
--     RETURN 'sem_permissao';
--   END IF;
--
--   IF v_status = 'cancelada' THEN
--     RETURN 'ja_cancelada';
--   END IF;
--
--   IF v_status NOT IN ('pendente', 'em_andamento') THEN
--     RETURN 'situacao_mudou';
--   END IF;
--
--   -- Trava as paradas da rota antes de mexer: um UPDATE de parada pelo
--   -- motorista ainda sem commit não toca na linha de rotas, então só a trava
--   -- da rota não o espera (o mesmo cuidado de finalizar_rota).
--   PERFORM 1 FROM public.paradas p WHERE p.rota_id = p_rota_id FOR NO KEY UPDATE;
--
--   UPDATE public.paradas
--      SET status = 'pendente'
--    WHERE rota_id = p_rota_id
--      AND status = 'em_andamento';
--
--   UPDATE public.rotas
--      SET status = 'cancelada'
--    WHERE id = p_rota_id;
--
--   RETURN 'cancelada';
-- END;
-- $$;
--
-- ALTER FUNCTION public.cancelar_rota(uuid) OWNER TO postgres;
-- REVOKE ALL ON FUNCTION public.cancelar_rota(uuid) FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.cancelar_rota(uuid) TO authenticated, service_role;
--
-- COMMENT ON FUNCTION public.cancelar_rota(uuid) IS
--   'Migration 70: o gestor ativo da loja cancela a rota pendente ou em andamento; a parada em_andamento volta a pendente na mesma transação. Devolve cancelada | ja_cancelada | situacao_mudou | sem_permissao.';
-- CREATE OR REPLACE FUNCTION public.reativar_rota(p_rota_id uuid)
-- RETURNS text
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = ''
-- AS $$
-- DECLARE
--   v_status text;
--   v_motorista_id uuid;
--   v_unidade_id uuid;
--   v_hoje date;
--   v_nome text;
-- BEGIN
--   IF auth.uid() IS NULL THEN
--     RETURN 'sem_permissao';
--   END IF;
--
--   -- Só trava a rota de quem pode reativá-la.
--   SELECT r.status, r.motorista_id, r.unidade_id
--     INTO v_status, v_motorista_id, v_unidade_id
--     FROM public.rotas r
--    WHERE r.id = p_rota_id
--      AND EXISTS (
--        SELECT 1 FROM public.usuario_unidades uu
--         WHERE uu.usuario_id = auth.uid()
--           AND uu.unidade_id = r.unidade_id
--           AND uu.papel::text = 'gestor'
--           AND uu.ativo = true
--      )
--    FOR NO KEY UPDATE;
--
--   IF NOT FOUND THEN
--     RETURN 'sem_permissao';
--   END IF;
--
--   IF v_status <> 'nao_executada' THEN
--     RETURN 'situacao_mudou';
--   END IF;
--
--   -- A regra de criar_rota_com_paradas: vínculo ativo de motorista na loja da
--   -- rota e cadastro ativo. Rota sem motorista reativa (o gestor atribui).
--   IF v_motorista_id IS NOT NULL AND NOT EXISTS (
--     SELECT 1
--       FROM public.usuario_unidades uu
--       JOIN public.usuarios u ON u.id = uu.usuario_id
--      WHERE uu.usuario_id = v_motorista_id
--        AND uu.unidade_id = v_unidade_id
--        AND uu.papel::text = 'motorista'
--        AND uu.ativo = true
--        AND u.ativo = true
--   ) THEN
--     RETURN 'motorista_indisponivel';
--   END IF;
--
--   -- Trava as paradas da rota antes de mexer (o mesmo cuidado de
--   -- cancelar_rota e finalizar_rota): uma escrita do motorista ainda sem
--   -- commit numa parada concluida não casaria com o filtro abaixo.
--   PERFORM 1 FROM public.paradas p WHERE p.rota_id = p_rota_id FOR NO KEY UPDATE;
--
--   v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
--
--   UPDATE public.rotas
--      SET status = 'pendente',
--          data = v_hoje,
--          iniciada_em = NULL,
--          concluida_em = NULL
--    WHERE id = p_rota_id;
--
--   UPDATE public.paradas
--      SET status = 'pendente',
--          concluida_em = NULL
--    WHERE rota_id = p_rota_id
--      AND status <> 'concluida';
--
--   SELECT u.nome INTO v_nome
--     FROM public.usuarios u
--    WHERE u.id = auth.uid();
--
--   INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
--   VALUES (
--     auth.uid(),
--     p_rota_id,
--     'rota_reativada',
--     jsonb_build_object('nova_data', v_hoje, 'reativado_por', v_nome)
--   );
--
--   RETURN 'reativada';
-- END;
-- $$;
--
-- ALTER FUNCTION public.reativar_rota(uuid) OWNER TO postgres;
-- REVOKE ALL ON FUNCTION public.reativar_rota(uuid) FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.reativar_rota(uuid) TO authenticated, service_role;
-- COMMENT ON FUNCTION public.reativar_rota(uuid) IS
--   'Migration 78 (sobre a 71): o gestor ativo da loja reabre a rota nao_executada para hoje (São Paulo) e as paradas não concluídas, numa transação, com log rota_reativada. Resultado: reativada | situacao_mudou | motorista_indisponivel (motorista sem vínculo ativo de motorista na loja ou desativado; nada muda) | sem_permissao.';
-- COMMIT;
