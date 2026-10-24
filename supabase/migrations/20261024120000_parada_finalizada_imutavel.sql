-- ============================================================================
-- Migration 53: parada finalizada não se apaga, e a concluída não muda de lugar
-- Date: 2026-10-24
-- Author: Wellinton Ribeiro
-- Purpose: a tela da rota do gestor trabalha com um retrato velho. Se o
-- motorista conclui a parada 3 enquanto o gestor está com a tela aberta, o
-- botão Remover continua lá — e o DELETE passa: a política `paradas_delete`
-- só confere se o gestor é da loja, nunca o status. Resultado: entrega feita,
-- com foto e log, some da rota. Do mesmo jeito, Editar reescreve endereço e
-- tipo de uma parada que já foi entregue (o comprovante passa a apontar para
-- outro lugar). O cliente agora esconde os botões e confere o retorno, mas
-- isso é só o cliente: outra aba, um cliente antigo ou uma chamada direta à
-- API ainda faziam. Estes gatilhos são a trava no banco.
--
-- Regras (valem só com usuário autenticado: `auth.uid()` não nulo):
-- 1. BEFORE DELETE em public.paradas recusa, com a sentinela
--    'PARADA_FINALIZADA' (P0001), apagar parada `concluida` ou `pulada`.
-- 2. BEFORE UPDATE OF endereco, tipo, latitude, longitude recusa, com a
--    sentinela 'PARADA_CONCLUIDA_IMUTAVEL' (P0001), mudar essas colunas numa
--    parada que JÁ está `concluida` (OLD.status). Destinatário, telefone e
--    observações seguem editáveis (não mudam onde nem o que foi entregue);
--    status e ordem não entram: reabrir a parada e a reordenação (RPC) são
--    ações explícitas, e `pulada` pode ter o endereço corrigido para
--    reagendar. Coordenada entra junto com o endereço porque o formulário as
--    grava juntas: trocar só a coordenada mudaria o local sem mudar o texto.
--
-- Cascata: o DELETE de uma ROTA (política `rotas_delete`, gestor da loja) leva
-- as paradas em cascata (FK ON DELETE CASCADE). A rota concluída tem só
-- paradas finalizadas — barrar a cascata impediria excluir qualquer rota
-- feita. Por isso a regra 1 só vale se a rota da parada AINDA existe: na
-- cascata o RI trigger roda depois do DELETE da rota, com snapshot novo, e a
-- rota já não é visível. A trava de rota em andamento é a da Migration 41.
--
-- Sem usuário (`auth.uid()` nulo) segue livre, de propósito: chave secreta /
-- service_role (painel admin, manutenção, Edge Functions) e SQL Editor. Mesma
-- escolha da Migration 41.
--
-- Alternativa descartada: política RESTRICTIVE de DELETE com
-- `status NOT IN ('concluida','pulada')`. (a) Para o DELETE bastaria, mas a
-- RLS recusa sem erro — 0 linhas e `error: null` — então a tela não saberia
-- dizer por quê (precisaria reler a parada para adivinhar); (b) o UPDATE não
-- cabe em política: USING/WITH CHECK só enxergam a linha (a nova, no CHECK),
-- nunca OLD e NEW juntas, então "o endereço mudou" não se expressa — seria
-- preciso congelar a linha toda ou abrir mão da regra; (c) política exige
-- DROP/CREATE POLICY, que o MCP recusa e o SQL Editor pede à mão; (d) a
-- cascata de rota passaria a ser barrada pela política também, e a política
-- não tem como distinguir cascata. Gatilho dá mensagem própria (sentinela),
-- compara OLD e NEW, e fica idempotente com CREATE OR REPLACE TRIGGER.
--
-- SECURITY DEFINER com search_path vazio: tudo qualificado (auth.uid(),
-- public.rotas — o EXISTS precisa enxergar a rota mesmo que a RLS da sessão
-- não deixe). Só os gatilhos chamam; ninguém executa direto.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.recusa_apagar_parada_finalizada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND OLD.status IN ('concluida', 'pulada')
     AND EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = OLD.rota_id)
  THEN
    RAISE EXCEPTION 'PARADA_FINALIZADA: a parada já foi % e não pode ser removida.',
        CASE OLD.status WHEN 'concluida' THEN 'concluída' ELSE 'pulada' END
      USING ERRCODE = 'P0001',
            HINT = 'Paradas finalizadas ficam no histórico da rota.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.recusa_editar_local_de_parada_concluida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND OLD.status = 'concluida'
     AND (   NEW.endereco  IS DISTINCT FROM OLD.endereco
          OR NEW.tipo      IS DISTINCT FROM OLD.tipo
          OR NEW.latitude  IS DISTINCT FROM OLD.latitude
          OR NEW.longitude IS DISTINCT FROM OLD.longitude)
  THEN
    RAISE EXCEPTION 'PARADA_CONCLUIDA_IMUTAVEL: a parada já foi concluída; endereço e tipo não podem mudar.'
      USING ERRCODE = 'P0001',
            HINT = 'Reabra a parada antes de editar o endereço ou o tipo.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recusa_apagar_parada_finalizada() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recusa_editar_local_de_parada_concluida() FROM PUBLIC, anon, authenticated;

-- CREATE OR REPLACE (PG14+) em vez de DROP + CREATE: idempotente sem DROP TRIGGER.
CREATE OR REPLACE TRIGGER trg_recusa_apagar_parada_finalizada
  BEFORE DELETE ON public.paradas
  FOR EACH ROW
  EXECUTE FUNCTION public.recusa_apagar_parada_finalizada();

-- Os nomes `trg_...` ordenam depois de `log_parada_status` etc.; o BEFORE
-- UPDATE OF + WHEN deixa o gatilho de fora de todo UPDATE que não toca no
-- local de uma parada concluída (conclusão, pulo, reordenação, foto).
CREATE OR REPLACE TRIGGER trg_recusa_editar_local_de_parada_concluida
  BEFORE UPDATE OF endereco, tipo, latitude, longitude ON public.paradas
  FOR EACH ROW
  WHEN (OLD.status = 'concluida')
  EXECUTE FUNCTION public.recusa_editar_local_de_parada_concluida();

COMMENT ON FUNCTION public.recusa_apagar_parada_finalizada() IS
  'Recusa (sentinela PARADA_FINALIZADA, P0001) o DELETE de parada concluida/pulada por usuário autenticado, exceto na cascata da exclusão da rota; service_role e SQL Editor seguem livres (Migration 53).';
COMMENT ON FUNCTION public.recusa_editar_local_de_parada_concluida() IS
  'Recusa (sentinela PARADA_CONCLUIDA_IMUTAVEL, P0001) mudar endereco/tipo/latitude/longitude de parada já concluida por usuário autenticado (Migration 53).';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_recusa_apagar_parada_finalizada ON public.paradas;
-- DROP TRIGGER IF EXISTS trg_recusa_editar_local_de_parada_concluida ON public.paradas;
-- DROP FUNCTION IF EXISTS public.recusa_apagar_parada_finalizada();
-- DROP FUNCTION IF EXISTS public.recusa_editar_local_de_parada_concluida();
-- COMMIT;
