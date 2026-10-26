-- ============================================================================
-- Migration 75: rota encerrada não volta por UPDATE direto da API
-- Date: 2026-10-26
-- Author: Wellinton Ribeiro
-- Purpose:
--   A policy `rotas_update` deixa o gestor ativo da loja e o motorista ativo
--   da rota atualizarem a linha sem olhar a transição de status, e nenhum
--   gatilho de `rotas` confere status. Um app instalado (ou a fila offline
--   dele) pode, com um UPDATE direto, devolver uma rota `cancelada`,
--   `concluida` ou `nao_executada` a `pendente`/`em_andamento`. Desde as
--   Migrations 70 e 71 (e o app 1.14.8 na web), cancelar e reativar passam
--   por RPC SECURITY DEFINER; a conclusão já passava por `finalizar_rota`.
--
--   Regra nova: o gatilho `trg_rota_encerrada_nao_volta` (BEFORE UPDATE OF
--   status, por linha, WHEN status antigo encerrado e status novo diferente)
--   recusa a mudança com P0001 'ROTA_ENCERRADA' quando o UPDATE vem dos
--   papéis da API (`current_user` = `authenticated` ou `anon`). Passam:
--     - as RPCs SECURITY DEFINER donas `postgres` (`reativar_rota`,
--       `cancelar_rota`, `finalizar_rota`, `expire_old_pending_routes`):
--       dentro delas `current_user` é o dono;
--     - a chave secreta (Edge Functions, `service_role`) e o CLI/SQL Editor
--       (`postgres`);
--     - UPDATE de outras colunas em rota encerrada (troca de motorista,
--       distância, estado da otimização): o gatilho só olha `status`;
--     - UPDATE que mantém o status (`cancelada` → `cancelada`).
--
--   Função do gatilho SECURITY INVOKER de propósito: como DEFINER,
--   `current_user` dentro dela seria sempre o dono e o gatilho não separaria
--   a API da RPC. `auth.uid()` também não separa: a RPC roda com a sessão de
--   quem a chama. A função não lê tabela nenhuma (só OLD/NEW e
--   `current_user`), então rodar com os privilégios de quem faz o UPDATE não
--   muda o resultado. O EXECUTE da função não é conferido no disparo do
--   gatilho (só no CREATE TRIGGER), por isso fica revogado de PUBLIC, anon e
--   authenticated, como na Migration 73.
--
--   Medido em 26/10/2026 (só SELECT):
--     - gatilhos de `rotas`: BEFORE `trg_recusa_apagar_rota_em_andamento`,
--       `trg_validar_motorista_e_loja_da_rota`, `update_rotas_updated_at`;
--       AFTER `log_rota_status`, `trigger_notify_rota_concluida`,
--       `trigger_notify_rota_iniciada`, `trigger_nova_rota_atribuida`(+insert).
--       Nenhum confere transição de status. Na ordem alfabética dos BEFORE, o
--       novo roda entre `trg_recusa_…` e `trg_validar_…`; como só recusa ou
--       deixa passar sem mudar NEW, a ordem não muda o resultado;
--     - funções de public que fazem UPDATE em `rotas`: `cancelar_rota`,
--       `reativar_rota`, `finalizar_rota`, `expire_old_pending_routes` — as
--       quatro SECURITY DEFINER, dono `postgres`. A Edge Function
--       `expire-routes` chama `expire_old_pending_routes` com a chave secreta;
--     - logs de mudança de status a partir de rota encerrada (gravados por
--       `log_rota_status`): `nao_executada → pendente` 6 (as reativações; 1
--       nos últimos 30 dias, a da RPC), `nao_executada → em_andamento` 3 (2
--       em 30 dias), `concluida → em_andamento` 3 (a última em 17/09) e
--       `cancelada → em_andamento` 1 (25/10). Das 7 de `→ em_andamento`, 2
--       são de uma loja real em dez/2025 (`concluida → em_andamento` minutos
--       depois da conclusão, rota concluída de novo em seguida; nenhuma
--       desde então) e 5 da loja demo (rotas `aaaa0000-…` e `4c9eaaae-…`),
--       onde o fixture do e2e
--       `e2e/fixtures/garantir-rota-do-mapa.ts` reabria a rota demo com
--       UPDATE direto como gestor — no mesmo PR ele passa a copiar a rota
--       encerrada (ver "Efeito no app");
--     - app: `startRoute` (`src/hooks/route-status/useRouteActions.ts`) só
--       muda rota `pendente` (`.eq('status', 'pendente')`); nenhuma tela do
--       motorista muda status de rota encerrada; o gestor 1.14.8 cancela e
--       reativa pela RPC.
--
--   Alternativas consideradas:
--     (a) gatilho BEFORE UPDATE OF status com `current_user` (escolhida):
--         recusa com erro explícito, enxerga OLD e NEW, deixa as RPCs e a
--         chave secreta passarem sem mudar nenhuma delas;
--     (b) policy `rotas_update` com WITH CHECK: o WITH CHECK só vê a linha
--         nova, não a transição. Pôr o status antigo no USING (`status NOT
--         IN (encerrados)`) esconderia a rota encerrada de todo UPDATE — a
--         troca de motorista e o recálculo de distância parariam, e a recusa
--         sairia como 0 linhas, sem erro;
--     (c) gatilho SECURITY DEFINER com marcador de sessão
--         (`set_config('rotamestre.rpc', ...)` dentro das RPCs): pede
--         reescrever as quatro RPCs, e quem esquecer o marcador numa RPC nova
--         é recusado;
--     (d) privilégio por coluna (`REVOKE UPDATE (status)` de authenticated):
--         recusaria também o início da rota pelo motorista
--         (`pendente → em_andamento`).
--   Papéis recusados: lista dos papéis da API (`authenticated`, `anon`,
--   escolhida, como o plano) em vez de "todo papel que não seja `postgres`/
--   `service_role`": são os dois papéis em que o PostgREST entra; os demais
--   (`postgres`, `service_role`, `supabase_admin`) já são de manutenção.
--
--   Efeito no app:
--     - motorista (qualquer versão): nenhum — não há caminho que mude status
--       de rota encerrada;
--     - gestor 1.14.8 (web): nenhum — cancela e reativa pela RPC;
--     - gestor 1.14.6 (cancela e reativa por UPDATE sem filtro de status):
--       cancelar rota já concluida ou reativar rota cancelada/concluida passa
--       a ser recusado com ROTA_ENCERRADA — o comportamento certo;
--     - gestor no app nativo 1.14.7 que reativar (UPDATE direto
--       `nao_executada → pendente`): passa a receber o erro e a tela mostra a
--       mensagem de erro dela (aceito na Decisão D2; atualiza para 1.14.8);
--     - e2e: `garantirRotaDoMapa` reabria a rota demo encerrada com UPDATE
--       direto (`→ em_andamento`). No mesmo PR, sem rota aberta, ele passa a
--       criar uma cópia da encerrada mais recente por `criar_rota_com_paradas`
--       e a iniciar como o app (`pendente → em_andamento`), sem nunca deixar
--       duas rotas abertas do motorista demo (`e2e/fixtures/planoDaRotaDoMapa.ts`).
--       O fixture novo precisa estar na main antes de aplicar.
--
--   `SET LOCAL lock_timeout = '3s'`: o DROP TRIGGER IF EXISTS pede ACCESS
--   EXCLUSIVE em `rotas` (mesmo sem o gatilho existir) e o CREATE TRIGGER pede
--   SHARE ROW EXCLUSIVE; enquanto esperam, seguram leituras e escritas do app.
--   Se a trava não vier em 3 s, a migration para sem efeito e é repetida.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.rota_encerrada_nao_volta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- O WHEN do gatilho já garante: status antigo encerrado e status novo
  -- diferente. Aqui só se decide quem fez o UPDATE.
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'ROTA_ENCERRADA'
      USING ERRCODE = 'P0001',
            DETAIL = format('A rota %s está %s; o status só muda pelas RPCs (reativar_rota).', OLD.id, OLD.status),
            HINT = 'Recarregue a rota.';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.rota_encerrada_nao_volta() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rota_encerrada_nao_volta() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.rota_encerrada_nao_volta() IS
  'Migration 75: gatilho BEFORE UPDATE OF status de rotas. Rota cancelada, concluida ou nao_executada não muda de status por UPDATE dos papéis da API (authenticated, anon): P0001 ROTA_ENCERRADA. SECURITY INVOKER de propósito, para que as RPCs SECURITY DEFINER (current_user = postgres), a chave secreta e o cron passem.';

DROP TRIGGER IF EXISTS trg_rota_encerrada_nao_volta ON public.rotas;
CREATE TRIGGER trg_rota_encerrada_nao_volta
  BEFORE UPDATE OF status ON public.rotas
  FOR EACH ROW
  WHEN (OLD.status IN ('cancelada', 'concluida', 'nao_executada') AND NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.rota_encerrada_nao_volta();

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT pg_get_triggerdef(t.oid), t.tgenabled FROM pg_trigger t
--  WHERE t.tgrelid = 'public.rotas'::regclass AND t.tgname = 'trg_rota_encerrada_nao_volta';
-- SELECT p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl
--   FROM pg_proc p WHERE p.oid = to_regprocedure('public.rota_encerrada_nao_volta()');
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_rota_encerrada_nao_volta ON public.rotas;
-- DROP FUNCTION IF EXISTS public.rota_encerrada_nao_volta();
-- COMMIT;
