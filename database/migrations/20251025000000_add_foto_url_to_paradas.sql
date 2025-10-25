-- Migration: Adicionar coluna foto_url na tabela paradas
-- Sprint 1.3 - Upload de Fotos
-- Data: 25/10/2025

-- Adicionar coluna foto_url para armazenar URL da foto de comprovante de entrega
ALTER TABLE paradas
ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Comentário explicativo
COMMENT ON COLUMN paradas.foto_url IS 'URL da foto do comprovante de entrega (Supabase Storage)';

-- Index para buscar paradas com foto (útil para relatórios)
CREATE INDEX IF NOT EXISTS idx_paradas_foto_url
ON paradas(foto_url)
WHERE foto_url IS NOT NULL;

-- Log da migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251025000000: Coluna foto_url adicionada à tabela paradas';
END $$;
