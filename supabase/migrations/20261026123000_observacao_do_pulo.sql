-- ============================================================================
-- Migration 73: observação do pulo em coluna própria
-- (`paradas.observacao_pulo`), sem substituir a observação do gestor
-- Date: 2026-10-26
-- Author: Wellinton Ribeiro
-- Purpose:
--   Hoje o pulo do motorista grava o texto dele em `paradas.observacoes`, a
--   mesma coluna em que o gestor deixa a instrução da parada ("portão azul",
--   "ligar antes"). O texto do pulo substitui a instrução, e a instrução some
--   para o gestor e para o motorista que retomar a parada.
--
--   Medido em 26/10/2026 (só SELECT): 98% das paradas têm texto do gestor em
--   `observacoes` (concluídas 4.492/4.540, pendentes 198/214); das puladas,
--   266/269 têm texto, mistura de instrução do gestor e texto do pulo
--   ("Ficou para amanhã" 16, "Ficou para tarde" 11). Nenhum log guarda o
--   texto anterior, então o passado não se separa: sem backfill.
--
--   Esta migration:
--     1. cria `public.paradas.observacao_pulo text` (nula). O UPDATE de
--        tabela de `authenticated` em `paradas` já cobre a coluna nova (sem
--        privilégio por coluna); anon segue só com SELECT;
--     2. cria o gatilho `trg_paradas_observacao_do_gestor` (BEFORE UPDATE,
--        por linha), com a regra: quem não é gestor ativo da loja da rota não
--        muda `observacoes` (Decisão D4). A função:
--          a. `auth.uid()` nulo (postgres, Edge Function com chave secreta,
--             cron) → deixa passar;
--          b. gestor ativo (`usuario_unidades.papel = 'gestor'`, `ativo`) da
--             loja da rota → deixa passar (o mesmo EXISTS de
--             `paradas_foto_vinculada_preservada`);
--          c. pulo (`status` → 'pulada') que muda `observacoes` sem mexer
--             em `observacao_pulo` (o pedido do app até a 1.14.7 com texto)
--             → o texto mandado em `observacoes` vai para
--             `observacao_pulo`. Fora disso `observacao_pulo` não é tocado:
--             o app 1.14.8 que pula, retoma e pula de novo com o mesmo texto
--             manda `observacao_pulo` igual ao de antes e ele fica; o pulo
--             sem texto do app antigo também deixa o `observacao_pulo` de um
--             pulo anterior como estava (aceito: o texto antigo segue
--             visível, e só existe em parada pulada, retomada e pulada de
--             novo);
--          d. em todos os casos fora de a/b, `observacoes` volta ao valor
--             antigo — sem erro: o UPDATE segue valendo para as outras
--             colunas.
--        O WHEN do gatilho (`observacoes` mudou, ou transição para 'pulada')
--        deixa de fora a conclusão, o avanço para `em_andamento`, a retomada
--        de parada pulada, a troca de ordem e todas as RPCs que mexem em
--        paradas sem tocar em `observacoes` (`inserir_parada`,
--        `reordenar_paradas`, `cancelar_rota`, `reativar_rota`,
--        `finalizar_rota`): nesses UPDATEs a função nem é chamada.
--
--   Ordem dos gatilhos BEFORE UPDATE de `paradas` (alfabética):
--   `trg_paradas_foto_vinculada_preservada` → `trg_paradas_observacao_do_gestor`
--   → `trg_paradas_troca_de_rota_pelo_gestor` →
--   `trg_recusa_editar_local_de_parada_concluida` → `trg_validar_vinculo_parada`
--   → `update_paradas_updated_at`. Nenhum deles lê `observacoes` ou
--   `observacao_pulo`, então a ordem não muda o resultado. Os AFTER
--   (`log_parada_status`, `trigger_notify_parada_pulada`,
--   `trigger_notify_parada_reaberta`) também não leem as duas colunas.
--
--   Alternativas consideradas (compatibilidade com o app instalado):
--     (a) gatilho que redireciona (escolhida): o app instalado — e as ações
--         que estão na fila offline dele — segue pulando sem erro, e a
--         observação do gestor fica;
--     (b) privilégio por coluna (`REVOKE UPDATE (observacoes)` de
--         authenticated): recusaria o UPDATE inteiro do pulo da 1.14.7
--         (42501), a fila descartaria o pulo depois de 60 tentativas, e o
--         gestor perderia a edição pelo mesmo papel;
--     (c) sem gatilho, só o app novo: o texto do gestor segue sendo
--         substituído até cada aparelho atualizar.
--   Alcance da regra:
--     (a) quem não é gestor ativo nunca muda `observacoes` (escolhida, D4):
--         cobre também `completeParada` (sem chamador hoje) e versões antigas;
--         nenhum fluxo do motorista edita a observação do gestor;
--     (b) só na transição para 'pulada': deixaria um UPDATE direto do
--         motorista substituir a instrução fora do pulo.
--   Gatilho sem RAISE: recusar o pulo faria a fila offline do app instalado
--   reenviar e descartar a ação; a regra devolve o valor antigo em silêncio
--   (custo registrado em D4: um cliente que tente editar recebe sucesso sem
--   efeito).
--
--   Efeito no app instalado:
--     - motorista 1.14.6/1.14.7 (e anteriores): o pulo segue funcionando; o
--       texto do pulo vai para `observacao_pulo`; a observação do gestor
--       fica;
--     - gestor em app 1.14.7 instalado: deixa de ver o texto do pulo de rotas
--       novas (a tela dele só lê `observacoes`) até atualizar para a 1.14.8;
--       o painel web passa a mostrar no deploy da Tarefa A3;
--     - ordem de implantação: o app 1.14.8 (web e nativo) grava
--       `observacao_pulo` — esta migration tem de estar aplicada antes do
--       merge do PR do app; sem a coluna, o PostgREST recusa o pulo.
--   Limite registrado: um mesmo texto mandado no pulo pela 1.14.7 igual à
--   observação do gestor não é visto como texto do pulo (`observacoes` não
--   mudou) e `observacao_pulo` fica como estava; a instrução, que é o mesmo
--   texto, continua visível.
--
--   `SET LOCAL lock_timeout = '3s'`: o ADD COLUMN pede ACCESS EXCLUSIVE em
--   `paradas`, tabela de escrita contínua; se a trava não vier em 3 s, a
--   migration para sem efeito e é repetida, em vez de enfileirar as escritas
--   do app atrás dela.
--
--   Função nova: SECURITY DEFINER (lê `usuario_unidades` sem depender da RLS
--   de quem faz o UPDATE), `SET search_path = ''` (nomes qualificados), dono
--   postgres. EXECUTE revogado de PUBLIC, anon e authenticated — o gatilho
--   não precisa de EXECUTE de quem faz o UPDATE.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

