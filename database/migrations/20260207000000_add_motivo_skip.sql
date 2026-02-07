-- Migration: Add motivo_skip column to paradas table
-- Captures structured reason when a stop is skipped (pulada)
-- Values: cliente_ausente, recusa, endereco_incorreto, acesso_bloqueado, renovacao_contrato, outro

ALTER TABLE paradas ADD COLUMN motivo_skip VARCHAR(30);
