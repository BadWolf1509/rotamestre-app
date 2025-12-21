-- Migration: Adicionar índices para foreign keys não indexadas
-- Data: 2025-12-20
-- Descrição:
--   Adiciona índices para colunas de FK que não possuem índice,
--   melhorando performance de JOINs e queries com WHERE nessas colunas.
--
-- Referência: Supabase Linter - unindexed_foreign_keys (INFO)

-- ============================================
-- TABELA: notificacoes
-- ============================================

-- Índice para FK incidente_id (referencia incidentes.id)
CREATE INDEX IF NOT EXISTS idx_notificacoes_incidente_id
ON public.notificacoes (incidente_id);

-- Índice para FK parada_id (referencia paradas.id)
CREATE INDEX IF NOT EXISTS idx_notificacoes_parada_id
ON public.notificacoes (parada_id);

-- ============================================
-- TABELA: push_notification_logs
-- ============================================

-- Índice para FK notificacao_id (referencia notificacoes.id)
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_notificacao_id
ON public.push_notification_logs (notificacao_id);

-- Índice para FK usuario_id (referencia usuarios.id)
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_usuario_id
ON public.push_notification_logs (usuario_id);

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Após executar, rode o Linter novamente no Supabase Dashboard
-- para confirmar que os warnings de unindexed_foreign_keys foram resolvidos