ALTER TABLE public.paradas
  ADD COLUMN IF NOT EXISTS observacao_pulo text;

COMMENT ON COLUMN public.paradas.observacao_pulo IS
  'Migration 73: texto que o motorista deixou ao pular a parada. A instrução do gestor fica em observacoes, que só o gestor ativo da loja muda (gatilho trg_paradas_observacao_do_gestor).';

CREATE OR REPLACE FUNCTION public.paradas_observacao_do_gestor()
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
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'pulada'
     AND OLD.status IS DISTINCT FROM 'pulada'
     AND NEW.observacoes IS DISTINCT FROM OLD.observacoes
     AND NEW.observacao_pulo IS NOT DISTINCT FROM OLD.observacao_pulo
  THEN
    NEW.observacao_pulo := NEW.observacoes;
  END IF;

  NEW.observacoes := OLD.observacoes;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.paradas_observacao_do_gestor() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.paradas_observacao_do_gestor() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.paradas_observacao_do_gestor() IS
  'Migration 73: gatilho BEFORE UPDATE de paradas. Quem não é gestor ativo da loja da rota (com sessão) não muda observacoes; no pulo pedido sem observacao_pulo (app até 1.14.7), o texto mandado em observacoes vai para observacao_pulo. Sem erro.';

DROP TRIGGER IF EXISTS trg_paradas_observacao_do_gestor ON public.paradas;
CREATE TRIGGER trg_paradas_observacao_do_gestor
  BEFORE UPDATE ON public.paradas
  FOR EACH ROW
  WHEN (OLD.observacoes IS DISTINCT FROM NEW.observacoes OR (NEW.status = 'pulada' AND OLD.status IS DISTINCT FROM 'pulada'))
  EXECUTE FUNCTION public.paradas_observacao_do_gestor();

COMMIT;

-- ============================================================================
-- Conferência (só SELECT), depois de aplicar:
-- SELECT c.data_type, c.is_nullable,
--        has_column_privilege('authenticated', 'public.paradas', 'observacao_pulo', 'UPDATE') AS auth_update
--   FROM information_schema.columns c
--  WHERE c.table_schema = 'public' AND c.table_name = 'paradas' AND c.column_name = 'observacao_pulo';
-- SELECT pg_get_triggerdef(t.oid), t.tgenabled FROM pg_trigger t
--  WHERE t.tgrelid = 'public.paradas'::regclass AND t.tgname = 'trg_paradas_observacao_do_gestor';
-- SELECT p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS dono, p.proacl
--   FROM pg_proc p WHERE p.oid = to_regprocedure('public.paradas_observacao_do_gestor()');
-- ============================================================================

-- Opcional, fora do rollback: para devolver o texto do pulo a `observacoes`
-- sem apagar a instrução do gestor, rodar sem sessão (postgres):
--   UPDATE public.paradas
--      SET observacoes = concat_ws(' | ', observacoes, 'Pulo: ' || observacao_pulo)
--    WHERE status = 'pulada' AND observacao_pulo IS NOT NULL;
-- A coluna `observacao_pulo` fica no rollback: o app 1.14.8 grava nela, e
-- apagá-la faria o PostgREST recusar o pulo.

-- ROLLBACK:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_paradas_observacao_do_gestor ON public.paradas;
-- DROP FUNCTION IF EXISTS public.paradas_observacao_do_gestor();
-- COMMIT;
