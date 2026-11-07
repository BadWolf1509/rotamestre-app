-- ============================================================================
-- Migration 83: varredura de 07/11/2026 (banco) — aviso de expiração pelo
-- vínculo, lembrete na janela e uma vez por dia, conclusão de rota só sem
-- parada aberta, retenção de notificações
-- Date: 2026-11-07
-- Author: Wellinton Ribeiro
-- Purpose:
--   Quatro itens da varredura de 07/11 (`docs/superpowers/2026-11-07-
--   varredura-refatoracoes.md`), numa transação:
--
--   B-1 `expire_old_pending_routes` avisava os gestores pela coluna legada
--       (`usuarios.unidade_id` + `papel = 'gestor'`). A Migration 35 trocou
--       os gatilhos `notify_*` pelo helper `gestores_ativos_da_unidade`
--       (vínculo `gestor` ativo em `usuario_unidades`) e esta função ficou
--       para trás: gestor que só tem o vínculo não era avisado, e quem saiu
--       da loja (vínculo inativo) continuava sendo. Muda só o SELECT do loop
--       de gestores; o resto é o corpo da Migration 25 (20260831230000),
--       última definição.
--
--   B-2 `remind_pending_routes` não olhava a hora nem o que já tinha
--       enviado. O agendador do GitHub já entregou evento com +9h43
--       (27/08/2026) e um disparo manual repete o lembrete. Agora:
--         - janela em America/Sao_Paulo, a partir dos horários do
--           `.github/workflows/expire-routes.yml` (lembrete 16:00, aviso
--           final 20:00, expiração 22:00, dias úteis):
--             normal: 15:00 ≤ hora < 17:00 — 1 h antes do agendado para
--               disparo manual; termina às 17:00 porque o texto da rota
--               pendente diz "Expediente termina às 17h!" (depois disso o
--               aviso final das 20:00 cobre a rota);
--             final:  19:00 ≤ hora < 22:00 — termina na expiração: depois
--               dela o texto "expira às 22:00" seria falso (e, depois da
--               meia-noite, falaria de rota do dia seguinte);
--           fora da janela a função devolve (0, 0) sem escrever nada;
--         - não envia de novo o mesmo tipo de aviso (`lembrete_rota_pendente`
--           ou `lembrete_rota_urgente`) para a mesma rota e o mesmo
--           motorista desde a meia-noite de Brasília (`NOT EXISTS` em
--           `notificacoes`). Rota que já recebeu o aviso não entra no loop
--           (nem em `routes_found`).
--       A decisão mora em `lembrar_rotas_no_horario(p_urgency, p_agora)`,
--       com o instante como argumento para a sonda provar as janelas sem
--       depender da hora em que roda; `remind_pending_routes(p_urgency)`
--       (assinatura e ACL de antes) só a chama com `now()`. A interna não é
--       SECURITY DEFINER e ninguém além do dono a executa: quem a chama é a
--       `remind_pending_routes` (DEFINER, dono postgres). Predicados, textos
--       e contagens são os da Migration 26 (20260831234500), última
--       definição.
--
--   B-4 Rota só conclui sem parada real aberta, qualquer que seja o caminho.
--       A função do gatilho da Migration 76 (`rota_status_pelo_gestor`,
--       20261027100000, última definição) passa a conferir, em toda chegada
--       a `concluida`, as paradas reais (`is_checkpoint IS DISTINCT FROM
--       false`, o critério da `finalizar_rota`) em `pendente`/`em_andamento`,
--       com as paradas travadas antes de contar (como a `finalizar_rota`);
--       havendo alguma: P0001 com a mensagem `ROTA_PARADAS_PENDENTES: ...`, o
--       mesmo prefixo da `finalizar_rota` (o app já o mapeia em
--       `src/lib/errorMapping.ts`). Vale para o motorista e para o gestor;
--       sessão sem usuário (cron, chave secreta, CLI) segue passando, como na
--       Migration 76.
--       `finalizar_rota` (última definição em 20261024111000) não muda de
--       comportamento: ela confere antes com o mesmo código, conclui a
--       chegada (`is_checkpoint = false`, fora da contagem) e só então grava
--       a rota. Partida e chegada não contam.
--
--   B-5 `notificacoes` e `push_notification_logs` não tinham retenção.
--       `limpar_notificacoes_antigas(p_dias_lidas 90, p_dias_push_logs 30)`
--       apaga notificação LIDA criada há mais de p_dias_lidas dias e log de
--       push criado há mais de p_dias_push_logs dias, em lotes de 5.000 (até
--       200 lotes por tabela numa chamada; o que sobrar sai na seguinte).
--       Mínimos: 30 dias para lidas, 7 para logs (um 0 por engano não apaga
--       tudo). Notificação não lida fica. Chamada pela Edge Function
--       `expire-routes` ao lado da limpeza de posições (Migration 37), com a
--       mesma regra: falha só vai para o log. EXECUTE só de `service_role`.
--       Índice novo em `push_notification_logs(created_at)`; `notificacoes`
--       já tem `idx_notificacoes_created`.
--
--   Alternativas consideradas:
--     B-1: (a) helper `gestores_ativos_da_unidade` (escolhida: fonte única do
--          critério, a mesma dos gatilhos); (b) JOIN em `usuario_unidades`
--          dentro da função: duplicaria o critério.
--     B-2 janela: (a) guarda no SQL (escolhida: protege de qualquer
--          chamador, inclusive disparo manual); (b) guarda na Edge Function:
--          o SQL seguiria aberto a quem tem a chave secreta; (c) janela
--          estreita (±30 min): um atraso normal do agendador perderia o
--          aviso. Testabilidade: (a) função interna com `p_agora`
--          (escolhida); (b) parâmetro `p_agora` na própria
--          `remind_pending_routes`: quem tem EXECUTE escolheria a hora e
--          furaria a janela; (c) só a hora atual: a sonda não provaria as
--          duas janelas na mesma execução.
--     B-2 idempotência: (a) `NOT EXISTS` em `notificacoes` (escolhida: sem
--          objeto novo); (b) índice único parcial por (rota, tipo, dia): a
--          `criar_notificacao` engole o erro e o dia em Brasília não é
--          expressão IMMUTABLE simples; (c) tabela de controle de execução:
--          mais um objeto a manter.
--     B-4: (a) conferência no gatilho da Migration 76 (escolhida: mesmo
--          lugar que já decide a transição, sem gatilho novo para ordenar);
--          (b) gatilho próprio: dois BEFORE UPDATE OF status com ordem
--          alfabética a cuidar; (c) só aceitar a conclusão pela RPC: o app
--          até a 1.14.2 conclui por UPDATE (compatibilidade, B-7).
--          Escopo: toda chegada a `concluida` (o gestor também), porque rota
--          concluída com parada real aberta é estado inválido para qualquer
--          um; o motorista só chega a `concluida` vindo de `em_andamento`.
--     B-5: (a) RPC chamada pela `expire-routes` (escolhida: mesmo caminho da
--          Migration 37, sem pg_cron no projeto); (b) pg_cron: decisão do
--          usuário (B-6); (c) DELETE único sem lotes: uma primeira execução
--          sobre meses de histórico seguraria a tabela.
--
--   Efeito no app:
--     - B-1: o gestor pelo vínculo passa a receber o aviso de rota não
--       executada/abandonada; quem saiu da loja deixa de receber;
--     - B-2: lembrete fora de hora ou repetido deixa de chegar;
--     - B-4: concluir com parada real aberta devolve o erro (o app mostra
--       "concluir com paradas pendentes"); o caminho normal (todas
--       concluídas ou puladas) não muda;
--     - B-5: notificação lida com mais de 90 dias some da lista.
--
--   Ordem de deploy: esta migration antes do deploy da `expire-routes` nova
--   (o inverso não quebra: a RPC ausente só vai para o log da função).
--
--   `SET LOCAL lock_timeout = '3s'`: CREATE OR REPLACE FUNCTION pede trava
--   só no catálogo; o CREATE INDEX pede SHARE em `push_notification_logs`
--   (tabela pequena, escrita só pela `send-push-notification`). Se a trava
--   não vier em 3 s, a migration para sem efeito e é repetida.
--   CREATE OR REPLACE preserva a ACL; REVOKE/GRANT repetem a vigente
--   (expire/remind: só service_role, Migrations 20260622183805 e
--   20260827190000; rota_status_pelo_gestor: só o dono, Migration 76).
--
--   APLICAR COMO `postgres`: a `expire_old_pending_routes` (DEFINER) chama
--   `gestores_ativos_da_unidade`, que só o dono postgres executa.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

