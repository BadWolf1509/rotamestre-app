-- ============================================================================
-- Migration 58: parada só muda de rota pelo gestor das lojas das duas rotas
-- Date: 2026-10-24
-- Author: Wellinton Ribeiro
-- Purpose:
--   `paradas.rota_id` define a loja da parada (pela rota). A policy
--   `paradas_update` avalia o mesmo critério na linha antiga e na nova (não
--   tem WITH CHECK próprio), então quem pode atualizar a parada na rota de
--   origem e também na de destino conseguia trocar a rota, inclusive para uma
--   rota de outra loja. Esta migration define que a troca de rota só vale
--   quando quem chama é gestor com vínculo ativo na loja da rota de origem
--   E na loja da rota de destino. Sem sessão (`auth.uid()` nulo: chave
--   secreta do painel e das Edge Functions, jobs), nada muda, como nos demais
--   gatilhos de `paradas` (`recusa_apagar_parada_finalizada`,
--   `paradas_foto_vinculada_preservada`).
--
--   Alternativas consideradas:
--     (a) gatilho BEFORE UPDATE OF rota_id (escolhida): compara OLD e NEW,
--         que é o que a regra precisa; a cláusula WHEN deixa de fora todo
--         UPDATE em que a rota não muda de fato;
--     (b) WITH CHECK em `paradas_update`: a expressão só enxerga a linha
--         nova, sem OLD. Ela consegue exigir permissão na rota de destino
--         (o que o USING já faz hoje), mas não consegue exigir que a rota
--         continue a mesma para o motorista nem conferir a loja de origem;
--     (c) privilégio de coluna (REVOKE UPDATE e GRANT UPDATE nas demais
--         colunas para `authenticated`): fecha a troca para todos com sessão,
--         inclusive o gestor das duas lojas, e cada coluna nova de `paradas`
--         passaria a exigir um GRANT — esquecido, o app quebra em silêncio.
--
--   Efeito no que já existe:
--     - RPCs SECURITY DEFINER que gravam em `paradas` (`inserir_parada`,
--       `reordenar_paradas`, `finalizar_rota`, `criar_rota_com_paradas`):
--       nenhuma muda `rota_id` (só `ordem`, `status`, `concluida_em`,
--       `vinculo_parada_id`); a cláusula WHEN não dispara para elas. Rodam com
--       a sessão de quem chama, então, se um dia trocarem a rota, valerá a
--       mesma regra.
--     - App: nenhum fluxo troca `rota_id` de parada (o tipo `ParadaUpdate` não
--       tem a coluna, e a fila offline aceita só `status`, `concluida_em` e
--       `foto_url`). A fixture do e2e (`garantir-rota-do-mapa`) só reabre
--       paradas da mesma rota.
--     - Apagar a rota: a FK `paradas_rota_id_fkey` é ON DELETE CASCADE (e a
--       coluna é NOT NULL), então não passa por UPDATE de `rota_id`.
--
--   SECURITY DEFINER com `search_path` vazio: a conferência de gestor lê
--   `rotas` e `usuario_unidades` sem depender do RLS de quem atualiza. Sem
--   EXECUTE para PUBLIC, `anon` e `authenticated`: função de gatilho não é
--   chamada direto.
--
--   Ordem: os gatilhos BEFORE UPDATE de `paradas` disparam em ordem
--   alfabética (`trg_paradas_foto_vinculada_preservada`, este,
--   `trg_recusa_editar_local_de_parada_concluida`,
--   `trg_validar_vinculo_parada`, `update_paradas_updated_at`). Nenhum deles
--   grava `rota_id`, e o da foto confere o gestor pela rota de OLD; a ordem
--   entre eles não muda o resultado.
--
--   Medido em 24/10/2026: 3 motoristas com vínculo ativo em mais de uma loja;
--   nenhum gestor nessa situação.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.paradas_troca_de_rota_pelo_gestor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.rotas r
    JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
    WHERE r.id = OLD.rota_id
      AND uu.usuario_id = auth.uid()
      AND uu.ativo = true
      AND uu.papel::text = 'gestor'
  ) AND EXISTS (
    SELECT 1
    FROM public.rotas r
    JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
    WHERE r.id = NEW.rota_id
      AND uu.usuario_id = auth.uid()
      AND uu.ativo = true
      AND uu.papel::text = 'gestor'
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'A parada só muda de rota pelo gestor das lojas das duas rotas.'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.paradas_troca_de_rota_pelo_gestor() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.paradas_troca_de_rota_pelo_gestor() IS
  'Gatilho BEFORE UPDATE OF rota_id em paradas: com sessão, a troca de rota só vale para gestor ativo da loja da rota de origem e da de destino (Migration 58).';

DROP TRIGGER IF EXISTS trg_paradas_troca_de_rota_pelo_gestor ON public.paradas;

CREATE TRIGGER trg_paradas_troca_de_rota_pelo_gestor
  BEFORE UPDATE OF rota_id ON public.paradas
  FOR EACH ROW
  WHEN (OLD.rota_id IS DISTINCT FROM NEW.rota_id)
  EXECUTE FUNCTION public.paradas_troca_de_rota_pelo_gestor();

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- 1. o gatilho, habilitado, com a cláusula WHEN
-- SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid)
--   FROM pg_trigger t
--  WHERE t.tgrelid = 'public.paradas'::regclass
--    AND t.tgname = 'trg_paradas_troca_de_rota_pelo_gestor';
-- 2. função: DEFINER, search_path vazio, sem EXECUTE para anon/authenticated
-- SELECT proname, prosecdef, proconfig,
--        has_function_privilege('anon', oid, 'EXECUTE') AS anon,
--        has_function_privilege('authenticated', oid, 'EXECUTE') AS auth
--   FROM pg_proc WHERE proname = 'paradas_troca_de_rota_pelo_gestor';
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_paradas_troca_de_rota_pelo_gestor ON public.paradas;
-- DROP FUNCTION IF EXISTS public.paradas_troca_de_rota_pelo_gestor();
-- COMMIT;
