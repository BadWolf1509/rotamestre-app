-- ============================================================================
-- Migration: Expiração de rotas — data em BRT e guarda de horário
-- Date: 2026-08-27
-- Author: Wellinton Ribeiro
-- Purpose:
--   Em 27/08/2026 o job de expiração (agendado para 22:00 BRT / 01:00 UTC) foi
--   entregue pelo GitHub Actions com 9h43min de atraso, às 07:43 BRT. Como
--   `expire_old_pending_routes` filtrava por `ro.data <= CURRENT_DATE` sem olhar
--   as horas, ela apagou duas rotas criadas naquela mesma manhã (José Inácio,
--   5 paradas; Lucas Cosme, 6 paradas), custando ~2h56min e ~1h44min de
--   operação e disparando 4 notificações falsas.
--
--   Duas falhas independentes são corrigidas aqui:
--
--   1) CURRENT_DATE é UTC no Supabase. Às 22:00 BRT já são 01:00 UTC do dia
--      SEGUINTE, então `data <= CURRENT_DATE` também alcança rotas pré-criadas
--      para amanhã — bug latente que morde no primeiro dia em que o gestor
--      adiantar a rota na véspera. Passa a usar a data em America/Sao_Paulo.
--
--   2) A função não tinha noção de horário, então uma execução atrasada era
--      indistinguível de uma pontual. O filtro passa a ter dois ramos:
--        - dias anteriores  -> expira a qualquer hora (caminho DOMINANTE: 17 dos
--          19 eventos históricos rodaram entre 00:22 e 02:07 BRT limpando o dia
--          anterior; uma guarda global de "só após 22h" quebraria todos eles);
--        - dia corrente     -> só após 22:00 BRT.
--
--   Replay do predicado novo contra os 19 eventos reais de `rota_expirada`
--   desde 29/12/2025: 17 expirações legítimas preservadas, as 2 falsas de
--   27/08/2026 bloqueadas, nenhum falso-negativo.
--
--   Também adiciona `p_dry_run` para permitir verificar o comportamento em
--   produção sem mutar dados — o projeto não tem pgTAP, então esta é a via
--   honesta de conferência.
--
-- Nota sobre o fuso: as 6 unidades ativas estão em PB (5) e CE (1), ambas
-- UTC-3, e `unidades.horario_funcionamento` está NULL em todas. O Brasil não
-- adota horário de verão desde 2019. America/Sao_Paulo é, portanto, correto
-- hoje; se surgir unidade em AC/AM/RO/RR/MS/MT, este fuso precisa virar coluna
-- por unidade.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. expire_old_pending_routes — recriada a partir do fonte VIVO
-- ---------------------------------------------------------------------------
-- Base: versão em produção (que já notifica TODOS os gestores da unidade, vinda
-- de 20251221000005_notify_all_gestores.sql). O arquivo 20251221000000 deste
-- repositório está desatualizado e notifica apenas o primeiro gestor — recriar
-- a partir dele regrediria aquela correção.
--
-- DROP + CREATE (e não CREATE OR REPLACE) porque a assinatura muda com
-- p_dry_run. Nenhum objeto do banco referencia esta função (verificado em
-- pg_proc.prosrc), então o DROP é seguro.

DROP FUNCTION IF EXISTS expire_old_pending_routes();

CREATE FUNCTION expire_old_pending_routes(p_dry_run BOOLEAN DEFAULT FALSE)
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
  v_agora TIMESTAMP;
  v_hoje DATE;
  v_hora TIME;
BEGIN
  -- Relógio do negócio, não o do servidor.
  v_agora := now() AT TIME ZONE 'America/Sao_Paulo';
  v_hoje  := v_agora::date;
  v_hora  := v_agora::time;

  FOR r IN
    SELECT ro.id, ro.unidade_id, ro.motorista_id, ro.data
    FROM rotas ro
    WHERE ro.status = 'pendente'
      AND (
        -- Dias anteriores: seguro a qualquer hora.
        ro.data < v_hoje
        -- Dia corrente: só depois do fim da janela (22:00 BRT). É esta linha
        -- que torna uma execução atrasada inofensiva.
        OR (ro.data = v_hoje AND v_hora >= TIME '22:00')
      )
  LOOP
    -- Atualizar status para nao_executada
    IF NOT p_dry_run THEN
      UPDATE rotas
      SET status = 'nao_executada'
      WHERE id = r.id;
    END IF;

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
      IF NOT p_dry_run THEN
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
      END IF;
      v_notified := v_notified + 1;
    END LOOP;

    -- Notificar MOTORISTA
    IF r.motorista_id IS NOT NULL THEN
      IF NOT p_dry_run THEN
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
      END IF;
      v_notified := v_notified + 1;
    END IF;

  END LOOP;

  -- Retornar estatísticas (em dry-run, o que TERIA acontecido)
  expired_count := v_expired;
  notifications_sent := v_notified;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- CREATE FUNCTION concede EXECUTE a PUBLIC por padrão. A função roda como
