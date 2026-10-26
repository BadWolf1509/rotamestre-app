-- ============================================================================
-- Migration 68: motorista_locations — posição gravada em rota em andamento
-- (com margem para a fila offline) e por motorista com cadastro ativo
-- Date: 2026-10-25
-- Author: Wellinton Ribeiro
-- Purpose:
--   A policy de INSERT de `motorista_locations`
--   (`motorista_locations_insert_optimized`) aceita a posição quando
--   `motorista_id` é de quem grava e a rota (se houver) é dele, em qualquer
--   status. Esta migration recria a policy (mesmo nome, `FOR INSERT TO
--   authenticated`) com a regra nova:
--     - cadastro ativo de quem grava (`usuario_atual_ativo()`), também para
--       posição sem rota (`rota_id IS NULL`);
--     - com rota: a rota é de quem grava, com vínculo ativo na loja da rota, e
--       está `em_andamento`, ou `concluida` com o horário da posição
--       (`"timestamp"`, o horário do GPS enviado pelo app) até 10 minutos
--       depois de `concluida_em`.
--   `pendente`, `cancelada` e `nao_executada` recusam. A policy de SELECT
--   (`motorista_locations_select_optimized`) não muda.
--
--   Alternativas consideradas:
--     (a) só `em_andamento`: recusa a trilha do fim da rota que a fila offline
--         do app envia depois de a rota ser concluída (o lote sobe quando a
--         rede volta, e a rota já está `concluida`);
--     (b) `concluida` com margem pelo horário da posição (escolhida): a fila
--         offline sobe a trilha legítima do fim da rota mesmo horas depois,
--         porque o que se compara é quando a posição foi medida;
--     (c) `concluida` com margem por `now()`: recusa a mesma fila offline se
--         ela subir mais de 10 minutos depois da conclusão.
--   Sobre a forma da subconsulta, comparadas:
--     (i) subconsulta direta em `rotas` + `usuario_unidades` (escolhida): sem
--         função nova; ela passa pelo RLS de quem grava (`rotas_select`,
--         `usuario_unidades_select`), mas as condições escritas aqui são as
--         mesmas do ramo do motorista em `rotas_select` (Migration 49) ou mais
--         estritas, então o resultado não depende daquela policy;
--     (ii) helper SECURITY DEFINER, como o `foto_de_rota_minha` da Migration
--         65: lá ele existe para conferir o formato do path antes do cast;
--         aqui não há cast, e uma função a mais seria só manutenção.
--
--   Medido em 25/10/2026 (só SELECT, posições dos últimos 7 dias): 11.569 em
--   rota `em_andamento` e 6.264 em rota `concluida`; destas, 137 com horário
--   do GPS depois de `concluida_em` e 118 mais de 10 minutos depois (passam a
--   ser recusadas); 0 em rota `pendente`, `cancelada` ou `nao_executada`; 0
--   sem rota; 0 de cadastro inativo.
--
--   Limites:
--     - O `"timestamp"` vem do aparelho. A margem confia no horário do GPS
--       enviado pelo app, como o restante do rastreamento.
--     - Posição com `"timestamp"` NULL explícito só é aceita em rota
--       `em_andamento` (a comparação da margem não casa). O app sempre envia o
--       horário; sem a coluna no INSERT, vale o default `now()`.
--     - `rota_id IS NULL` segue aceito (com cadastro ativo): o app sempre
--       envia a rota, e manter evita mudar o que não foi medido.
--
--   Efeito no app (1.14.5/1.14.6): o único INSERT é
--   `src/lib/motorista/filaPosicoes.ts` (envio da fila). Recusa por RLS
--   (42501) já é tratada lá: o lote daquela rota conta uma tentativa, fica no
--   máximo `MAX_TENTATIVAS_POSICAO` (60) vezes e não bloqueia o envio das
--   outras rotas, com `logger.error` ao descartar. O rastreamento começa
--   depois de a rota virar `em_andamento`
--   (`src/hooks/route-status/useRouteActions.ts`), então o início da rota é
--   aceito. Na versão que segue rastreando depois de concluir, as posições
--   além da margem passam a ser recusadas e descartadas pela fila; o gestor
--   deixa de ver o motorista se movendo em rota concluída. Nenhuma mudança de
--   código.
--
--   Policy: DROP + CREATE dentro da transação. Nome mantido,
--   `TO authenticated`. O painel e as Edge Functions usam a chave secreta, que
--   ignora RLS.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS motorista_locations_insert_optimized ON public.motorista_locations;

CREATE POLICY motorista_locations_insert_optimized ON public.motorista_locations
  FOR INSERT TO authenticated
  WITH CHECK (
    motorista_id = (SELECT auth.uid())
    AND (SELECT public.usuario_atual_ativo())
    AND (
      rota_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.rotas r
          JOIN public.usuario_unidades uu ON uu.unidade_id = r.unidade_id
         WHERE r.id = motorista_locations.rota_id
           AND r.motorista_id = (SELECT auth.uid())
           AND uu.usuario_id = (SELECT auth.uid())
           AND uu.ativo = true
           AND (
             r.status = 'em_andamento'
             OR (r.status = 'concluida'
                 AND motorista_locations."timestamp" <= r.concluida_em + interval '10 minutes')
           )
      )
    )
  );

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- 1. a policy de INSERT exige cadastro ativo e tem a margem pela conclusão
-- SELECT policyname, cmd, roles,
--        with_check ILIKE '%usuario_atual_ativo%' AS cadastro_ativo,
--        with_check ILIKE '%concluida_em%' AS margem,
--        with_check ILIKE '%now()%' AS usa_relogio
--   FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'motorista_locations'
--  ORDER BY 1;
-- 2. posições recusadas pela regra nova nos últimos 7 dias (para comparar
--    com a medição de 25/10 depois de alguns dias de uso)
-- SELECT r.status, count(*)
--   FROM public.motorista_locations ml JOIN public.rotas r ON r.id = ml.rota_id
--  WHERE ml."timestamp" >= now() - interval '7 days'
--  GROUP BY 1;
-- ============================================================================

-- ROLLBACK:
-- -- Policy no estado vivo de 25/10/2026 (pg_policies antes desta migration).
-- BEGIN;
-- DROP POLICY IF EXISTS motorista_locations_insert_optimized ON public.motorista_locations;
-- CREATE POLICY motorista_locations_insert_optimized ON public.motorista_locations
--   FOR INSERT TO authenticated
--   WITH CHECK ((motorista_id = ( SELECT auth.uid() AS uid)) AND ((rota_id IS NULL) OR (EXISTS ( SELECT 1
--    FROM rotas r
--   WHERE ((r.id = motorista_locations.rota_id) AND (r.motorista_id = ( SELECT auth.uid() AS uid)))))));
-- COMMIT;
