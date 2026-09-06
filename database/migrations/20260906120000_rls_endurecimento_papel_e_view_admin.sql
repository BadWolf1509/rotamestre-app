-- ============================================================================
-- Migration: endurecimento de RLS — view admin, escalonamento de papel,
--            notificações e incidentes_delete legado
-- Date: 2026-09-06
-- Author: Wellinton Ribeiro
-- Purpose:
--   Varredura de 06/09/2026 encontrou quatro buracos confirmados no banco vivo.
--   Os dois primeiros são exploráveis com uma chamada comum do cliente
--   Supabase, sem ferramenta especial.
--
--   A técnica usada aqui em dois dos quatro casos é REVOKE por coluna, e não
--   WITH CHECK. O motivo é uma limitação do Postgres: WITH CHECK enxerga apenas
--   a linha NOVA, então "esta coluna não pode mudar de valor" não é expressável
--   nele. Já é o raciocínio da casa — a nota sobre `unidades` no
--   PROJECT_CONTEXT registra que "RLS não restringe coluna", e lá a saída foi
--   não ter policy de UPDATE. Aqui a saída é o grant.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. `admin_dashboard_metrics` era legível SEM LOGIN
-- ---------------------------------------------------------------------------
-- A view pertence a `postgres` (rolbypassrls) e estava sem `security_invoker`,
-- logo rodava ignorando RLS; e `anon` tinha SELECT. Como a ANON_KEY vai no
-- bundle web, qualquer visitante do site podia ler MRR, churn, taxa de
-- conversão e contagens de TODOS os tenants.
--
-- Isto é reaplicação: `20260622183805_security_hardening_multitenant.sql`
-- (linhas 216-220) já continha estas instruções. As linhas irmãs do mesmo bloco
-- pegaram — `vw_rotas_resumo` e `vw_performance_motoristas` estão com
-- `security_invoker=true` e `anon` negado —, estas duas não. Causa não
-- determinada; por isso vai idempotente.
--
-- Nenhum código deste app consulta a view (conferido): ela é do painel
-- administrativo, projeto separado que acessa por service_role e não é afetado.
ALTER VIEW public.admin_dashboard_metrics SET (security_invoker = true);
REVOKE ALL ON public.admin_dashboard_metrics FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Motorista podia se promover a gestor (e a admin do painel)
-- ---------------------------------------------------------------------------
-- `usuarios_update_optimized` tem USING com o ramo `id = auth.uid()`, que não
-- depende de nenhuma outra coluna. Sem WITH CHECK, o Postgres reusa o USING
-- contra a linha NOVA — e esse ramo aprova qualquer valor novo desde que o `id`
-- não mude. Não havia GRANT de coluna barrando: `papel`, `admin_role`,
-- `unidade_id`, `ativo` e `is_gestor_principal` eram todos graváveis.
--
-- `papel` e `admin_role` NÃO são escritos por nenhum caminho deste app
-- (conferido em src/, app/, supabase/functions/ e scripts/), então revogar é
-- cirúrgico: mata o escalonamento sem quebrar fluxo. `admin_role` é a coluna do
-- painel administrativo, que compartilha este Postgres.
--
-- Quem legitimamente precisa escrever nessas colunas não é afetado: as RPCs
-- SECURITY DEFINER (onboarding) rodam como o definidor, e o painel usa
-- service_role. Os dois ignoram grants de `authenticated`.

-- `unidade_id` continua gravável porque o app escreve nela de verdade
-- (`useUnidadeAtiva.ts:197`, troca de unidade ativa). Mas passa a ser
-- restringida por WITH CHECK ao conjunto de unidades de que a pessoa participa
-- — isso É expressável, porque é propriedade do valor NOVO, não comparação com
-- o antigo. Sem isso, um motorista apontaria a própria `unidade_id` para outro
-- tenant e envenenaria as telas que ainda leem essa coluna legada.
--
-- ATENÇÃO ao alcance: essa restrição vale só para o ramo de auto-edição
-- (abaixo). O ramo gestor→motorista é cópia literal do USING e não menciona
-- unidade_id — um gestor pode gravar qualquer unidade_id na linha de um
-- motorista da sua unidade, inclusive de outro tenant. Não é regressão desta
-- migration (sem WITH CHECK nenhum, já era possível antes), mas não é verdade
-- dizer que o WITH CHECK novo prende unidade_id nos dois ramos — só no
-- primeiro.
DROP POLICY IF EXISTS usuarios_update_optimized ON public.usuarios;

