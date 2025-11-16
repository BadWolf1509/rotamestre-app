-- Adicionar tabela de incidentes ao schema do RotaMestre
-- Execute este script no SQL Editor do Supabase

-- ============================================
-- TABELA: incidentes
-- ============================================
CREATE TABLE IF NOT EXISTS incidentes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rota_id UUID REFERENCES rotas(id) ON DELETE SET NULL,
  parada_id UUID REFERENCES paradas(id) ON DELETE SET NULL,
  motorista_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria VARCHAR(50) NOT NULL CHECK (categoria IN (
    'accident',
    'absent',
    'wrong_address',
    'blocked',
    'vehicle',
    'other'
  )),
  descricao TEXT NOT NULL,
  foto_url TEXT,
  endereco TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_analise', 'resolvido', 'fechado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolvido_em TIMESTAMP WITH TIME ZONE,
  observacoes_gestao TEXT
);

-- Índices para incidentes
CREATE INDEX idx_incidentes_rota ON incidentes(rota_id);
CREATE INDEX idx_incidentes_parada ON incidentes(parada_id);
CREATE INDEX idx_incidentes_motorista ON incidentes(motorista_id);
CREATE INDEX idx_incidentes_status ON incidentes(status);
CREATE INDEX idx_incidentes_categoria ON incidentes(categoria);
CREATE INDEX idx_incidentes_created_at ON incidentes(created_at);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_incidentes_updated_at
  BEFORE UPDATE ON incidentes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View com resumo de incidentes
CREATE OR REPLACE VIEW vw_incidentes_resumo AS
SELECT
  i.id,
  i.categoria,
  i.descricao,
  i.endereco,
  i.status,
  i.foto_url,
  i.created_at,
  u.nome as motorista_nome,
  u.id as motorista_id,
  un.nome as unidade_nome,
  r.id as rota_id,
  r.data as rota_data,
  p.endereco as parada_endereco
FROM incidentes i
JOIN usuarios u ON i.motorista_id = u.id
LEFT JOIN unidades un ON u.unidade_id = un.id
LEFT JOIN rotas r ON i.rota_id = r.id
LEFT JOIN paradas p ON i.parada_id = p.id
ORDER BY i.created_at DESC;

-- Comentário
COMMENT ON TABLE incidentes IS 'Registro de incidentes e problemas reportados pelos motoristas durante as rotas';
COMMENT ON COLUMN incidentes.categoria IS 'Tipo de incidente: accident (acidente), absent (cliente ausente), wrong_address (endereço incorreto), blocked (acesso bloqueado), vehicle (problema no veículo), other (outros)';
COMMENT ON COLUMN incidentes.status IS 'Status do incidente: aberto, em_analise, resolvido, fechado';

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Tabela incidentes criada com sucesso!';
  RAISE NOTICE 'View: vw_incidentes_resumo';
END $$;
