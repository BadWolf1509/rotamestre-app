-- ============================================
-- Migration 007: Sistema de Notificações e Tracking GPS
-- ============================================

-- 1. Tabela de Notificações
CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  -- Tipos: 'rota_iniciada', 'rota_concluida', 'parada_concluida', 'incidente_reportado', 'rota_atrasada', 'parada_pulada'
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT NOT NULL,
  rota_id UUID REFERENCES rotas(id) ON DELETE CASCADE,
  parada_id UUID REFERENCES paradas(id) ON DELETE SET NULL,
  incidente_id UUID REFERENCES incidentes(id) ON DELETE SET NULL,
  lida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes para notificacoes (criados separadamente)
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_lida ON notificacoes(usuario_id, lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_created ON notificacoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_rota ON notificacoes(rota_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo ON notificacoes(tipo);

-- RLS para notificações
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver suas notificacoes"
  ON notificacoes FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Usuarios podem atualizar suas notificacoes"
  ON notificacoes FOR UPDATE
  USING (auth.uid() = usuario_id);

-- 2. Tabela de Localização dos Motoristas
CREATE TABLE IF NOT EXISTS motorista_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  motorista_id UUID REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  rota_id UUID REFERENCES rotas(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  velocidade DECIMAL(5, 2), -- km/h
  precisao DECIMAL(5, 2), -- metros
  heading DECIMAL(5, 2) -- direção em graus
);

-- Indexes para motorista_locations (criados separadamente)
CREATE INDEX IF NOT EXISTS idx_motorista_locations_motorista ON motorista_locations(motorista_id);
CREATE INDEX IF NOT EXISTS idx_motorista_locations_rota ON motorista_locations(rota_id);
CREATE INDEX IF NOT EXISTS idx_motorista_locations_timestamp ON motorista_locations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_motorista_locations_rota_timestamp ON motorista_locations(rota_id, timestamp DESC);

-- RLS para motorista_locations
ALTER TABLE motorista_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Motoristas podem inserir sua localizacao"
  ON motorista_locations FOR INSERT
  WITH CHECK (auth.uid() = motorista_id);

CREATE POLICY "Gestores podem ver localizacao da sua unidade"
  ON motorista_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u1
      JOIN usuarios u2 ON u1.unidade_id = u2.unidade_id
      WHERE u1.id = auth.uid()
        AND u1.papel = 'gestor'
        AND u2.id = motorista_locations.motorista_id
    )
  );

CREATE POLICY "Motoristas podem ver sua propria localizacao"
  ON motorista_locations FOR SELECT
  USING (auth.uid() = motorista_id);

