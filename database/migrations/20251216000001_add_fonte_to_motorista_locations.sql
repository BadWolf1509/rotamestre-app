-- Migration: Adicionar coluna 'fonte' à tabela motorista_locations
-- Para identificar se a localização veio do foreground (app aberto) ou background (app fechado)

-- Adicionar coluna fonte
ALTER TABLE motorista_locations
ADD COLUMN IF NOT EXISTS fonte VARCHAR(20) DEFAULT 'foreground';

-- Adicionar comentário explicativo
COMMENT ON COLUMN motorista_locations.fonte IS 'Origem do update: foreground (app aberto) ou background (app fechado/minimizado)';

-- Criar índice para consultas por fonte (útil para análises)
CREATE INDEX IF NOT EXISTS idx_motorista_locations_fonte ON motorista_locations(fonte);

-- Criar índice composto para consultas de rota + fonte
CREATE INDEX IF NOT EXISTS idx_motorista_locations_rota_fonte ON motorista_locations(rota_id, fonte);
