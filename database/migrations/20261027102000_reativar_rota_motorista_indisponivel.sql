-- ============================================================================
-- Migration 78: reativar_rota confere o motorista (resultado
-- `motorista_indisponivel`)
-- Date: 2026-10-27
-- Author: Wellinton Ribeiro
-- Purpose:
--   A `reativar_rota` (Migration 71) reabre a rota `nao_executada` para hoje
--   sem olhar o motorista. Se ele foi desativado (a pessoa ou o vínculo com a
--   loja) depois da expiração, a RPC devolve 'reativada', a rota fica
--   `pendente`, mas o motorista não a vê (as policies de `rotas`/`paradas`
--   exigem vínculo ativo e `usuario_atual_ativo()`), e às 22:00 a expiração a
--   encerra de novo. O gatilho `validar_motorista_e_loja_da_rota` não entra,
--   porque nem `motorista_id` nem `unidade_id` mudam.
--
--   Regra nova: depois da trava e do `situacao_mudou`, e antes de mexer em
--   qualquer linha, a RPC confere o motorista com a mesma regra de
--   `criar_rota_com_paradas` (vínculo ativo de `motorista` na loja da rota e
--   cadastro ativo). Sem isso, devolve 'motorista_indisponivel' e não muda
--   nada. Rota sem motorista (`motorista_id` nulo) segue reativando: volta
--   `pendente`, e o gestor escolhe o motorista pelo app (a troca de motorista
--   vale para rota `pendente`).
--
--   Ordem dos resultados: 'sem_permissao' (sessão sem `sub`, gestor sem
--   vínculo ativo na loja, rota inexistente), 'situacao_mudou' (a rota não
--   está `nao_executada`), 'motorista_indisponivel', 'reativada'.
--
--   Medido em 26/10/2026 (só SELECT): 12 rotas `nao_executada`; 3 com
--   motorista sem vínculo ativo ou desativado.
--
--   Alternativas consideradas:
--     (a) resultado novo 'motorista_indisponivel' no conjunto fechado
--         (escolhida): a RPC não anuncia uma reativação que não chega a
--         ninguém; o app diz o porquê;
--     (b) reativar sem motorista (`motorista_id = NULL`): a rota some da
--         agenda de quem a faria e o gestor não fica sabendo do motivo;
--     (c) parâmetro opcional com o novo motorista: muda a assinatura (nova
--         sobrecarga) e pede tela nova no app; fica para quando houver a tela.
--
--   Efeito no app:
--     - gestor 1.14.8 e 1.14.9 (`src/lib/gestor/acoesRota.ts`): resultado fora
--       do conjunto conhecido vira erro, e a tela mostra a mensagem genérica
--       de erro sem anunciar sucesso. A versão nova traz o texto próprio
--       (acrescentar 'motorista_indisponivel' a `RESULTADOS_REATIVAR`);
--     - gestor 1.14.7 (UPDATE direto): já recusado pela Migration 75;
--     - motorista: nenhum.
--
--   `SET LOCAL lock_timeout = '3s'`: CREATE OR REPLACE FUNCTION pede trava só
--   no catálogo da função; o valor fica pelo padrão das migrations.
--   CREATE OR REPLACE preserva a ACL; REVOKE/GRANT repetem a da Migration 71.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.reativar_rota(p_rota_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_motorista_id uuid;
  v_unidade_id uuid;
  v_hoje date;
  v_nome text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'sem_permissao';
  END IF;

  -- Só trava a rota de quem pode reativá-la.
  SELECT r.status, r.motorista_id, r.unidade_id
    INTO v_status, v_motorista_id, v_unidade_id
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

  -- A regra de criar_rota_com_paradas: vínculo ativo de motorista na loja da
  -- rota e cadastro ativo. Rota sem motorista reativa (o gestor atribui).
  IF v_motorista_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.usuario_unidades uu
      JOIN public.usuarios u ON u.id = uu.usuario_id
     WHERE uu.usuario_id = v_motorista_id
       AND uu.unidade_id = v_unidade_id
       AND uu.papel::text = 'motorista'
       AND uu.ativo = true
       AND u.ativo = true
  ) THEN
    RETURN 'motorista_indisponivel';
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
  'Migration 78 (sobre a 71): o gestor ativo da loja reabre a rota nao_executada para hoje (São Paulo) e as paradas não concluídas, numa transação, com log rota_reativada. Resultado: reativada | situacao_mudou | motorista_indisponivel (motorista sem vínculo ativo de motorista na loja ou desativado; nada muda) | sem_permissao.';

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl,
--        position('motorista_indisponivel' in p.prosrc) > 0 AS tem_resultado_novo
--   FROM pg_proc p WHERE p.oid = to_regprocedure('public.reativar_rota(uuid)');
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- CREATE OR REPLACE FUNCTION public.reativar_rota(p_rota_id uuid)
-- RETURNS text
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = ''
-- AS $$
-- DECLARE
--   v_status text;
--   v_hoje date;
--   v_nome text;
-- BEGIN
--   IF auth.uid() IS NULL THEN
--     RETURN 'sem_permissao';
--   END IF;
--   SELECT r.status INTO v_status
--     FROM public.rotas r
--    WHERE r.id = p_rota_id
--      AND EXISTS (
--        SELECT 1 FROM public.usuario_unidades uu
--         WHERE uu.usuario_id = auth.uid()
--           AND uu.unidade_id = r.unidade_id
--           AND uu.papel::text = 'gestor'
--           AND uu.ativo = true
--      )
--    FOR NO KEY UPDATE;
--   IF NOT FOUND THEN
--     RETURN 'sem_permissao';
--   END IF;
--   IF v_status <> 'nao_executada' THEN
--     RETURN 'situacao_mudou';
--   END IF;
--   PERFORM 1 FROM public.paradas p WHERE p.rota_id = p_rota_id FOR NO KEY UPDATE;
--   v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
--   UPDATE public.rotas
--      SET status = 'pendente', data = v_hoje, iniciada_em = NULL, concluida_em = NULL
--    WHERE id = p_rota_id;
--   UPDATE public.paradas
--      SET status = 'pendente', concluida_em = NULL
--    WHERE rota_id = p_rota_id AND status <> 'concluida';
--   SELECT u.nome INTO v_nome FROM public.usuarios u WHERE u.id = auth.uid();
--   INSERT INTO public.logs (usuario_id, rota_id, evento, detalhes)
--   VALUES (auth.uid(), p_rota_id, 'rota_reativada',
--           jsonb_build_object('nova_data', v_hoje, 'reativado_por', v_nome));
--   RETURN 'reativada';
-- END;
-- $$;
-- ALTER FUNCTION public.reativar_rota(uuid) OWNER TO postgres;
-- REVOKE ALL ON FUNCTION public.reativar_rota(uuid) FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.reativar_rota(uuid) TO authenticated, service_role;
-- COMMIT;
