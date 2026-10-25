-- ============================================================================
-- Migration 59: incidente só muda de rota pelo gestor das lojas de origem e
-- de destino
-- Date: 2026-10-24
-- Author: Wellinton Ribeiro
-- Purpose:
--   A loja de um incidente (`incidentes.unidade_id`) segue a rota: o gatilho
--   `incidentes_define_unidade` recalcula a loja quando `rota_id` muda para
--   uma rota não nula. A policy `incidentes_update` aceita o próprio motorista
--   (`motorista_id = auth.uid()`) em USING e em WITH CHECK, e o gatilho
--   `incidentes_confere_rota_parada` só exige que a rota nova seja do mesmo
--   motorista. Para quem dirige em mais de uma loja, isso deixava a troca de
--   rota levar o incidente de uma loja para outra. Esta migration aplica a
--   mesma regra da Migration 58 (paradas): com sessão, a troca de rota só
--   vale quando quem chama é gestor com vínculo ativo na loja de origem do
--   incidente E na loja da rota de destino. Sem sessão (`auth.uid()` nulo:
--   chave secreta do painel e das Edge Functions, jobs), nada muda.
--
--   Loja de origem: `OLD.unidade_id`, a loja gravada no incidente. OLD não é
--   alterado por gatilho nenhum, então a conferência não depende da ordem em
--   relação ao `incidentes_define_unidade` (que reescreve NEW.unidade_id).
--   Se o incidente não tiver loja gravada (hoje nenhum, medido em 24/10), vale
--   a loja da rota antiga. Loja de destino: a da rota de NEW.rota_id, lida em
--   `rotas` (não em NEW.unidade_id, pelo mesmo motivo de ordem).
--
--   O que fica de fora, pela cláusula WHEN:
--     - SET com a mesma rota;
--     - desligar a rota (NEW.rota_id nulo): a loja não muda (o
--       `incidentes_define_unidade` mantém OLD.unidade_id) e o ON DELETE SET
--       NULL da FK `incidentes_rota_id_fkey`, disparado ao apagar a rota, não
--       pode ser recusado.
--   `unidade_id` não entra na lista OF: authenticated tem UPDATE na coluna,
--   mas o `incidentes_define_unidade` roda em todo UPDATE e devolve
--   OLD.unidade_id quando a rota não muda (ou recalcula pela rota e pelo
--   motorista, quando a loja gravada é nula). Gravar a coluna direto não muda
--   a loja; a sonda confere.
--
--   Alternativas consideradas:
--     (a) gatilho BEFORE UPDATE OF rota_id com origem em OLD.unidade_id e
--         destino pela rota nova (escolhida): mesmo molde da Migration 58,
--         independente da ordem dos gatilhos BEFORE e sem mexer em função
--         que já está em uso no INSERT;
--     (b) gatilho que compara OLD.unidade_id com NEW.unidade_id já
--         recalculado (BEFORE UPDATE sem OF, com WHEN na loja): confere o
--         efeito em vez da causa, mas só funciona se disparar DEPOIS do
--         `incidentes_define_unidade` — a ordem é alfabética, e renomear
--         qualquer um dos dois desfaria a regra sem erro; além disso, a
--         cláusula WHEN seria avaliada em todo UPDATE da tabela;
--     (c) RAISE dentro do `incidentes_define_unidade`: junta cálculo de loja
--         com permissão numa função que também roda no INSERT (criação do
--         incidente pelo app), e um CREATE OR REPLACE dela arrisca a criação;
--     (d) WITH CHECK em `incidentes_update`: a expressão só enxerga a linha
--         nova, sem OLD, e o motorista continua passando por
--         `motorista_id = auth.uid()`;
--     (e) privilégio de coluna (tirar UPDATE de `rota_id` de authenticated):
--         fecha a troca também para o gestor das duas lojas, e toda coluna
--         nova de `incidentes` passaria a exigir GRANT.
--
--   Efeito no que já existe:
--     - App: nenhum fluxo troca `rota_id` de incidente. A criação
--       (`createIncidente`, usado pelo envio e pela restauração do rascunho)
--       é INSERT e não passa por gatilho de UPDATE; as atualizações do app
--       gravam só `status`, `observacoes_gestao`, `resolvido_em`,
--       `updated_at` (tipo `IncidenteUpdate`) e, na ligação tardia da foto
--       (Migration 57), `foto_url`, que não está na lista OF.
--     - Nenhuma função do banco faz UPDATE em `incidentes` (conferido em
--       pg_proc em 24/10/2026).
--     - Apagar a rota: ON DELETE SET NULL, fora da cláusula WHEN.
--
--   SECURITY DEFINER com `search_path` vazio: a conferência de gestor lê
--   `rotas` e `usuario_unidades` sem depender do RLS de quem atualiza. Dono
--   `postgres`, sem EXECUTE para PUBLIC, `anon` e `authenticated`: função de
--   gatilho não é chamada direto.
--
--   Ordem: os gatilhos BEFORE UPDATE de `incidentes` disparam em ordem
--   alfabética (`incidentes_confere_rota_parada`,
--   `incidentes_define_unidade`, `trg_incidentes_foto_vinculada_preservada`,
--   este, `update_incidentes_updated_at`). Nenhum deles grava `rota_id`, e
--   este lê OLD e `rotas`, não o NEW.unidade_id recalculado; qualquer RAISE
--   aborta o comando inteiro. A ordem não muda o resultado.
--
--   Medido em 24/10/2026: 26 incidentes, nenhum sem loja gravada, nenhum com
--   loja diferente da loja da rota; 3 sem rota.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.incidentes_troca_de_rota_pelo_gestor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_loja_origem uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_loja_origem := OLD.unidade_id;
  IF v_loja_origem IS NULL THEN
    SELECT r.unidade_id INTO v_loja_origem
    FROM public.rotas r
    WHERE r.id = OLD.rota_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.usuario_unidades uu
    WHERE uu.unidade_id = v_loja_origem
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

  RAISE EXCEPTION 'O incidente só muda de rota pelo gestor das lojas de origem e de destino.'
    USING ERRCODE = '42501';
