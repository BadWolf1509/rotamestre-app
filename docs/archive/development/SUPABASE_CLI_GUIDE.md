# 🔌 Guia do Supabase CLI - RotaMestre

**Data:** 22/10/2025
**Versão CLI:** 2.53.6
**Projeto:** Rota Mestre (xezslsyxjivunmhhyxtd)

---

## 📊 Status da Conexão

✅ **Conectado ao projeto:** Rota Mestre
✅ **Região:** South America (São Paulo)
✅ **Reference ID:** xezslsyxjivunmhhyxtd
✅ **CLI Instalado:** Via npx (recomendado)

---

## 🚀 Comandos Essenciais

### **1. Verificar Versão**
```bash
npx supabase --version
# Saída: 2.53.6

# Sempre usar última versão:
npx supabase@latest --version
```

---

### **2. Listar Projetos**
```bash
npx supabase projects list

# Saída:
#    LINKED | ORG ID    | REFERENCE ID         | NAME        | REGION
#    ●      | ...       | xezslsyxjivunmhhyxtd | Rota Mestre | South America (São Paulo)
```

**Legenda:**
- ● = Projeto linkado (ativo no diretório atual)

---

### **3. Ver Status do Banco de Dados**
```bash
npx supabase db remote status

# Mostra:
# - Migrations aplicadas
# - Migrations pendentes
# - Estado atual do schema
```

---

### **4. Listar Migrations Aplicadas**
```bash
npx supabase migration list

# Saída:
#   LOCAL      │ REMOTE     │ TIME (UTC)
#  ────────────┼────────────┼──────────────────────
#   20251019.. │ 20251019.. │ 2025-10-19 23:03:25
#   20251019.. │ 20251019.. │ 2025-10-19 23:04:00
```

---

## 📝 Trabalhando com Migrations

### **5. Criar Nova Migration**
```bash
# Sintaxe:
npx supabase migration new <nome_da_migration>

# Exemplo:
npx supabase migration new add_usuarios_insert_policy

# Cria arquivo:
# database/migrations/20251022_add_usuarios_insert_policy.sql
```

---

### **6. Aplicar Migrations Pendentes (Remote)**
```bash
# Aplicar todas as migrations pendentes
npx supabase db push

# Aplicar migration específica
npx supabase db push database/migrations/20251022_add_usuarios_insert_policy.sql
```

**⚠️ Atenção:** Isso aplica no banco **remoto** (produção).

---

### **7. Reverter Migration**
```bash
# Reverter última migration
npx supabase db reset

# Reverter para migration específica
npx supabase db reset --version 20251019230325
```

**⚠️ Atenção:** Use com cuidado em produção!

---

### **8. Gerar Migration a partir do Schema Remoto**
```bash
# Baixar schema atual do remote
npx supabase db pull

# Cria migration com diferenças entre local e remote
```

---

## 🔍 Inspeção do Banco

### **9. Executar Query SQL**
```bash
# Query simples
npx supabase db query "SELECT * FROM usuarios LIMIT 5"

# Query de arquivo
npx supabase db query -f database/migrations/20251022_add_usuarios_insert_policy.sql
```

---

### **10. Ver Schema de uma Tabela**
```bash
npx supabase db schema usuarios

# Mostra:
# - Colunas
# - Tipos
# - Constraints
# - Indexes
```

---

### **11. Ver Políticas RLS**
```bash
npx supabase db query "
SELECT
  schemaname, tablename, policyname, cmd,
  CASE WHEN permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END as type
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname
"
```

---

### **12. Ver Funções do Banco**
```bash
npx supabase db query "
SELECT
  n.nspname as schema,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY function_name
"
```

---

## 🧪 Desenvolvimento Local

### **13. Iniciar Supabase Local**
```bash
# Iniciar todos os serviços locais
npx supabase start

# Serviços iniciados:
# - PostgreSQL (localhost:54322)
# - Studio (http://localhost:54323)
# - Auth (http://localhost:54321)
# - Storage (http://localhost:54321/storage)
```

---

### **14. Parar Supabase Local**
```bash
npx supabase stop
```

---

### **15. Resetar Banco Local**
```bash
# Deleta tudo e recria do zero
npx supabase db reset

# Aplica todas as migrations novamente
```

---

## 🔒 Segurança e Credenciais

### **16. Ver Credenciais do Projeto**
```bash
npx supabase projects api-keys

# Mostra:
# - anon key (pública)
# - service_role key (privada)
```

