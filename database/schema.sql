-- RotaMestre Database Schema
-- Execute este script no SQL Editor do Supabase

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- Para funcionalidades geográficas avançadas (opcional)

-- ============================================
-- 1. TABELA: unidades
-- ============================================
CREATE TABLE IF NOT EXISTS unidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  cidade VARCHAR(100) NOT NULL,
  cnpj VARCHAR(18) UNIQUE NOT NULL,
  endereco TEXT,
  telefone VARCHAR(20),
  email VARCHAR(255),
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para unidades
CREATE INDEX idx_unidades_cnpj ON unidades(cnpj);
CREATE INDEX idx_unidades_ativa ON unidades(ativa);

-- ============================================
-- 2. TABELA: usuarios
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  papel VARCHAR(20) NOT NULL CHECK (papel IN ('gestor', 'motorista')),
  unidade_id UUID REFERENCES unidades(id) ON DELETE SET NULL,
  telefone VARCHAR(20),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para usuarios
CREATE INDEX idx_usuarios_papel ON usuarios(papel);
CREATE INDEX idx_usuarios_unidade ON usuarios(unidade_id);
CREATE INDEX idx_usuarios_email ON usuarios(email);

-- ============================================
-- 3. TABELA: rotas
-- ============================================
CREATE TABLE IF NOT EXISTS rotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  motorista_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada', 'nao_executada')),
  -- Status: pendente (aguardando), em_andamento (executando), concluida (finalizada),
  -- cancelada (pelo gestor), nao_executada (expirou às 22:00 sem conclusão)
  distancia_total DECIMAL(10, 2), -- em quilômetros
  tempo_total INTEGER, -- em minutos
  polyline TEXT, -- Polyline codificada do Google Maps
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  iniciada_em TIMESTAMP WITH TIME ZONE,
  concluida_em TIMESTAMP WITH TIME ZONE
);

-- Índices para rotas
CREATE INDEX idx_rotas_unidade ON rotas(unidade_id);
CREATE INDEX idx_rotas_motorista ON rotas(motorista_id);
CREATE INDEX idx_rotas_status ON rotas(status);
CREATE INDEX idx_rotas_data ON rotas(data);

-- ============================================
-- 4. TABELA: paradas
-- ============================================
CREATE TABLE IF NOT EXISTS paradas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rota_id UUID NOT NULL REFERENCES rotas(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('entrega', 'retirada')),
  endereco TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  ordem INTEGER NOT NULL, -- Ordem na rota otimizada
  status VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'concluida', 'pulada')),
  destinatario VARCHAR(255),
  telefone VARCHAR(20),
  observacoes TEXT,
  foto_comprovante TEXT, -- URL da foto
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  concluida_em TIMESTAMP WITH TIME ZONE,

  -- Constraint para garantir ordem única dentro de uma rota
  UNIQUE(rota_id, ordem)
);

-- Índices para paradas
CREATE INDEX idx_paradas_rota ON paradas(rota_id);
CREATE INDEX idx_paradas_status ON paradas(status);
CREATE INDEX idx_paradas_tipo ON paradas(tipo);
CREATE INDEX idx_paradas_ordem ON paradas(rota_id, ordem);
CREATE INDEX idx_paradas_location ON paradas(latitude, longitude);

-- ============================================
-- 5. TABELA: logs
-- ============================================
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  rota_id UUID REFERENCES rotas(id) ON DELETE SET NULL,
  evento VARCHAR(100) NOT NULL,
  detalhes JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para logs
CREATE INDEX idx_logs_usuario ON logs(usuario_id);
CREATE INDEX idx_logs_rota ON logs(rota_id);
CREATE INDEX idx_logs_timestamp ON logs(timestamp);
CREATE INDEX idx_logs_evento ON logs(evento);

-- ============================================
-- 6. TRIGGERS para updated_at
-- ============================================

-- Função genérica para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para cada tabela
CREATE TRIGGER update_unidades_updated_at
  BEFORE UPDATE ON unidades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rotas_updated_at
  BEFORE UPDATE ON rotas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paradas_updated_at
  BEFORE UPDATE ON paradas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. TRIGGER para log automático de eventos
-- ============================================

