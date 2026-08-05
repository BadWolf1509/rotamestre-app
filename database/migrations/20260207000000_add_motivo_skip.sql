-- Migration: Add motivo_skip column to paradas table
-- Captures structured reason when a stop is skipped (pulada)
-- Values: cliente_ausente, recusa, endereco_incorreto, acesso_bloqueado, renovacao_contrato, outro

-- IF NOT EXISTS acrescentado em 05/08/2026 (auditoria de drift): a coluna já
-- está viva em produção, mas esta migration não tem linha em
-- supabase_migrations.schema_migrations. Sem a guarda, ela era o primeiro
-- arquivo pendente que um `supabase db push` tentaria rodar, e abortava o push
-- inteiro com "column already exists". A alteração é só defensiva — o efeito no
-- banco é o mesmo.
ALTER TABLE paradas ADD COLUMN IF NOT EXISTS motivo_skip VARCHAR(30);