**⚠️ Nunca commitar service_role key!**

---

### **17. Ver Connection String**
```bash
npx supabase db remote-url

# Retorna:
# postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

---

## 📊 Monitoramento e Logs

### **18. Ver Logs do Banco**
```bash
npx supabase db logs

# Mostra últimos logs do PostgreSQL
```

---

### **19. Ver Logs de API**
```bash
npx supabase functions logs <function-name>
```

---

## 🗂️ Estrutura de Migrations (Atual)

```
database/migrations/
├── 20251019230325_initial_schema_fixed.sql       ✅ Schema inicial
├── 20251019230400_rls_policies.sql               ✅ Políticas RLS
├── 20251019230500_reset_and_apply_rls.sql        ✅ Reset RLS
├── 20251019230600_rls_optimized.sql              ✅ RLS otimizado
├── 20251020000000_fix_rls_recursion.sql          ✅ Fix recursão
├── 20251020000001_fix_rls_public_schema.sql      ✅ Fix public schema
├── 20251020000002_remove_old_policies.sql        ✅ Remove políticas antigas
├── 20251022000000_fix_security_warnings.sql      ✅ Fix warnings segurança
├── 20251022000001_fix_security_definer_views.sql ✅ Fix SECURITY DEFINER
├── 20251022000002_fix_postgis_rls.sql            ✅ Fix PostGIS RLS
├── 20251022000003_optimize_rls_performance.sql   ✅ Otimiza performance
├── 20251022000004_consolidate_multiple_policies.sql ✅ Consolida políticas
├── 20251022_add_usuarios_insert_policy.sql       ✅ Insert policy usuarios
└── 99999999999999_seed_test_data.sql             🌱 Dados de teste
```

---

## 🔧 Comandos Úteis Específicos do Projeto

### **Verificar Warnings do Linter**
```bash
npx supabase db lint

# Mostra avisos de:
# - auth_rls_initplan (performance)
# - multiple_permissive_policies
# - security_definer_view
```

---

### **Aplicar Migration Pendente**
```bash
# Ver quais migrations estão pendentes
npx supabase migration list

# Aplicar todas
npx supabase db push
```

---

### **Backup do Banco**
```bash
# Dump completo do schema
npx supabase db dump -f backup_$(date +%Y%m%d).sql

# Dump apenas dados
npx supabase db dump --data-only -f backup_data_$(date +%Y%m%d).sql
```

---

### **Restaurar Backup**
```bash
npx supabase db query -f backup_20251022.sql
```

---

## 🚨 Troubleshooting

### **Erro: "Project not linked"**
```bash
# Linkar novamente ao projeto
npx supabase link --project-ref xezslsyxjivunmhhyxtd

# Verificar link
npx supabase projects list
```

---

### **Erro: "Permission denied"**
```bash
# Fazer login novamente
npx supabase login

# Usar access token do dashboard
npx supabase login --token <access-token>
```

---

### **Erro: "Migration already applied"**
```bash
# Ver histórico de migrations
npx supabase migration list

# Forçar reaplicação (cuidado!)
npx supabase db push --force
```

---

## 📚 Recursos

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Migration Guide](https://supabase.com/docs/guides/cli/local-development)
- [Database Functions](https://supabase.com/docs/guides/database/functions)
- [RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)

---

## ✅ Checklist Diário

Antes de começar a trabalhar:
- [ ] `npx supabase projects list` - Verificar conexão
- [ ] `npx supabase migration list` - Ver migrations aplicadas
- [ ] `npx supabase db lint` - Verificar warnings

Antes de fazer deploy:
- [ ] `npx supabase db push` - Aplicar migrations pendentes
- [ ] `npx supabase db lint` - Verificar se não há warnings críticos
- [ ] Testar no ambiente de staging

---

## 🎯 Comandos Mais Usados (Quick Reference)

```bash
# Ver status
npx supabase projects list
npx supabase migration list

# Nova migration
npx supabase migration new <nome>

# Aplicar migrations
npx supabase db push

# Ver schema
npx supabase db pull

# Executar query
npx supabase db query "SELECT * FROM usuarios"

# Ver logs
npx supabase db logs

# Lint (verificar warnings)
npx supabase db lint
```

---

**Atualizado em:** 22/10/2025
**Versão:** 1.0
**Responsável:** Claude AI
