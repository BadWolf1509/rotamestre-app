-- ============================================================================
-- Migration 57: foto de comprovante vinculada não é desfeita pelo motorista
-- Date: 2026-10-24
-- Author: Wellinton Ribeiro
-- Purpose:
--   Completa a Migration 50 do lado das tabelas. A Migration 50 preserva no
--   bucket `fotos-entrega` o objeto referenciado por `paradas.foto_url`,
--   `paradas.foto_comprovante` ou `incidentes.foto_url`; esta migration define
--   quem pode mudar essas referências. Dois gatilhos BEFORE UPDATE, um em
--   cada tabela, valem para quem tem sessão (`auth.uid()` não nulo) e NÃO é
--   gestor com vínculo ativo na loja da linha:
--
--   paradas (`foto_url`, `foto_comprovante`, `status`):
--     a. foto preenchida não volta a NULL;
--     b. em parada finalizada (`concluida` ou `pulada`), foto preenchida não é
--        trocada por outra;
--     c. parada finalizada com foto não volta a um status aberto.
--     Continuam valendo: a ligação tardia NULL → valor da fila offline
--     (`subirFotoDaFilaOffline` em `src/lib/storage.ts`, UPDATE condicionado
--     a `foto_url IS NULL`, inclusive em parada já concluída); e a nova foto
--     enquanto a parada está aberta (`uploadELinkFotoParada` grava
--     `foto_url` sem condição: o "Voltar" do `StopCompletionFlow` e a parada
--     reaberta pelo gestor, que mantém a foto anterior, levam a uma segunda
--     foto antes de concluir).
--
--   incidentes (`foto_url`): só NULL → valor. Nenhum fluxo do app troca a
--     foto de um incidente depois de criado.
--
--   O gestor ativo da loja (vínculo `usuario_unidades` ativo, papel gestor,
--   loja da rota da parada ou `incidentes.unidade_id`) segue corrigindo
--   qualquer coisa — é o mesmo critério do ramo de gestor de `paradas_update`
--   e `incidentes_update`, lido de OLD. Sem sessão (chave secreta do painel e
--   das Edge Functions, jobs), nada muda, como em
--   `recusa_apagar_parada_finalizada`.
--
--   Alternativas consideradas:
--     (a) só NULL → valor em qualquer parada — recusaria a nova foto antes de
--         concluir (os dois fluxos acima) e o app apagaria o upload novo;
--     (b) no helper `pode_apagar_foto_entrega`, contar também a foto que já
--         foi referenciada antes — o log `log_parada_status` não carrega o
--         caminho da foto, e não há outra trilha;
--     (c) regra por estado da parada, nos gatilhos (escolhida): a foto é
--         prova a partir da conclusão, e o item c fecha o caminho de reabrir
--         a parada para trocar a foto. Só o gestor reabre parada no app
--         (`useMapaRotaHandlers`); a fila do motorista só atualiza parada
--         aberta (`filaAcoesParada`, `STATUS_ABERTOS`).
--
--   SECURITY DEFINER com `search_path` vazio: a conferência de gestor lê
--   `rotas` e `usuario_unidades` sem depender do RLS de quem atualiza (o
--   mesmo desenho dos demais gatilhos de `paradas`, como
--   `recusa_apagar_parada_finalizada`). Sem EXECUTE para `anon` e
--   `authenticated`: função de gatilho não é chamada direto.
--
--   Ordem: os gatilhos BEFORE de `paradas` e `incidentes` existentes não
--   leem nem gravam estas colunas; a ordem alfabética entre eles não importa.
--   A cláusula WHEN limita a execução às linhas em que algo destas colunas
--   muda de fato.
--
--   Medido em 24/10/2026: 2.186 paradas concluídas e 1 pulada com
--   `foto_url`; nenhuma aberta com foto; `foto_comprovante` vazia em todas.
--   Nenhuma função do banco grava estas colunas.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. paradas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.paradas_foto_vinculada_preservada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_finalizada boolean := OLD.status::text IN ('concluida', 'pulada');
  v_tinha_foto boolean := OLD.foto_url IS NOT NULL OR OLD.foto_comprovante IS NOT NULL;
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
  ) THEN
    RETURN NEW;
  END IF;

  IF (OLD.foto_url IS NOT NULL AND NEW.foto_url IS NULL)
     OR (OLD.foto_comprovante IS NOT NULL AND NEW.foto_comprovante IS NULL)
  THEN
    RAISE EXCEPTION 'FOTO_VINCULADA: a foto de comprovante desta parada não pode ser removida.'
      USING ERRCODE = 'P0001',
            HINT = 'A correção da foto é feita pelo gestor da loja.';
  END IF;

  IF v_finalizada AND (
       (OLD.foto_url IS NOT NULL AND NEW.foto_url IS DISTINCT FROM OLD.foto_url)
    OR (OLD.foto_comprovante IS NOT NULL AND NEW.foto_comprovante IS DISTINCT FROM OLD.foto_comprovante)
    OR (v_tinha_foto AND NEW.status::text NOT IN ('concluida', 'pulada'))
  ) THEN
    RAISE EXCEPTION 'FOTO_VINCULADA: a parada já foi finalizada com foto de comprovante.'
      USING ERRCODE = 'P0001',
            HINT = 'A correção da foto é feita pelo gestor da loja.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.paradas_foto_vinculada_preservada() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.paradas_foto_vinculada_preservada() IS
  'Gatilho BEFORE UPDATE em paradas: para quem não é gestor ativo da loja da rota, foto preenchida não volta a NULL; em parada finalizada, a foto não é trocada e a parada com foto não volta a aberta (Migration 57).';