-- ----------------------------------------------------------------------------
-- B-1. expire_old_pending_routes — corpo da Migration 25; muda só o loop de
-- gestores
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_old_pending_routes(p_dry_run boolean DEFAULT false)
RETURNS TABLE(
  expired_count integer,
  notifications_sent integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      -- EM ANDAMENTO: carência de 7 dias, sem guarda de hora (Migration 25).
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

    -- Todos os gestores com vínculo ativo na loja (Migration 83, B-1): a
    -- mesma fonte dos gatilhos notify_* (Migration 35).
    FOR g IN
      SELECT ga.id
      FROM public.gestores_ativos_da_unidade(r.unidade_id) AS ga(id)
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
$$;

REVOKE ALL ON FUNCTION public.expire_old_pending_routes(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_old_pending_routes(boolean) TO service_role;

COMMENT ON FUNCTION public.expire_old_pending_routes(boolean) IS
  'Migration 83 (sobre a 25): expira rotas e notifica os gestores com vínculo ativo na loja (gestores_ativos_da_unidade) e o motorista. PENDENTES: dias anteriores a qualquer hora; dia corrente apenas após 22:00 America/Sao_Paulo. EM ANDAMENTO: apenas após 7 dias de carência. p_dry_run=true apenas conta, sem mutar nem notificar.';

-- ----------------------------------------------------------------------------
-- B-2. Lembrete na janela e uma vez por dia
-- ----------------------------------------------------------------------------
-- Interna: o corpo da Migration 26 com o instante como argumento, a janela
-- antes do loop e o NOT EXISTS no SELECT do loop.
CREATE OR REPLACE FUNCTION public.lembrar_rotas_no_horario(p_urgency text, p_agora timestamptz)
RETURNS TABLE(
  routes_found integer,
  reminders_sent integer
)
LANGUAGE plpgsql
SET search_path = public
AS $$
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
  v_local TIMESTAMP;
  v_hoje DATE;
  v_hora TIME;
  v_inicio_do_dia TIMESTAMPTZ;
  v_na_janela BOOLEAN;
  v_dias INTEGER;
BEGIN
  -- Relógio do negócio, não o do servidor (mesma nota da 20260827190000).
  v_local := p_agora AT TIME ZONE 'America/Sao_Paulo';
  v_hoje := v_local::date;
  v_hora := v_local::time;
  v_inicio_do_dia := v_hoje::timestamp AT TIME ZONE 'America/Sao_Paulo';

  -- O tipo depende só da urgência (os dois ramos abaixo usam o mesmo par).
  IF p_urgency = 'final' THEN
    v_tipo_notificacao := 'lembrete_rota_urgente';
  ELSE
    v_tipo_notificacao := 'lembrete_rota_pendente';
  END IF;

  -- Janela (B-2): agendador atrasado ou disparo manual fora de hora não avisa.
  -- Agendado (expire-routes.yml): lembrete 16:00, aviso final 20:00,
  -- expiração 22:00. A normal fecha às 17:00: o texto da pendente diz
  -- "Expediente termina às 17h!".
  IF p_urgency = 'final' THEN
    v_na_janela := v_hora >= TIME '19:00' AND v_hora < TIME '22:00';
  ELSE
    v_na_janela := v_hora >= TIME '15:00' AND v_hora < TIME '17:00';
  END IF;

  IF NOT v_na_janela THEN
    routes_found := 0;
    reminders_sent := 0;
    RETURN NEXT;
    RETURN;
  END IF;

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
      -- Uma vez por dia (B-2): o mesmo aviso para a mesma rota e o mesmo
      -- motorista desde a meia-noite de Brasília não se repete.
      AND NOT EXISTS (
        SELECT 1
        FROM notificacoes n
        WHERE n.rota_id = ro.id
          AND n.usuario_id = ro.motorista_id
          AND n.tipo = v_tipo_notificacao
          AND n.created_at >= v_inicio_do_dia
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
        v_titulo := '🚨 URGENTE: Rota será encerrada em 2 horas!';
        v_mensagem := format(
          'Sua rota de %s está aberta há %s dias e será encerrada às 22:00. Conclua as %s parada(s) restantes agora.',
          TO_CHAR(r.data, 'DD/MM'), v_dias, v_paradas_count
        );
      ELSE
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
        v_titulo := '🚨 URGENTE: Rota expira em 2 horas!';
        v_mensagem := format('Sua rota com %s parada(s) expira às 22:00! Inicie agora ou ela será marcada como não executada.', v_paradas_count);
      ELSE
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
$$;

ALTER FUNCTION public.lembrar_rotas_no_horario(text, timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.lembrar_rotas_no_horario(text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.lembrar_rotas_no_horario(text, timestamptz) IS
  'Migration 83: corpo do lembrete de rota com o instante como argumento. Só avisa na janela de America/Sao_Paulo (normal 15:00-17:00, final 19:00-22:00) e não repete o mesmo tipo de aviso para a mesma rota e motorista no dia. Chamada só pela remind_pending_routes; EXECUTE só do dono.';

CREATE OR REPLACE FUNCTION public.remind_pending_routes(p_urgency text DEFAULT 'normal')
RETURNS TABLE(
  routes_found integer,
  reminders_sent integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT l.routes_found, l.reminders_sent
    FROM public.lembrar_rotas_no_horario(p_urgency, now()) AS l;
END;
$$;

REVOKE ALL ON FUNCTION public.remind_pending_routes(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remind_pending_routes(text) TO service_role;

COMMENT ON FUNCTION public.remind_pending_routes(text) IS
  'Migration 83 (sobre a 26): lembra motoristas de rota a vencer, pela lembrar_rotas_no_horario com now(). Só na janela de America/Sao_Paulo (normal 15:00-17:00, final 19:00-22:00; fora dela devolve 0, 0) e uma vez por dia por rota e tipo. PENDENTES: rota do dia. EM ANDAMENTO: data <= hoje - 7. p_urgency=final envia o aviso das 20:00.';

-- ----------------------------------------------------------------------------
-- B-4. rota_status_pelo_gestor — corpo da Migration 76 + conferência de
-- paradas reais abertas antes de qualquer chegada a `concluida`
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rota_status_pelo_gestor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pendentes integer;
BEGIN
  -- Cron, chave secreta e CLI não têm usuário.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Rota só conclui sem parada real aberta (Migration 83, B-4), com o
  -- critério e o código da finalizar_rota. Partida e chegada
  -- (is_checkpoint = false) não contam. As paradas são travadas antes da
  -- contagem, como na finalizar_rota (FOR NO KEY UPDATE, nunca FOR UPDATE).
  IF NEW.status = 'concluida' THEN
    PERFORM 1
       FROM public.paradas p
      WHERE p.rota_id = OLD.id
        FOR NO KEY UPDATE;

    SELECT count(*)
      INTO v_pendentes
      FROM public.paradas p
     WHERE p.rota_id = OLD.id
       AND p.is_checkpoint IS DISTINCT FROM false
       AND p.status IN ('pendente', 'em_andamento');

    IF v_pendentes > 0 THEN
      RAISE EXCEPTION 'ROTA_PARADAS_PENDENTES: não é possível concluir a rota com % parada(s) pendente(s).', v_pendentes
        USING ERRCODE = 'P0001',
              HINT = 'Conclua ou pule as paradas antes de concluir a rota.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.usuario_unidades uu
     WHERE uu.usuario_id = v_uid
       AND uu.unidade_id = OLD.unidade_id
       AND uu.ativo = true
       AND uu.papel::text = 'gestor'
  ) THEN
    RETURN NEW;
  END IF;

  IF (OLD.status = 'pendente' AND NEW.status = 'em_andamento')
     OR (OLD.status = 'em_andamento' AND NEW.status = 'concluida') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'ROTA_TRANSICAO_RECUSADA'
    USING ERRCODE = 'P0001',
          DETAIL = format('A rota %s não passa de %s a %s por este usuário.', OLD.id, OLD.status, NEW.status),
          HINT = 'Recarregue a rota.';
END;
$$;

ALTER FUNCTION public.rota_status_pelo_gestor() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rota_status_pelo_gestor() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.rota_status_pelo_gestor() IS
  'Migration 83 (sobre a 76): gatilho BEFORE UPDATE OF status de rotas. Concluir com parada real (is_checkpoint distinto de false) pendente ou em andamento é recusado para todo usuário (P0001 ROTA_PARADAS_PENDENTES). Quem não é gestor ativo da loja da rota só leva o status de pendente a em_andamento e de em_andamento a concluida (P0001 ROTA_TRANSICAO_RECUSADA). Sessão sem usuário passa.';

-- ----------------------------------------------------------------------------
-- B-5. Retenção de notificações lidas e logs de push
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_created_at
  ON public.push_notification_logs (created_at);

CREATE OR REPLACE FUNCTION public.limpar_notificacoes_antigas(
  p_dias_lidas integer DEFAULT 90,
  p_dias_push_logs integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_lote CONSTANT integer := 5000;
  c_max_lotes CONSTANT integer := 200;
  v_corte_lidas timestamptz;
  v_corte_logs timestamptz;
  v_n integer;
  v_lotes integer;
  v_logs integer := 0;
  v_notificacoes integer := 0;
  v_logs_completo boolean;
  v_notificacoes_completo boolean;
BEGIN
  -- Piso para um argumento errado não apagar o histórico recente.
  IF p_dias_lidas IS NULL OR p_dias_lidas < 30 THEN
    RAISE EXCEPTION 'Retenção mínima de notificações lidas é 30 dias (recebido: %).', p_dias_lidas
      USING ERRCODE = '22023';
  END IF;
  IF p_dias_push_logs IS NULL OR p_dias_push_logs < 7 THEN
    RAISE EXCEPTION 'Retenção mínima de logs de push é 7 dias (recebido: %).', p_dias_push_logs
      USING ERRCODE = '22023';
  END IF;

  v_corte_lidas := now() - make_interval(days => p_dias_lidas);
  v_corte_logs := now() - make_interval(days => p_dias_push_logs);

  -- Logs de push antigos, em lotes.
  v_lotes := 0;
  LOOP
    DELETE FROM public.push_notification_logs l
     WHERE l.id IN (
       SELECT l2.id
         FROM public.push_notification_logs l2
        WHERE l2.created_at < v_corte_logs
        LIMIT c_lote
     );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_logs := v_logs + v_n;
    v_lotes := v_lotes + 1;
    EXIT WHEN v_n < c_lote OR v_lotes >= c_max_lotes;
  END LOOP;
  v_logs_completo := v_n < c_lote;

  -- Notificações lidas antigas, em lotes (os logs delas saem pelo CASCADE).
  v_lotes := 0;
  LOOP
    DELETE FROM public.notificacoes n
     WHERE n.id IN (
       SELECT n2.id
         FROM public.notificacoes n2
        WHERE n2.lida = true
          AND n2.created_at < v_corte_lidas
        LIMIT c_lote
     );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_notificacoes := v_notificacoes + v_n;
    v_lotes := v_lotes + 1;
    EXIT WHEN v_n < c_lote OR v_lotes >= c_max_lotes;
  END LOOP;
  v_notificacoes_completo := v_n < c_lote;

  RETURN jsonb_build_object(
    'notificacoes_apagadas', v_notificacoes,
    'push_logs_apagados', v_logs,
    'completa', v_logs_completo AND v_notificacoes_completo
  );
END;
$$;

ALTER FUNCTION public.limpar_notificacoes_antigas(integer, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.limpar_notificacoes_antigas(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.limpar_notificacoes_antigas(integer, integer) TO service_role;

COMMENT ON FUNCTION public.limpar_notificacoes_antigas(integer, integer) IS
  'Migration 83: apaga notificações lidas criadas há mais de p_dias_lidas dias (padrão 90, mínimo 30) e logs de push criados há mais de p_dias_push_logs dias (padrão 30, mínimo 7), em lotes de 5000 (até 200 por tabela numa chamada). Devolve {notificacoes_apagadas, push_logs_apagados, completa}. Chamada pela Edge Function expire-routes.';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT p.oid::regprocedure, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono,
--        p.proacl, left(obj_description(p.oid, 'pg_proc'), 40)
--   FROM pg_proc p
--  WHERE p.oid IN (to_regprocedure('public.expire_old_pending_routes(boolean)'),
--                  to_regprocedure('public.remind_pending_routes(text)'),
--                  to_regprocedure('public.lembrar_rotas_no_horario(text,timestamptz)'),
--                  to_regprocedure('public.rota_status_pelo_gestor()'),
--                  to_regprocedure('public.limpar_notificacoes_antigas(integer,integer)'));
-- SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_push_notification_logs_created_at';
-- ============================================================================

-- ROLLBACK:
-- -- Corpos das últimas definições nos arquivos (expire: 20260831230000;
-- -- remind: 20260831234500; gatilho: 20261027100000), ACL e COMMENT de antes.
-- -- Reverter a B-4 tira a conferência de paradas do gatilho; reverter a B-2
-- -- volta o lembrete fora de hora e repetido.
-- BEGIN;
-- SET LOCAL lock_timeout = '3s';
--
-- CREATE OR REPLACE FUNCTION public.expire_old_pending_routes(p_dry_run boolean DEFAULT false)
-- RETURNS TABLE(expired_count integer, notifications_sent integer)
-- LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
-- AS $$
-- DECLARE
--   r RECORD;
--   g RECORD;
--   v_motorista_nome VARCHAR;
--   v_unidade_nome VARCHAR;
--   v_paradas_count INTEGER;
--   v_expired INTEGER := 0;
--   v_notified INTEGER := 0;
--   v_agora TIMESTAMP;
--   v_hoje DATE;
--   v_hora TIME;
--   v_dias INTEGER;
--   v_titulo_gestor VARCHAR;
--   v_msg_gestor TEXT;
--   v_titulo_motorista VARCHAR;
--   v_msg_motorista TEXT;
-- BEGIN
--   v_agora := now() AT TIME ZONE 'America/Sao_Paulo';
--   v_hoje  := v_agora::date;
--   v_hora  := v_agora::time;
--   FOR r IN
--     SELECT ro.id, ro.unidade_id, ro.motorista_id, ro.data, ro.status
--     FROM rotas ro
--     WHERE
--       (
--         ro.status = 'pendente'
--         AND (
--           ro.data < v_hoje
--           OR (ro.data = v_hoje AND v_hora >= TIME '22:00')
--         )
--       )
--       OR (
--         ro.status = 'em_andamento'
--         AND ro.data <= v_hoje - 7
--       )
--   LOOP
--     IF NOT p_dry_run THEN
--       UPDATE rotas
--       SET status = 'nao_executada'
--       WHERE id = r.id;
--     END IF;
--     v_expired := v_expired + 1;
--     IF r.motorista_id IS NOT NULL THEN
--       SELECT nome INTO v_motorista_nome
--       FROM usuarios
--       WHERE id = r.motorista_id;
--     ELSE
--       v_motorista_nome := 'não atribuído';
--     END IF;
--     SELECT nome INTO v_unidade_nome
--     FROM unidades
--     WHERE id = r.unidade_id;
--     SELECT COUNT(*) INTO v_paradas_count
--     FROM paradas
--     WHERE rota_id = r.id
--       AND status = 'pendente'
--       AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);
--     IF r.status = 'em_andamento' THEN
--       v_dias := v_hoje - r.data;
--       v_titulo_gestor    := '⚠️ Rota abandonada';
--       v_msg_gestor       := format(
--         'A rota de %s atribuída a %s ficou %s dias aberta sem ser concluída e foi encerrada. %s parada(s) ficaram pendentes.',
--         TO_CHAR(r.data, 'DD/MM'),
--         COALESCE(v_motorista_nome, 'motorista não identificado'),
--         v_dias,
--         v_paradas_count
--       );
--       v_titulo_motorista := '❌ Rota encerrada';
--       v_msg_motorista    := format(
--         'Sua rota de %s ficou %s dias aberta sem ser concluída e foi encerrada. %s parada(s) ficaram pendentes. Entre em contato com seu gestor se necessário.',
--         TO_CHAR(r.data, 'DD/MM'),
--         v_dias,
--         v_paradas_count
--       );
--     ELSE
--       v_titulo_gestor    := '⚠️ Rota não executada';
--       v_msg_gestor       := format(
--         'A rota de %s atribuída a %s não foi executada. %s parada(s) ficaram pendentes.',
--         TO_CHAR(r.data, 'DD/MM'),
--         COALESCE(v_motorista_nome, 'motorista não identificado'),
--         v_paradas_count
--       );
--       v_titulo_motorista := '❌ Rota não executada';
--       v_msg_motorista    := format(
--         'Sua rota de %s não foi executada e foi encerrada. %s parada(s) ficaram pendentes. Entre em contato com seu gestor se necessário.',
--         TO_CHAR(r.data, 'DD/MM'),
--         v_paradas_count
--       );
--     END IF;
--     FOR g IN
--       SELECT id, nome
--       FROM usuarios
--       WHERE unidade_id = r.unidade_id
--         AND papel = 'gestor'
--     LOOP
--       IF NOT p_dry_run THEN
--         PERFORM criar_notificacao(g.id, 'rota_nao_executada', v_titulo_gestor, v_msg_gestor, r.id, NULL, NULL);
--       END IF;
--       v_notified := v_notified + 1;
--     END LOOP;
--     IF r.motorista_id IS NOT NULL THEN
--       IF NOT p_dry_run THEN
--         PERFORM criar_notificacao(r.motorista_id, 'rota_nao_executada', v_titulo_motorista, v_msg_motorista, r.id, NULL, NULL);
--       END IF;
--       v_notified := v_notified + 1;
--     END IF;
--   END LOOP;
--   expired_count := v_expired;
--   notifications_sent := v_notified;
--   RETURN NEXT;
-- END;
-- $$;
-- REVOKE ALL ON FUNCTION public.expire_old_pending_routes(boolean) FROM PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.expire_old_pending_routes(boolean) TO service_role;
-- COMMENT ON FUNCTION public.expire_old_pending_routes(boolean) IS
--   'Expira rotas e notifica gestores e motorista. PENDENTES: dias anteriores a qualquer hora; dia corrente apenas após 22:00 America/Sao_Paulo, para que execução atrasada do agendador não apague rotas do próprio dia. EM ANDAMENTO: apenas após 7 dias de carência — 11% das rotas reais são concluídas depois das 22:00 da própria data, então expirá-las junto com as pendentes marcaria trabalho em curso como não executado. p_dry_run=true apenas conta, sem mutar nem notificar.';
--
-- CREATE OR REPLACE FUNCTION public.remind_pending_routes(p_urgency text DEFAULT 'normal')
-- RETURNS TABLE(routes_found integer, reminders_sent integer)
-- LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
-- AS $$
-- DECLARE
--   r RECORD;
--   v_motorista_nome VARCHAR;
--   v_unidade_nome VARCHAR;
--   v_paradas_count INTEGER;
--   v_found INTEGER := 0;
--   v_sent INTEGER := 0;
--   v_titulo VARCHAR;
--   v_mensagem VARCHAR;
--   v_tipo_notificacao VARCHAR;
--   v_hoje DATE;
--   v_dias INTEGER;
-- BEGIN
--   v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
--   FOR r IN
--     SELECT ro.id, ro.unidade_id, ro.motorista_id, ro.data, ro.status
--     FROM rotas ro
--     WHERE ro.motorista_id IS NOT NULL
--       AND (
--         (ro.status = 'pendente' AND ro.data = v_hoje)
--         OR (ro.status = 'em_andamento' AND ro.data <= v_hoje - 7)
--       )
--   LOOP
--     v_found := v_found + 1;
--     SELECT nome INTO v_motorista_nome FROM usuarios WHERE id = r.motorista_id;
--     SELECT nome INTO v_unidade_nome FROM unidades WHERE id = r.unidade_id;
--     IF r.status = 'em_andamento' THEN
--       SELECT COUNT(*) INTO v_paradas_count
--       FROM paradas
--       WHERE rota_id = r.id
--         AND status = 'pendente'
--         AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);
--       v_dias := v_hoje - r.data;
--       IF p_urgency = 'final' THEN
--         v_tipo_notificacao := 'lembrete_rota_urgente';
--         v_titulo := '🚨 URGENTE: Rota será encerrada em 2 horas!';
--         v_mensagem := format(
--           'Sua rota de %s está aberta há %s dias e será encerrada às 22:00. Conclua as %s parada(s) restantes agora.',
--           TO_CHAR(r.data, 'DD/MM'), v_dias, v_paradas_count
--         );
--       ELSE
--         v_tipo_notificacao := 'lembrete_rota_pendente';
--         v_titulo := '⏰ Lembrete: Rota em aberto!';
--         v_mensagem := format(
--           'Sua rota de %s está aberta há %s dias e será encerrada hoje às 22:00 se não for concluída. Faltam %s parada(s).',
--           TO_CHAR(r.data, 'DD/MM'), v_dias, v_paradas_count
--         );
--       END IF;
--     ELSE
--       SELECT COUNT(*) INTO v_paradas_count
--       FROM paradas
--       WHERE rota_id = r.id
--         AND (is_checkpoint IS NULL OR is_checkpoint = TRUE);
--       IF p_urgency = 'final' THEN
--         v_tipo_notificacao := 'lembrete_rota_urgente';
--         v_titulo := '🚨 URGENTE: Rota expira em 2 horas!';
--         v_mensagem := format('Sua rota com %s parada(s) expira às 22:00! Inicie agora ou ela será marcada como não executada.', v_paradas_count);
--       ELSE
--         v_tipo_notificacao := 'lembrete_rota_pendente';
--         v_titulo := '⏰ Lembrete: Rota pendente!';
--         v_mensagem := format('Você ainda tem uma rota pendente para hoje com %s parada(s). Expediente termina às 17h!', v_paradas_count);
--       END IF;
--     END IF;
--     PERFORM criar_notificacao(r.motorista_id, v_tipo_notificacao, v_titulo, v_mensagem, r.id, NULL, NULL);
--     v_sent := v_sent + 1;
--   END LOOP;
--   routes_found := v_found;
--   reminders_sent := v_sent;
--   RETURN NEXT;
-- END;
-- $$;
-- REVOKE ALL ON FUNCTION public.remind_pending_routes(text) FROM PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.remind_pending_routes(text) TO service_role;
-- COMMENT ON FUNCTION public.remind_pending_routes(text) IS
--   'Lembra motoristas de rota a vencer (data em America/Sao_Paulo, nao CURRENT_DATE/UTC). PENDENTES: rota do dia. EM ANDAMENTO: mesmo predicado da expiracao (data <= hoje - 7), para que o aviso caia no dia em que a rota realmente expira — 6h de antecedencia as 16:00, 2h as 20:00. p_urgency=final envia o aviso das 20:00. O ramo em_andamento conta apenas paradas pendentes; o ramo pendente conta todas, como sempre fez.';
-- DROP FUNCTION IF EXISTS public.lembrar_rotas_no_horario(text, timestamptz);
--
-- CREATE OR REPLACE FUNCTION public.rota_status_pelo_gestor()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = ''
-- AS $$
-- DECLARE
--   v_uid uuid := auth.uid();
-- BEGIN
--   IF v_uid IS NULL THEN
--     RETURN NEW;
--   END IF;
--   IF EXISTS (
--     SELECT 1
--       FROM public.usuario_unidades uu
--      WHERE uu.usuario_id = v_uid
--        AND uu.unidade_id = OLD.unidade_id
--        AND uu.ativo = true
--        AND uu.papel::text = 'gestor'
--   ) THEN
--     RETURN NEW;
--   END IF;
--   IF (OLD.status = 'pendente' AND NEW.status = 'em_andamento')
--      OR (OLD.status = 'em_andamento' AND NEW.status = 'concluida') THEN
--     RETURN NEW;
--   END IF;
--   RAISE EXCEPTION 'ROTA_TRANSICAO_RECUSADA'
--     USING ERRCODE = 'P0001',
--           DETAIL = format('A rota %s não passa de %s a %s por este usuário.', OLD.id, OLD.status, NEW.status),
--           HINT = 'Recarregue a rota.';
-- END;
-- $$;
-- REVOKE ALL ON FUNCTION public.rota_status_pelo_gestor() FROM PUBLIC, anon, authenticated;
-- COMMENT ON FUNCTION public.rota_status_pelo_gestor() IS
--   'Migration 76: gatilho BEFORE UPDATE OF status de rotas. Quem não é gestor ativo da loja da rota só leva o status de pendente a em_andamento e de em_andamento a concluida (P0001 ROTA_TRANSICAO_RECUSADA). Sessão sem usuário passa.';
--
-- DROP FUNCTION IF EXISTS public.limpar_notificacoes_antigas(integer, integer);
-- DROP INDEX IF EXISTS public.idx_push_notification_logs_created_at;
-- COMMIT;
-- -- (Notificações e logs já apagados não voltam.)
