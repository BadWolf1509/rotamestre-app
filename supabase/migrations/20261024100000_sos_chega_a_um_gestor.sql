-- ============================================================================
-- Migration 46: o SOS chega a um gestor, ou o motorista sabe que não chegou
-- Date: 2026-10-24
-- Author: Wellinton Ribeiro
-- Purpose:
--   B1 (1.14.6). Sem rota, `notify_sos_acionado` (Migration 35) achava a loja
--   só pelo vínculo `is_principal` — em 24/10/2026, 1 de 11 vínculos ativos de
--   motorista tem a marca, e 3 motoristas atendem mais de uma loja —, então o
--   SOS de quem não estava em rota não avisava ninguém. O gatilho também lia
--   `detalhes.motivo`, enquanto o app grava `detalhes.descricao`: o texto do
--   motorista nunca chegava. E o app dizia "Seu gestor foi notificado" sem
--   saber de nada.
--
--   1. Helper `avisar_gestores_do_sos(motorista, rota, detalhes)` — fonte
--      única de quem recebe, no padrão do `unidade_do_incidente` da Migration
--      43 (SECURITY DEFINER, sem EXECUTE para a API):
--        a. com rota: os gestores ativos da loja da rota;
--        b. sem rota (ou rota sem loja): os gestores ativos de TODAS as lojas
--           com vínculo ativo do motorista, sem repetir gestor (UNION). Um
--           SOS não escolhe loja: diferente do incidente (que precisa de UMA
--           loja dona para a visibilidade), aqui avisar a mais é inofensivo e
--           avisar a menos é o defeito;
--        c. texto: `descricao`, depois `motivo` (versões antigas e chamadas
--           manuais), depois "Emergência acionada"; cortado em 200 caracteres;
--        d. devolve quantas notificações NASCERAM (`criar_notificacao` devolve
--           NULL quando o INSERT falha, e engole o erro);
--        e. nunca levanta: qualquer falha cai no EXCEPTION e devolve 0 — a
--           subtransação do bloco desfaz os avisos já criados, então 0 é a
--           verdade, não um palpite.
--
--   2. Gatilho `notify_sos_acionado` (AFTER INSERT em `logs`, já existente):
--      avisa pelo helper e grava a contagem no próprio log
--      (`detalhes.gestores_avisados`) — fica no histórico quantos gestores
--      receberam cada SOS, e é de onde a RPC lê. Tudo dentro de EXCEPTION:
--      o SOS nunca derruba o INSERT do log. O UPDATE da contagem tem bloco
--      próprio: se só ele falhar, os avisos já criados ficam (no mesmo bloco,
--      a subtransação os desfaria) e a RPC responde 0. Continua valendo para
--      as versões do app que gravam o log por INSERT direto (até a 1.14.5).
--      Rota numa loja sem gestor ativo: 0 avisados, sem recorrer às lojas do
--      vínculo (o brief manda manter a loja da rota; o app diz que ninguém
--      recebeu e destaca os botões de ligar).
--
--   3. RPC `registrar_sos(p_detalhes jsonb, p_rota_id uuid)` → integer, só
--      para `authenticated`: grava o log em nome de `auth.uid()` (o gatilho
--      avisa) e devolve quantos gestores receberam. SECURITY DEFINER com as
--      mesmas regras da policy `logs_insert_optimized`: sessão obrigatória e,
--      com rota, `pode_registrar_log_na_rota`. `gestores_avisados` vindo do
--      cliente é descartado antes do INSERT. SOS repetido em 5 s é descartado
--      pelo `prevent_duplicate_log` (o BEFORE devolve NULL e o gatilho de
--      aviso nem dispara); a RPC então responde pelo SOS anterior do mesmo
--      motorista e da mesma rota, que é o que de fato avisou alguém.
--
--   Alternativas consideradas (para o app saber se alguém recebeu):
--     - App confere depois do INSERT: o motorista não lê `notificacoes` de
--       outra conta (RLS), então precisaria de uma RPC de consulta de
--       qualquer jeito — duas idas à rede em vez de uma, e uma janela em que
--       a resposta pode não corresponder ao log que acabou de gravar.
--     - Contagem num GUC de transação (`set_config(..., true)`) lida pela RPC
--       depois do INSERT: não deixa rastro e não responde ao SOS descartado
--       como duplicado (o gatilho não roda).
--     - RPC que chama o helper direto, pulando o gatilho: `criar_notificacao`
--       recusa chamada com `auth.uid()` de quem não é gestor fora de gatilho
--       (`pg_trigger_depth() = 0`) — o aviso falharia sempre.
--     - RPC + contagem gravada no log pelo gatilho (esta): uma ida à rede,
--       rastro auditável no histórico, o SOS duplicado responde pelo anterior,
--       e o INSERT direto das versões antigas segue avisando.
--
--   Medido em produção (24/10/2026, só SELECT): nenhum `sos_acionado` em
--   `logs` nem em `notificacoes` — não há o que corrigir para trás.
--
--   APLICAR COMO `postgres` (SQL Editor, numa execução só — tem REVOKE, que o
--   MCP recusa). O gatilho roda como `postgres` e precisa de EXECUTE no helper.
--   Ordem com o app: pode ir antes ou depois do merge. Sem a RPC, o app novo
--   volta ao INSERT direto e diz que não conseguiu confirmar o aviso.
--
-- Sonda transacional: database/sondas/20261024100000_sonda_migration46.sql
-- (rodar DEPOIS desta migration, no SQL Editor; termina em RAISE e desfaz tudo).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. quem recebe o SOS (fonte única) — avisa e devolve quantos receberam
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.avisar_gestores_do_sos(p_motorista_id uuid, p_rota_id uuid, p_detalhes jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unidade_id uuid;
  v_motorista_nome varchar(255);
  v_texto text;
  v_gestor_id uuid;
  v_avisados integer := 0;
BEGIN
  IF p_rota_id IS NOT NULL THEN
    SELECT r.unidade_id INTO v_unidade_id FROM public.rotas r WHERE r.id = p_rota_id;
  END IF;

  SELECT u.nome INTO v_motorista_nome
  FROM public.usuarios u
  WHERE u.id = p_motorista_id;

  v_texto := COALESCE(
    NULLIF(btrim(p_detalhes->>'descricao'), ''),
    NULLIF(btrim(p_detalhes->>'motivo'), ''),
    'Emergência acionada'
  );

  FOR v_gestor_id IN
    -- com rota: a loja da rota
    SELECT g.id
    FROM public.gestores_ativos_da_unidade(v_unidade_id) AS g(id)
    WHERE v_unidade_id IS NOT NULL
    UNION
    -- sem rota: todas as lojas com vínculo ativo do motorista
    SELECT g.id
    FROM public.usuario_unidades uu CROSS JOIN LATERAL public.gestores_ativos_da_unidade(uu.unidade_id) AS g(id)
    WHERE v_unidade_id IS NULL
      AND uu.usuario_id = p_motorista_id
      AND uu.ativo = true
  LOOP
    IF public.criar_notificacao(
      v_gestor_id,
      'sos_acionado',
      '🚨 SOS - EMERGÊNCIA',
      'O motorista ' || COALESCE(v_motorista_nome, 'Não identificado') ||
      ' acionou o botão de emergência! ' || SUBSTRING(v_texto, 1, 200),
      p_rota_id
    ) IS NOT NULL THEN
      v_avisados := v_avisados + 1;
    END IF;
  END LOOP;

  RETURN v_avisados;
EXCEPTION WHEN OTHERS THEN
  -- A subtransação deste bloco desfez os avisos já criados: 0 é a verdade.
  RAISE WARNING 'avisar_gestores_do_sos falhou (motorista %, rota %): %', p_motorista_id, p_rota_id, SQLERRM;
  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.avisar_gestores_do_sos(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.avisar_gestores_do_sos(uuid, uuid, jsonb) IS
  'Migration 46: avisa os gestores do SOS (com rota, os da loja da rota; sem rota, os de todas as lojas com vínculo ativo do motorista, sem repetir) e devolve quantos receberam. Nunca levanta. Uso interno do gatilho notify_sos_acionado.';

-- ---------------------------------------------------------------------------
-- 2. gatilho: avisa e grava no log quantos receberam
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_sos_acionado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_avisados integer;
BEGIN
  IF NEW.evento <> 'sos_acionado' THEN
    RETURN NEW;
  END IF;

  v_avisados := public.avisar_gestores_do_sos(NEW.usuario_id, NEW.rota_id, NEW.detalhes);

  -- Bloco próprio: se só a contagem falhar, a subtransação dele desfaz o
  -- UPDATE e mais nada — os avisos já criados ficam. Sem `gestores_avisados`
  -- no log, a RPC responde 0 (ninguém confirmado), que é o lado seguro.
  BEGIN
    UPDATE public.logs
    SET detalhes = COALESCE(detalhes, '{}'::jsonb) || jsonb_build_object('gestores_avisados', v_avisados)
    WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_sos_acionado: contagem não gravada no log % (% gestores avisados): %', NEW.id, v_avisados, SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- O SOS nunca derruba o INSERT do log. Só chega aqui uma falha FORA do
  -- helper (que não levanta) e do bloco acima — ex.: EXECUTE perdido no helper.
  RAISE WARNING 'notify_sos_acionado falhou (log %): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC do app: grava o SOS e devolve quantos gestores receberam
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_sos(p_detalhes jsonb, p_rota_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_log_id uuid;
  v_avisados integer;
BEGIN
  -- As mesmas regras da policy logs_insert_optimized (o DEFINER passa por cima dela).
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória para registrar o SOS.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_rota_id IS NOT NULL AND NOT public.pode_registrar_log_na_rota(p_rota_id) THEN RAISE EXCEPTION 'Sem permissão para registrar SOS nesta rota.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
  VALUES (v_uid, p_rota_id, 'sos_acionado', COALESCE(p_detalhes, '{}'::jsonb) - 'gestores_avisados')
  RETURNING id INTO v_log_id;

  -- Descartado pelo prevent_duplicate_log (o mesmo SOS em 5 s): o anterior
  -- é o que avisou, e é por ele que se responde.
  IF v_log_id IS NULL THEN
    SELECT l.id INTO v_log_id
    FROM public.logs l
    WHERE l.usuario_id = v_uid AND l.evento = 'sos_acionado' AND l.rota_id IS NOT DISTINCT FROM p_rota_id
    ORDER BY l.timestamp DESC
    LIMIT 1;
  END IF;

  SELECT (l.detalhes->>'gestores_avisados')::integer INTO v_avisados
  FROM public.logs l
  WHERE l.id = v_log_id;

  RETURN COALESCE(v_avisados, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_sos(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_sos(jsonb, uuid) TO authenticated;

COMMENT ON FUNCTION public.registrar_sos(jsonb, uuid) IS
  'Migration 46: grava o SOS (logs, evento sos_acionado) em nome de auth.uid() e devolve quantos gestores receberam o aviso. 0 = ninguém recebeu. "Avisado" = notificação criada em notificacoes (aparece no app do gestor), não push entregue no aparelho: gestor sem token de push conta como avisado.';

COMMIT;

-- ============================================================================
-- Conferência pós-aplicação (só SELECT; esperado ao lado)
-- ============================================================================
-- 1. donos → postgres, postgres, postgres
-- SELECT proname, pg_get_userbyid(proowner) FROM pg_proc
-- WHERE proname IN ('avisar_gestores_do_sos', 'notify_sos_acionado', 'registrar_sos');
-- 2. helper fechado, RPC só de authenticated → false, false, true, false
-- SELECT has_function_privilege('authenticated', 'public.avisar_gestores_do_sos(uuid, uuid, jsonb)', 'EXECUTE'),
--        has_function_privilege('anon', 'public.avisar_gestores_do_sos(uuid, uuid, jsonb)', 'EXECUTE'),
--        has_function_privilege('authenticated', 'public.registrar_sos(jsonb, uuid)', 'EXECUTE'),
--        has_function_privilege('anon', 'public.registrar_sos(jsonb, uuid)', 'EXECUTE');
-- 3. o gatilho usa o helper e não lê mais o vínculo principal → true, false
-- SELECT prosrc LIKE '%avisar_gestores_do_sos%', prosrc LIKE '%is_principal%'
-- FROM pg_proc WHERE oid = 'public.notify_sos_acionado'::regproc;
-- 4. o gatilho continua ligado → 1 linha, AFTER INSERT ... WHEN sos_acionado
-- SELECT pg_get_triggerdef(oid) FROM pg_trigger
-- WHERE tgrelid = 'public.logs'::regclass AND tgname = 'trigger_notify_sos_acionado';

-- ROLLBACK:
-- Volta ao estado da Migration 35 (o gatilho decide a loja sozinho pelo vínculo
-- principal e lê `motivo`). O app novo, sem a RPC, cai no INSERT direto e diz
-- que não conseguiu confirmar o aviso.
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.registrar_sos(jsonb, uuid);
-- CREATE OR REPLACE FUNCTION public.notify_sos_acionado()
--  RETURNS trigger
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO ''
-- AS $fn$
-- DECLARE
--   v_gestor_id UUID;
--   v_motorista_nome VARCHAR(255);
--   v_unidade_id UUID;
--   v_rota_endereco VARCHAR(255);
--   v_motivo TEXT;
-- BEGIN
--   IF NEW.evento != 'sos_acionado' THEN
--     RETURN NEW;
--   END IF;
--   IF NEW.rota_id IS NOT NULL THEN
--     SELECT r.unidade_id, p.endereco
--     INTO v_unidade_id, v_rota_endereco
--     FROM public.rotas r
--     LEFT JOIN public.paradas p ON p.rota_id = r.id AND p.ordem = 1
--     WHERE r.id = NEW.rota_id;
--   END IF;
--   IF v_unidade_id IS NULL AND NEW.usuario_id IS NOT NULL THEN
--     SELECT uu.unidade_id
--     INTO v_unidade_id
--     FROM public.usuario_unidades uu
--     WHERE uu.usuario_id = NEW.usuario_id
--       AND uu.ativo = true
--       AND uu.is_principal = true
--     LIMIT 1;
--   END IF;
--   SELECT nome INTO v_motorista_nome
--   FROM public.usuarios
--   WHERE id = NEW.usuario_id;
--   IF NEW.detalhes IS NOT NULL AND NEW.detalhes::jsonb ? 'motivo' THEN
--     v_motivo := NEW.detalhes::jsonb->>'motivo';
--   ELSE
--     v_motivo := 'Emergência acionada';
--   END IF;
--   FOR v_gestor_id IN SELECT public.gestores_ativos_da_unidade(v_unidade_id) LOOP
--     PERFORM public.criar_notificacao(
--       v_gestor_id,
--       'sos_acionado',
--       '🚨 SOS - EMERGÊNCIA',
--       'O motorista ' || COALESCE(v_motorista_nome, 'Não identificado') ||
--       ' acionou o botão de emergência! ' || COALESCE(v_motivo, ''),
--       NEW.rota_id
--     );
--   END LOOP;
--   RETURN NEW;
-- END;
-- $fn$;
-- -- Só DEPOIS de restaurar o gatilho (senão ele chama função inexistente):
-- DROP FUNCTION IF EXISTS public.avisar_gestores_do_sos(uuid, uuid, jsonb);
-- COMMIT;
