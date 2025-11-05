# 🔒 Aplicar Novas Correções de Segurança

Após resolver os avisos de `function_search_path_mutable`, apareceram 3 novos avisos do Database Linter.

## 📊 Avisos Atuais

| Aviso | Nível | Item | Descrição |
|-------|-------|------|-----------|
| `security_definer_view` | ERROR | `vw_rotas_resumo` | View com SECURITY DEFINER |
| `security_definer_view` | ERROR | `vw_performance_motoristas` | View com SECURITY DEFINER |
| `rls_disabled_in_public` | ERROR | `spatial_ref_sys` | Tabela PostGIS sem RLS |

---

## 🛠️ Correção 1: Views com SECURITY DEFINER

### Problema

Views com `SECURITY DEFINER` executam com permissões do **criador da view**, não do usuário que consulta. Isso pode causar:
- ⚠️ Vazamento de dados (usuário vê dados que não deveria)
- ⚠️ Bypass de RLS (políticas são ignoradas)
- ⚠️ Problemas de auditoria (ações aparecem como do criador)

### Solução

Arquivo: `database/migrations/20251022000001_fix_security_definer_views.sql`

**O que faz:**
1. Remove `SECURITY DEFINER` das 2 views
2. RLS das tabelas base será aplicado corretamente
3. Cada usuário vê apenas seus dados

**Como aplicar:**
1. Abra: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql
2. Copie **TODO** o conteúdo de `20251022000001_fix_security_definer_views.sql`
3. Cole no SQL Editor
4. Clique em **"Run"**
5. Verifique a validação (deve mostrar ✅ para ambas as views)

**Impacto:**
- ✅ Views respeitam RLS das tabelas base
- ✅ Usuários veem apenas dados da sua unidade
- ⚠️ Pode haver pequeno impacto de performance (testável)
- ✅ Segurança aprimorada

**Teste após aplicar:**
```sql
-- Como motorista, deve ver apenas rotas da sua unidade
SELECT * FROM vw_rotas_resumo;

-- Como gestor, deve ver apenas rotas da sua unidade
SELECT * FROM vw_performance_motoristas;
```

---

## 🛠️ Correção 2: PostGIS spatial_ref_sys

### Problema

`spatial_ref_sys` é uma **tabela de sistema do PostGIS** que armazena definições de SRID (Spatial Reference System Identifiers). O linter reclama que está no schema `public` sem RLS.

### 3 Opções de Solução

Arquivo: `database/migrations/20251022000002_fix_postgis_rls.sql`

#### Opção A: Ignorar o Aviso (RECOMENDADO) ✅

- ✅ **ESCOLHA ESTA** se você entende que é uma tabela de sistema
- `spatial_ref_sys` não contém dados sensíveis (apenas definições de coordenadas)
- É esperado e seguro que todos leiam esta tabela
- Comentário explicativo foi adicionado
- **Aviso permanecerá no linter** (mas é seguro ignorar)

**Como aplicar:**
1. Execute apenas a **SOLUÇÃO 2** do arquivo SQL
2. Isso adiciona comentário explicativo
3. Mantém a tabela sem RLS (correto para PostGIS)

#### Opção B: Habilitar RLS com Política Permissiva

- Habilita RLS apenas para "calar" o linter
- Cria política que permite SELECT para todos
- **Não melhora segurança** (política permite tudo)
- Adiciona overhead de performance
- **Aviso desaparecerá do linter**

**Como aplicar:**
1. Execute a **SOLUÇÃO 3** do arquivo SQL
2. Descomente as linhas comentadas
3. Execute a migration

#### Opção C: Mover PostGIS para Schema Extensions

- Move toda a extensão PostGIS para schema `extensions`
- **PODE QUEBRAR** código existente
- Requer atualização de queries que usam geometry/geography
- **NÃO RECOMENDADO** para este projeto

### Recomendação

**Use a Opção A** (ignorar o aviso):
- ✅ Mais segura (não adiciona complexidade desnecessária)
- ✅ Melhor performance (sem overhead de RLS)
- ✅ Prática aceita pela comunidade PostGIS
- ⚠️ Aviso permanecerá no linter (mas pode ser ignorado)

