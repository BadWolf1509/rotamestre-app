-- ============================================================================
-- Migration: Lembrete alcança rotas em andamento prestes a expirar
-- Date: 2026-08-31
-- Author: Wellinton Ribeiro
-- Purpose:
--   Consequência direta da migration 20260831230000, que passou a expirar rotas
--   `em_andamento` após 7 dias. `remind_pending_routes` continuou filtrando só
--   `status = 'pendente'`, então a rota abandonada expirava **sem nunca ter
--   recebido aviso** — nem o lembrete das 16:00 nem o aviso final das 20:00.
--   Encerrar trabalho de alguém sem avisar é pior que não encerrar.
--
-- QUANDO AVISAR
--   O `expire` roda às 22:00 BRT e casa `em_andamento AND data <= hoje - 7`.
--   Usar o MESMO predicado aqui faz os dois lembretes caírem no dia em que a
--   rota de fato expira: 16:00 dá 6h de antecedência, 20:00 dá 2h. É exatamente
--   o desenho que já existe para as pendentes, e mantém a promessa do aviso
--   "2 horas antes" verdadeira também para o ramo novo.
--
--   Alternativa descartada: avisar no dia 6 ("expira amanhã"). O agendador só
--   roda em dias úteis, então "amanhã" seria falso toda sexta-feira — e a
--   migration 20260827190000 documenta que o cron do GitHub Actions atrasa
--   horas. Ancorar o aviso no mesmo predicado da expiração é a única forma de
--   os dois não divergirem quando o agendador escorrega.
--
-- TEXTO PRÓPRIO, PORQUE O ATUAL SERIA MENTIRA
--   O aviso final diz "expira às 22:00! **Inicie agora** ou ela será marcada
--   como não executada". Para rota já iniciada, "inicie agora" está errado, e
--   "não executada" é falso quando há paradas concluídas. O ramo das pendentes
--   fica byte a byte igual; só o ramo novo ganha texto.
--
-- CONTAGEM DE PARADAS: O BUG QUE SÓ APARECE NO RAMO NOVO
--   `remind_pending_routes` conta `WHERE rota_id = r.id AND (is_checkpoint IS
--   NULL OR is_checkpoint = TRUE)` — ou seja, TODAS as paradas, sem filtrar por
--   status. Para rota `pendente` isso é inofensivo (nenhuma foi concluída).
--   Para `em_andamento` seria errado: a rota demo diria "5 parada(s)" com 2 já
--   entregues. O ramo novo conta só as pendentes, como
--   `expire_old_pending_routes` já faz. O ramo antigo fica intocado — corrigi-lo
--   mudaria mensagem que hoje está correta, sem ganho.
--
-- Tipos de notificação preservados (`lembrete_rota_urgente` /
-- `lembrete_rota_pendente`): mudá-los quebraria consumidores que filtram por
-- eles.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- remind_pending_routes — recriada a partir do fonte VIVO
-- ---------------------------------------------------------------------------
-- Conferido com `SELECT prosrc FROM pg_proc` antes de editar: o corpo em
-- produção confere com o da migration 20260827190000.
--
-- CREATE OR REPLACE: assinatura inalterada (`p_urgency TEXT DEFAULT 'normal'`),
-- então os GRANTs atuais são preservados e não há risco de reconceder EXECUTE a
-- PUBLIC.

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
  v_hoje DATE;
  v_dias INTEGER;
BEGIN
  -- Relógio do negócio, não o do servidor (mesma nota da 20260827190000).
  v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  FOR r IN
    SELECT ro.id, ro.unidade_id, ro.motorista_id, ro.data, ro.status
    FROM rotas ro
    WHERE ro.motorista_id IS NOT NULL
      AND (
        -- PENDENTES: predicado original, inalterado.
        (ro.status = 'pendente' AND ro.data = v_hoje)
        -- EM ANDAMENTO: mesmo predicado que `expire_old_pending_routes` usa,
        -- para que o aviso caia no dia em que a rota realmente expira.
        OR (ro.status = 'em_andamento' AND ro.data <= v_hoje - 7)
      )
  LOOP
    v_found := v_found + 1;
    SELECT nome INTO v_motorista_nome FROM usuarios WHERE id = r.motorista_id;
    SELECT nome INTO v_unidade_nome FROM unidades WHERE id = r.unidade_id;

    IF r.status = 'em_andamento' THEN
      -- Só as que faltam: a rota já tem paradas concluídas.
      SELECT COUNT(*) INTO v_paradas_count
      FROM paradas
      WHERE rota_id = r.id
        AND status = 'pendente'
        AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);

      v_dias := v_hoje - r.data;

      IF p_urgency = 'final' THEN
        v_tipo_notificacao := 'lembrete_rota_urgente';
        v_titulo := '🚨 URGENTE: Rota será encerrada em 2 horas!';
        v_mensagem := format(
          'Sua rota de %s está aberta há %s dias e será encerrada às 22:00. Conclua as %s parada(s) restantes agora.',
          TO_CHAR(r.data, 'DD/MM'), v_dias, v_paradas_count
        );
      ELSE
        v_tipo_notificacao := 'lembrete_rota_pendente';
        v_titulo := '⏰ Lembrete: Rota em aberto!';
        v_mensagem := format(
          'Sua rota de %s está aberta há %s dias e será encerrada hoje às 22:00 se não for concluída. Faltam %s parada(s).',
          TO_CHAR(r.data, 'DD/MM'), v_dias, v_paradas_count
        );
      END IF;
    ELSE
      -- Ramo original, preservado byte a byte (contagem inclusive).
      SELECT COUNT(*) INTO v_paradas_count
      FROM paradas
      WHERE rota_id = r.id
        AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);

      IF p_urgency = 'final' THEN
        v_tipo_notificacao := 'lembrete_rota_urgente';
        v_titulo := '🚨 URGENTE: Rota expira em 2 horas!';
        v_mensagem := format('Sua rota com %s parada(s) expira às 22:00! Inicie agora ou ela será marcada como não executada.', v_paradas_count);
      ELSE
        v_tipo_notificacao := 'lembrete_rota_pendente';
        v_titulo := '⏰ Lembrete: Rota pendente!';
        v_mensagem := format('Você ainda tem uma rota pendente para hoje com %s parada(s). Expediente termina às 17h!', v_paradas_count);
      END IF;
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

COMMENT ON FUNCTION remind_pending_routes(TEXT) IS
  'Lembra motoristas de rota a vencer (data em America/Sao_Paulo, nao CURRENT_DATE/UTC). PENDENTES: rota do dia. EM ANDAMENTO: mesmo predicado da expiracao (data <= hoje - 7), para que o aviso caia no dia em que a rota realmente expira — 6h de antecedencia as 16:00, 2h as 20:00. p_urgency=final envia o aviso das 20:00. O ramo em_andamento conta apenas paradas pendentes; o ramo pendente conta todas, como sempre fez.';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- CREATE OR REPLACE FUNCTION remind_pending_routes(p_urgency TEXT DEFAULT 'normal')
-- RETURNS TABLE(routes_found INTEGER, reminders_sent INTEGER) AS $$
-- ... corpo de 20260827190000 (secao 2), com
--     `WHERE ro.data = (now() AT TIME ZONE 'America/Sao_Paulo')::date
--        AND ro.status = 'pendente' AND ro.motorista_id IS NOT NULL` ...
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- COMMIT;
--
-- ATENCAO: reverter isto SEM reverter a 20260831230000 deixa o pior dos dois
-- mundos — a rota em andamento continua expirando aos 7 dias, mas volta a
-- expirar em silencio. Se for reverter, reverta as duas.
