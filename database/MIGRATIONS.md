# 🗄️ Database Migrations - Rota Mestre

> Histórico consolidado de todas as migrations SQL do projeto

---

## 📋 Como Aplicar uma Migration

### Opção 1: Supabase Dashboard (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql
2. Cole o SQL da migration
3. Execute

### Opção 2: CLI Local

```bash
cd tools/scripts
node apply-migration.js nome-da-migration.sql
```

---

> ⚠️ **Rastreamento (dual-path):** migrations são aplicadas via Dashboard, `tools/scripts/apply-migration.js` ou MCP `apply_migration`. A tabela `supabase_migrations.schema_migrations` rastreia **apenas o subconjunto** aplicado via Supabase CLI/MCP; a maior parte do histórico (~44 arquivos) foi aplicada manualmente e os efeitos estão confirmados no banco. `database/migrations/` é a **fonte canônica**; `supabase/migrations/` é um subconjunto para `supabase db push`. As RPCs `20251224150000_reordenar_paradas_rpc` e `20251224160000_inserir_parada_rpc` foram copiadas de `supabase/` para `database/` em 22/06/2026 para completar o canônico.

---

## 📊 Migrations Aplicadas

### ✅ Migration 1: Coluna `foto_url` em `paradas`

**Data:** 25/10/2025
**Objetivo:** Adicionar suporte para upload de fotos de comprovante de entrega

**SQL:**

```sql
-- Adicionar coluna foto_url para armazenar URL da foto
ALTER TABLE paradas
ADD COLUMN IF NOT EXISTS foto_url TEXT;

COMMENT ON COLUMN paradas.foto_url IS 'URL da foto de comprovante de entrega (Supabase Storage)';
```

**Status:** ✅ Aplicado em produção

---

### ✅ Migration 2: Correção de Security Warnings (Funções)

**Data:** 22/10/2025
**Objetivo:** Corrigir avisos `function_search_path_mutable` do Supabase Database Linter

**Funções corrigidas:**

- `get_user_unidade()`
- `get_user_role()`
- `log_parada_conclusao()`
- `rotas_ativas_motorista()`
- `update_updated_at_column()`
- `estatisticas_rota()`
- `log_rota_status_change()`
- `calcular_distancia()`

**SQL:**

```sql
-- Exemplo de correção (get_user_unidade)
CREATE OR REPLACE FUNCTION get_user_unidade()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ← FIX: Define search_path explicitamente
AS $$
BEGIN
  RETURN (
    SELECT unidade_id
    FROM profiles
    WHERE id = auth.uid()
  );
END;
$$;
```

**Status:** ✅ Aplicado em produção

---

### ✅ Migration 3: Views com SECURITY DEFINER

**Data:** 22/10/2025
**Objetivo:** Corrigir views `vw_rotas_resumo` e `vw_performance_motoristas`

**Problema:** Views com `SECURITY DEFINER` executam com permissões do criador, não do usuário

**Solução:** Remover `SECURITY DEFINER` e confiar no RLS das tabelas base

**SQL:**

```sql
-- Recriar view sem SECURITY DEFINER
CREATE OR REPLACE VIEW vw_rotas_resumo AS
SELECT
  r.id,
  r.data,
  r.status,
  r.motorista_id,
  m.nome as motorista_nome,
  r.distancia_total,
  COUNT(p.id) as total_paradas,
  COUNT(CASE WHEN p.status = 'concluida' THEN 1 END) as paradas_concluidas
FROM rotas r
LEFT JOIN profiles m ON m.id = r.motorista_id
LEFT JOIN paradas p ON p.rota_id = r.id
GROUP BY r.id, r.data, r.status, r.motorista_id, m.nome, r.distancia_total;
```

**Status:** ✅ Aplicado em produção

---

### ⏳ Migration 4: Otimização RLS (InitPlan)

**Data:** Pendente
**Objetivo:** Resolver avisos `auth_rls_initplan` - melhorar performance

**Problema:** `auth.uid()` está sendo chamado para cada linha retornada (lento em queries grandes)

**Solução:** Usar CTEs (Common Table Expressions) para calcular `auth.uid()` uma única vez

**Exemplo:**