Se você **realmente** quer que o aviso desapareça, use **Opção B**.

---

## 📋 Passo a Passo Completo

### 1. Corrigir Views (OBRIGATÓRIO)

```bash
# Abrir Supabase Dashboard
https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql

# Executar
database/migrations/20251022000001_fix_security_definer_views.sql
```

**Validação esperada:**
```
Schema | View                      | Owner          | Status
-------|---------------------------|----------------|-------------------------
public | vw_performance_motoristas | ✅ Owner correto | ✅ SEM SECURITY DEFINER
public | vw_rotas_resumo           | ✅ Owner correto | ✅ SEM SECURITY DEFINER
```

### 2. PostGIS (ESCOLHA UMA OPÇÃO)

#### Opção A: Ignorar (Recomendado)

```sql
-- Execute apenas a SOLUÇÃO 2 do arquivo:
COMMENT ON TABLE public.spatial_ref_sys IS
'Tabela de sistema do PostGIS com definições de SRID. '
'RLS não é necessário - dados são públicos e somente leitura. '
'Aviso do Database Linter pode ser ignorado.';

GRANT SELECT ON TABLE public.spatial_ref_sys TO PUBLIC;
```

#### Opção B: Habilitar RLS (Se quer que aviso desapareça)

```sql
-- Execute a SOLUÇÃO 3 completa do arquivo
-- (descomente as linhas no arquivo SQL)
```

### 3. Executar Database Linter

```
Dashboard → Database → Database Linter → Run Linter
```

**Resultado esperado:**

**Se usou Opção A (ignorar PostGIS):**
```
✅ security_definer_view (vw_rotas_resumo) - RESOLVIDO
✅ security_definer_view (vw_performance_motoristas) - RESOLVIDO
⚠️  rls_disabled_in_public (spatial_ref_sys) - PERMANECE (seguro ignorar)
```

**Se usou Opção B (RLS no PostGIS):**
```
✅ security_definer_view (vw_rotas_resumo) - RESOLVIDO
✅ security_definer_view (vw_performance_motoristas) - RESOLVIDO
✅ rls_disabled_in_public (spatial_ref_sys) - RESOLVIDO
```

---

## ✅ Checklist Final

### Após Correção 1 (Views)
- [ ] Executou `20251022000001_fix_security_definer_views.sql`
- [ ] Validação mostrou ✅ SEM SECURITY DEFINER para ambas as views
- [ ] Testou SELECT nas views (retornam dados)
- [ ] Testou com usuário motorista (vê apenas sua unidade)

### Após Correção 2 (PostGIS)
- [ ] Escolheu Opção A ou B
- [ ] Executou SQL correspondente
- [ ] Testou `SELECT * FROM spatial_ref_sys` (funciona)
- [ ] Executou Database Linter novamente

### Resultado Final
- [ ] Avisos `security_definer_view` desapareceram ✅
- [ ] Aviso `rls_disabled_in_public` foi tratado (desapareceu ou ignorado) ✅
- [ ] App continua funcionando normalmente ✅
- [ ] Queries com geometry/geography continuam funcionando ✅

---

## 📊 Resumo de Avisos

| Tipo de Aviso | Antes | Depois |
|---------------|-------|--------|
| `function_search_path_mutable` | 3 ❌ | 0 ✅ |
| `security_definer_view` | 2 ❌ | 0 ✅ |
| `rls_disabled_in_public` | 1 ❌ | 0 ou 1* |
| **Total** | **6** | **0-1** |

\* Depende da opção escolhida para PostGIS

**Avisos aceitáveis (não críticos):**
- `extension_in_public` (postgis) - Documentado
- `rls_disabled_in_public` (spatial_ref_sys) - Tabela de sistema
- `auth_leaked_password_protection` - Configuração de auth
- `auth_insufficient_mfa_options` - Configuração de auth

---

**Data:** 2025-10-22
**Prioridade:** Views (OBRIGATÓRIO) + PostGIS (OPCIONAL)
**Status:** Aguardando execução
