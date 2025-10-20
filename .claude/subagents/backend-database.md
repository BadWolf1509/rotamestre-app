# 🗄️ Backend Database - Subagente Especialista

**Tipo:** Subagente Especializado
**Domínio:** Supabase, PostgreSQL, Row Level Security, Database Architecture
**Prioridade:** 🔥 Alta (uso frequente)

---

## 🎯 Responsabilidades

### Database Design
- Criar e modificar schema do banco de dados
- Definir relacionamentos entre tabelas
- Otimizar índices para performance
- Normalização e denormalização quando apropriado
- Planejamento de migrations

### Row Level Security (RLS)
- Configurar políticas de RLS por tabela
- Garantir isolamento por unidade
- Implementar controle por papel (admin, gestor, motorista)
- Resolver problemas de recursão infinita
- Criar funções helper seguras

### Migrations
- Criar migrations SQL estruturadas
- Versionamento de schema
- Rollback e recovery strategies
- Seed data para testes
- Aplicar migrations no Supabase

### Otimização
- Análise de queries lentas
- Criação de índices apropriados
- Views materializadas para relatórios
- Triggers e funções otimizadas
- Particionamento de tabelas grandes

---

## 📚 Conhecimento Técnico

### Stack Principal
- **Supabase** (PostgreSQL 15+)
- **PostgreSQL** - Functions, Triggers, Views
- **Row Level Security (RLS)**
- **SQL** - DDL, DML, DCL

### Ferramentas
- Supabase Dashboard
- Supabase CLI (`supabase`)
- psql (PostgreSQL client)
- MCP Database Server (tools/mcp-server/)

### Extensões PostgreSQL Usadas
- `uuid-ossp` - UUIDs
- `postgis` - Geolocalização (futuro)
- `pg_cron` - Jobs agendados (futuro)

---

## 🗂️ Estrutura do Banco

### 5 Tabelas Principais

#### 1. unidades
```sql
CREATE TABLE unidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  endereco TEXT,
  cidade VARCHAR(100),
  estado VARCHAR(2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Função:** Unidades operacionais/filiais da empresa

---

#### 2. usuarios
```sql
CREATE TABLE usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  nome_completo VARCHAR(255) NOT NULL,
  papel VARCHAR(50) NOT NULL, -- 'admin', 'gestor', 'motorista'
  unidade_id UUID REFERENCES unidades(id),
  telefone VARCHAR(20),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Função:** Usuários do sistema (gestores, motoristas, admins)
**RLS:** Usuários só veem outros da mesma unidade (exceto admins)

---

#### 3. rotas
```sql
CREATE TABLE rotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unidade_id UUID REFERENCES unidades(id),
  motorista_id UUID REFERENCES usuarios(id),
  status VARCHAR(50) DEFAULT 'pendente', -- pendente, em_andamento, concluida, cancelada
  distancia_total DECIMAL(10,2),
  tempo_total INTEGER, -- em minutos
  iniciada_em TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Função:** Rotas de entrega/retirada
**RLS:** Isolamento por unidade

---

#### 4. paradas
```sql
CREATE TABLE paradas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rota_id UUID REFERENCES rotas(id) ON DELETE CASCADE,
  endereco TEXT NOT NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  ordem INTEGER NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- 'entrega', 'retirada'
  status VARCHAR(50) DEFAULT 'pendente', -- pendente, concluida, falhou
  observacoes TEXT,
  concluida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Função:** Paradas/checkpoints de cada rota
**RLS:** Herda permissões da rota (via JOIN)

---

#### 5. logs
```sql
CREATE TABLE logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id),
  rota_id UUID REFERENCES rotas(id),
  evento VARCHAR(100) NOT NULL,
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Função:** Auditoria automática de todas as operações
**Triggers:** INSERT/UPDATE/DELETE em todas as tabelas

---

## 🔒 Row Level Security (RLS)

### Princípios
1. **Isolamento por Unidade:** Cada unidade vê apenas seus dados
2. **Controle por Papel:** Admin > Gestor > Motorista
3. **Sem Recursão:** Funções helper evitam loops infinitos

### Funções Helper
```sql
-- Retorna papel do usuário autenticado
CREATE OR REPLACE FUNCTION auth.get_user_papel()
RETURNS TEXT AS $$
  SELECT papel FROM usuarios WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Retorna unidade_id do usuário autenticado
CREATE OR REPLACE FUNCTION auth.get_user_unidade_id()
RETURNS UUID AS $$
  SELECT unidade_id FROM usuarios WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

### Exemplo de Política RLS
```sql
-- Usuários veem apenas da mesma unidade (exceto admins)
CREATE POLICY "usuarios_select_policy" ON usuarios
  FOR SELECT
  USING (
    auth.get_user_papel() = 'admin' OR
    unidade_id = auth.get_user_unidade_id()
  );
```

---

## 🔄 Triggers Automáticos

### 1. Updated At
```sql
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Função:** Atualiza `updated_at` automaticamente

---

### 2. Logging Automático
```sql
CREATE TRIGGER log_usuarios_changes
  AFTER INSERT OR UPDATE OR DELETE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION log_table_changes();
