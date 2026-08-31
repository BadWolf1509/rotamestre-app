-- ============================================================================
-- Migration: Expiração alcança rotas em andamento, com carência de 7 dias
-- Date: 2026-08-31
-- Author: Wellinton Ribeiro
-- Purpose:
--   `expire_old_pending_routes` filtrava `ro.status = 'pendente'` e mais nada.
--   Rota que o motorista INICIA e abandona ficava imortal: nunca expirava,
--   nunca gerava aviso ao gestor, e o `remind_pending_routes` também não a
--   alcançava (mesmo filtro). Descoberto em 31/08/2026 pela rota demo
--   `aaaa0000-0000-4000-8000-000000000020`, aberta em `em_andamento` desde
--   08/08 — 23 dias, 3 de 5 paradas pendentes.
--
--   Confirmado que a lacuna era total, não um detalhe do predicado: em todo o
--   schema `public` só duas funções mencionam `nao_executada` — esta e o
--   trigger de log `log_rota_status_change`. Nenhuma expirava `em_andamento`.
--
--   ATÉ HOJE A LACUNA ERA LATENTE, NÃO ATIVA: das 641 rotas da base, 620 estão
--   `concluida`, 17 `nao_executada`, 3 `cancelada` e exatamente 1
--   `em_andamento` — a demo, semeada nesse estado (`created_at` = `updated_at`,
--   linha nunca atualizada). Nenhuma rota real ficou presa. O buraco é para
--   frente, não uma dívida acumulada.
--
-- POR QUE 7 DIAS, E NÃO "JUNTO COM AS PENDENTES"
--   A leitura literal — expirar `em_andamento` às 22:00 do próprio dia, igual
--   às pendentes — foi testada por replay contra o histórico real de
--   `motorista_iniciou_rota` / `motorista_concluiu_rota` e REPROVADA:
--   **67 das 604 rotas concluídas (11%) foram fechadas depois das 22:00 da
--   própria data.** Elas teriam sido marcadas `nao_executada` com o motorista
--   ainda entregando, disparando notificação falsa para ele e para todos os
--   gestores da unidade — exatamente o incidente de 27/08/2026 que a migration
--   20260827190000 foi escrita para impedir, aqui em escala 33x maior.
--
--   Rota em andamento não é rota esquecida. Das 67 tardias, só 1 fechou antes
--   da meia-noite; 47 fecharam no dia seguinte. A mediana fecha 10,1h depois
--   das 22:00 (~08:00 da manhã seguinte) e o p90 em 58,8h. O padrão real é o
--   motorista deixar a rota aberta e concluir na manhã seguinte ou depois.
--
--   Replay dos falsos positivos por carência, sobre as 604 concluídas com log:
--     0 dias (literal) -> 67   |  3 dias ->  4
--     1 dia            -> 19   |  7 dias ->  2  <-- ESCOLHIDO
--     2 dias           -> 19   | 14 dias ->  0
--
--   7 dias deixa 2 falsos históricos (0,3%) com folga larga sobre o p90 real,
--   e ainda alcança a rota demo de 23 dias. 14 dias zeraria os falsos, ao custo
--   de o gestor ficar duas semanas sem saber que a rota ficou para trás.
--
-- MENSAGEM DIFERENTE PARA ROTA ABANDONADA
--   "não foi executada" é falso para uma rota com paradas concluídas — a demo
--   tem 2 de 5 entregues. As pendentes mantêm o texto atual, byte a byte; só o
--   ramo novo ganha texto próprio. O `tipo` da notificação continua
--   `rota_nao_executada` de propósito: mudá-lo quebraria os consumidores que
--   filtram por ele.
--
-- Fuso: mesma nota da 20260827190000 — as 6 unidades ativas estão em PB e CE
-- (UTC-3) e o Brasil não adota horário de verão desde 2019. Se surgir unidade
-- em AC/AM/RO/RR/MS/MT, o fuso precisa virar coluna por unidade.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- expire_old_pending_routes — recriada a partir do fonte VIVO
-- ---------------------------------------------------------------------------
-- Conferido com `SELECT prosrc FROM pg_proc` antes de editar (md5
-- 10c15952...): o corpo em produção confere com o desta migration.
--
-- CREATE OR REPLACE, e não DROP + CREATE: a assinatura não muda
-- (`p_dry_run BOOLEAN DEFAULT FALSE`), e o REPLACE preserva os GRANTs atuais
-- (`postgres=EXECUTE, service_role=EXECUTE`). Um DROP reconcederia EXECUTE a
-- PUBLIC por padrão e exigiria refazer os REVOKEs — risco desnecessário numa
-- função SECURITY DEFINER que expira rotas de TODAS as unidades.

CREATE OR REPLACE FUNCTION expire_old_pending_routes(p_dry_run BOOLEAN DEFAULT FALSE)
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
  v_agora TIMESTAMP;
  v_hoje DATE;
  v_hora TIME;
  v_dias INTEGER;
  v_titulo_gestor VARCHAR;
  v_msg_gestor TEXT;
  v_titulo_motorista VARCHAR;
  v_msg_motorista TEXT;