```sql
-- ❌ ATUAL (LENTO)
CREATE POLICY "rotas_select" ON rotas
FOR SELECT USING (motorista_id = auth.uid());

-- ✅ OTIMIZADO (RÁPIDO)
CREATE POLICY "rotas_select" ON rotas
FOR SELECT USING (
  motorista_id IN (
    WITH user_id AS (SELECT auth.uid() AS id)
    SELECT id FROM user_id
  )
);
```

**Tabelas afetadas:**

- `rotas` (10 políticas)
- `paradas` (via `rotas`)
- `profiles`

**Status:** ⏳ Pendente (não crítico - melhoria de performance)

---

### ℹ️ Migration 5: PostGIS RLS

**Data:** Opcional
**Objetivo:** Adicionar RLS na tabela `spatial_ref_sys` do PostGIS

**Nota:** Tabela do sistema PostGIS, RLS não é necessário (somente leitura de metadados)

**SQL:**

```sql
-- Adicionar comentário explicativo
COMMENT ON TABLE spatial_ref_sys IS
'PostGIS system table - RLS not required (read-only metadata)';
```

**Status:** ℹ️ Opcional (ignorável)

---

## 🎯 Status Geral

| Tipo             | Quantidade | Status       |
| ---------------- | ---------- | ------------ |
| **Críticas**     | 3          | ✅ Aplicadas |
| **Performance**  | 1          | ⏳ Pendente  |
| **Opcionais**    | 1          | ℹ️ Ignorável |
| **Notificações** | 2          | ✅ Aplicadas |

**Total Aplicado:** 5/7 migrations (71%)
**Avisos Resolvidos:** 13 avisos críticos ✅

---

## 🔍 Troubleshooting

### Funções Duplicadas

Se após aplicar migration ainda aparecem avisos, pode haver funções duplicadas:

```sql
-- Verificar duplicatas
SELECT proname, oid
FROM pg_proc
WHERE proname IN ('get_user_unidade', 'get_user_role', 'calcular_distancia')
ORDER BY proname;

-- Deletar versão antiga (substituir OID)
DROP FUNCTION IF EXISTS get_user_unidade() CASCADE; -- OID antigo
```

### RLS Bloqueando Query

```sql
-- Testar como usuário autenticado
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "user-id-aqui"}';
SELECT * FROM rotas;

-- Ver políticas ativas
SELECT * FROM pg_policies WHERE tablename = 'rotas';
```

### Performance Lenta

Use `EXPLAIN ANALYZE` para ver plano de execução:

```sql
EXPLAIN ANALYZE
SELECT * FROM rotas WHERE motorista_id = auth.uid();
```

---

## 📚 Referências

- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostGIS Documentation](https://postgis.net/documentation/)

---

---

### ✅ Migration 6: Notificação "Nova Rota Atribuída"

**Data:** 19/12/2025
**Arquivo:** `20251219000000_add_nova_rota_notification.sql`
**Objetivo:** Notificar motorista automaticamente quando gestor atribui rota

**Funções criadas:**

- `notify_motorista_nova_rota()` - Trigger para UPDATE (rota atribuída depois)
- `notify_motorista_nova_rota_insert()` - Trigger para INSERT (rota criada com motorista)

**Triggers:**

- `trigger_nova_rota_atribuida` - Dispara no UPDATE de rotas
- `trigger_nova_rota_atribuida_insert` - Dispara no INSERT de rotas

**Tipo de notificação:** `nova_rota_atribuida`

**Status:** ✅ Aplicado em produção

---

### ✅ Migration 7: Expirar Rotas Pendentes de Dias Anteriores

**Data:** 19/12/2025
**Arquivo:** `20251219000001_expire_old_pending_routes.sql`
**Objetivo:** Marcar rotas pendentes de ontem como `nao_executada` e notificar gestor

**Função criada:**

- `expire_old_pending_routes()` - Retorna `expired_count` e `notifications_sent`

**Edge Function:** `supabase/functions/expire-routes/index.ts`
**Cron Job:** GitHub Actions `.github/workflows/expire-routes.yml` (07:00 Brasília)

**Tipo de notificação:** `rota_nao_executada`

**Status:** ✅ Aplicado em produção

---

### 🔧 Migration 8: Corrigir Triggers Duplicados de Log

**Data:** 27/12/2025
**Arquivo:** `20251227000000_fix_duplicate_log_triggers.sql`
**Objetivo:** Remover triggers duplicados que criam logs duplicados de `motorista_iniciou_rota`

**Problema identificado:**
Múltiplos triggers estavam criando logs quando a rota mudava de status, causando duplicidade na timeline.

**Ações:**

1. Remove todos os triggers potencialmente duplicados (`trigger_log_rota_status`, `log_rota_status_change`, etc.)
2. Recria a função `log_rota_status_change()` com a versão correta
3. Cria trigger único `log_rota_status`
4. Adiciona comentários de documentação para evitar duplicidade futura

**Verificação:**
A migration inclui diagnóstico que lista triggers antes e depois da limpeza.

**Status:** ✅ Aplicado em produção (27/12/2025)

---

**Última atualização:** 27/12/2025

### 🔧 Migration 9: Prevenir Logs Duplicados

**Data:** 27/12/2025
**Arquivo:** `20251227000001_prevent_duplicate_logs.sql`
**Objetivo:** Adicionar proteção no nível do banco para prevenir inserção de logs duplicados

**Problema identificado:**
Apesar da Migration 8 ter limpado os triggers, logs duplicados de `motorista_iniciou_rota` continuavam aparecendo. A fonte do segundo log (com `motorista_nome` e `unidade_nome`) não foi identificada no código.

**Solução implementada:**

1. Criar trigger `prevent_duplicate_log_trigger` (BEFORE INSERT) na tabela `logs`
2. Bloquear inserção se já existe log similar nos últimos 5 segundos
3. Log similar = mesmo `rota_id` + mesmo `evento` + mesmo `usuario_id`
4. Limpar logs duplicados existentes

**Verificação:**
Logs de `motorista_iniciou_rota` agora aparecem apenas uma vez por início de rota.

**Status:** ✅ Aplicado em produção (27/12/2025)

---

### ✅ Migration 10: Hardening RLS/RPC Multi-tenant (Segurança)

**Data:** 22/06/2026
**Arquivos:** `20260622183805_security_hardening_multitenant.sql` (database/ + supabase/)
**Objetivo:** Fechar furos multi-tenant exploráveis (validados no banco vivo).

- **C1/C2:** guard de autorização (espelha `paradas_insert`/`paradas_update`) + `SET search_path=''` nas RPCs `inserir_parada`/`reordenar_paradas`; revoga EXECUTE de PUBLIC/anon (mantém authenticated)
- **C4:** revoga EXECUTE de `expire_old_pending_routes`/`remind_pending_routes` de PUBLIC/anon/authenticated (cron usa service_role)
- **A1:** escopa `push_notification_logs` SELECT por unidade
- **A3:** revoga 4 views de anon + `security_invoker` nas 2 views DEFINER (`vw_performance_motoristas`, `admin_dashboard_metrics`)
- **A4:** remove grant INSERT morto de `notificacoes`

**Validação:** security advisor sem `security_definer_view`; teste funcional cross-tenant **negado**, próprio-tenant **OK**.
**Status:** ✅ Aplicado em produção (PR #271)

---

### ✅ Migration 11: Revogar EXECUTE de Funções DEFINER não-públicas (Segurança)

**Data:** 22/06/2026
**Arquivos:** `20260622195500_security_revoke_definer_anon.sql` (database/ + supabase/)
**Objetivo:** Reduzir superfície de funções SECURITY DEFINER executáveis por `anon` (37 → 14).

- 16 trigger functions + 2 de introspecção (`get_all_tables`, `get_table_schema`) + 3 query-funcs legadas (`estatisticas_rota`, `obter_paradas_ordenadas`, `rotas_ativas_motorista`) → revoga de PUBLIC/anon/authenticated
- `criar_notificacao`, `get_gestor_contato` → revoga só PUBLIC/anon (app chama por usuário logado)
- **Mantidos (consciente):** helpers de autorização (usam `auth.uid()`, retornam null p/ anon) e PostGIS

**Status:** ✅ Aplicado em produção (PR #272)

---

**Última atualização:** 22/06/2026
