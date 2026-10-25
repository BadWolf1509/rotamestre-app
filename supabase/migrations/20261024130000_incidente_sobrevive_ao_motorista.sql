-- ============================================================================
-- Migration 56: o incidente sobrevive à exclusão do motorista (anonimizado)
-- Date: 2026-10-24
-- Author: Wellinton Ribeiro
-- Purpose:
--   `incidentes.motorista_id` era `NOT NULL ... ON DELETE CASCADE`: excluir a
--   conta de um motorista (Edge Function `delete-account`) apagava junto os
--   incidentes que ele reportou — a ocorrência é registro DA LOJA, e a tela
--   `app/exclusao-de-conta.tsx` promete o contrário ("Rotas, comprovantes,
--   ocorrências ... a conta é desvinculada e os registros são anonimizados").
--
--   1. `motorista_id` passa a aceitar NULL e a FK a `ON DELETE SET NULL`.
--      A loja do incidente (`unidade_id`, Migration 43) e a rota ficam: é por
--      `unidade_id` que o gestor continua enxergando o registro.
--
--   2. `incidentes_confere_rota_parada` (Migration 38) recusava o SET NULL: ao
--      mudar `motorista_id` ele reconfere "a rota é deste motorista" e, com
--      NULL, `r.motorista_id = NULL` nunca é verdadeiro — o DELETE do usuário
--      falharia com 42501. Passa a pular a conferência da rota quando o
--      motorista é NULL (desligar nunca é recusado, como já valia para
--      rota e parada). Em compensação, o `NOT NULL` que saiu da coluna volta
--      como regra do INSERT, dentro do próprio gatilho: um CHECK não serve,
--      porque barraria o SET NULL da FK.
--
--   Campos pessoais (a "anonimização" que a tela promete):
--     - `motorista_id`: o vínculo com a pessoa. É o ÚNICO campo que
--       identifica o motorista; vira NULL.
--     - Mantidos, por serem o registro da loja e não dado do motorista:
--       `categoria`, `descricao`, `endereco`, `foto_url`, `status`,
--       `observacoes_gestao`, datas, `rota_id`, `parada_id`, `unidade_id`.
--   Alternativa considerada: apagar/mascarar também `descricao` e `foto_url`.
--   Descartada: a descrição é texto livre escrito para o gestor (o que
--   aconteceu, onde) e a foto é a evidência da ocorrência; sem elas o registro
--   perde a função para a qual a promessa da tela o preserva. Anonimizado =
--   sem ligação com a conta; quem digitou dado pessoal de terceiros no texto
--   livre é caso de pedido de remoção pontual, não de apagar todo incidente.
--
--   Efeito no app: a lista do gestor filtra pela loja (`unidade_id`) e passa a
--   mostrar o incidente sem motorista como "Motorista removido".
--
--   Rollback: ver o bloco comentado no fim. Só é possível voltar o NOT NULL
--   enquanto nenhum incidente tiver sido anonimizado.
--
-- Sonda transacional: database/sondas/20261024130000_sonda_migration56.sql
-- (rodar DEPOIS desta migration, no SQL Editor — tem DELETE de usuário que ela
-- mesma cria; termina em RAISE e desfaz tudo).
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. coluna aceita NULL; FK passa a SET NULL
-- ---------------------------------------------------------------------------
ALTER TABLE public.incidentes
  ALTER COLUMN motorista_id DROP NOT NULL;

ALTER TABLE public.incidentes
  DROP CONSTRAINT IF EXISTS incidentes_motorista_id_fkey;

ALTER TABLE public.incidentes
  ADD CONSTRAINT incidentes_motorista_id_fkey
  FOREIGN KEY (motorista_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.incidentes.motorista_id IS
  'Motorista que reportou. NULL = conta excluída (anonimizado, Migration 56): o incidente fica com a loja. Não é aceito NULL no INSERT (gatilho incidentes_confere_rota_parada).';

-- ---------------------------------------------------------------------------
-- 2. gatilho: aceita o SET NULL e segura o NULL no INSERT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.incidentes_confere_rota_parada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_rota_mudou boolean := true;
  v_parada_mudou boolean := true;
BEGIN
  -- O NOT NULL da coluna saiu (Migration 56) para a FK poder anonimizar; o
  -- incidente NOVO continua exigindo motorista.
  IF TG_OP = 'INSERT' AND NEW.motorista_id IS NULL THEN
    RAISE EXCEPTION 'O incidente precisa de um motorista.'
      USING ERRCODE = '23502';
  END IF;

  -- No UPDATE, cada ligação só é conferida quando muda: a rota pode ser
  -- reatribuída a outro motorista depois, e o incidente antigo continua
  -- editável. E desligar (virar NULL) nunca é recusado: apagar a rota, a
  -- parada ou o motorista dispara o ON DELETE SET NULL das FKs, em ordem não
  -- garantida — recusar ali bloquearia o DELETE.
  IF TG_OP = 'UPDATE' THEN
    v_rota_mudou := NEW.rota_id IS DISTINCT FROM OLD.rota_id
                    OR NEW.motorista_id IS DISTINCT FROM OLD.motorista_id;
    v_parada_mudou := NEW.parada_id IS DISTINCT FROM OLD.parada_id
                      OR (NEW.rota_id IS DISTINCT FROM OLD.rota_id AND NEW.rota_id IS NOT NULL);
  END IF;

  -- Motorista NULL (conta excluída): não há de quem conferir a rota.
  IF v_rota_mudou AND NEW.motorista_id IS NOT NULL AND NEW.rota_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.rotas r
    WHERE r.id = NEW.rota_id
      AND r.motorista_id = NEW.motorista_id
  ) THEN
    RAISE EXCEPTION 'A rota do incidente não é deste motorista.'
      USING ERRCODE = '42501';
  END IF;

  IF v_parada_mudou AND NEW.parada_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.paradas p
    WHERE p.id = NEW.parada_id
      AND p.rota_id = NEW.rota_id
  ) THEN
    RAISE EXCEPTION 'A parada do incidente não pertence à rota informada.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

COMMIT;

-- ============================================================================
-- Roteiro de conferência (só SELECT), depois de aplicar:
--   SELECT is_nullable FROM information_schema.columns
--    WHERE table_name = 'incidentes' AND column_name = 'motorista_id';       -- YES
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'incidentes_motorista_id_fkey';                          -- ... ON DELETE SET NULL
--   SELECT prosrc LIKE '%23502%' AND prosrc LIKE '%motorista_id IS NOT NULL%'
--     FROM pg_proc WHERE proname = 'incidentes_confere_rota_parada';          -- true
-- ============================================================================

-- ROLLBACK (só se nenhum incidente tiver motorista_id NULL):
-- BEGIN;
-- ALTER TABLE public.incidentes DROP CONSTRAINT incidentes_motorista_id_fkey;
-- ALTER TABLE public.incidentes ALTER COLUMN motorista_id SET NOT NULL;
-- ALTER TABLE public.incidentes ADD CONSTRAINT incidentes_motorista_id_fkey
--   FOREIGN KEY (motorista_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;
-- -- e recriar incidentes_confere_rota_parada como na Migration 38
-- COMMIT;