CREATE POLICY usuarios_update_optimized ON public.usuarios
  FOR UPDATE
  USING (
    (id = (SELECT auth.uid()))
    OR (
      (papel)::text = 'motorista'::text
      AND EXISTS (
        SELECT 1
        FROM public.usuario_unidades my_uu
        WHERE my_uu.usuario_id = (SELECT auth.uid())
          AND (my_uu.papel)::text = 'gestor'::text
          AND my_uu.ativo = true
          AND my_uu.unidade_id IN (
            SELECT uu.unidade_id
            FROM public.usuario_unidades uu
            WHERE uu.usuario_id = usuarios.id
              AND uu.ativo = true
          )
      )
    )
  )
  WITH CHECK (
    -- Auto-edição: a unidade apontada tem de ser uma de que a pessoa participa.
    -- `get_my_unidade_ids()` já filtra por `ativo = true`.
    (
      id = (SELECT auth.uid())
      AND (unidade_id IS NULL OR unidade_id IN (SELECT public.get_my_unidade_ids()))
    )
    -- Gestor editando motorista da sua unidade: mesma condição do USING.
    OR (
      (papel)::text = 'motorista'::text
      AND EXISTS (
        SELECT 1
        FROM public.usuario_unidades my_uu
        WHERE my_uu.usuario_id = (SELECT auth.uid())
          AND (my_uu.papel)::text = 'gestor'::text
          AND my_uu.ativo = true
          AND my_uu.unidade_id IN (
            SELECT uu.unidade_id
            FROM public.usuario_unidades uu
            WHERE uu.usuario_id = usuarios.id
              AND uu.ativo = true
          )
      )
    )
  );

COMMENT ON POLICY usuarios_update_optimized ON public.usuarios IS
  'Auto-edição + gestor edita motorista da sua unidade. O WITH CHECK prende unidade_id às unidades do próprio usuário só no ramo de auto-edição — o ramo gestor→motorista copia o USING e não restringe unidade_id. papel, admin_role e is_gestor_principal são protegidos por REVOKE de coluna, porque WITH CHECK não enxerga a linha antiga.';