END;
$$;

ALTER FUNCTION public.incidentes_troca_de_rota_pelo_gestor() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.incidentes_troca_de_rota_pelo_gestor() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.incidentes_troca_de_rota_pelo_gestor() IS
  'Gatilho BEFORE UPDATE OF rota_id em incidentes: com sessão, a troca para outra rota só vale para gestor ativo da loja de origem do incidente e da loja da rota de destino (Migration 59).';

DROP TRIGGER IF EXISTS trg_incidentes_troca_de_rota_pelo_gestor ON public.incidentes;

CREATE TRIGGER trg_incidentes_troca_de_rota_pelo_gestor
  BEFORE UPDATE OF rota_id ON public.incidentes
  FOR EACH ROW
  WHEN (OLD.rota_id IS DISTINCT FROM NEW.rota_id AND NEW.rota_id IS NOT NULL)
  EXECUTE FUNCTION public.incidentes_troca_de_rota_pelo_gestor();

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- 1. o gatilho, habilitado, com a cláusula WHEN
-- SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid)
--   FROM pg_trigger t
--  WHERE t.tgrelid = 'public.incidentes'::regclass
--    AND t.tgname = 'trg_incidentes_troca_de_rota_pelo_gestor';
-- 2. função: dono postgres, DEFINER, search_path vazio, sem EXECUTE para
--    anon/authenticated
-- SELECT proname, pg_get_userbyid(proowner) AS dono, prosecdef, proconfig,
--        has_function_privilege('anon', oid, 'EXECUTE') AS anon,
--        has_function_privilege('authenticated', oid, 'EXECUTE') AS auth
--   FROM pg_proc WHERE proname = 'incidentes_troca_de_rota_pelo_gestor';
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_incidentes_troca_de_rota_pelo_gestor ON public.incidentes;
-- DROP FUNCTION IF EXISTS public.incidentes_troca_de_rota_pelo_gestor();
-- COMMIT;