-- 3. Função para criar notificação genérica
CREATE OR REPLACE FUNCTION criar_notificacao(
  p_usuario_id UUID,
  p_tipo VARCHAR,
  p_titulo VARCHAR,
  p_mensagem TEXT,
  p_rota_id UUID DEFAULT NULL,
  p_parada_id UUID DEFAULT NULL,
  p_incidente_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_notificacao_id UUID;
BEGIN
  INSERT INTO notificacoes (
    usuario_id,
    tipo,
    titulo,
    mensagem,
    rota_id,
    parada_id,
    incidente_id
  ) VALUES (
    p_usuario_id,
    p_tipo,
    p_titulo,
    p_mensagem,
    p_rota_id,
    p_parada_id,
    p_incidente_id
  ) RETURNING id INTO v_notificacao_id;

  RETURN v_notificacao_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger: Notificar quando rota é iniciada
CREATE OR REPLACE FUNCTION notify_rota_iniciada()
RETURNS TRIGGER AS $$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
BEGIN
  -- Quando rota muda de 'pendente' para 'em_andamento'
  IF NEW.status = 'em_andamento' AND OLD.status = 'pendente' THEN
    -- Buscar gestor da unidade
    SELECT id INTO v_gestor_id
    FROM usuarios
    WHERE unidade_id = NEW.unidade_id
      AND papel = 'gestor'
    LIMIT 1;

    -- Buscar nome do motorista
    SELECT nome INTO v_motorista_nome
    FROM usuarios
    WHERE id = NEW.motorista_id;

    IF v_gestor_id IS NOT NULL THEN
      PERFORM criar_notificacao(
        v_gestor_id,
        'rota_iniciada',
        'Rota Iniciada',
        'O motorista ' || COALESCE(v_motorista_nome, 'Não atribuído') || ' iniciou uma rota',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_rota_iniciada ON rotas;
CREATE TRIGGER trigger_notify_rota_iniciada
  AFTER UPDATE ON rotas
  FOR EACH ROW
  EXECUTE FUNCTION notify_rota_iniciada();

-- 5. Trigger: Notificar quando rota é concluída
CREATE OR REPLACE FUNCTION notify_rota_concluida()
RETURNS TRIGGER AS $$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_total_paradas INT;
  v_paradas_concluidas INT;
BEGIN
  -- Quando rota é concluída
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    -- Buscar gestor
    SELECT id INTO v_gestor_id
    FROM usuarios
    WHERE unidade_id = NEW.unidade_id
      AND papel = 'gestor'
    LIMIT 1;

    -- Buscar nome do motorista
    SELECT nome INTO v_motorista_nome
    FROM usuarios
    WHERE id = NEW.motorista_id;

    -- Contar paradas
    SELECT
      COUNT(*) FILTER (WHERE is_checkpoint IS NULL OR is_checkpoint = TRUE),
      COUNT(*) FILTER (WHERE status = 'concluida' AND (is_checkpoint IS NULL OR is_checkpoint = TRUE))
    INTO v_total_paradas, v_paradas_concluidas
    FROM paradas
    WHERE rota_id = NEW.id;

    IF v_gestor_id IS NOT NULL THEN
      PERFORM criar_notificacao(
        v_gestor_id,
        'rota_concluida',
        'Rota Concluída',
        'O motorista ' || COALESCE(v_motorista_nome, 'Não atribuído') ||
        ' finalizou a rota com ' || v_paradas_concluidas || '/' || v_total_paradas || ' paradas concluídas',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_rota_concluida ON rotas;
CREATE TRIGGER trigger_notify_rota_concluida
  AFTER UPDATE ON rotas
  FOR EACH ROW
  EXECUTE FUNCTION notify_rota_concluida();

-- 6. Trigger: Notificar quando parada é pulada
CREATE OR REPLACE FUNCTION notify_parada_pulada()
RETURNS TRIGGER AS $$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_unidade_id UUID;
BEGIN
  -- Quando parada muda para 'pulada'
  IF NEW.status = 'pulada' AND OLD.status != 'pulada' THEN
    -- Buscar unidade_id através da rota
    SELECT r.unidade_id, r.motorista_id, u.nome
    INTO v_unidade_id, v_gestor_id, v_motorista_nome
    FROM rotas r
    LEFT JOIN usuarios u ON u.id = r.motorista_id
    WHERE r.id = NEW.rota_id;

    -- Buscar gestor
    SELECT id INTO v_gestor_id
    FROM usuarios
    WHERE unidade_id = v_unidade_id
      AND papel = 'gestor'
    LIMIT 1;

    IF v_gestor_id IS NOT NULL THEN
      PERFORM criar_notificacao(
        v_gestor_id,
        'parada_pulada',
        'Parada Pulada',
        'O motorista ' || COALESCE(v_motorista_nome, 'Não atribuído') ||
        ' pulou uma parada: ' || NEW.endereco,
        NEW.rota_id,
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_parada_pulada ON paradas;
CREATE TRIGGER trigger_notify_parada_pulada
  AFTER UPDATE ON paradas
  FOR EACH ROW
  EXECUTE FUNCTION notify_parada_pulada();

-- 7. Trigger: Notificar quando incidente é criado
CREATE OR REPLACE FUNCTION notify_incidente_criado()
RETURNS TRIGGER AS $$
DECLARE
  v_gestor_id UUID;
  v_motorista_nome VARCHAR(255);
  v_categoria_label VARCHAR(100);
BEGIN
  -- Buscar gestor através da unidade do motorista
  SELECT u1.id, u2.nome
  INTO v_gestor_id, v_motorista_nome
  FROM usuarios u1
  JOIN usuarios u2 ON u1.unidade_id = u2.unidade_id
  WHERE u1.papel = 'gestor'
    AND u2.id = NEW.motorista_id
    AND u1.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = NEW.motorista_id)
  LIMIT 1;

  -- Label da categoria
  v_categoria_label := CASE NEW.categoria
    WHEN 'accident' THEN 'Acidente/Incidente'
    WHEN 'absent' THEN 'Cliente ausente'
    WHEN 'wrong_address' THEN 'Endereço incorreto'
    WHEN 'blocked' THEN 'Acesso bloqueado'
    WHEN 'vehicle' THEN 'Problema no veículo'
    ELSE 'Outros'
  END;

  IF v_gestor_id IS NOT NULL THEN
    PERFORM criar_notificacao(
      v_gestor_id,
      'incidente_reportado',
      'Incidente Reportado',
      'O motorista ' || COALESCE(v_motorista_nome, 'Não atribuído') ||
      ' reportou: ' || v_categoria_label || ' - ' || SUBSTRING(NEW.descricao, 1, 100),
      NEW.rota_id,
      NULL,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_incidente_criado ON incidentes;
CREATE TRIGGER trigger_notify_incidente_criado
  AFTER INSERT ON incidentes
  FOR EACH ROW
  EXECUTE FUNCTION notify_incidente_criado();

-- 8. Função para limpar localizações antigas (manter apenas últimas 24h)
CREATE OR REPLACE FUNCTION cleanup_old_locations()
RETURNS void AS $$
BEGIN
  DELETE FROM motorista_locations
  WHERE timestamp < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- 9. Comentários
COMMENT ON TABLE notificacoes IS 'Notificações para gestores sobre eventos nas rotas';
COMMENT ON TABLE motorista_locations IS 'Histórico de localização GPS dos motoristas durante rotas';
COMMENT ON FUNCTION criar_notificacao IS 'Função auxiliar para criar notificações de forma padronizada';
COMMENT ON FUNCTION cleanup_old_locations IS 'Remove localizações antigas para manter banco otimizado';

-- Grants
GRANT SELECT, INSERT, UPDATE ON notificacoes TO authenticated;
GRANT SELECT, INSERT ON motorista_locations TO authenticated;
GRANT EXECUTE ON FUNCTION criar_notificacao TO authenticated;
