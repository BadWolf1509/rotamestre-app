-- ============================================
-- Migration: Adicionar métricas de rotas expiradas à view de performance
-- Data: 2025-12-21
-- Descrição:
--   Atualiza vw_performance_motoristas para incluir:
--   - rotas_nao_executadas: quantidade de rotas que expiraram
--   - rotas_canceladas: quantidade de rotas canceladas
--   - taxa_execucao: percentual de rotas concluídas vs total finalizadas
--
--   Isso permite ao gestor identificar motoristas com muitas rotas expiradas.
-- ============================================

-- Dropar view existente (necessário para alterar colunas)
DROP VIEW IF EXISTS vw_performance_motoristas CASCADE;

-- Recriar a view com novas métricas
CREATE VIEW vw_performance_motoristas AS
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
  -- Retorna 100% se não há rotas finalizadas (evita divisão por zero)
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

-- Comentário para documentação
COMMENT ON VIEW vw_performance_motoristas IS 'KPIs de performance dos motoristas incluindo taxa de execução de rotas';

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Após executar, verifique as novas colunas:
-- SELECT id, nome, rotas_concluidas, rotas_nao_executadas, taxa_execucao FROM vw_performance_motoristas;
