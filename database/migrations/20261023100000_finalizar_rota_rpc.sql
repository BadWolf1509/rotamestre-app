-- ============================================================================
-- Migration 40: RPC finalizar_rota (rota + checkpoint de chegada numa transação)
-- Date: 2026-10-23
-- Author: Wellinton Ribeiro
-- Purpose: o app finalizava a rota em dois UPDATEs do cliente — a rota e,
-- depois, o checkpoint de chegada (com o erro deste ignorado) — e conferia as
-- paradas pendentes só na lista que tinha em memória. Com a consulta de
-- paradas falhando, a lista vinha vazia e a rota aparecia "pronta para
-- finalizar"; nada no banco recusava. Operação de mais de uma linha vira RPC
-- em transação (armadilha do PROJECT_CONTEXT).
--
-- finalizar_rota(p_rota_id):
--   1. quem chama é o motorista da rota: o dono está no WHERE do SELECT que
--      trava a rota, então só a rota própria é travada, e "não existe" e "não
--      é sua" caem no mesmo NOT FOUND (ROTA_NAO_ENCONTRADA, sem revelar rota
--      alheia);
--   2. a rota está 'em_andamento' (trava a linha: FOR NO KEY UPDATE). Se já está
--      'concluida', retorna SEM erro: a resposta da 1ª chamada pode se perder
--      com sinal ruim, e o novo toque não pode virar "erro inesperado";
--   2b. trava as paradas da rota (FOR NO KEY UPDATE) antes de contar: uma parada
--      reaberta ou inserida (inserir_parada mexe na chegada) ao mesmo tempo
--      espera esta transação, e a contagem seguinte já a vê;
--   As travas são FOR NO KEY UPDATE, nunca FOR UPDATE: o INSERT em paradas de
--   inserir_parada pega FOR KEY SHARE na rota pela FK, e FOR UPDATE conflita
--   com KEY SHARE (deadlock gestor-insere x motorista-finaliza). NO KEY UPDATE
--   não conflita com KEY SHARE e basta, porque nenhuma chave muda aqui;
--   3. nenhuma parada REAL (is_checkpoint verdadeiro ou nulo, a convenção do
--      app `p.is_checkpoint !== false` e de notify_rota_concluida) está
--      'pendente' ou 'em_andamento';
--   4. marca o checkpoint de chegada (is_checkpoint = false de maior ordem)
--      como concluído, se ainda não estiver, e a rota como 'concluida' com
--      concluida_em = now().
-- Qualquer falha: RAISE EXCEPTION, e nada muda. Cada mensagem começa por uma
-- sentinela (NAO_AUTENTICADO, ROTA_*) que src/lib/errorMapping.ts traduz para
-- o motorista (guarda: src/lib/__tests__/rpc-finalizar-rota.test.ts).
--
-- SECURITY DEFINER porque o UPDATE de rotas/paradas precisa valer como uma
-- unidade, independente das policies; a guarda é a conferência do passo 1.
-- Os gatilhos existentes (log_rota_status, notify_rota_concluida,
-- log_parada_status) disparam como antes.
-- EXECUTE só para authenticated.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.finalizar_rota(p_rota_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_pendentes integer;
  v_chegada_id uuid;
  v_agora timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO: sessão expirada ao finalizar a rota.'
      USING ERRCODE = '42501';
  END IF;

  -- O dono no WHERE: só a rota própria é travada, e "não existe" e "não é
  -- sua" caem no mesmo NOT FOUND (não revela rota alheia).
  SELECT r.status
    INTO v_status
    FROM public.rotas r
   WHERE r.id = p_rota_id
     AND r.motorista_id = auth.uid()
     FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROTA_NAO_ENCONTRADA: rota não encontrada para este motorista.'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotente: o dono pedindo de novo uma rota já concluída é sucesso.
  IF v_status = 'concluida' THEN RETURN; END IF;

  IF v_status IS DISTINCT FROM 'em_andamento' THEN
    RAISE EXCEPTION 'ROTA_NAO_EM_ANDAMENTO: a rota precisa estar em andamento para ser finalizada (status atual: %).',
      v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Trava as paradas antes de contar (ver 2b no cabeçalho).
  PERFORM 1
     FROM public.paradas p
    WHERE p.rota_id = p_rota_id
      FOR NO KEY UPDATE;

  SELECT count(*)
    INTO v_pendentes
    FROM public.paradas p
   WHERE p.rota_id = p_rota_id
     AND p.is_checkpoint IS DISTINCT FROM false
     AND p.status IN ('pendente', 'em_andamento');

  IF v_pendentes > 0 THEN
    RAISE EXCEPTION 'ROTA_PARADAS_PENDENTES: não é possível finalizar a rota com % parada(s) pendente(s).',
      v_pendentes
      USING ERRCODE = 'P0001';
  END IF;

  SELECT p.id
    INTO v_chegada_id
    FROM public.paradas p
   WHERE p.rota_id = p_rota_id
     AND p.is_checkpoint = false
   ORDER BY p.ordem DESC
   LIMIT 1;

  IF v_chegada_id IS NOT NULL THEN
    UPDATE public.paradas
       SET status = 'concluida',
           concluida_em = v_agora
     WHERE id = v_chegada_id
       AND status IS DISTINCT FROM 'concluida';
  END IF;

  UPDATE public.rotas
     SET status = 'concluida',
         concluida_em = v_agora
   WHERE id = p_rota_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalizar_rota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_rota(uuid) TO authenticated;

COMMENT ON FUNCTION public.finalizar_rota(uuid) IS
  'Finaliza a rota do motorista chamador (idempotente se já concluída): exige em_andamento e nenhuma parada real pendente; conclui o checkpoint de chegada e a rota numa transação (Migration 40).';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.finalizar_rota(uuid);
-- COMMIT;
-- (O app desta versão passa a falhar ao finalizar rota sem a função: reverter
--  a função exige reverter também o completeRoute de useRouteActions.)