-- ARMADILHA não prevista no desenho original: WITH CHECK é avaliado contra a
-- linha NOVA INTEIRA em TODO UPDATE, inclusive os que não tocam unidade_id.
-- Consequência: um `UPDATE usuarios SET ultimo_login = now()` (ou push_token,
-- primeira_senha, foto_url — qualquer coluna ainda gravável) passa a exigir
-- que o unidade_id JÁ ARMAZENADO na linha esteja em get_my_unidade_ids(). Uma
-- pessoa cujo usuarios.unidade_id legado não esteja entre os vínculos ATIVOS
-- em usuario_unidades perde a capacidade de escrever QUALQUER COISA no
-- próprio perfil — inclusive o próprio login (`src/lib/auth.ts:80`, que não
-- confere o erro do update, então a falha é silenciosa).
--
-- Medido em 06/09/2026: ZERO usuários nesse estado.
--   SELECT count(*) FROM public.usuarios u
--   WHERE u.unidade_id IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM public.usuario_unidades uu
--                     WHERE uu.usuario_id=u.id AND uu.unidade_id=u.unidade_id AND uu.ativo=true);
--
-- Mas é alcançável por operação normal, não só por corrupção de dado: em
-- `supabase/functions/criar-motorista/index.ts` o INSERT em `usuarios` grava
-- `unidade_id` (linha ~188) e, se o INSERT seguinte em `usuario_unidades`
-- falhar (linha ~214), a função só loga o erro e PROSSEGUE — produzindo
-- exatamente essa linha órfã: unidade_id preenchido, sem vínculo ativo
-- correspondente.
--
-- `is_gestor_principal` entra na lista porque a RPC do item 6 passa a ser a
-- única porta até ela. `anon` também perde: hoje é inofensivo (toda policy
-- depende de `auth.uid()`, nulo para anônimo), mas é a mesma defesa em
-- profundidade que justifica o resto do arquivo.
-- ATENÇÃO — `REVOKE UPDATE (coluna)` sozinho NÃO FUNCIONA aqui. `authenticated`
-- e `anon` têm UPDATE em nível de TABELA nesta tabela, e no Postgres o grant de
-- tabela SUBSUME o de coluna: o REVOKE de coluna vira no-op silencioso e
-- `has_column_privilege` continua devolvendo true.
--
-- Descoberto aplicando: a primeira tentativa devolveu `success: true` e não
-- mudou nada nestas colunas. Só apareceu porque a verificação consulta o
-- EFEITO, não o retorno do apply. O item 3 (notificações) funcionou de primeira
-- justamente porque já usava este padrão.
--
-- As colunas reconcedidas são TODAS as existentes menos as bloqueadas.
-- Deliberadamente não se aproveita para apertar `id`/`created_at`: quebrar uma
-- escrita legítima em silêncio é pior que a folga.
REVOKE UPDATE ON public.usuarios FROM authenticated, anon;
GRANT UPDATE (
  id, nome, email, unidade_id, telefone, ativo, created_at, updated_at,
  primeira_senha, foto_url, ultimo_login, push_token
) ON public.usuarios TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Motorista podia mover a própria rota para outro tenant (pendência 2)
-- ---------------------------------------------------------------------------
-- `rotas_update` não tem WITH CHECK, e o ramo `motorista_id = auth.uid()` não
-- depende de `unidade_id` — então a linha nova recasa no mesmo ramo. Mover a
-- rota leva junto TODAS as paradas (nome, endereço e telefone do destinatário),
-- porque `paradas_select`/`paradas_update` decidem por `rotas.unidade_id`; e
-- como `rotas` está na publicação `supabase_realtime`, o gestor de destino
-- recebe o evento ao vivo.
--
-- O registro da pendência diz que "o fix óbvio quebra o motorista", e está
-- certo sobre o fix óbvio: um WITH CHECK exigindo que o motorista pertença à
-- unidade da rota tira dele a capacidade de iniciar e concluir a própria rota.
--
-- Mas o app NUNCA escreve `rotas.unidade_id` — levantamento em src/ e app/: só
-- `status`, `data`, `iniciada_em`, `concluida_em`, `distancia_total` e
-- `tempo_total`. A unidade nasce em `criar_rota_com_paradas`, que é SECURITY
-- DEFINER e portanto imune a grant. Nenhuma Edge Function toca `rotas`.
-- Mesmo motivo do bloco de `usuarios` acima: revogar a tabela e reconceder as
-- colunas, porque o REVOKE de coluna sozinho é no-op sob grant de tabela.
REVOKE UPDATE ON public.rotas FROM authenticated, anon;
GRANT UPDATE (
  id, motorista_id, data, status, distancia_total, tempo_total, polyline,
  observacoes, created_at, updated_at, iniciada_em, concluida_em,
  client_request_id, otimizacao_estado, otimizacao_distancia_antes,
  otimizacao_distancia_depois, otimizada_em, otimizada_por
) ON public.rotas TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Dono de notificação podia reescrever o conteúdo dela
-- ---------------------------------------------------------------------------
-- `notificacoes_update_optimized` também não tem WITH CHECK e seu USING
-- (`usuario_id = auth.uid()`) não é sensível a coluna nenhuma. O app escreve
-- exatamente um campo — `lida: true`, em NotificationDataContext.tsx:227 — então
-- o grant pode ser reduzido a ele. Revogar tudo e reconceder só `lida` também
-- protege colunas futuras por padrão.
REVOKE UPDATE ON public.notificacoes FROM authenticated, anon;
GRANT UPDATE (lida) ON public.notificacoes TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. `incidentes_delete_optimized` ainda decidia pelo `usuarios` legado
-- ---------------------------------------------------------------------------
-- Era a única policy de `incidentes` ainda apoiada em `usuarios.papel` +
-- `usuarios.unidade_id`; as irmãs `incidentes_select`/`incidentes_update` já
-- usam `usuario_unidades`. Isolado, negava gestor multi-unidade legítimo cuja
-- coluna legada aponta para a outra unidade. Combinado com o item 2, era o
-- gadget que transformava "envenenei minha própria linha em usuarios" em DELETE
-- cross-tenant — apagar incidente de outro franqueado.
--
-- A tradução é fiel de propósito: mantém a base "gestor da unidade DA ROTA" e
-- só troca a fonte da verdade para `usuario_unidades`. Quem pode apagar não
-- muda. (A `incidentes_update` usa outra base — a unidade do autor. A
-- divergência entre as duas é anterior a esta migration e fica registrada como
-- follow-up, em vez de ser resolvida em silêncio aqui.)
DROP POLICY IF EXISTS incidentes_delete_optimized ON public.incidentes;