DROP TRIGGER IF EXISTS trg_paradas_foto_vinculada_preservada ON public.paradas;

CREATE TRIGGER trg_paradas_foto_vinculada_preservada
  BEFORE UPDATE OF foto_url, foto_comprovante, status ON public.paradas
  FOR EACH ROW
  WHEN (
       OLD.foto_url IS DISTINCT FROM NEW.foto_url
    OR OLD.foto_comprovante IS DISTINCT FROM NEW.foto_comprovante
    OR (OLD.status IS DISTINCT FROM NEW.status
        AND OLD.status::text IN ('concluida', 'pulada'))
  )
  EXECUTE FUNCTION public.paradas_foto_vinculada_preservada();

-- ---------------------------------------------------------------------------
-- 2. incidentes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.incidentes_foto_vinculada_preservada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR OLD.foto_url IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.usuario_unidades uu
    WHERE uu.unidade_id = OLD.unidade_id
      AND uu.usuario_id = auth.uid()
      AND uu.ativo = true
      AND uu.papel::text = 'gestor'
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'FOTO_VINCULADA: a foto deste incidente não pode ser removida nem trocada.'
    USING ERRCODE = 'P0001',
          HINT = 'A correção da foto é feita pelo gestor da loja.';
END;
$$;

REVOKE ALL ON FUNCTION public.incidentes_foto_vinculada_preservada() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.incidentes_foto_vinculada_preservada() IS
  'Gatilho BEFORE UPDATE em incidentes: para quem não é gestor ativo da loja do incidente, foto_url só passa de NULL a um valor (Migration 57).';

DROP TRIGGER IF EXISTS trg_incidentes_foto_vinculada_preservada ON public.incidentes;

CREATE TRIGGER trg_incidentes_foto_vinculada_preservada
  BEFORE UPDATE OF foto_url ON public.incidentes
  FOR EACH ROW
  WHEN (OLD.foto_url IS DISTINCT FROM NEW.foto_url)
  EXECUTE FUNCTION public.incidentes_foto_vinculada_preservada();

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- 1. os dois gatilhos, habilitados, com a cláusula WHEN
-- SELECT c.relname, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid)
--   FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
--  WHERE t.tgname IN ('trg_paradas_foto_vinculada_preservada',
--                     'trg_incidentes_foto_vinculada_preservada');
-- 2. funções: DEFINER, search_path vazio, sem EXECUTE para anon/authenticated
-- SELECT proname, prosecdef, proconfig,
--        has_function_privilege('anon', oid, 'EXECUTE') AS anon,
--        has_function_privilege('authenticated', oid, 'EXECUTE') AS auth
--   FROM pg_proc WHERE proname IN ('paradas_foto_vinculada_preservada',
--                                  'incidentes_foto_vinculada_preservada');
-- ============================================================================

-- ROLLBACK:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_paradas_foto_vinculada_preservada ON public.paradas;
-- DROP TRIGGER IF EXISTS trg_incidentes_foto_vinculada_preservada ON public.incidentes;
-- DROP FUNCTION IF EXISTS public.paradas_foto_vinculada_preservada();
-- DROP FUNCTION IF EXISTS public.incidentes_foto_vinculada_preservada();
-- COMMIT;
