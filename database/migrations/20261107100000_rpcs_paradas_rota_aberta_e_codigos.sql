-- ============================================================================
-- Migration 81: inserir_parada e reordenar_paradas só em rota aberta, com
-- código na resposta
-- Date: 2026-11-07
-- Author: Wellinton Ribeiro
-- Purpose:
--   As duas RPCs que mexem na ordem das paradas (`inserir_parada`, do gestor;
--   `reordenar_paradas`, do gestor e do motorista da rota) tinham três
--   problemas:
--     1. aceitavam rota encerrada: inserir parada numa rota `cancelada`
--        devolvia `success: true` e criava a parada; reordenar numa rota
--        `concluida` reescrevia a ordem. O gatilho da Migration 77 olha só o
--        status da parada, e nenhuma das duas muda status;
--     2. `reordenar_paradas` ignorava em silêncio id de outra rota (ou
--        inexistente): o UPDATE filtrava por `rota_id` e `updated` devolvia o
--        tamanho do array, não o que mudou;
--     3. toda exceção voltava com `'error', SQLERRM`: o texto do Postgres
--        ("duplicate key value violates unique constraint ...") ia para o
--        toast do gestor.
--
--   Regra nova (mesma assinatura, SECURITY DEFINER, search_path vazio):
--     - toda recusa devolve `{ success: false, code, error }`, com `error`
--       num texto fixo em pt-BR para o gestor (o app publicado mostra `error`
--       no toast) e `code` num conjunto fechado: SEM_PERMISSAO,
--       ROTA_ENCERRADA, PARADA_NAO_ENCONTRADA, PARADAS_DE_OUTRA_ROTA,
--       ENTRADA_INVALIDA, ORDEM_DUPLICADA, ERRO. O sucesso não muda;
--     - depois da guarda de autorização (a mesma de hoje), a linha da rota é
--       travada e lida; fora de `pendente`/`em_andamento`, ROTA_ENCERRADA, sem
--       nenhuma escrita;
--     - `reordenar_paradas` confere, antes de qualquer UPDATE: arrays do
--       mesmo tamanho, sem id nem ordem nulos, ids distintos
--       (ENTRADA_INVALIDA); a 1ª parada existe (PARADA_NAO_ENCONTRADA); todas
--       as paradas são da rota da 1ª (PARADAS_DE_OUTRA_ROTA);
--     - no `EXCEPTION WHEN OTHERS`, o SQLSTATE e o SQLERRM vão só para o log
--       do servidor (`RAISE LOG`); a resposta leva o código: 23505 →
--       ORDEM_DUPLICADA; P0001 com mensagem `PARADA_DE_ROTA_ENCERRADA` ou
--       `ROTA_ENCERRADA` → ROTA_ENCERRADA; o resto → ERRO. Como o bloco tem
--       EXCEPTION, o erro desfaz tudo o que a RPC escreveu.
--
--   Trava: `FOR NO KEY UPDATE` na linha da rota (e, no reordenar, nas
--   paradas do array, depois da rota — a ordem de `cancelar_rota` e
--   `finalizar_rota`). Conflita com o UPDATE de status de `cancelar_rota`,
--   `finalizar_rota`, da expiração e do app, que pegam a mesma trava: quem
--   chega depois espera e lê o status já gravado. Nunca `FOR UPDATE`: ele
--   conflita com o `FOR KEY SHARE` que todo INSERT com FK para `rotas`
--   (paradas, logs, posições do motorista) pega — o deadlock
--   gestor-insere x motorista-finaliza registrado em `finalizar_rota`
--   (20261023100000) e repetido em `cancelar_rota`/`reativar_rota`.
--
--   Medido em 06/11/2026 (só SELECT): definições vivas iguais às de
--   `20260713190000_fix_inserir_parada_chegada_conflict.sql` (inserir) e
--   `20261024111000_rotas_paradas_pelo_vinculo_ativo.sql` (reordenar); as
--   duas SECURITY DEFINER, `search_path=""`, dono postgres, ACL
--   `{postgres=X, authenticated=X, service_role=X}` (anon sem EXECUTE).
--
--   Alternativas consideradas:
--     (a) código + texto fixo no jsonb, sem RAISE (escolhida): o app
--         publicado segue lendo `success`/`error` e mostra um texto legível;
--         o app novo pode mapear `code` sem depender de texto;
--     (b) RAISE EXCEPTION com sentinela (como `finalizar_rota`): o app
--         publicado recebe `error` do PostgREST em vez de `data.success`, e o
--         toast mostraria o texto cru ou o genérico; muda o contrato;
--     (c) só trocar `SQLERRM` por texto genérico: o texto do Postgres sai do
--         toast, mas o app novo continua sem como distinguir os casos;
--     (d) rota aberta conferida por gatilho em `paradas` (INSERT/UPDATE OF
--         ordem): pegaria também o INSERT direto, mas `criar_rota_com_paradas`
--         e o painel inserem em rota recém-criada, e a recusa sairia como
--         exceção, de novo com texto do Postgres no toast.
--     Trava: (a) `FOR NO KEY UPDATE` (escolhida, acima); (b) `FOR UPDATE`
--     (conflita com KEY SHARE); (c) sem trava (a rota pode ser cancelada
--     entre a leitura e o INSERT).
--     Textos: (a) CASE dentro de cada RPC (escolhida): sem objeto novo nem
--     ACL nova; (b) função auxiliar com o mapa código → texto: uma fonte só,
--     mas um objeto a mais com EXECUTE a cuidar, para 7 frases.
--
--   Efeito no app:
--     - versão publicada: as recusas novas aparecem no toast com o texto
--       fixo (`useAddStopForm` lança `rpcResult.error`; `reordenarParadas`
--       devolve `data.error`); nenhum caminho de sucesso muda. Gestor que
--       insere ou reordena paradas em rota encerrada passa a ver "rota
--       encerrada" em vez de a ação ser aceita;
--     - mapear `code` no cliente é a etapa seguinte (depois do PR #728).
--
--   Ordem de deploy: esta migration antes de qualquer versão do app que leia
--   `code`. O inverso não quebra: sem `code`, o app novo cai no `error`.
--
--   `SET LOCAL lock_timeout = '3s'`: CREATE OR REPLACE FUNCTION pede trava
--   só no catálogo da função; o valor fica pelo padrão das migrations.
--   CREATE OR REPLACE preserva a ACL; REVOKE/GRANT repetem a vigente.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

-- ----------------------------------------------------------------------------
-- inserir_parada: gestor ativo da loja da rota, rota aberta
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inserir_parada(
  p_rota_id uuid,
  p_tipo text,
  p_endereco text,
  p_latitude double precision,
  p_longitude double precision,
  p_posicao_insercao integer DEFAULT NULL, -- NULL = no final; número = nesta posição
  p_destinatario text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chegada RECORD;
  v_new_ordem INTEGER;
  v_parada_count INTEGER;
  v_new_parada_id UUID;
  v_status_rota text;
  v_estado text;
  v_mensagem text;
  v_codigo text;
BEGIN
  -- Autorização (espelha paradas_insert): gestor ativo da loja da rota.
  IF NOT EXISTS (
    SELECT 1
    FROM public.rotas r
    JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
    WHERE r.id = p_rota_id
      AND uu.usuario_id = auth.uid()
      AND uu.papel = 'gestor'
      AND uu.ativo = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'SEM_PERMISSAO',
      'error', 'Você não tem permissão para alterar esta rota.');
  END IF;

  -- Rota aberta, com a linha travada até o fim da transação.
  SELECT r.status INTO v_status_rota
    FROM public.rotas r
   WHERE r.id = p_rota_id
     FOR NO KEY UPDATE;

  IF v_status_rota IS NULL OR v_status_rota NOT IN ('pendente', 'em_andamento') THEN
    RETURN jsonb_build_object('success', false, 'code', 'ROTA_ENCERRADA',
      'error', 'Esta rota já foi encerrada e não pode mais ser alterada. Recarregue a rota.');
  END IF;

  SELECT COUNT(*) INTO v_parada_count
  FROM public.paradas
  WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false;

  SELECT id, ordem INTO v_chegada
  FROM public.paradas
  WHERE rota_id = p_rota_id AND is_checkpoint = false AND ordem > 0
  LIMIT 1;

  -- Estaciona a chegada em ordem alta ANTES de qualquer deslocamento/INSERT
  -- (fix de 13/07/2026). As paradas deslocadas ocupam no máximo ~1000+N e a
  -- inserção usa ordens baixas, então +2000 não colide. O bloco final
  -- reposiciona a chegada para count+1.
  IF v_chegada.id IS NOT NULL THEN
    UPDATE public.paradas
    SET ordem = v_chegada.ordem + 2000
    WHERE id = v_chegada.id;
  END IF;

  IF p_posicao_insercao IS NULL THEN
    v_new_ordem := v_parada_count + 1;
  ELSE
    -- Posição mínima é 1 (ordem 0 é a partida).
    v_new_ordem := GREATEST(p_posicao_insercao, 1);
    UPDATE public.paradas
    SET ordem = ordem + 1000
    WHERE rota_id = p_rota_id
      AND is_checkpoint IS DISTINCT FROM false
      AND ordem >= v_new_ordem;
    UPDATE public.paradas
    SET ordem = ordem - 1000 + 1
    WHERE rota_id = p_rota_id
      AND is_checkpoint IS DISTINCT FROM false
      AND ordem >= 1000;
  END IF;

  INSERT INTO public.paradas (
    rota_id, tipo, endereco, latitude, longitude, ordem,
    destinatario, telefone, observacoes, status, is_checkpoint
  ) VALUES (
    p_rota_id, p_tipo, p_endereco, p_latitude, p_longitude, v_new_ordem,
    p_destinatario, p_telefone, p_observacoes, 'pendente', true
  )
  RETURNING id INTO v_new_parada_id;

  -- Normalização: paradas reais renumeradas em sequência (1, 2, 3, ...).
  WITH ordered_paradas AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY ordem) AS new_ordem
    FROM public.paradas
    WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false
  )
  UPDATE public.paradas p
  SET ordem = op.new_ordem
  FROM ordered_paradas op
  WHERE p.id = op.id AND p.ordem != op.new_ordem;

  -- Chegada volta para depois de todas as paradas reais.
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
    GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_mensagem = MESSAGE_TEXT;
    RAISE LOG 'inserir_parada(rota %): SQLSTATE % SQLERRM %', p_rota_id, SQLSTATE, SQLERRM;
    v_codigo := CASE
      WHEN v_estado = '23505' THEN 'ORDEM_DUPLICADA'
      WHEN v_estado = 'P0001' AND v_mensagem IN ('PARADA_DE_ROTA_ENCERRADA', 'ROTA_ENCERRADA') THEN 'ROTA_ENCERRADA'
      ELSE 'ERRO'
    END;
    RETURN jsonb_build_object('success', false, 'code', v_codigo,
      'error', CASE v_codigo
        WHEN 'ORDEM_DUPLICADA' THEN 'Duas paradas ficaram na mesma posição. Recarregue a rota e tente de novo.'
        WHEN 'ROTA_ENCERRADA' THEN 'Esta rota já foi encerrada e não pode mais ser alterada. Recarregue a rota.'
        ELSE 'Não foi possível salvar a parada. Tente de novo.'
      END);
