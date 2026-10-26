-- ============================================================================
-- Migration 71: RPC reativar_rota — o gestor reabre a rota não executada e
-- as paradas não concluídas na mesma transação
-- Date: 2026-10-26
-- Author: Wellinton Ribeiro
-- Purpose:
--   Hoje o gestor reativa com três escritas independentes do cliente
--   (`src/components/gestor/mapa-rota/hooks/useMapaRotaHandlers.ts`,
--   `handleConfirmReactivate`): UPDATE da rota (`nao_executada → pendente`,
--   `data` = hoje no aparelho, `iniciada_em`/`concluida_em` nulos), UPDATE das
--   paradas (`status <> 'concluida'` → `pendente`, `concluida_em` nulo) e
--   INSERT do log `rota_reativada`. Se a segunda ou a terceira não chega ao
--   banco, a rota fica `pendente` com paradas ainda `pulada`/`em_andamento`,
--   ou sem o registro de quem reativou. Esta migration cria
--   `public.reativar_rota(uuid)`, que confere o gestor ativo da loja da rota,
--   trava a rota e faz as três escritas numa transação, com um resultado
--   explícito para cada situação. A regra é a do cliente, espelhada sem
--   mudança.
--
--   Regra espelhada:
--     - rota `nao_executada` → `status = 'pendente'`, `data` = hoje em São
--       Paulo, `iniciada_em = NULL`, `concluida_em = NULL`;
--     - paradas da rota com `status <> 'concluida'` (inclui partida, chegada e
--       `pulada`) → `status = 'pendente'`, `concluida_em = NULL`;
--       `motivo_skip` e foto não mudam; as `concluida` ficam como estão;
--     - log `rota_reativada` com `usuario_id` = quem reativou e
--       `detalhes = {nova_data, reativado_por}` (o nome em `usuarios`).
--
--   Gatilhos que as escritas desta função alcançam (os mesmos do caminho do
--   cliente):
--     - em `rotas`, `log_rota_status` grava `status_alterado` (com
--       `usuario_id = motorista_id`); como o evento difere de
--       `rota_reativada`, `prevent_duplicate_log` mantém os dois;
--       `validar_motorista_e_loja_da_rota` não entra (o UPDATE não toca
--       `motorista_id` nem `unidade_id`);
--     - em `paradas`, `notify_parada_reaberta` dispara para cada ex-`pulada`
--       (um aviso aos gestores da loja por parada), como hoje;
--       `paradas_foto_vinculada_preservada` deixa passar porque `auth.uid()`
--       é gestor ativo da loja da rota (a foto da ex-`pulada` fica).
--
--   Resultado (`RETURNS text`), conjunto fechado:
--     'reativada'      — a rota estava `nao_executada` e foi reaberta agora;
--     'situacao_mudou' — a rota está em qualquer outro status (inclusive
--                        `pendente`: a 2ª chamada não distingue "eu mesmo
--                        reativei" de "outro gestor reativou e o motorista já
--                        iniciou"; a tela recarrega nos dois casos);
--     'sem_permissao'  — sem sessão, rota inexistente, ou quem chama não tem
--                        vínculo ativo de gestor na loja da rota. "Não
--                        existe" e "sem permissão" caem no mesmo resultado
--                        para não revelar rota de outra loja.
--   Regra de negócio nunca vira exceção; erro só para erro técnico.
--
--   Alternativas consideradas:
--     "Hoje":
--       (a) `(now() AT TIME ZONE 'America/Sao_Paulo')::date` (escolhida): o
--           relógio do negócio, o mesmo de `expire_old_pending_routes`;
--       (b) parâmetro `p_data date` vindo do aparelho (`getTodayISO`):
--           aceitaria data arbitrária e pediria outra validação;
--       (c) `CURRENT_DATE`: segue o fuso da sessão (UTC no PostgREST) e, das
--           21:00 às 24:00 em São Paulo, já seria o dia seguinte.
--     Log:
--       (a) dentro da RPC (escolhida): hoje o INSERT do cliente pode não
--           chegar depois de a rota mudar;
--       (b) manter no cliente: mantém as escritas separadas que a RPC existe
--           para juntar.
--     Segunda chamada: 'situacao_mudou' (ver acima), sem um 'ja_reativada'
--       como o 'ja_cancelada' da Migration 70 — `pendente` é também o estado
--       de uma rota que outro gestor reativou ou que nunca expirou.
--
--   Reativar depois das 22:00 em São Paulo (Decisão D6): a rota volta com
--   `data` = hoje, e a próxima execução de `expire_old_pending_routes`
--   (pendente com `data = hoje` e hora ≥ 22:00) a encerra de novo. É o
--   comportamento do cliente de hoje, mantido de propósito.
--
--   Trava: `FOR NO KEY UPDATE` na linha da rota, só quando quem chama é
--   gestor ativo da loja (o EXISTS fica no mesmo WHERE). Nunca `FOR UPDATE`:
--   ele conflita com o `FOR KEY SHARE` do INSERT de `inserir_parada`
--   (Migration 40).
--
--   Limites:
--     - A RPC é do gestor. O motorista que chama recebe 'sem_permissao'.
--     - A chave secreta (painel e Edge Functions) não tem `auth.uid()` e
--       recebe 'sem_permissao'.
--
--   Efeito no app instalado: nenhum. 1.14.6/1.14.7 seguem nas escritas
--   separadas até a 1.14.8 (Tarefa A1), que passa a chamar a RPC.
--
--   Função nova: SECURITY DEFINER, `SET search_path = ''` (nomes
--   qualificados), dono postgres, REVOKE explícito de PUBLIC e anon (a
--   Migration 69 não alcança CREATE OR REPLACE), EXECUTE para authenticated
--   e service_role.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.reativar_rota(p_rota_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_hoje date;
  v_nome text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'sem_permissao';
  END IF;

  -- Só trava a rota de quem pode reativá-la.
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

  IF v_status <> 'nao_executada' THEN
    RETURN 'situacao_mudou';
  END IF;

  -- Trava as paradas da rota antes de mexer (o mesmo cuidado de
  -- cancelar_rota e finalizar_rota): uma escrita do motorista ainda sem
  -- commit numa parada concluida não casaria com o filtro abaixo.
  PERFORM 1 FROM public.paradas p WHERE p.rota_id = p_rota_id FOR NO KEY UPDATE;

  v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  UPDATE public.rotas
     SET status = 'pendente',
         data = v_hoje,
         iniciada_em = NULL,
         concluida_em = NULL
   WHERE id = p_rota_id;

  UPDATE public.paradas
     SET status = 'pendente',
         concluida_em = NULL
   WHERE rota_id = p_rota_id
     AND status <> 'concluida';

  SELECT u.nome INTO v_nome
    FROM public.usuarios u
   WHERE u.id = auth.uid();

  INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
  VALUES (
    auth.uid(),
    p_rota_id,
    'rota_reativada',
    jsonb_build_object('nova_data', v_hoje, 'reativado_por', v_nome)
  );

  RETURN 'reativada';
END;
$$;

ALTER FUNCTION public.reativar_rota(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reativar_rota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reativar_rota(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.reativar_rota(uuid) IS
  'Migration 71: o gestor ativo da loja reativa a rota nao_executada com a data de hoje em São Paulo; as paradas não concluídas voltam a pendente e o log rota_reativada é gravado na mesma transação. Devolve reativada | situacao_mudou | sem_permissao.';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_executa
--   FROM pg_proc p WHERE p.oid = to_regprocedure('public.reativar_rota(uuid)');
-- ============================================================================

-- ROLLBACK:
-- (Volte antes o app que chama reativar_rota: sem a função, a reativação
-- do gestor 1.14.8 deixa de funcionar.)
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.reativar_rota(uuid);
-- COMMIT;
