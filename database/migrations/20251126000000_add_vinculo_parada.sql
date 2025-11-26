-- Migration: Adicionar vinculação entre paradas (retirada -> entrega)
-- Permite que uma entrega dependa de uma retirada prévia (mesmo equipamento)
-- Data: 2025-11-26

-- ============================================
-- 1. Adicionar coluna vinculo_parada_id
-- ============================================
ALTER TABLE paradas
ADD COLUMN IF NOT EXISTS vinculo_parada_id UUID REFERENCES paradas(id) ON DELETE SET NULL;

-- Comentário explicativo
COMMENT ON COLUMN paradas.vinculo_parada_id IS
'ID da parada que deve ser executada ANTES desta. Usado para vincular entregas a retiradas do mesmo equipamento.';

-- ============================================
-- 2. Índice para buscas por vínculo
-- ============================================
CREATE INDEX IF NOT EXISTS idx_paradas_vinculo ON paradas(vinculo_parada_id)
WHERE vinculo_parada_id IS NOT NULL;

-- ============================================
-- 3. Constraint para evitar vínculos circulares
-- ============================================
-- Uma parada não pode vincular a si mesma
ALTER TABLE paradas
ADD CONSTRAINT chk_vinculo_not_self
CHECK (vinculo_parada_id IS NULL OR vinculo_parada_id != id);

-- ============================================
-- 4. Função para validar vínculo (mesma rota)
-- ============================================
CREATE OR REPLACE FUNCTION validar_vinculo_parada()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se tem vínculo, verificar se é da mesma rota
  IF NEW.vinculo_parada_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM paradas
      WHERE id = NEW.vinculo_parada_id
      AND rota_id = NEW.rota_id
    ) THEN
      RAISE EXCEPTION 'Parada vinculada deve pertencer à mesma rota';
    END IF;

    -- Verificar se o vínculo é para uma retirada (entrega depende de retirada)
    IF NEW.tipo = 'entrega' THEN
      IF NOT EXISTS (
        SELECT 1 FROM paradas
        WHERE id = NEW.vinculo_parada_id
        AND tipo = 'retirada'
      ) THEN
        RAISE EXCEPTION 'Entrega só pode ser vinculada a uma retirada';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar vínculos
DROP TRIGGER IF EXISTS trg_validar_vinculo_parada ON paradas;
CREATE TRIGGER trg_validar_vinculo_parada
  BEFORE INSERT OR UPDATE OF vinculo_parada_id ON paradas
  FOR EACH ROW
  WHEN (NEW.vinculo_parada_id IS NOT NULL)
  EXECUTE FUNCTION validar_vinculo_parada();

-- ============================================
-- 5. Função para obter ordem respeitando vínculos
-- ============================================
CREATE OR REPLACE FUNCTION obter_paradas_ordenadas(rota_uuid UUID)
RETURNS TABLE(
  id UUID,
  tipo VARCHAR,
  endereco TEXT,
  ordem INTEGER,
  ordem_efetiva INTEGER,
  vinculo_parada_id UUID,
  status VARCHAR
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ordem_atual INTEGER := 1;
  parada_record RECORD;
  vinculada_record RECORD;
BEGIN
  -- Primeiro, retornar paradas sem vínculo (retiradas e entregas independentes)
  -- ordenadas pela ordem original
  FOR parada_record IN
    SELECT p.id, p.tipo, p.endereco, p.ordem, p.vinculo_parada_id, p.status
    FROM paradas p
    WHERE p.rota_id = rota_uuid
    AND p.vinculo_parada_id IS NULL
    ORDER BY p.ordem
  LOOP
    id := parada_record.id;
    tipo := parada_record.tipo;
    endereco := parada_record.endereco;
    ordem := parada_record.ordem;
    ordem_efetiva := ordem_atual;
    vinculo_parada_id := parada_record.vinculo_parada_id;
    status := parada_record.status;
    RETURN NEXT;

    ordem_atual := ordem_atual + 1;

    -- Buscar entregas vinculadas a esta parada (se for retirada)
    IF parada_record.tipo = 'retirada' THEN
      FOR vinculada_record IN
        SELECT p.id, p.tipo, p.endereco, p.ordem, p.vinculo_parada_id, p.status
        FROM paradas p
        WHERE p.vinculo_parada_id = parada_record.id
        ORDER BY p.ordem
      LOOP
        id := vinculada_record.id;
        tipo := vinculada_record.tipo;
        endereco := vinculada_record.endereco;
        ordem := vinculada_record.ordem;
        ordem_efetiva := ordem_atual;
        vinculo_parada_id := vinculada_record.vinculo_parada_id;
        status := vinculada_record.status;
        RETURN NEXT;

        ordem_atual := ordem_atual + 1;
      END LOOP;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. View atualizada com informações de vínculo
-- ============================================
CREATE OR REPLACE VIEW vw_paradas_com_vinculo AS
SELECT
  p.id,
  p.rota_id,
  p.tipo,
  p.endereco,
  p.latitude,
  p.longitude,
  p.ordem,
  p.status,
  p.destinatario,
  p.telefone,
  p.observacoes,
  p.vinculo_parada_id,
  pv.endereco AS vinculo_endereco,
  pv.destinatario AS vinculo_destinatario,
  CASE
    WHEN p.vinculo_parada_id IS NOT NULL THEN true
    ELSE false
  END AS tem_vinculo,
  CASE
    WHEN EXISTS (SELECT 1 FROM paradas WHERE vinculo_parada_id = p.id) THEN true
    ELSE false
  END AS tem_dependentes
FROM paradas p
LEFT JOIN paradas pv ON pv.id = p.vinculo_parada_id;

-- ============================================
-- Mensagem de sucesso
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration vinculo_parada aplicada com sucesso!';
  RAISE NOTICE 'Nova coluna: paradas.vinculo_parada_id';
  RAISE NOTICE 'Nova função: obter_paradas_ordenadas(rota_uuid)';
  RAISE NOTICE 'Nova view: vw_paradas_com_vinculo';
END $$;
