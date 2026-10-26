-- ============================================================================
-- Migration 77: parada de rota encerrada não muda de status pela API
-- Date: 2026-10-27
-- Author: Wellinton Ribeiro
-- Purpose:
--   A Migration 75 garante que rota `cancelada`, `concluida` ou
--   `nao_executada` não muda de status por UPDATE da API. As paradas dela
--   ainda mudavam: a policy `paradas_update` exige só vínculo ativo e ser o
--   motorista da rota (ou gestor da loja), sem olhar o status da rota, e
--   nenhum gatilho de `paradas` o confere. Na aba Paradas, "Retomar" numa
--   parada pulada de rota já concluída devolve a parada a `pendente`, e ela
--   nunca mais é concluída nem pulada (concluir exige rota em andamento). O
--   app corrige o botão na versão nova; as instaladas (até a 1.14.9) seguem
--   com ele, e a fila offline de versões antigas pode concluir parada de rota
--   que o gestor cancelou enquanto o motorista estava sem rede.
--
--   Regra nova: o gatilho `trg_parada_de_rota_encerrada_nao_muda` (BEFORE
--   UPDATE OF status, por linha, WHEN o status muda) recusa com P0001
--   'PARADA_DE_ROTA_ENCERRADA' quando o UPDATE vem dos papéis da API
--   (`current_user` = `authenticated` ou `anon`) e a rota da parada está
--   encerrada. Passam:
--     - as RPCs SECURITY DEFINER donas `postgres` (`reativar_rota`,
--       `cancelar_rota`, `finalizar_rota`): dentro delas `current_user` é o
--       dono — o mesmo critério da Migration 75;
--     - a chave secreta (`service_role`) e o CLI (`postgres`);
--     - UPDATE de outras colunas (foto, observação, ordem): o gatilho só olha
--       `status`;
--     - a chegada (`is_checkpoint = false`) indo a `concluida` numa rota
--       `concluida`: é a ordem do app até a 1.14.2, que finaliza por UPDATE
--       direto (rota primeiro, chegada depois; a RPC `finalizar_rota` entrou
--       em 23/10/2026, #630). A exceção é só essa — partida, entrega e
--       retirada não entram, nem rota cancelada ou não executada.
--
--   Fila offline (conclusão feita antes do cancelamento chegando depois):
--   recusada. O app atual já descarta essa ação antes de gravar
--   (`filaAcoesParada` lê `rotas.status` e só grava com a rota em andamento);
--   as versões antigas recebem o erro e o tratam como erro de envio. A foto
--   do comprovante vai por outra coluna (`foto_url`/`foto_comprovante`) e não
--   é afetada. Aceitar pelo horário da conclusão exigiria confiar no relógio
--   do aparelho, que o banco não confere.
--
--   Função SECURITY INVOKER de propósito: como DEFINER, `current_user` seria
--   sempre o dono e o gatilho não separaria a API da RPC (a Migration 75
--   explica). A leitura de `rotas` roda com os privilégios de quem faz o
--   UPDATE: a policy `paradas_update` só deixa passar quem enxerga a rota
--   pela `rotas_select`, então a rota é lida; se não fosse (NOT FOUND), o
--   UPDATE já teria sido barrado pela policy, e o gatilho deixa seguir. O
--   EXECUTE da função não é conferido no disparo do gatilho, por isso fica
--   revogado de PUBLIC, anon e authenticated.
--
--   Medido em 26/10/2026 (só SELECT):
--     - `paradas_update`: USING = vínculo ativo na loja da rota E (gestor OU
--       motorista da rota com `usuario_atual_ativo()`); WITH CHECK nulo;
--     - 10 gatilhos em `paradas`; os BEFORE UPDATE são
--       `trg_paradas_foto_vinculada_preservada`, `trg_paradas_observacao_do_gestor`,
--       `trg_paradas_troca_de_rota_pelo_gestor`,
--       `trg_recusa_editar_local_de_parada_concluida`,
--       `trg_validar_vinculo_parada`, `update_paradas_updated_at`; nenhum olha
--       o status da rota. O novo roda primeiro na ordem alfabética; como só
--       recusa ou deixa passar sem mudar NEW, a ordem não muda o resultado;
--     - funções que fazem UPDATE em `paradas`: `cancelar_rota`,
--       `criar_rota_com_paradas`, `finalizar_rota`, `inserir_parada`,
--       `reativar_rota`, `reordenar_paradas` — todas SECURITY DEFINER, dono
--       `postgres`;
--     - 10 paradas `pendente`/`em_andamento` em rotas `concluida` hoje; uma
--       delas atualizada 4 min depois da conclusão da rota (o "Retomar");
--     - app: o motorista muda status de parada só com a rota em andamento
--       (`completeStop`/`skipStop`/`avancarProxima`, `startRoute` para a
--       partida), salvo o "Retomar" e a chegada da finalização até a 1.14.2;
--       o gestor não muda status de parada em rota encerrada
--       (`useMapaRotaHandlers.recusarAlteracao`; a reativação direta da
--       1.14.7 já para na rota, pela Migration 75, antes das paradas); o e2e
--       só reabre paradas de rota aberta.
--
--   Alternativas consideradas:
--     (a) gatilho BEFORE UPDATE OF status, INVOKER com `current_user`
--         (escolhida): erro explícito, deixa as RPCs e a chave secreta
--         passarem sem mudar nenhuma, mesmo critério da Migration 75;
--     (b) recusar só quem não é gestor (DEFINER + `auth.uid()`): o gestor não
--         muda status de parada em rota encerrada em nenhuma versão do app, e
--         a regra ficaria com dois critérios diferentes para rota e parada;
--     (c) status da rota no USING da `paradas_update`: a recusa sairia como 0
--         linhas, sem erro, e bloquearia também foto e observação em rota
--         encerrada (a foto do comprovante pode subir depois do status);
--     (d) aceitar a conclusão da fila offline quando `concluida_em` é anterior
--         ao encerramento: depende do relógio do aparelho.
--
--   Efeito no app:
--     - motorista atual e antigo: concluir, pular, avançar e iniciar seguem
--       (rota em andamento); finalizar segue (RPC, ou chegada depois da rota
--       até a 1.14.2); "Retomar" em rota encerrada passa a dar erro na tela
--       em vez de reabrir a parada;
--     - fila offline de versão antiga com rota já encerrada: a ação é
--       recusada (o app atual nem a envia);
--     - gestor: nenhum.
--
--   `SET LOCAL lock_timeout = '3s'`: DROP/CREATE TRIGGER pedem trava forte em
--   `paradas`; se ela não vier em 3 s, a migration para sem efeito e é
--   repetida.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.parada_de_rota_encerrada_nao_muda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_status_rota text;
BEGIN
  -- RPCs SECURITY DEFINER, chave secreta e CLI passam sem ler nada.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  SELECT r.status INTO v_status_rota
    FROM public.rotas r
   WHERE r.id = OLD.rota_id;

  IF v_status_rota IS NULL OR v_status_rota NOT IN ('cancelada', 'concluida', 'nao_executada') THEN
    RETURN NEW;
  END IF;

  -- Chegada concluída depois da rota: a finalização do app até a 1.14.2.
  IF v_status_rota = 'concluida'
     AND OLD.is_checkpoint = false
     AND NEW.status = 'concluida' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'PARADA_DE_ROTA_ENCERRADA'
    USING ERRCODE = 'P0001',
          DETAIL = format('A rota %s está %s; o status da parada %s não muda mais.', OLD.rota_id, v_status_rota, OLD.id),
          HINT = 'Recarregue a rota.';
END;
$$;

ALTER FUNCTION public.parada_de_rota_encerrada_nao_muda() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.parada_de_rota_encerrada_nao_muda() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.parada_de_rota_encerrada_nao_muda() IS
  'Migration 77: gatilho BEFORE UPDATE OF status de paradas. Parada de rota cancelada, concluida ou nao_executada não muda de status por UPDATE dos papéis da API (authenticated, anon): P0001 PARADA_DE_ROTA_ENCERRADA. Exceção: a chegada (is_checkpoint = false) indo a concluida em rota concluida. SECURITY INVOKER de propósito, para que as RPCs SECURITY DEFINER, a chave secreta e o cron passem.';

DROP TRIGGER IF EXISTS trg_parada_de_rota_encerrada_nao_muda ON public.paradas;
CREATE TRIGGER trg_parada_de_rota_encerrada_nao_muda
  BEFORE UPDATE OF status ON public.paradas
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.parada_de_rota_encerrada_nao_muda();

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT pg_get_triggerdef(t.oid), t.tgenabled FROM pg_trigger t
--  WHERE t.tgrelid = 'public.paradas'::regclass AND t.tgname = 'trg_parada_de_rota_encerrada_nao_muda';
-- SELECT p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl
--   FROM pg_proc p WHERE p.oid = to_regprocedure('public.parada_de_rota_encerrada_nao_muda()');
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_parada_de_rota_encerrada_nao_muda ON public.paradas;
-- DROP FUNCTION IF EXISTS public.parada_de_rota_encerrada_nao_muda();
-- COMMIT;
