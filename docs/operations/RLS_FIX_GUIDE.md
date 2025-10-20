# 🔧 Guia de Correção RLS - RotaMestre

**Problema:** `infinite recursion detected in policy for relation "usuarios"`
**Status:** ✅ Correção aplicada
**Data:** 2025-10-20

---

## ❌ Problema Identificado

### Erro

```
GET /rest/v1/usuarios?select=*&id=eq.6b2994cc... 500 (Internal Server Error)
Erro: infinite recursion detected in policy for relation "usuarios"
```

### Causa Raiz

As políticas RLS estavam causando recursão infinita ao fazer SELECT na própria tabela `usuarios`:

```sql
-- ❌ PROBLEMA: Esta política faz SELECT na própria tabela usuarios
create policy "Gestores podem visualizar usuarios da mesma unidade"
  on usuarios for select
  using (
    exists (
      select 1 from usuarios as u  -- ⚠️ Recursão aqui!
      where u.id = auth.uid()
        and u.papel = 'gestor'
        and u.unidade_id = usuarios.unidade_id
    )
  );
```

**Fluxo da Recursão:**
1. App faz `SELECT * FROM usuarios WHERE id = '...'`
2. RLS dispara política de segurança
3. Política tenta fazer outro `SELECT FROM usuarios`
4. RLS dispara novamente a política
5. Loop infinito → erro 500

---

## ✅ Solução

### Migration aplicada: `20251020000000_fix_rls_recursion.sql`

A solução foi criar **funções helper** que não disparam RLS:

```sql
-- Função helper SECURITY DEFINER (não dispara RLS)
CREATE OR REPLACE FUNCTION auth.get_user_papel(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT papel FROM public.usuarios WHERE id = user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth.get_user_unidade_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT unidade_id FROM public.usuarios WHERE id = user_id LIMIT 1;
$$;
```

**Políticas RLS atualizadas:**

```sql
-- ✅ SOLUÇÃO: Usar função helper ao invés de SELECT
CREATE POLICY "Gestores podem visualizar usuarios da mesma unidade"
  ON usuarios FOR SELECT
  USING (
    auth.get_user_papel(auth.uid()) = 'gestor'
    AND unidade_id = auth.get_user_unidade_id(auth.uid())
  );
```

---

## 🚀 Como Aplicar a Correção

### Método 1: Dashboard Supabase (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql/new
2. Cole o conteúdo de `database/migrations/20251020000000_fix_rls_recursion.sql`
3. Clique em **"Run"**
4. Aguarde sucesso (✅ Success)

---

### Método 2: Via Script (Windows)

```bash
# Execute o script batch
tools\scripts\db\quick-apply.bat
```

---

### Método 3: npx supabase cli (Se instalado)

```bash
npx supabase db push --db-url "sua-connection-string"
```

---

## 🧪 Testar Correção

### 1. Teste via App

```bash
# Acessar app
https://app.rotamestre.tec.br/auth/login

# Fazer login com gestor
Email: gestor@rotamestre.tec.br
Senha: gestor123

# Deve redirecionar para /gestor/dashboard SEM ERRO
```

---

### 2. Teste via API REST

```bash
# Testar SELECT em usuarios
curl -X GET 'https://your-project.supabase.co/rest/v1/usuarios?select=*&id=eq.UUID' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_USER_JWT"

# Deve retornar 200 OK (não mais 500)
```

---

### 3. Teste via SQL Editor

```sql
-- No Supabase SQL Editor
SELECT * FROM usuarios WHERE id = auth.uid();

-- Deve retornar dados SEM ERRO
```

---

## 📋 Detalhes da Migration

**Arquivo:** `database/migrations/20251020000000_fix_rls_recursion.sql`

**O que faz:**

1. **Drop** de políticas RLS antigas (recursivas)
2. **Criação** de funções helper `SECURITY DEFINER`
3. **Criação** de políticas RLS novas (usando helpers)
4. **Aplicação** nas tabelas: `usuarios`, `unidades`, `rotas`, `paradas`

**Tabelas afetadas:**
- `usuarios`
- `unidades`
- `rotas`
- `paradas`
- `logs`

---

## 🔐 Segurança

### SECURITY DEFINER

As funções helper usam `SECURITY DEFINER` para **bypass** RLS:

```sql
CREATE OR REPLACE FUNCTION auth.get_user_papel(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER  -- ⚠️ Executa como dono da função (postgres)
STABLE
AS $$
  SELECT papel FROM public.usuarios WHERE id = user_id LIMIT 1;
$$;
```

**Por que é seguro?**
1. Função apenas **lê** dados (não modifica)
2. Retorna apenas 1 campo específico (`papel` ou `unidade_id`)
3. Filtra por `user_id` fornecido (não permite SQL injection)
4. Marcada como `STABLE` (não muda dados, pode ser cached)

---

## ⚠️ Importante

### Limitações

- ❌ **NÃO tentar** conectar via PostgreSQL direto (requer Database Password)
- ✅ **USAR** Supabase Dashboard ou API REST
- ✅ **TESTAR** após aplicar migration

### Troubleshooting

**❌ Erro: "Tenant or user not found"**
- Causa: Tentando usar SERVICE_ROLE_KEY como senha PostgreSQL
- Solução: Usar Dashboard ou API REST

**❌ Erro: "Function does not exist"**
- Causa: Migration não foi aplicada
- Solução: Aplicar migration via Dashboard

**❌ Still getting recursion error**
- Causa: Cache do Supabase
- Solução: Aguardar 1-2 minutos ou fazer logout/login no app

---

## ✅ Status

- ✅ Migration criada e testada
- ✅ Aplicada em produção
- ✅ Login funcionando sem erros
- ✅ RLS protegendo dados corretamente
- ✅ Performance mantida

---

**Responsável:** Wellinton Ribeiro
**Projeto:** RotaMestre App
**Data:** 2025-10-20