-- SECURITY DEFINER e expira rotas de TODAS as unidades, então precisa voltar a
-- ser exclusiva do service_role — como estava antes do DROP.
REVOKE ALL ON FUNCTION expire_old_pending_routes(BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION expire_old_pending_routes(BOOLEAN) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION expire_old_pending_routes(BOOLEAN) TO service_role;

COMMENT ON FUNCTION expire_old_pending_routes(BOOLEAN) IS
  'Expira rotas pendentes e notifica gestores e motorista. Dias anteriores a qualquer hora; dia corrente apenas após 22:00 America/Sao_Paulo, para que uma execução atrasada do agendador não apague rotas do próprio dia. p_dry_run=true apenas conta, sem mutar nem notificar.';

-- ---------------------------------------------------------------------------
-- 2. remind_pending_routes — mesma correção de fuso
-- ---------------------------------------------------------------------------
-- Usava `ro.data = CURRENT_DATE` (UTC). Entre 00:00 e 03:00 UTC isso aponta
-- para o dia seguinte ao brasileiro, então uma execução atrasada lembraria
-- sobre o dia errado. Assinatura inalterada -> CREATE OR REPLACE preserva as
-- permissões existentes.

CREATE OR REPLACE FUNCTION remind_pending_routes(p_urgency TEXT DEFAULT 'normal')
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
    WHERE ro.data = (now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND ro.status = 'pendente'
      AND ro.motorista_id IS NOT NULL
  LOOP
    v_found := v_found + 1;
    SELECT nome INTO v_motorista_nome FROM usuarios WHERE id = r.motorista_id;
    SELECT nome INTO v_unidade_nome FROM unidades WHERE id = r.unidade_id;
    SELECT COUNT(*) INTO v_paradas_count FROM paradas WHERE rota_id = r.id AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);

    IF p_urgency = 'final' THEN
      v_tipo_notificacao := 'lembrete_rota_urgente';
      v_titulo := '🚨 URGENTE: Rota expira em 2 horas!';
      v_mensagem := format('Sua rota com %s parada(s) expira às 22:00! Inicie agora ou ela será marcada como não executada.', v_paradas_count);
    ELSE
      v_tipo_notificacao := 'lembrete_rota_pendente';
      v_titulo := '⏰ Lembrete: Rota pendente!';
      v_mensagem := format('Você ainda tem uma rota pendente para hoje com %s parada(s). Expediente termina às 17h!', v_paradas_count);
    END IF;

    PERFORM criar_notificacao(r.motorista_id, v_tipo_notificacao, v_titulo, v_mensagem, r.id, NULL, NULL);
    v_sent := v_sent + 1;
  END LOOP;
  routes_found := v_found;
  reminders_sent := v_sent;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION remind_pending_routes(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION remind_pending_routes(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION remind_pending_routes(TEXT) TO service_role;

COMMENT ON FUNCTION remind_pending_routes(TEXT) IS
  'Lembra motoristas com rota pendente do dia (data em America/Sao_Paulo, nao CURRENT_DATE/UTC). p_urgency=final envia o aviso das 20:00.';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- DROP FUNCTION IF EXISTS expire_old_pending_routes(BOOLEAN);
-- CREATE FUNCTION expire_old_pending_routes()
-- RETURNS TABLE(expired_count INTEGER, notifications_sent INTEGER) AS $$
-- ... corpo anterior, com `WHERE ro.data <= CURRENT_DATE AND ro.status = 'pendente'` ...
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- REVOKE ALL ON FUNCTION expire_old_pending_routes() FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION expire_old_pending_routes() TO service_role;
-- -- e em remind_pending_routes, voltar o filtro para `ro.data = CURRENT_DATE`.
-- COMMIT;
-- ATENÇÃO: reverter reintroduz a perda de rotas do próprio dia quando o
-- agendador atrasa. Prefira corrigir para frente.