END;
$$;

ALTER FUNCTION public.inserir_parada(uuid, text, text, double precision, double precision, integer, text, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.inserir_parada(uuid, text, text, double precision, double precision, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inserir_parada(uuid, text, text, double precision, double precision, integer, text, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.inserir_parada(uuid, text, text, double precision, double precision, integer, text, text, text) IS
  'Migration 81: insere parada numa posição, deslocando as seguintes e mantendo a chegada no fim, numa transação. Só gestor ativo da loja da rota e só com a rota pendente ou em_andamento (linha da rota travada com FOR NO KEY UPDATE). Recusa: {success:false, code, error} com texto fixo; codes SEM_PERMISSAO, ROTA_ENCERRADA, ORDEM_DUPLICADA, ERRO. O SQLERRM vai só para o log do servidor.';

-- ----------------------------------------------------------------------------
-- reordenar_paradas: gestor ativo da loja, ou o motorista da rota, ativo, com
-- vínculo ativo; rota aberta; todas as paradas da mesma rota
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reordenar_paradas(p_parada_ids uuid[], p_novas_ordens integer[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
  v_rota_id UUID;
  v_i INTEGER;
  v_status_rota text;
  v_da_rota INTEGER;
  v_estado text;
  v_mensagem text;
  v_codigo text;
BEGIN
  IF coalesce(cardinality(p_parada_ids), 0) <> coalesce(cardinality(p_novas_ordens), 0) THEN
    RETURN jsonb_build_object('success', false, 'code', 'ENTRADA_INVALIDA',
      'error', 'Dados da reordenação inválidos. Recarregue a rota e tente de novo.');
  END IF;

  v_count := coalesce(cardinality(p_parada_ids), 0);
  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', true, 'updated', 0);
  END IF;

  IF array_ndims(p_parada_ids) <> 1
     OR array_ndims(p_novas_ordens) <> 1
     OR array_position(p_parada_ids, NULL) IS NOT NULL
     OR array_position(p_novas_ordens, NULL) IS NOT NULL
     OR (SELECT count(DISTINCT x) FROM unnest(p_parada_ids) AS x) <> v_count THEN
    RETURN jsonb_build_object('success', false, 'code', 'ENTRADA_INVALIDA',
      'error', 'Dados da reordenação inválidos. Recarregue a rota e tente de novo.');
  END IF;

  SELECT rota_id INTO v_rota_id FROM public.paradas WHERE id = p_parada_ids[1];
  IF v_rota_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'PARADA_NAO_ENCONTRADA',
      'error', 'Parada não encontrada. Recarregue a rota.');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.rotas r
    JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
    WHERE r.id = v_rota_id
      AND uu.usuario_id = auth.uid()
      AND uu.ativo = true
      AND (
        uu.papel = 'gestor'
        OR (
          r.motorista_id = auth.uid()
          AND (SELECT public.usuario_atual_ativo())
        )
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'SEM_PERMISSAO',
      'error', 'Você não tem permissão para alterar esta rota.');
  END IF;

  -- Rota aberta, com a linha travada até o fim da transação.
  SELECT r.status INTO v_status_rota
    FROM public.rotas r
   WHERE r.id = v_rota_id
     FOR NO KEY UPDATE;

  IF v_status_rota IS NULL OR v_status_rota NOT IN ('pendente', 'em_andamento') THEN
    RETURN jsonb_build_object('success', false, 'code', 'ROTA_ENCERRADA',
      'error', 'Esta rota já foi encerrada e não pode mais ser alterada. Recarregue a rota.');
  END IF;

  -- Trava as paradas do array que são desta rota e confere que são todas.
  PERFORM 1
     FROM public.paradas p
    WHERE p.id = ANY (p_parada_ids)
      AND p.rota_id = v_rota_id
      FOR NO KEY UPDATE;

  SELECT count(*) INTO v_da_rota
    FROM public.paradas p
   WHERE p.id = ANY (p_parada_ids)
     AND p.rota_id = v_rota_id;

  IF v_da_rota <> v_count THEN
    RETURN jsonb_build_object('success', false, 'code', 'PARADAS_DE_OUTRA_ROTA',
      'error', 'A lista tem paradas que não são desta rota. Recarregue a rota e tente de novo.');
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
    GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_mensagem = MESSAGE_TEXT;
    RAISE LOG 'reordenar_paradas(rota %): SQLSTATE % SQLERRM %', v_rota_id, SQLSTATE, SQLERRM;
    v_codigo := CASE
      WHEN v_estado = '23505' THEN 'ORDEM_DUPLICADA'
      WHEN v_estado = 'P0001' AND v_mensagem IN ('PARADA_DE_ROTA_ENCERRADA', 'ROTA_ENCERRADA') THEN 'ROTA_ENCERRADA'
      ELSE 'ERRO'
    END;
    RETURN jsonb_build_object('success', false, 'code', v_codigo,
      'error', CASE v_codigo
        WHEN 'ORDEM_DUPLICADA' THEN 'Duas paradas ficaram na mesma posição. Recarregue a rota e tente de novo.'
        WHEN 'ROTA_ENCERRADA' THEN 'Esta rota já foi encerrada e não pode mais ser alterada. Recarregue a rota.'
        ELSE 'Não foi possível salvar a nova ordem das paradas. Tente de novo.'
      END);
END;
$$;

ALTER FUNCTION public.reordenar_paradas(uuid[], integer[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reordenar_paradas(uuid[], integer[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reordenar_paradas(uuid[], integer[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.reordenar_paradas(uuid[], integer[]) IS
  'Migration 81: grava a nova ordem das paradas de uma rota numa transação. Gestor ativo da loja ou motorista da rota (ativo, com vínculo ativo); só com a rota pendente ou em_andamento (linha da rota travada com FOR NO KEY UPDATE); todos os ids distintos e da rota da 1ª parada, conferidos antes de qualquer UPDATE. Recusa: {success:false, code, error} com texto fixo; codes SEM_PERMISSAO, ROTA_ENCERRADA, PARADA_NAO_ENCONTRADA, PARADAS_DE_OUTRA_ROTA, ENTRADA_INVALIDA, ORDEM_DUPLICADA, ERRO. O SQLERRM vai só para o log do servidor.';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT p.oid::regprocedure, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono,
--        p.proacl, obj_description(p.oid, 'pg_proc')
--   FROM pg_proc p
--  WHERE p.oid IN (to_regprocedure('public.inserir_parada(uuid,text,text,double precision,double precision,integer,text,text,text)'),
--                  to_regprocedure('public.reordenar_paradas(uuid[],integer[])'));
-- ============================================================================

-- ROLLBACK:
-- -- Corpos vivos lidos em 06/11/2026, sem os comentários internos; ACL e
-- -- COMMENT de antes.
-- BEGIN;
-- SET LOCAL lock_timeout = '3s';
-- CREATE OR REPLACE FUNCTION public.inserir_parada(p_rota_id uuid, p_tipo text, p_endereco text, p_latitude double precision, p_longitude double precision, p_posicao_insercao integer DEFAULT NULL::integer, p_destinatario text DEFAULT NULL::text, p_telefone text DEFAULT NULL::text, p_observacoes text DEFAULT NULL::text)
-- RETURNS jsonb
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path TO ''
-- AS $function$
-- DECLARE
--   v_chegada RECORD;
--   v_new_ordem INTEGER;
--   v_parada_count INTEGER;
--   v_new_parada_id UUID;
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1
--     FROM public.rotas r
--     JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
--     WHERE r.id = p_rota_id
--       AND uu.usuario_id = auth.uid()
--       AND uu.papel = 'gestor'
--       AND uu.ativo = true
--   ) THEN
--     RETURN jsonb_build_object('success', false, 'error', 'Não autorizado: gestor da unidade da rota requerido.');
--   END IF;
--
--   SELECT COUNT(*) INTO v_parada_count
--   FROM public.paradas
--   WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false;
--
--   SELECT id, ordem INTO v_chegada
--   FROM public.paradas
--   WHERE rota_id = p_rota_id AND is_checkpoint = false AND ordem > 0
--   LIMIT 1;
--
--   IF v_chegada.id IS NOT NULL THEN
--     UPDATE public.paradas
--     SET ordem = v_chegada.ordem + 2000
--     WHERE id = v_chegada.id;
--   END IF;
--
--   IF p_posicao_insercao IS NULL THEN
--     v_new_ordem := v_parada_count + 1;
--   ELSE
--     v_new_ordem := GREATEST(p_posicao_insercao, 1);
--     UPDATE public.paradas
--     SET ordem = ordem + 1000
--     WHERE rota_id = p_rota_id
--       AND is_checkpoint IS DISTINCT FROM false
--       AND ordem >= v_new_ordem;
--     UPDATE public.paradas
--     SET ordem = ordem - 1000 + 1
--     WHERE rota_id = p_rota_id
--       AND is_checkpoint IS DISTINCT FROM false
--       AND ordem >= 1000;
--   END IF;
--
--   INSERT INTO public.paradas (
--     rota_id, tipo, endereco, latitude, longitude, ordem,
--     destinatario, telefone, observacoes, status, is_checkpoint
--   ) VALUES (
--     p_rota_id, p_tipo, p_endereco, p_latitude, p_longitude, v_new_ordem,
--     p_destinatario, p_telefone, p_observacoes, 'pendente', true
--   )
--   RETURNING id INTO v_new_parada_id;
--
--   WITH ordered_paradas AS (
--     SELECT id, ROW_NUMBER() OVER (ORDER BY ordem) AS new_ordem
--     FROM public.paradas
--     WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false
--   )
--   UPDATE public.paradas p
--   SET ordem = op.new_ordem
--   FROM ordered_paradas op
--   WHERE p.id = op.id AND p.ordem != op.new_ordem;
--
--   IF v_chegada.id IS NOT NULL THEN
--     SELECT COUNT(*) INTO v_parada_count
--     FROM public.paradas
--     WHERE rota_id = p_rota_id AND is_checkpoint IS DISTINCT FROM false;
--     UPDATE public.paradas
--     SET ordem = v_parada_count + 1
--     WHERE id = v_chegada.id;
--   END IF;
--
--   RETURN jsonb_build_object('success', true, 'parada_id', v_new_parada_id, 'ordem', v_new_ordem);
-- EXCEPTION
--   WHEN OTHERS THEN
--     RETURN jsonb_build_object('success', false, 'error', SQLERRM);
-- END;
-- $function$;
-- CREATE OR REPLACE FUNCTION public.reordenar_paradas(p_parada_ids uuid[], p_novas_ordens integer[])
-- RETURNS jsonb
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path TO ''
-- AS $function$
-- DECLARE
--   v_count INTEGER;
--   v_rota_id UUID;
--   v_i INTEGER;
-- BEGIN
--   IF array_length(p_parada_ids, 1) != array_length(p_novas_ordens, 1) THEN
--     RETURN jsonb_build_object('success', false, 'error', 'Arrays must have same length');
--   END IF;
--
--   v_count := array_length(p_parada_ids, 1);
--   IF v_count IS NULL OR v_count = 0 THEN
--     RETURN jsonb_build_object('success', true, 'updated', 0);
--   END IF;
--
--   SELECT rota_id INTO v_rota_id FROM public.paradas WHERE id = p_parada_ids[1];
--   IF v_rota_id IS NULL THEN
--     RETURN jsonb_build_object('success', false, 'error', 'Parada not found');
--   END IF;
--
--   IF NOT EXISTS (
--     SELECT 1
--     FROM public.rotas r
--     JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
--     WHERE r.id = v_rota_id
--       AND uu.usuario_id = auth.uid()
--       AND uu.ativo = true
--       AND (
--         uu.papel = 'gestor'
--         OR (
--           r.motorista_id = auth.uid()
--           AND (SELECT public.usuario_atual_ativo())
--         )
--       )
--   ) THEN
--     RETURN jsonb_build_object('success', false, 'error', 'Não autorizado.');
--   END IF;
--
--   FOR v_i IN 1..v_count LOOP
--     UPDATE public.paradas SET ordem = 1000 + v_i
--     WHERE id = p_parada_ids[v_i] AND rota_id = v_rota_id;
--   END LOOP;
--
--   FOR v_i IN 1..v_count LOOP
--     UPDATE public.paradas SET ordem = p_novas_ordens[v_i]
--     WHERE id = p_parada_ids[v_i] AND rota_id = v_rota_id;
--   END LOOP;
--
--   RETURN jsonb_build_object('success', true, 'updated', v_count);
-- EXCEPTION
--   WHEN OTHERS THEN
--     RETURN jsonb_build_object('success', false, 'error', SQLERRM);
-- END;
-- $function$;
-- REVOKE ALL ON FUNCTION public.inserir_parada(uuid, text, text, double precision, double precision, integer, text, text, text) FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.inserir_parada(uuid, text, text, double precision, double precision, integer, text, text, text) TO authenticated, service_role;
-- REVOKE ALL ON FUNCTION public.reordenar_paradas(uuid[], integer[]) FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.reordenar_paradas(uuid[], integer[]) TO authenticated, service_role;
-- COMMENT ON FUNCTION public.inserir_parada(uuid, text, text, double precision, double precision, integer, text, text, text) IS 'Inserts a new stop atomically, handling order adjustments and normalization in a single transaction. Chegada é estacionada em ordem temporária antes do shift (fix 2026-07-13).';
-- COMMENT ON FUNCTION public.reordenar_paradas(uuid[], integer[]) IS 'Reorders stops atomically to avoid unique constraint violations. Used by route editing feature.';
-- COMMIT;