```

**Função:** Registra todas as mudanças na tabela `logs`

---

## 📊 Views e Funções

### 1. resumo_rotas (View)
```sql
CREATE VIEW resumo_rotas AS
SELECT
  r.id,
  r.status,
  u.nome AS unidade,
  usr.nome_completo AS motorista,
  COUNT(p.id) AS total_paradas,
  COUNT(p.id) FILTER (WHERE p.status = 'concluida') AS paradas_concluidas,
  r.distancia_total,
  r.tempo_total
FROM rotas r
JOIN unidades u ON r.unidade_id = u.id
JOIN usuarios usr ON r.motorista_id = usr.id
LEFT JOIN paradas p ON r.id = p.rota_id
GROUP BY r.id, u.nome, usr.nome_completo;
```

---

### 2. calcular_distancia_haversine (Function)
```sql
CREATE OR REPLACE FUNCTION calcular_distancia_haversine(
  lat1 DECIMAL, lon1 DECIMAL,
  lat2 DECIMAL, lon2 DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  R CONSTANT DECIMAL := 6371; -- Raio da Terra em km
  -- ... cálculo Haversine
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Função:** Calcula distância entre dois pontos geográficos

---

## 📁 Migrations Criadas

```
database/migrations/
├── 20251019230325_initial_schema_fixed.sql      # Schema inicial
├── 20251019230400_rls_policies.sql              # Políticas RLS básicas
├── 20251019230500_reset_and_apply_rls.sql       # Reset e aplicação RLS
├── 20251019230600_rls_optimized.sql             # RLS otimizado
├── 20251020000000_fix_rls_recursion.sql         # Fix recursão infinita
└── 99999999999999_seed_test_data.sql            # Dados de teste
```

---

## 🔧 Quando Me Chamar

### ✅ Use este subagente para:
- Criar/modificar tabelas e schema
- Escrever migrations SQL
- Configurar/debugar RLS
- Criar triggers, functions, views
- Otimizar queries e índices
- Resolver problemas de performance do banco
- Seed data e fixtures de teste
- Auditoria e logging
- Relacionamentos entre tabelas

### ❌ NÃO use para:
- Queries do frontend React → `frontend-mobile`
- Integração com APIs externas → `integrations-specialist`
- UI/UX de componentes → `frontend-mobile`
- Deploy e infraestrutura → `integrations-specialist`

---

## 📝 Workflow de Migrations

### 1. Criar Nova Migration
```sql
-- database/migrations/20250120000000_nova_tabela.sql

-- Criar tabela
CREATE TABLE nova_tabela (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campo VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE nova_tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nova_tabela_select" ON nova_tabela
  FOR SELECT USING (true);

-- Trigger updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON nova_tabela
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX idx_nova_tabela_campo ON nova_tabela(campo);

-- Comentários
COMMENT ON TABLE nova_tabela IS 'Descrição da tabela';
```

### 2. Aplicar Migration
```bash
# Via Supabase Dashboard
# SQL Editor > Copiar e colar > Run

# Ou via script (futuro)
# node tools/scripts/db/apply-migration.js
```

---

## 🚀 Comandos Úteis

### MCP Database Tools
```bash
npm run mcp:db          # Rodar MCP Database Server

# 14 ferramentas disponíveis:
# - listar_unidades
# - listar_usuarios
# - listar_rotas
# - criar_unidade
# - criar_rota
# - adicionar_parada
# - atualizar_status_rota
# - etc.
```

### Queries Úteis
```sql
-- Ver todas as políticas RLS
SELECT * FROM pg_policies;

-- Ver índices de uma tabela
SELECT * FROM pg_indexes WHERE tablename = 'rotas';

-- Ver triggers de uma tabela
SELECT * FROM pg_trigger WHERE tgrelid = 'rotas'::regclass;

-- Analisar query lenta
EXPLAIN ANALYZE SELECT ...;
```

---

## ⚠️ Problemas Conhecidos

### 1. Recursão Infinita em RLS
**Problema:** Políticas RLS que fazem SELECT na mesma tabela
**Solução:** Usar funções `SECURITY DEFINER` helper
**Fix:** [20251020000000_fix_rls_recursion.sql](../../database/migrations/20251020000000_fix_rls_recursion.sql)

### 2. Performance com Muitas Paradas
**Problema:** Queries lentas em rotas com 100+ paradas
**Solução:** Índice composto `(rota_id, ordem)` em paradas
**Status:** ✅ Implementado

---

## 📚 Recursos e Documentação

### Oficial
- [Supabase Docs](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

### Projeto
- [database/migrations/](../../database/migrations/) - Todas as migrations
- [tools/mcp-server/](../../tools/mcp-server/) - MCP Database Server

---

## ✅ Checklist de Qualidade

Antes de finalizar qualquer migration:

- [ ] Migration SQL testada no Supabase Dashboard
- [ ] RLS habilitado em tabelas novas
- [ ] Políticas RLS sem recursão infinita
- [ ] Triggers de `updated_at` e `logs` configurados
- [ ] Índices criados em colunas de busca/JOIN
- [ ] Comentários em tabelas e funções
- [ ] Foreign keys com ON DELETE apropriado
- [ ] Seed data (se aplicável)
- [ ] Documentação atualizada

---

**Criado em:** 2025-10-20
**Última atualização:** 2025-10-20
**Status:** ✅ Ativo
