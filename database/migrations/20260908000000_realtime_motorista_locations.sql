-- ============================================================================
-- Migration: publicar motorista_locations no realtime
-- Date: 2026-09-08
-- Author: Wellinton Ribeiro
-- Purpose:
--   O gestor nunca viu o motorista se mover. `useMotoristaLocationMapLibre` e
--   `MotoristaMarker` assinam `postgres_changes` de INSERT em
--   `motorista_locations`, mas a tabela NUNCA esteve na publicação
--   `supabase_realtime` — que tem apenas `notificacoes`, `paradas` e `rotas`.
--
--   Assinatura em tabela fora da publicação é uma falha silenciosa exemplar: o
--   canal conecta, entra em SUBSCRIBED, e nenhum evento chega nunca. Sem erro,
--   sem log, sem sintoma no cliente.
--
--   O que salvava as aparências é que os dois componentes fazem um SELECT
--   inicial (`order by timestamp desc limit 1`) ao montar. O gestor abre o mapa
--   e vê o motorista lá — só que o marcador congela e nunca mais anda. Por isso
--   passou despercebido: só nota quem fica olhando a tela enquanto o motorista
--   dirige.
--
--   Vale igualmente para posição de primeiro e de segundo plano: não é um
--   problema de background. É "Rastreamento em Tempo Real", que a landing page
--   anuncia, entregando na verdade "posição do instante em que você abriu a
--   tela".
-- ============================================================================

-- 1. Publicação
--
-- Idempotente de propósito: `ALTER PUBLICATION ... ADD TABLE` falha se a tabela
-- já estiver publicada, e esta migration precisa poder ser reaplicada — o
-- histórico deste projeto tem drift entre `database/migrations` e o que o banco
-- registrou (ver a seção de drift em MIGRATIONS.md).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'motorista_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.motorista_locations;
  END IF;
END $$;

-- 2. Sem mudança de RLS, e isso é o ponto de segurança
--
-- `motorista_locations` já tem RLS habilitado e uma policy de SELECT:
--
--   motorista_id = auth.uid()
--   OR EXISTS (motorista pertence a unidade ativa em get_my_unidade_ids())
--
-- O Realtime do Supabase aplica essa MESMA policy ao entregar `postgres_changes`
-- — cada assinante só recebe a linha que já poderia ler por SELECT. Publicar,
-- portanto, não alarga o alcance de ninguém: o gestor passa a receber ao vivo
-- exatamente as posições que a tela dele já buscava por consulta.
--
-- E a postura é idêntica à das três tabelas já publicadas: `paradas`, `rotas` e
-- `notificacoes` também têm RLS habilitado com policy de SELECT. `replica
-- identity` fica em `default` (a PK), igual a `paradas` e `rotas`; só há
-- assinatura de INSERT, e INSERT carrega a linha nova inteira de qualquer forma.
--
-- NÃO se está publicando dado novo: a tabela já era legível pelo cliente com a
-- ANON_KEY sob RLS. O que muda é o transporte — de "consulta ao abrir a tela"
-- para "evento quando a linha nasce".
--
-- COMO ISSO FOI VERIFICADO, e não assumido da documentação: lendo o corpo de
-- `realtime.apply_rls` implantado neste projeto (`pg_get_functiondef`). Antes
-- de decidir quem recebe cada linha, ela executa
-- `set_config('role', <role do assinante>)` e
-- `set_config('request.jwt.claims', <claims do assinante>)` e só então roda
-- `SELECT EXISTS(SELECT 1 FROM motorista_locations WHERE id = <pk do WAL>)`.
-- É a policy nativa da tabela que responde — não existe regra de acesso
-- separada para o realtime.
--
-- ⚠️ LIMITE QUE ISSO **NÃO** COBRE: DELETE.
-- No mesmo `apply_rls`, o ramo `if not is_rls_enabled or action = 'DELETE'`
-- entrega a linha a QUALQUER assinatura cujo filtro de cliente case, SEM
-- checar RLS. Hoje é inerte, porque as duas únicas assinaturas desta tabela
-- (`useMotoristaLocationMapLibre` e `MotoristaMarker`) são `event: 'INSERT'`.
-- Trocar por `'DELETE'` ou `'*'` desligaria o filtro de tenant em silêncio.
-- Por isso existe a guarda `src/lib/__tests__/realtime-motorista-locations-somente-insert.test.ts`:
-- o invariante é do código do cliente, então é lá que ele é vigiado.

-- 3. Documentação
COMMENT ON TABLE public.motorista_locations IS
  'Posições do motorista durante a rota (fonte: foreground | background). '
  'Publicada em supabase_realtime desde 08/09/2026 para o acompanhamento ao '
  'vivo do gestor; a entrega respeita a policy de SELECT da própria tabela.';

-- ROLLBACK:
-- BEGIN;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.motorista_locations;
-- COMMIT;
--
-- Reverter devolve o comportamento anterior: o mapa do gestor volta a mostrar
-- só a posição do momento em que a tela montou.
