-- ====================================================================
-- SEED DATA PARA TESTES - RotaMestre
-- ====================================================================
-- Este script cria dados de teste para validação do sistema
-- Inclui: 1 unidade, 2 usuários (gestor + motorista), 2 rotas de exemplo
-- ====================================================================

-- ====================================================================
-- 1. CRIAR UNIDADE DE TESTE
-- ====================================================================

INSERT INTO unidades (id, nome, endereco, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Unidade Centro - Teste',
  'Av. Paulista, 1000 - São Paulo, SP',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 2. CRIAR USUÁRIO GESTOR DE TESTE
-- ====================================================================
-- Email: gestor@rotamestre.tec.br
-- Senha: gestor123 (será definida no Supabase Auth)
-- ====================================================================

-- Nota: O auth.users será criado via Supabase Dashboard ou API
-- Este INSERT criará apenas o registro na tabela usuarios

INSERT INTO usuarios (id, nome, email, telefone, papel, unidade_id, ativo, created_at)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'João Silva - Gestor',
  'gestor@rotamestre.tec.br',
  '(11) 98765-4321',
  'gestor',
  '00000000-0000-0000-0000-000000000001',
  true,
  now()
)
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 3. CRIAR USUÁRIO MOTORISTA DE TESTE
-- ====================================================================
-- Email: motorista@rotamestre.tec.br
-- Senha: motorista123 (será definida no Supabase Auth)
-- ====================================================================

INSERT INTO usuarios (id, nome, email, telefone, papel, unidade_id, ativo, created_at)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  'Carlos Santos - Motorista',
  'motorista@rotamestre.tec.br',
  '(11) 97654-3210',
  'motorista',
  '00000000-0000-0000-0000-000000000001',
  true,
  now()
)
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 4. CRIAR ROTA DE TESTE #1 (EM ANDAMENTO)
-- ====================================================================

INSERT INTO rotas (id, motorista_id, unidade_id, data, status, distancia_total, iniciada_em, created_at)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  CURRENT_DATE,
  'em_andamento',
  25.5,
  now() - interval '2 hours',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Paradas da Rota #1
INSERT INTO paradas (id, rota_id, endereco, latitude, longitude, ordem, status, created_at)
VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Rua Augusta, 500 - Consolação, São Paulo - SP',
    -23.5505199,
    -46.6333094,
    1,
    'concluida',
    now()
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    'Av. Brigadeiro Faria Lima, 2000 - Jardim Paulistano, São Paulo - SP',
    -23.5816799,
    -46.6880499,
    2,
    'concluida',
    now()
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000001',
    'Rua Oscar Freire, 800 - Jardins, São Paulo - SP',
    -23.5619,
    -46.6693,
    3,
    'pendente',
    now()
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000001',
    'Av. Rebouças, 3000 - Pinheiros, São Paulo - SP',
    -23.5628,
    -46.6773,
    4,
    'pendente',
    now()
  ),
  (
    '40000000-0000-0000-0000-000000000005',
    '30000000-0000-0000-0000-000000000001',
    'Rua Haddock Lobo, 1500 - Cerqueira César, São Paulo - SP',
    -23.5641,
    -46.6614,
    5,
    'pendente',
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 5. CRIAR ROTA DE TESTE #2 (PENDENTE)
-- ====================================================================

INSERT INTO rotas (id, motorista_id, unidade_id, data, status, distancia_total, created_at)
VALUES (
  '30000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  CURRENT_DATE + interval '1 day',
  'pendente',
  18.3,
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Paradas da Rota #2
INSERT INTO paradas (id, rota_id, endereco, latitude, longitude, ordem, status, created_at)
VALUES
  (
    '40000000-0000-0000-0000-000000000006',
    '30000000-0000-0000-0000-000000000002',
    'Av. Ipiranga, 1000 - República, São Paulo - SP',
    -23.5434,
    -46.6435,
    1,
    'pendente',
    now()
  ),
  (
    '40000000-0000-0000-0000-000000000007',
    '30000000-0000-0000-0000-000000000002',
    'Praça da República, 100 - República, São Paulo - SP',
    -23.5431,
    -46.6429,
    2,
    'pendente',
    now()
  ),
  (
    '40000000-0000-0000-0000-000000000008',
    '30000000-0000-0000-0000-000000000002',
    'Rua 25 de Março, 500 - Centro, São Paulo - SP',
    -23.5445,
    -46.6352,
    3,
    'pendente',
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 6. CRIAR LOGS DE EXEMPLO
-- ====================================================================

INSERT INTO logs (id, usuario_id, rota_id, parada_id, evento, detalhes, created_at)
VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    NULL,
    'Rota iniciada',
    '{"timestamp": "2025-10-20T13:00:00Z", "localizacao": {"lat": -23.5505199, "lng": -46.6333094}}',
    now() - interval '2 hours'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'Parada concluída',
    '{"timestamp": "2025-10-20T13:30:00Z", "observacao": "Entrega realizada com sucesso"}',
    now() - interval '90 minutes'
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    'Parada concluída',
    '{"timestamp": "2025-10-20T14:00:00Z", "observacao": "Cliente ausente, entregue ao porteiro"}',
    now() - interval '60 minutes'
  )
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 7. ATUALIZAR TIMESTAMPS DAS PARADAS CONCLUÍDAS
-- ====================================================================

UPDATE paradas
SET concluida_em = now() - interval '90 minutes'
WHERE id = '40000000-0000-0000-0000-000000000001';

UPDATE paradas
SET concluida_em = now() - interval '60 minutes'
WHERE id = '40000000-0000-0000-0000-000000000002';

-- ====================================================================
-- RESUMO DOS DADOS CRIADOS
-- ====================================================================
--
-- ✅ 1 Unidade: "Unidade Centro - Teste"
-- ✅ 2 Usuários:
--    - Gestor: gestor@rotamestre.tec.br
--    - Motorista: motorista@rotamestre.tec.br
-- ✅ 2 Rotas:
--    - Rota #1: Em andamento (5 paradas, 2 concluídas)
--    - Rota #2: Pendente (3 paradas)
-- ✅ 8 Paradas totais
-- ✅ 3 Logs de atividade
--
-- ====================================================================
-- PRÓXIMOS PASSOS
-- ====================================================================
--
-- 1. Criar usuários no Supabase Auth:
--    - Via Dashboard: Authentication > Users > Add User
--    - Email: gestor@rotamestre.tec.br | Senha: gestor123
--    - Email: motorista@rotamestre.tec.br | Senha: motorista123
--
-- 2. Atualizar os IDs dos usuários:
--    - Após criar no Auth, copiar os UUIDs gerados
--    - Atualizar os IDs neste script e rodar novamente
--
-- 3. Testar login no app:
--    - https://app.rotamestre.tec.br
--    - Login com as credenciais acima
--
-- ====================================================================

COMMIT;