CREATE POLICY incidentes_delete_optimized ON public.incidentes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuario_unidades uu
      JOIN public.rotas r ON r.id = incidentes.rota_id
      WHERE uu.usuario_id = (SELECT auth.uid())
        AND (uu.papel)::text = 'gestor'::text
        AND uu.ativo = true
        AND uu.unidade_id = r.unidade_id
    )
  );

COMMENT ON POLICY incidentes_delete_optimized ON public.incidentes IS
  'Gestor ativo da unidade da rota. Migrado de usuarios.papel/unidade_id (legado, envenenável) para usuario_unidades em 06/09/2026.';

-- ---------------------------------------------------------------------------
-- 6. Transferência de gestão principal deixava a unidade sem nenhum gestor
-- ---------------------------------------------------------------------------
-- `transferir.tsx` faz dois UPDATE soltos. O segundo, no alvo `papel='gestor'`,
-- JÁ É NEGADO pelo `USING` de `usuarios_update_optimized`, que só libera
-- terceiros quando o alvo é `papel='motorista'`. Sem `.select()`, zero linhas
-- não produz erro: o `if (addError) throw` nunca dispara e a tela mostra
-- "Transferência Concluída!" — mas o passo anterior já tirou o flag do gestor
-- antigo. A unidade fica SEM NENHUM principal, e como só o principal
-- transfere, o estado é irrecuperável pelo app.
--
-- A saída NÃO é alargar a policy: um ramo "principal edita outro gestor"
-- liberaria a LINHA INTEIRA do outro (unidade_id, ativo, foto_url) para
-- consertar um booleano — o erro contra o qual este arquivo inteiro argumenta.
-- E não resolveria o defeito de verdade, que é de atomicidade.
--
-- ATENÇÃO ao escopo do flag: o índice único é
-- `UNIQUE(unidade_id) WHERE is_gestor_principal AND ativo AND papel='gestor'`,
-- sobre a coluna LEGADA `usuarios.unidade_id`. Por isso a RPC exige que as duas
-- pessoas tenham essa coluna apontando para `p_unidade_id` — senão o flag
-- cairia no "slot" de outra unidade, em silêncio.
--
-- Efeito colateral que esta migration abre e não fecha: depois dela não sobra
-- NENHUM caminho de `authenticated` para estabelecer o PRIMEIRO gestor
-- principal de uma unidade. Esta RPC só transfere — exige que quem chama já
-- seja principal —, e `criar_unidade_para_novo_gestor` só liga o flag na
-- criação da unidade, não depois disso.
--
-- Medido em 06/09/2026: NENHUMA das 9 unidades tem gestor principal (0 de 16
-- usuarios com o flag ligado), porque nenhuma delas passou pelo fluxo
-- self-service — o único que liga `is_gestor_principal`. Ou seja, hoje não
-- existe unidade em condições de chamar esta RPC.
--
-- Não é esquecimento, é decisão de produto pendente: o bootstrap do primeiro
-- principal de cada unidade existente vai exigir `service_role` ou uma RPC
-- dedicada de bootstrap — nenhuma das duas existe ainda. E não é regressão: o
-- caminho que esta migration fecha era qualquer gestor se autopromover com um
-- `.update()` direto do cliente contra `usuarios_update_optimized` sem WITH
-- CHECK — o mesmo buraco que o REVOKE do item 2 tapa.
CREATE OR REPLACE FUNCTION public.transferir_gestao_principal(
  p_unidade_id uuid,
  p_novo_gestor_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chamador uuid := auth.uid();
BEGIN
  IF v_chamador IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  IF v_chamador = p_novo_gestor_id THEN
    RAISE EXCEPTION 'O novo gestor principal precisa ser outra pessoa'
      USING ERRCODE = '22023';
  END IF;

  -- Quem chama tem de ser o gestor principal ATIVO desta unidade.
  IF NOT EXISTS (
    SELECT 1
    FROM public.usuario_unidades uu
    JOIN public.usuarios u ON u.id = uu.usuario_id
    WHERE uu.usuario_id = v_chamador
      AND uu.unidade_id = p_unidade_id
      AND uu.papel = 'gestor'
      AND uu.ativo = true
      AND u.ativo = true
      AND u.unidade_id = p_unidade_id
      AND u.is_gestor_principal = true
  ) THEN
    RAISE EXCEPTION 'Só o gestor principal da unidade pode transferir a gestão'
      USING ERRCODE = '42501';
  END IF;

  -- O alvo tem de ser gestor ativo da MESMA unidade.
  IF NOT EXISTS (
    SELECT 1
    FROM public.usuario_unidades uu
    JOIN public.usuarios u ON u.id = uu.usuario_id
    WHERE uu.usuario_id = p_novo_gestor_id
      AND uu.unidade_id = p_unidade_id
      AND uu.papel = 'gestor'
      AND uu.ativo = true
      AND u.ativo = true
      AND u.unidade_id = p_unidade_id
  ) THEN
    RAISE EXCEPTION 'O destinatário precisa ser gestor ativo desta unidade'
      USING ERRCODE = '22023';
  END IF;

  -- Ordem importa: limpar ANTES de conceder, senão o índice único parcial
  -- recusa os dois principais coexistindo por um instante.
  UPDATE public.usuarios SET is_gestor_principal = false WHERE id = v_chamador;
  UPDATE public.usuarios SET is_gestor_principal = true  WHERE id = p_novo_gestor_id;
END;
$$;

REVOKE ALL ON FUNCTION public.transferir_gestao_principal(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transferir_gestao_principal(uuid, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.transferir_gestao_principal(uuid, uuid) IS
  'Transfere is_gestor_principal entre dois gestores ativos da mesma unidade, atomicamente. Existe para não alargar usuarios_update_optimized: RLS não restringe coluna.';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- -- 1. view admin (volta a ser legível por anon — só reverta se algo do painel quebrar)
-- ALTER VIEW public.admin_dashboard_metrics RESET (security_invoker);
-- GRANT SELECT ON public.admin_dashboard_metrics TO anon, authenticated;
--
-- -- 2. usuarios
-- GRANT UPDATE (papel, admin_role) ON public.usuarios TO authenticated;
-- DROP POLICY IF EXISTS usuarios_update_optimized ON public.usuarios;
-- CREATE POLICY usuarios_update_optimized ON public.usuarios FOR UPDATE
--   USING ((id = (SELECT auth.uid())) OR ((papel)::text = 'motorista'::text AND EXISTS (
--     SELECT 1 FROM public.usuario_unidades my_uu
--     WHERE my_uu.usuario_id = (SELECT auth.uid()) AND (my_uu.papel)::text = 'gestor'::text
--       AND my_uu.ativo = true AND my_uu.unidade_id IN (
--         SELECT uu.unidade_id FROM public.usuario_unidades uu
--         WHERE uu.usuario_id = usuarios.id AND uu.ativo = true))));
--
-- -- 3. notificacoes
-- GRANT UPDATE ON public.notificacoes TO authenticated, anon;
--
-- -- 4. incidentes
-- DROP POLICY IF EXISTS incidentes_delete_optimized ON public.incidentes;
-- CREATE POLICY incidentes_delete_optimized ON public.incidentes FOR DELETE
--   USING (EXISTS (SELECT 1 FROM public.usuarios u
--     WHERE u.id = (SELECT auth.uid()) AND (u.papel)::text = 'gestor'::text
--       AND u.unidade_id = (SELECT r.unidade_id FROM public.rotas r WHERE r.id = incidentes.rota_id)));
--
-- -- o rollback tem de devolver o grant de TABELA, nao so as colunas:
-- GRANT UPDATE ON public.usuarios TO authenticated, anon;
-- GRANT UPDATE ON public.rotas TO authenticated, anon;
-- GRANT UPDATE ON public.notificacoes TO anon;
-- DROP FUNCTION IF EXISTS public.transferir_gestao_principal(uuid, uuid);
-- COMMIT;
