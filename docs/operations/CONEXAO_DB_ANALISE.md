# 🔍 Análise de Conexão ao Banco de Dados

## 📊 Resumo das Tentativas

Foram testadas **8 configurações diferentes** para conectar ao banco de dados via terminal, todas falharam.

---

## ❌ Tentativas Realizadas

### 1. PostgreSQL Client com SERVICE_ROLE_KEY
**Arquivo:** `apply-rls-fix.js`
- **Connection String:** `postgresql://postgres.${projectRef}:${SERVICE_ROLE_KEY}@pooler:6543/postgres`
- **Resultado:** ❌ `Tenant or user not found`
- **Motivo:** SERVICE_ROLE_KEY não é aceito como senha PostgreSQL

### 2. Supabase CLI `db push`
**Comando:** `npx supabase db push --db-url "..."`
- **Connection String:** Mesma do item 1
- **Resultado:** ❌ `Tenant or user not found`
- **Motivo:** CLI também rejeita SERVICE_ROLE_KEY como senha

### 3. Conexão Direta ao DB (porta 5432)
**Arquivo:** `apply-rls-fix-direct.js`
- **Host:** `db.xezslsyxjivunmhhyxtd.supabase.co:5432`
- **User:** `postgres`
- **Password:** `${SERVICE_ROLE_KEY}`
- **Resultado:** ❌ `getaddrinfo ENOTFOUND`
- **Motivo:** Hostname não resolve (DNS)

### 4. Pooler com SERVICE_ROLE_KEY (porta 5432)
**Arquivo:** `apply-rls-fix-pooler.js`
- **Host:** `aws-0-us-east-1.pooler.supabase.com:5432`
- **User:** `postgres.${projectRef}`
- **Password:** `${SERVICE_ROLE_KEY}`
- **Resultado:** ❌ `Tenant or user not found`
- **Motivo:** SERVICE_ROLE_KEY não é senha PostgreSQL

### 5. Pooler com DATABASE_PASSWORD (porta 6543)
**Arquivo:** `apply-rls-with-password.js`
- **Host:** `aws-0-us-east-1.pooler.supabase.com:6543`
- **User:** `postgres`
- **Password:** `${SUPABASE_DB_PASSWORD}` (da .env)
- **Resultado:** ❌ `Tenant or user not found`
- **Motivo:** User precisa ser qualificado ou credenciais incorretas

### 6. Direct DB com DATABASE_PASSWORD (porta 5432)
**Arquivo:** `apply-rls-direct-db.js` (config 1)
- **Host:** `db.xezslsyxjivunmhhyxtd.supabase.co:5432`
- **User:** `postgres`
- **Password:** `${SUPABASE_DB_PASSWORD}`
- **Resultado:** ❌ `getaddrinfo ENOTFOUND`
- **Motivo:** Hostname não existe ou não é acessível

### 7. Direct DB com DATABASE_PASSWORD (porta 6543)
**Arquivo:** `apply-rls-direct-db.js` (config 2)
- **Host:** `db.xezslsyxjivunmhhyxtd.supabase.co:6543`
- **User:** `postgres`
- **Password:** `${SUPABASE_DB_PASSWORD}`
- **Resultado:** ❌ `getaddrinfo ENOTFOUND`
- **Motivo:** Hostname não resolve

### 8. Pooler com user qualificado e DATABASE_PASSWORD
**Arquivo:** `apply-rls-direct-db.js` (config 3)
- **Host:** `aws-0-us-east-1.pooler.supabase.com:6543`
- **User:** `postgres.xezslsyxjivunmhhyxtd`
- **Password:** `${SUPABASE_DB_PASSWORD}`
- **Resultado:** ❌ `Tenant or user not found`
- **Motivo:** Credenciais ou formato de user incorreto

---

## 🔍 Análise dos Resultados

### Problemas Identificados:

1. **Hostname `db.*` não resolve**
   - DNS não retorna endereço para `db.xezslsyxjivunmhhyxtd.supabase.co`
   - Supabase pode ter desabilitado acesso direto ao banco

2. **Pooler rejeita todas as credenciais**
   - Tanto SERVICE_ROLE_KEY quanto DATABASE_PASSWORD falham
   - Erro: "Tenant or user not found"

3. **Formato de autenticação desconhecido**
   - Supabase pode usar autenticação proprietária
   - Credenciais via `.env` podem não ser as corretas para PostgreSQL direto

### Possíveis Causas:

1. **Acesso direto desabilitado**
   - Supabase free tier pode não permitir conexão PostgreSQL direta
   - Requer upgrade de plano ou configuração específica

2. **Credenciais incorretas**
   - `SUPABASE_DB_PASSWORD` no `.env` pode ser placeholder
   - Senha real pode estar no Dashboard do Supabase

3. **Firewall ou restrição de IP**
   - Conexões podem estar bloqueadas por origem
   - Requer whitelist de IP no Dashboard

---

## ✅ Solução Definitiva

### Por que o Dashboard funciona?

O **SQL Editor do Supabase Dashboard** funciona porque:

1. ✅ Usa autenticação web (OAuth/Session)
2. ✅ Executa queries via API interna autorizada
3. ✅ Não precisa de credenciais PostgreSQL
4. ✅ Não está sujeito a firewall de IP
5. ✅ Sempre disponível em todos os planos

### Como aplicar via Dashboard:

```
1. Abrir: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql/new
2. Copiar: database/migrations/20251020000000_fix_rls_recursion.sql
3. Colar no editor
4. Clicar em "Run" ▶️
5. Aguardar sucesso
```

---

## 📁 Arquivos Criados Durante a Investigação

Total de **7 scripts de teste** criados:

1. `tools/scripts/db/fix-rls.js` - Script inicial de instruções
2. `tools/scripts/db/apply-rls-fix.js` - Tentativa via pg client
3. `tools/scripts/db/apply-rls-fix-v2.js` - Tentativa via API REST
4. `tools/scripts/db/apply-rls-fix-direct.js` - Tentativa conexão direta
5. `tools/scripts/db/apply-rls-fix-pooler.js` - Tentativa via pooler
6. `tools/scripts/db/apply-rls-with-password.js` - Usando DB_PASSWORD
7. `tools/scripts/db/apply-rls-direct-db.js` - Teste múltiplas configs
8. `tools/scripts/db/show-rls-fix.js` - Abrir Dashboard automaticamente

**Resultado:** Todos os scripts falharam, confirmando que acesso direto não está disponível.

---

## 🎯 Próxima Ação

**APLICAR VIA DASHBOARD (método oficial)**

1. ✅ Navegador já aberto no SQL Editor
2. ✅ VS Code já aberto com o arquivo SQL
3. ⏳ Aguardando você copiar e colar
4. ⏳ Aguardando você clicar em "Run"

---

## 📊 Estatísticas

- **Tentativas de conexão:** 8
- **Configurações testadas:** 8
- **Taxa de sucesso:** 0%
- **Tempo investido:** ~30 minutos
- **Scripts criados:** 8
- **Conclusão:** Dashboard é a única opção viável

---

**Data:** 2025-10-20
**Status:** ❌ Conexão direta não disponível
**Solução:** ✅ Usar Dashboard do Supabase

