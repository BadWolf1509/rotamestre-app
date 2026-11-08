-- ============================================================================
-- Migration 88: iniciar a rota numa RPC transacional (`iniciar_rota`)
-- Date: 2026-11-08
-- Author: Wellinton Ribeiro
-- Purpose:
--   Pendência 30(j). O motorista inicia a rota com três escritas separadas do
--   app (`useRouteActions.startRoute`): a rota `pendente` → `em_andamento`
--   com `iniciada_em`, a partida (ordem 0, `is_checkpoint = false`)
--   `pendente` → `concluida`, e a 1ª parada real `pendente` →
--   `em_andamento`. Se a rede cai entre elas, a rota fica em andamento com a
--   partida pendente (caso real em 19/10/2026); o app ficou idempotente no
--   #693 (relê a rota e completa o que faltou, e `useCompletarPartidaPendente`
--   repara na carga), mas a janela continua aberta.
--
--   `iniciar_rota(p_rota_id uuid) RETURNS text`, SECURITY DEFINER,
--   search_path vazio, faz as três numa transação só:
--     - sem sessão → 'sem_permissao';
--     - trava a rota com a regra de quem pode iniciá-la hoje (a policy
--       `rotas_update` no caminho do motorista e a `finalizar_rota`): o
--       motorista da rota, com o cadastro ativo (`usuario_atual_ativo()`) e
--       vínculo ativo na loja dela. Rota que não existe, de outro motorista,
--       de loja sem vínculo ativo ou com o cadastro inativo caem juntas em
--       'sem_permissao' (não revela rota alheia);
--     - `em_andamento` → 'ja_iniciada' (resposta perdida, toque duplo, outro
--       aparelho). Completa, se faltar, o que um início pela metade de versão
--       antiga deixou: partida pendente → concluida (com a hora do
--       `iniciada_em`) e, sem parada real em andamento, a 1ª pendente →
--       em_andamento. As duas escritas são condicionadas, então repetir não
--       muda nada;
--     - outro status (`concluida`, `cancelada`, `nao_executada`) →
--       'situacao_mudou', sem escrita;
--     - `pendente` → trava as paradas, rota `em_andamento` com
--       `iniciada_em = now()`, partida concluída com a mesma hora, 1ª parada
--       real (menor ordem, `is_checkpoint IS DISTINCT FROM false`, pendente)
--       em andamento se nenhuma real já estiver; 'iniciada'.
--
--   Respeita o que já guarda a rota: os gatilhos rodam dentro da RPC como em
--   qualquer UPDATE. `rota_status_pelo_gestor` (Migrations 76/83) vê
--   `auth.uid()` do motorista e permite `pendente` → `em_andamento`;
--   `rota_encerrada_nao_volta` (75) e `parada_de_rota_encerrada_nao_muda` (77)
--   não disparam, porque a RPC só escreve em rota `pendente`/`em_andamento`;
--   `notify_rota_iniciada` e `log_rota_status`/`log_parada_status` seguem
--   avisando o gestor e gravando o rastro, como no início pelo app.
--
--   Trava: `FOR NO KEY UPDATE` na rota e depois nas paradas, a ordem de
--   `finalizar_rota` e `cancelar_rota` — um cancelamento concorrente espera e
--   o outro lê o status já gravado. Nunca `FOR UPDATE` (conflita com o
--   `FOR KEY SHARE` dos INSERTs com FK para `rotas`).
--
--   Alternativas consideradas:
--     Resposta: (a) texto num conjunto fechado (escolhida), como
--          `cancelar_rota`/`reativar_rota`: o app mapeia o resultado sem
--          depender de texto de erro; (b) RAISE com sentinela, como
--          `finalizar_rota`: recusa esperada (rota cancelada pelo gestor)
--          viraria erro do PostgREST; (c) jsonb `{success, code}` (Migration
--          81): pede o formato por causa do app publicado, que esta RPC não
--          tem.
--     'ja_iniciada': (a) completa o início pela metade (escolhida): é o que o
--          app faz hoje ao achar a própria rota em andamento, e deixa o app
--          novo sem a releitura; (b) só responder: a partida pendente de
--          versão antiga dependeria só do reparo na carga.
--     Vínculo: (a) vínculo ativo na loja, qualquer papel (escolhida): é a
--          regra da policy `rotas_update` e da `finalizar_rota`, que o início
--          pelo app já segue; (b) exigir papel `motorista`, como
--          `reativar_rota`: mudaria quem inicia sem achado que o peça (o
--          gatilho `validar_motorista_e_loja_da_rota` já só põe motorista).
--
--   Medido em 08/11/2026 (só SELECT de catálogo): sem `iniciar_rota` no
--   catálogo; gatilhos de `rotas`/`paradas` e as funções
--   `rota_status_pelo_gestor`, `rota_encerrada_nao_volta`,
--   `parada_de_rota_encerrada_nao_muda`, `finalizar_rota` e
--   `usuario_atual_ativo()` como descritos acima.
--
--   Efeito no app: o app publicado segue com as três escritas (a RPC não o
--   afeta). O app novo chama `iniciar_rota` e só é mesclado depois desta
--   migration aplicada.
--
--   APLICAR COMO `postgres`.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.iniciar_rota(p_rota_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_iniciada_em timestamptz;
  v_agora timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'sem_permissao';
  END IF;

  -- Só trava a rota de quem pode iniciá-la: o motorista dela, ativo, com
  -- vínculo ativo na loja da rota.
  SELECT r.status, r.iniciada_em
    INTO v_status, v_iniciada_em
    FROM public.rotas r
   WHERE r.id = p_rota_id
     AND r.motorista_id = auth.uid()
     AND (SELECT public.usuario_atual_ativo())
     AND EXISTS (
       SELECT 1 FROM public.usuario_unidades uu
        WHERE uu.usuario_id = auth.uid()
          AND uu.unidade_id = r.unidade_id
          AND uu.ativo = true
     )
   FOR NO KEY UPDATE OF r;

  IF NOT FOUND THEN
    RETURN 'sem_permissao';
  END IF;

  IF v_status NOT IN ('pendente', 'em_andamento') THEN
    RETURN 'situacao_mudou';
  END IF;

  -- Trava as paradas antes de mexer (a ordem de finalizar_rota).
  PERFORM 1 FROM public.paradas p WHERE p.rota_id = p_rota_id FOR NO KEY UPDATE;

  IF v_status = 'pendente' THEN
    UPDATE public.rotas
       SET status = 'em_andamento',
           iniciada_em = v_agora
     WHERE id = p_rota_id;
    v_iniciada_em := v_agora;
  END IF;

  -- Partida (ordem 0, fora das paradas reais): concluída, se ainda pendente.
  UPDATE public.paradas
     SET status = 'concluida',
         concluida_em = coalesce(v_iniciada_em, v_agora)
   WHERE rota_id = p_rota_id
     AND is_checkpoint = false
     AND ordem = 0
     AND status = 'pendente';

  -- 1ª parada real pendente em andamento, se nenhuma real já estiver.
  IF NOT EXISTS (
    SELECT 1 FROM public.paradas p
     WHERE p.rota_id = p_rota_id
       AND p.is_checkpoint IS DISTINCT FROM false
       AND p.status = 'em_andamento'
  ) THEN
    UPDATE public.paradas
       SET status = 'em_andamento'
     WHERE id = (
       SELECT p.id FROM public.paradas p
        WHERE p.rota_id = p_rota_id
          AND p.is_checkpoint IS DISTINCT FROM false
          AND p.status = 'pendente'
        ORDER BY p.ordem
        LIMIT 1
     )
       AND status = 'pendente';
  END IF;

  IF v_status = 'em_andamento' THEN
    RETURN 'ja_iniciada';
  END IF;

  RETURN 'iniciada';
END;
$$;

ALTER FUNCTION public.iniciar_rota(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.iniciar_rota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iniciar_rota(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.iniciar_rota(uuid) IS
  'Migration 88: o motorista da rota (cadastro ativo, vínculo ativo na loja) inicia a rota pendente numa transação: rota em_andamento com iniciada_em, partida concluída e 1ª parada real em andamento. Idempotente: rota já em andamento devolve ja_iniciada e completa o que faltar. Devolve iniciada | ja_iniciada | situacao_mudou | sem_permissao.';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl
--   FROM pg_proc p WHERE p.oid = to_regprocedure('public.iniciar_rota(uuid)');
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.iniciar_rota(uuid);
-- COMMIT;
