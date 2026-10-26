-- ============================================================================
-- Migration 70: RPC cancelar_rota — o gestor cancela a rota e a parada em
-- andamento volta a pendente na mesma transação
-- Date: 2026-10-26
-- Author: Wellinton Ribeiro
-- Purpose:
--   Hoje o gestor cancela com um UPDATE direto em `rotas`
--   (`src/components/gestor/mapa-rota/hooks/useMapaRotaHandlers.ts:282`,
--   `.update({ status: 'cancelada' })`). As paradas não mudam, e a parada que
--   estava `em_andamento` fica assim numa rota cancelada: o painel segue
--   mostrando "Em rota". Esta migration cria `public.cancelar_rota(uuid)`,
--   que confere o gestor ativo da loja da rota, trava a rota, devolve a
--   parada `em_andamento` a `pendente` e cancela a rota, tudo numa transação,
--   com um resultado explícito para cada situação. E ajusta a única parada
--   que ficou nesse estado no passado.
--
--   Medições de 26/10/2026 (só SELECT):
--     - `rotas`: 872; `cancelada` 4, todas com parada aberta: 1 parada
--       `em_andamento` (`af99fbdf-d040-41d9-b41c-011868640f7e`, na rota
--       `dcf39a23-3278-43fc-9b4c-77ac30d52b29`, `updated_at` 2026-07-24, sem
--       foto) e 12 `pendente`; `nao_executada` 20 (102 paradas `pendente`).
--     - `paradas.status` aceita só `pendente|em_andamento|concluida|pulada`
--       (`paradas_status_check`). `expire_old_pending_routes` muda só
--       `rotas.status` e deixa as paradas `pendente`.
--     - Gatilhos que o UPDATE desta função alcança: em `rotas`,
--       `log_rota_status` grava `rota_cancelada` (com `usuario_id =
--       motorista_id`) e `validar_motorista_e_loja_da_rota` deixa passar
--       (motorista e loja iguais); em `paradas`, `em_andamento → pendente` não
--       dispara `notify_parada_pulada` (só `→ pulada`), nem
--       `notify_parada_reaberta` (só `concluida|pulada → pendente`), nem
--       `paradas_foto_vinculada_preservada` (só quando o status anterior é
--       `concluida|pulada`).
--
--   Resultado (`RETURNS text`), conjunto fechado:
--     'cancelada'      — a rota estava `pendente` ou `em_andamento` e foi
--                        cancelada agora;
--     'ja_cancelada'   — a rota já estava cancelada (toque duplo, resposta
--                        perdida): o app trata como sucesso informativo, sem
--                        log nem aviso a mais;
--     'situacao_mudou' — a rota está `concluida` ou `nao_executada`;
--     'sem_permissao'  — sem sessão, rota inexistente, ou quem chama não tem
--                        vínculo ativo de gestor na loja da rota. "Não
--                        existe" e "sem permissão" caem no mesmo resultado
--                        para não revelar rota de outra loja (como o
--                        `ROTA_NAO_ENCONTRADA` da Migration 40).
--   Regra de negócio nunca vira exceção; erro só para erro técnico.
--
--   Alternativas consideradas:
--     Forma do retorno:
--       (a) `RETURNS text` com conjunto fechado (escolhida): o pedido é
--           retorno explícito; o cliente faz `switch` exaustivo e não depende
--           do texto da mensagem; recusa não vira erro HTTP, então não entra
--           no log de erros do PostgREST;
--       (b) `RAISE` com sentinelas e ERRCODE 42501/P0001, como
--           `finalizar_rota`: obrigaria a casar prefixo de mensagem em
--           `errorMapping.ts`;
--       (c) `RETURNS jsonb {resultado, status_atual}`: o status atual não
--           muda a mensagem (a tela recarrega); YAGNI.
--     Paradas abertas (Decisão D1):
--       (a) `em_andamento → pendente`, `pendente` fica (escolhida): o mesmo
--           estado que a expiração deixa (`nao_executada` com paradas
--           `pendente`); o painel deixa de mostrar "Em rota", nenhum aviso
--           dispara e as métricas de pulo não mudam;
--       (b) abertas → `pulada` com `motivo_skip = 'rota_cancelada'`: dispara
--           `notify_parada_pulada` para cada parada (N avisos aos gestores) e
--           soma pulos que não aconteceram no desempenho do motorista
--           (Migration 55);
--       (c) status novo `cancelada` em `paradas`: muda o CHECK, os quatro
--           status que `useReorderState` exige (invariante do PR #312) e
--           todas as uniões de status do app.
--     Cobertura do app instalado (Decisão D2):
--       (a) só a RPC (escolhida): o gestor web atualiza junto no deploy e o
--           app nativo de gestor quase não tem uso;
--       (b) RPC + gatilho `AFTER UPDATE OF status ON rotas` que faz o mesmo
--           ajuste quando um UPDATE direto cancela: cobriria o gestor no app
--           1.14.7 instalado, com uma regra a mais escondida em gatilho.
--     Ajuste do passado (Decisão D3): um UPDATE único da parada medida,
--       travado pelo id, pela rota `cancelada` e pelo status `em_andamento`;
--       as 6 paradas `em_andamento` em rotas `concluida` (mar–jun/2026) são
--       outro estado e ficam fora. O rollback devolve só o id medido.
--
--   Trava: `FOR NO KEY UPDATE` na linha da rota, só quando quem chama é
--   gestor ativo da loja (o EXISTS fica no mesmo WHERE). Nunca `FOR UPDATE`:
--   ele conflita com o `FOR KEY SHARE` do INSERT de `inserir_parada`
--   (Migration 40).
--
--   Limites:
--     - A RPC é do gestor. O motorista que chama recebe 'sem_permissao'; o
--       UPDATE direto de `rotas` segue regido pela policy `rotas_update`,
--       que esta migration não muda.
--     - A chave secreta (painel e Edge Functions) não tem `auth.uid()` e
--       recebe 'sem_permissao'; o painel segue no UPDATE direto.
--
--   Efeito no app instalado: 1.14.6/1.14.7 não chamam a RPC; o gestor nesses
--   apps segue no UPDATE direto, que deixa a parada `em_andamento` como hoje
--   (D2). O motorista não muda. O app 1.14.8 passa a chamar a RPC (Tarefa
--   A1).
--
--   Função nova: SECURITY DEFINER, `SET search_path = ''` (nomes
--   qualificados), dono postgres, REVOKE explícito de PUBLIC e anon (a
--   Migration 69 não alcança CREATE OR REPLACE), EXECUTE para authenticated
--   e service_role.
-- ============================================================================

BEGIN;

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

  RETURN 'cancelada';
END;
$$;

ALTER FUNCTION public.cancelar_rota(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cancelar_rota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_rota(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.cancelar_rota(uuid) IS
  'Migration 70: o gestor ativo da loja cancela a rota pendente ou em andamento; a parada em_andamento volta a pendente na mesma transação. Devolve cancelada | ja_cancelada | situacao_mudou | sem_permissao.';

-- Ajuste do passado (D3): a única parada em_andamento em rota cancelada,
-- medida em 26/10/2026.
UPDATE public.paradas p
   SET status = 'pendente'
  FROM public.rotas r
 WHERE p.id = 'af99fbdf-d040-41d9-b41c-011868640f7e'
   AND p.rota_id = r.id
   AND r.status = 'cancelada'
   AND p.status = 'em_andamento';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- 1. a função, com SECURITY DEFINER, search_path vazio, dono e EXECUTE
-- SELECT p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_executa
--   FROM pg_proc p WHERE p.oid = to_regprocedure('public.cancelar_rota(uuid)');
-- 2. nenhuma parada em_andamento em rota cancelada (esperado 0)
-- SELECT count(*) FROM public.paradas p JOIN public.rotas r ON r.id = p.rota_id
--  WHERE r.status = 'cancelada' AND p.status = 'em_andamento';
-- ============================================================================

-- ROLLBACK:
-- (Volte antes o app que chama cancelar_rota: sem a função, o cancelamento
-- do gestor 1.14.8 deixa de funcionar. O ajuste da parada af99fbdf atualiza o
-- updated_at, cujo valor original era 2026-07-24 14:29:55.365577+00.)
-- BEGIN;
-- UPDATE public.paradas
--    SET status = 'em_andamento'
--  WHERE id = 'af99fbdf-d040-41d9-b41c-011868640f7e'
--    AND status = 'pendente';
-- DROP FUNCTION IF EXISTS public.cancelar_rota(uuid);
-- COMMIT;