BEGIN
  -- Relógio do negócio, não o do servidor.
  v_agora := now() AT TIME ZONE 'America/Sao_Paulo';
  v_hoje  := v_agora::date;
  v_hora  := v_agora::time;

  FOR r IN
    SELECT ro.id, ro.unidade_id, ro.motorista_id, ro.data, ro.status
    FROM rotas ro
    WHERE
      -- PENDENTES: predicado da 20260827190000, inalterado.
      (
        ro.status = 'pendente'
        AND (
          -- Dias anteriores: seguro a qualquer hora.
          ro.data < v_hoje
          -- Dia corrente: só depois do fim da janela (22:00 BRT). É esta linha
          -- que torna uma execução atrasada do agendador inofensiva.
          OR (ro.data = v_hoje AND v_hora >= TIME '22:00')
        )
      )
      -- EM ANDAMENTO: carência de 7 dias, sem guarda de hora.
      -- A hora não importa aqui — aos 7 dias, atraso do agendador é ruído. E a
      -- carência é o que separa "abandonada" de "o motorista fecha amanhã de
      -- manhã", que é o comportamento normal de 11% das rotas.
      OR (
        ro.status = 'em_andamento'
        AND ro.data <= v_hoje - 7
      )
  LOOP
    IF NOT p_dry_run THEN
      UPDATE rotas
      SET status = 'nao_executada'
      WHERE id = r.id;
    END IF;

    v_expired := v_expired + 1;

    IF r.motorista_id IS NOT NULL THEN
      SELECT nome INTO v_motorista_nome
      FROM usuarios
      WHERE id = r.motorista_id;
    ELSE
      v_motorista_nome := 'não atribuído';
    END IF;

    SELECT nome INTO v_unidade_nome
    FROM unidades
    WHERE id = r.unidade_id;

    SELECT COUNT(*) INTO v_paradas_count
    FROM paradas
    WHERE rota_id = r.id
      AND status = 'pendente'
      AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);

    -- Texto por ramo. O de 'pendente' é o histórico, preservado byte a byte
    -- para não alterar o que os gestores já reconhecem.
    IF r.status = 'em_andamento' THEN
      v_dias := v_hoje - r.data;
      v_titulo_gestor    := '⚠️ Rota abandonada';
      v_msg_gestor       := format(
        'A rota de %s atribuída a %s ficou %s dias aberta sem ser concluída e foi encerrada. %s parada(s) ficaram pendentes.',
        TO_CHAR(r.data, 'DD/MM'),
        COALESCE(v_motorista_nome, 'motorista não identificado'),
        v_dias,
        v_paradas_count
      );
      v_titulo_motorista := '❌ Rota encerrada';
      v_msg_motorista    := format(
        'Sua rota de %s ficou %s dias aberta sem ser concluída e foi encerrada. %s parada(s) ficaram pendentes. Entre em contato com seu gestor se necessário.',
        TO_CHAR(r.data, 'DD/MM'),
        v_dias,
        v_paradas_count
      );
    ELSE
      v_titulo_gestor    := '⚠️ Rota não executada';
      v_msg_gestor       := format(
        'A rota de %s atribuída a %s não foi executada. %s parada(s) ficaram pendentes.',
        TO_CHAR(r.data, 'DD/MM'),
        COALESCE(v_motorista_nome, 'motorista não identificado'),
        v_paradas_count
      );
      v_titulo_motorista := '❌ Rota não executada';
      v_msg_motorista    := format(
        'Sua rota de %s não foi executada e foi encerrada. %s parada(s) ficaram pendentes. Entre em contato com seu gestor se necessário.',
        TO_CHAR(r.data, 'DD/MM'),
        v_paradas_count
      );
    END IF;

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
          v_titulo_gestor,
          v_msg_gestor,
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
          v_titulo_motorista,
          v_msg_motorista,
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

COMMENT ON FUNCTION expire_old_pending_routes(BOOLEAN) IS
  'Expira rotas e notifica gestores e motorista. PENDENTES: dias anteriores a qualquer hora; dia corrente apenas após 22:00 America/Sao_Paulo, para que execução atrasada do agendador não apague rotas do próprio dia. EM ANDAMENTO: apenas após 7 dias de carência — 11% das rotas reais são concluídas depois das 22:00 da própria data, então expirá-las junto com as pendentes marcaria trabalho em curso como não executado. p_dry_run=true apenas conta, sem mutar nem notificar.';

COMMIT;

-- ROLLBACK:
-- Reverter = voltar o predicado para apenas `ro.status = 'pendente'` e o texto
-- para o único par de mensagens. A forma segura é reaplicar o corpo da
-- migration 20260827190000 (seção 1) via CREATE OR REPLACE, que restaura
-- exatamente o estado anterior preservando os GRANTs:
--
-- BEGIN;
-- CREATE OR REPLACE FUNCTION expire_old_pending_routes(p_dry_run BOOLEAN DEFAULT FALSE)
-- RETURNS TABLE(expired_count INTEGER, notifications_sent INTEGER) AS $$
-- ... corpo de 20260827190000, com `WHERE ro.status = 'pendente' AND (...)` ...
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- COMMIT;
--
-- ATENÇÃO: reverter reabre o buraco — rota iniciada e abandonada volta a ser
-- imortal, sem expiração e sem aviso ao gestor. Prefira ajustar a carência
-- (`v_hoje - 7`) a reverter.