-- Trigger para logar mudanças de status de rotas
CREATE OR REPLACE FUNCTION log_rota_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO logs (rota_id, evento, detalhes)
    VALUES (
      NEW.id,
      'status_changed',
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'motorista_id', NEW.motorista_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_rota_status
  AFTER UPDATE ON rotas
  FOR EACH ROW EXECUTE FUNCTION log_rota_status_change();

-- Trigger para logar conclusão de paradas
CREATE OR REPLACE FUNCTION log_parada_conclusao()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status = 'pendente' AND NEW.status = 'concluida') THEN
    INSERT INTO logs (rota_id, evento, detalhes)
    VALUES (
      NEW.rota_id,
      'parada_concluida',
      jsonb_build_object(
        'parada_id', NEW.id,
        'tipo', NEW.tipo,
        'endereco', NEW.endereco,
        'ordem', NEW.ordem
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_parada_status
  AFTER UPDATE ON paradas
  FOR EACH ROW EXECUTE FUNCTION log_parada_conclusao();

-- ============================================
-- 8. FUNÇÕES ÚTEIS
-- ============================================

-- Função para calcular distância entre dois pontos (Haversine)
CREATE OR REPLACE FUNCTION calcular_distancia(
  lat1 DECIMAL, lon1 DECIMAL,
  lat2 DECIMAL, lon2 DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  r DECIMAL := 6371; -- Raio da Terra em km
  dlat DECIMAL;
  dlon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  dlat := RADIANS(lat2 - lat1);
  dlon := RADIANS(lon2 - lon1);

  a := SIN(dlat/2) * SIN(dlat/2) +
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
       SIN(dlon/2) * SIN(dlon/2);

  c := 2 * ATAN2(SQRT(a), SQRT(1-a));

  RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para obter estatísticas de uma rota
CREATE OR REPLACE FUNCTION estatisticas_rota(rota_uuid UUID)
RETURNS TABLE(
  total_paradas INTEGER,
  paradas_concluidas INTEGER,
  paradas_pendentes INTEGER,
  progresso_percentual DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_paradas,
    COUNT(*) FILTER (WHERE status = 'concluida')::INTEGER as paradas_concluidas,
    COUNT(*) FILTER (WHERE status = 'pendente')::INTEGER as paradas_pendentes,
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'concluida')::DECIMAL /
       NULLIF(COUNT(*)::DECIMAL, 0) * 100),
      2
    ) as progresso_percentual
  FROM paradas
  WHERE rota_id = rota_uuid;
END;
$$ LANGUAGE plpgsql;

-- Função para obter rotas ativas de um motorista
CREATE OR REPLACE FUNCTION rotas_ativas_motorista(motorista_uuid UUID)
RETURNS TABLE(
  id UUID,
  unidade_nome VARCHAR,
  data DATE,
  status VARCHAR,
  total_paradas BIGINT,
  paradas_concluidas BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    u.nome as unidade_nome,
    r.data,
    r.status,
    COUNT(p.id) as total_paradas,
    COUNT(p.id) FILTER (WHERE p.status = 'concluida') as paradas_concluidas
  FROM rotas r
  JOIN unidades u ON r.unidade_id = u.id
  LEFT JOIN paradas p ON p.rota_id = r.id
  WHERE r.motorista_id = motorista_uuid
    AND r.status IN ('pendente', 'em_andamento')
  GROUP BY r.id, u.nome, r.data, r.status
  ORDER BY r.data DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. VIEWS ÚTEIS
-- ============================================

-- View com resumo de rotas
CREATE OR REPLACE VIEW vw_rotas_resumo AS
SELECT
  r.id,
  r.data,
  r.status,
  u.nome as unidade_nome,
  usr.nome as motorista_nome,
  r.distancia_total,
  r.tempo_total,
  COUNT(p.id) as total_paradas,
  COUNT(p.id) FILTER (WHERE p.status = 'concluida') as paradas_concluidas,
  COUNT(p.id) FILTER (WHERE p.tipo = 'entrega') as total_entregas,
  COUNT(p.id) FILTER (WHERE p.tipo = 'retirada') as total_retiradas,
  r.created_at,
  r.iniciada_em,
  r.concluida_em
FROM rotas r
JOIN unidades u ON r.unidade_id = u.id
LEFT JOIN usuarios usr ON r.motorista_id = usr.id
LEFT JOIN paradas p ON p.rota_id = r.id
GROUP BY r.id, u.nome, usr.nome;

-- View com KPIs de performance dos motoristas (incluindo taxa de execução)
CREATE OR REPLACE VIEW vw_performance_motoristas AS
SELECT
  u.id,
  u.nome,
  u.unidade_id,
  un.nome as unidade_nome,
  COUNT(r.id) as total_rotas,
  COUNT(r.id) FILTER (WHERE r.status = 'concluida') as rotas_concluidas,
  COUNT(r.id) FILTER (WHERE r.status = 'em_andamento') as rotas_em_andamento,
  COUNT(r.id) FILTER (WHERE r.status = 'nao_executada') as rotas_nao_executadas,
  COUNT(r.id) FILTER (WHERE r.status = 'cancelada') as rotas_canceladas,
  -- Taxa de execução: rotas concluídas / (concluídas + não executadas) * 100
  CASE
    WHEN COUNT(r.id) FILTER (WHERE r.status IN ('concluida', 'nao_executada')) > 0
    THEN ROUND(
      COUNT(r.id) FILTER (WHERE r.status = 'concluida')::DECIMAL * 100 /
      COUNT(r.id) FILTER (WHERE r.status IN ('concluida', 'nao_executada')),
      1
    )
    ELSE 100.0
  END as taxa_execucao,
  SUM(r.distancia_total) as distancia_total_km,
  AVG(r.tempo_total) as tempo_medio_minutos
FROM usuarios u
LEFT JOIN rotas r ON r.motorista_id = u.id
LEFT JOIN unidades un ON u.unidade_id = un.id
WHERE u.papel = 'motorista' AND u.ativo = true
GROUP BY u.id, u.nome, u.unidade_id, un.nome;

-- ============================================
-- 10. DADOS INICIAIS (OPCIONAL)
-- ============================================

-- Inserir unidade de exemplo
INSERT INTO unidades (nome, cidade, cnpj, endereco, ativa)
VALUES
  ('Unidade Central', 'São Paulo', '12.345.678/0001-90', 'Av. Paulista, 1000 - São Paulo, SP', true)
ON CONFLICT (cnpj) DO NOTHING;

-- ============================================
-- FIM DO SCHEMA
-- ============================================

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Schema do RotaMestre criado com sucesso!';
  RAISE NOTICE 'Tabelas: unidades, usuarios, rotas, paradas, logs';
  RAISE NOTICE 'Funções: calcular_distancia, estatisticas_rota, rotas_ativas_motorista';
  RAISE NOTICE 'Views: vw_rotas_resumo, vw_performance_motoristas';
END $$;
