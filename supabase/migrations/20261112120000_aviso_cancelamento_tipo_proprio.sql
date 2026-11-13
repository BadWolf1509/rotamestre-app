-- ============================================================================
-- Migration 91: aviso de cancelamento ao motorista com tipo próprio
-- Date: 2026-11-12
-- Author: Wellinton Ribeiro
-- Purpose:
--   Achado da validação da pendência 36 (11/11, versão 3060): o cancelamento
--   da rota pelo gestor enviava o push certo ("Rota cancelada pelo gestor",
--   com a data), mas a linha em `notificacoes` saía com tipo
--   `rota_nao_executada`, o da rota que expirou sem ser feita
--   (`expire_old_pending_routes`). A Migration 86 reaproveitou o tipo de
--   propósito, para não exigir Edge Function nem versão nova do app; o preço
--   era o banco não distinguir cancelamento de expiração.
--
--   `cancelar_rota(uuid)` recriada a partir da versão viva (a da Migration
--   86, conferida no catálogo em 12/11: md5 do corpo igual ao do arquivo),
--   trocando só o tipo do aviso para `rota_cancelada`. Título, mensagem,
--   destinatário e o EXCEPTION próprio do bloco não mudam. `reativar_rota`
--   não é tocada.
--
--   As notificações de cancelamento já gravadas com o tipo antigo (título
--   exato "Rota cancelada pelo gestor", que só a Migration 86 grava) passam a
--   `rota_cancelada`. Eram 4 linhas em 12/11, todas de 10 a 12/11.
--
--   PRÉ-REQUISITO: publicar ANTES a Edge Function `send-push-notification`
--   com `rota_cancelada` em PUSH_NOTIFICATION_TYPES. Sem isso, o push do
--   cancelamento é descartado calado (o aviso fica só no sino do app).
--
--   App: o tipo entra no destino do toque (Histórico do motorista), no ícone
--   e na cor. Versões instaladas até a 1.16.1 mostram o ícone genérico e o
--   toque não navega, nem no push (abre o app onde estava) nem no sino (só
--   marca como lida; antes levava ao Histórico); o título e a mensagem
--   chegam iguais. O web recebe tudo no deploy da Vercel.
--
--   Alternativas consideradas:
--     (a) tipo próprio `rota_cancelada` (escolhida): o dado diz o que
--         aconteceu, e `rota_nao_executada` volta a significar só a
--         expiração; custo: ordem de publicação e o ícone genérico nas
--         versões antigas — barato hoje, sem release de produção na Play;
--     (b) manter `rota_nao_executada` (a escolha da Migration 86): nada a
--         publicar, mas o banco continua misturando as duas coisas para quem
--         conta ou filtra por tipo;
--     (c) distinguir pelo título no app: transforma o texto em contrato e
--         não corrige o banco.
--   Linhas antigas: (a) corrigir as 4 (escolhida: o filtro pelo título exato
--   é inequívoco e o volume é mínimo); (b) deixar como estão, o histórico
--   mistura tipos para sempre.
--
--   APLICAR COMO `postgres`.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

-- ----------------------------------------------------------------------------
-- 1. cancelar_rota (corpo da Migration 86, com o tipo rota_cancelada)
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
        'rota_cancelada',
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
  'Migration 91 (sobre a 86): o gestor ativo da loja cancela a rota pendente ou em andamento; a parada em_andamento volta a pendente na mesma transação; ao cancelar, avisa o motorista (criar_notificacao, tipo rota_cancelada, com push), sem que um erro no aviso desfaça o cancelamento. Devolve cancelada | ja_cancelada | situacao_mudou | sem_permissao.';

-- ----------------------------------------------------------------------------
-- 2. Avisos de cancelamento já gravados com o tipo antigo
-- ----------------------------------------------------------------------------
UPDATE public.notificacoes
   SET tipo = 'rota_cancelada'
 WHERE tipo = 'rota_nao_executada'
   AND titulo = 'Rota cancelada pelo gestor';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl,
--        position('''rota_cancelada''' in p.prosrc) > 0 AS tipo_novo,
--        position('rota_nao_executada' in p.prosrc) = 0 AS sem_tipo_antigo,
--        obj_description(p.oid, 'pg_proc') AS comentario
--   FROM pg_proc p
--  WHERE p.oid = to_regprocedure('public.cancelar_rota(uuid)');
-- SELECT tipo, count(*) FROM public.notificacoes
--  WHERE titulo = 'Rota cancelada pelo gestor' GROUP BY tipo;
-- ============================================================================

-- ROLLBACK:
-- -- Volta cancelar_rota ao corpo da Migration 86 e o tipo das linhas.
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
--   -- Aviso ao motorista (Migration 86). Bloco à parte: um erro no aviso
--   -- desfaz só o aviso (WARNING no log), nunca o cancelamento.
--   DECLARE
--     v_aviso_motorista uuid;
--     v_aviso_data date;
--     v_aviso_loja text;
--   BEGIN
--     SELECT r.motorista_id, r.data, un.nome
--       INTO v_aviso_motorista, v_aviso_data, v_aviso_loja
--       FROM public.rotas r
--       LEFT JOIN public.unidades un ON un.id = r.unidade_id
--      WHERE r.id = p_rota_id;
--
--     IF v_aviso_motorista IS NOT NULL THEN
--       PERFORM public.criar_notificacao(
--         v_aviso_motorista,
--         'rota_nao_executada',
--         'Rota cancelada pelo gestor',
--         format(
--           'A rota de %s (%s) foi cancelada pelo gestor e não precisa mais ser feita.',
--           coalesce(to_char(v_aviso_data, 'DD/MM/YYYY'), 'data não definida'),
--           coalesce(v_aviso_loja, 'sua loja')
--         ),
--         p_rota_id
--       );
--     END IF;
--   EXCEPTION WHEN OTHERS THEN
--     RAISE WARNING 'cancelar_rota: aviso ao motorista não gravado (rota %): % %', p_rota_id, SQLSTATE, SQLERRM;
--   END;
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
--   'Migration 86 (sobre a 70): o gestor ativo da loja cancela a rota pendente ou em andamento; a parada em_andamento volta a pendente na mesma transação; ao cancelar, avisa o motorista (criar_notificacao, tipo rota_nao_executada, com push), sem que um erro no aviso desfaça o cancelamento. Devolve cancelada | ja_cancelada | situacao_mudou | sem_permissao.';
--
-- UPDATE public.notificacoes
--    SET tipo = 'rota_nao_executada'
--  WHERE tipo = 'rota_cancelada'
--    AND titulo = 'Rota cancelada pelo gestor';
-- COMMIT;
