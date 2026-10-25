-- ============================================================================
-- Migration 61: o incidente mantém o motorista que o registrou
-- Date: 2026-10-25
-- Author: Wellinton Ribeiro
-- Purpose:
--   `incidentes.motorista_id` é quem registrou o incidente, e é por essa
--   coluna que a pessoa lê o próprio incidente (`incidentes_select` e
--   `incidentes_update` aceitam `motorista_id = auth.uid()`). A criação já
--   amarra a coluna a quem chama (`incidentes_insert`: WITH CHECK
--   `motorista_id = auth.uid()`), mas o UPDATE do gestor da loja aceitava
--   gravar nela outra pessoa: o `incidentes_confere_rota_parada` só confere a
--   troca quando o incidente tem rota, e mesmo com rota aceita o motorista
--   para quem a rota foi reatribuída. A partir desta migration, com sessão, o
--   motorista do incidente não muda — nem para outra pessoa, nem para NULL
--   (NULL apagaria quem registrou e tiraria do motorista a leitura do próprio
--   incidente). Sem sessão (`auth.uid()` nulo: chave secreta do painel e das
--   Edge Functions, jobs), nada muda.
--
--   O que passa:
--     - SET com o mesmo motorista, pela cláusula WHEN (o app não manda a
--       coluna, mas um UPDATE que a repita não muda nada);
--     - motorista_id NULL gravado pela ação ON DELETE SET NULL da FK
--       `incidentes_motorista_id_fkey`, ao excluir a conta (Migration 56,
--       incidente anonimizado). Essa ação roda dentro do gatilho de
--       integridade de `usuarios`, então `pg_trigger_depth()` é maior que 1;
--       um UPDATE direto chega com 1. É o mesmo recurso das Migrations 32, 33
--       e 46. Alternativa descartada: liberar todo NULL na cláusula WHEN —
--       deixaria o gestor (ou o próprio motorista, se a policy mudar) apagar
--       o autor do incidente.
--
--   Alternativas consideradas:
--     (a) gatilho BEFORE UPDATE OF motorista_id que recusa, com sessão, toda
--         troca para outra pessoa (escolhida): o mesmo molde das Migrations
--         58 e 59, sem mexer em policy nem em função já em uso, e sem ramo
--         por papel — não há fluxo do app que troque o motorista;
--     (b) o mesmo gatilho aceitando motorista com vínculo ativo na loja do
--         incidente: deixa a coluna regravável pelo gestor para dentro da
--         loja, coisa que nenhum fluxo usa, e o registro de quem relatou o
--         incidente deixa de ser confiável para a auditoria;
--     (c) WITH CHECK em `incidentes_update`: a expressão não enxerga OLD, e
--         exigir `motorista_id = auth.uid()` do gestor tiraria dele a
--         resolução do incidente;
--     (d) privilégio de coluna (tirar UPDATE de `motorista_id` de
--         authenticated): o UPDATE hoje é concedido na tabela inteira; seria
--         preciso revogar e reconceder coluna a coluna, e toda coluna nova
--         passaria a exigir GRANT (mesmo motivo da Migration 59, item e).
--
--   Efeito no que já existe:
--     - App: nenhum fluxo grava `motorista_id` em UPDATE. O gestor resolve o
--       incidente com `status`, `observacoes_gestao`, `resolvido_em` e
--       `updated_at` (tipo `IncidenteUpdate`); o motorista cria pelo INSERT,
--       que não passa por gatilho de UPDATE.
--     - Exclusão de conta: ON DELETE SET NULL, aceito pela profundidade do
--       gatilho (conferido numa réplica local: DELETE da conta com sessão
--       ativa deixa o incidente com motorista_id NULL).
--     - Nenhuma função do banco faz UPDATE de `motorista_id` em `incidentes`
--       (conferido em pg_proc em 25/10/2026).
--
--   SECURITY DEFINER com `search_path` vazio, dono `postgres`, sem EXECUTE
--   para PUBLIC, `anon` e `authenticated`: função de gatilho não é chamada
--   direto. A função não lê tabela nenhuma.
--
--   Ordem: os gatilhos BEFORE UPDATE de `incidentes` disparam em ordem
--   alfabética (`incidentes_confere_rota_parada`,
--   `incidentes_define_unidade`, `trg_incidentes_foto_vinculada_preservada`,
--   este, `trg_incidentes_troca_de_rota_pelo_gestor`,
--   `update_incidentes_updated_at`). Nenhum deles grava `motorista_id`, e
--   qualquer RAISE aborta o comando inteiro: a ordem não muda o resultado.
--
--   Medido em 25/10/2026: 26 incidentes, nenhum sem motorista; os 3 sem rota
--   têm motorista com vínculo ativo na loja do incidente.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.incidentes_mantem_o_motorista()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- A ação ON DELETE SET NULL da FK roda dentro do gatilho de integridade de
  -- `usuarios` (profundidade 2 ou mais), e pode vir com a sessão de quem
  -- exclui a conta. UPDATE direto chega com profundidade 1.
  IF NEW.motorista_id IS NULL AND pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'O incidente mantém o motorista que o registrou.'
    USING ERRCODE = '42501';
END;
$$;

ALTER FUNCTION public.incidentes_mantem_o_motorista() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.incidentes_mantem_o_motorista() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.incidentes_mantem_o_motorista() IS
  'Gatilho BEFORE UPDATE OF motorista_id em incidentes: com sessão, o motorista do incidente não muda; passam chamadas sem sessão e o NULL gravado pela ação ON DELETE SET NULL da FK (pg_trigger_depth() > 1) (Migration 61).';

DROP TRIGGER IF EXISTS trg_incidentes_mantem_o_motorista ON public.incidentes;

CREATE TRIGGER trg_incidentes_mantem_o_motorista
  BEFORE UPDATE OF motorista_id ON public.incidentes
  FOR EACH ROW
  WHEN (OLD.motorista_id IS DISTINCT FROM NEW.motorista_id)
  EXECUTE FUNCTION public.incidentes_mantem_o_motorista();

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- 1. o gatilho, habilitado, com a cláusula WHEN
-- SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid)
--   FROM pg_trigger t
--  WHERE t.tgrelid = 'public.incidentes'::regclass
--    AND t.tgname = 'trg_incidentes_mantem_o_motorista';
-- 2. função: dono postgres, DEFINER, search_path vazio, sem EXECUTE para
--    anon/authenticated
-- SELECT proname, pg_get_userbyid(proowner) AS dono, prosecdef, proconfig,
--        has_function_privilege('anon', oid, 'EXECUTE') AS anon,
--        has_function_privilege('authenticated', oid, 'EXECUTE') AS auth
--   FROM pg_proc WHERE proname = 'incidentes_mantem_o_motorista';
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_incidentes_mantem_o_motorista ON public.incidentes;
-- DROP FUNCTION IF EXISTS public.incidentes_mantem_o_motorista();
-- COMMIT;
