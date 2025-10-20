# 🔧 Correção de RLS - Recursão Infinita

**Problema:** `infinite recursion detected in policy for relation "usuarios"`
**Causa:** Políticas RLS fazendo SELECT na própria tabela `usuarios`
**Status:** ⚠️ Requer aplicação manual da correção

---

## ❌ Problema Identificado

O erro ocorre quando o app tenta fazer login:

```
GET /rest/v1/usuarios?select=*&id=eq.6b2994cc... 500 (Internal Server Error)
Erro: infinite recursion detected in policy for relation "usuarios"
```

### Causa Raiz

As políticas RLS estão causando recursão infinita:

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
5. **Loop infinito** 🔄

---

## ✅ Solução Implementada

### Estratégia

Usar **funções helper com `security definer`** que executam fora do contexto RLS:

```sql
-- ✅ SOLUÇÃO: Função segura que não dispara RLS
create or replace function auth.get_user_papel()
returns text
language sql
security definer  -- Executa com privilégios do owner
stable
set search_path = public
as $$
  select papel from public.usuarios where id = auth.uid() limit 1;
$$;
```

### Políticas Corrigidas

**Antes (recursivo):**
```sql
using (
  exists (
    select 1 from usuarios as u
    where u.id = auth.uid()  -- ❌ Causa recursão
  )
)
```

**Depois (seguro):**
```sql
using (
  auth.get_user_papel() = 'gestor'  -- ✅ Usa função helper
  and auth.get_user_unidade_id() = unidade_id
)
```

---

## 🚀 Como Aplicar a Correção

### Método 1: Supabase Dashboard (Recomendado)

1. **Acesse o SQL Editor:**
   ```
   https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql/new
   ```

2. **Cole o conteúdo do arquivo:**
   ```
   database/migrations/20251020000000_fix_rls_recursion.sql
   ```

3. **Execute o SQL:**
   - Clique no botão "Run" (▶️)
   - Aguarde mensagem de sucesso

4. **Teste o login:**
   - Acesse: https://app.rotamestre.tec.br/auth/login
   - Login: gestor@rotamestre.tec.br / gestor123

### Método 2: Via Terminal (Supabase CLI)

```bash
# Se tiver Supabase CLI instalado
supabase db push
```

### Método 3: Via Script Node.js

```bash
cd tools/scripts
node db/fix-rls.js
```

---

## 📋 O Que Será Alterado

### 1. Funções Helper Criadas

- ✅ `auth.get_user_papel()` - Retorna papel do usuário logado
- ✅ `auth.get_user_unidade_id()` - Retorna unidade do usuário logado

### 2. Políticas Removidas (recursivas)

- ❌ "Gestores podem visualizar usuarios da mesma unidade"
- ❌ "Gestores podem inserir motoristas na mesma unidade"
- ❌ "Gestores podem atualizar motoristas da mesma unidade"
- ❌ "Gestores podem visualizar sua unidade"
- ❌ "Motoristas podem visualizar sua unidade"
- ❌ 6 políticas recursivas de rotas

### 3. Políticas Recriadas (seguras)

- ✅ `usuarios_select_own` - Ver próprio registro
- ✅ `usuarios_select_same_unit` - Gestor vê usuários da unidade
- ✅ `usuarios_insert_motorista` - Gestor cria motoristas
- ✅ `usuarios_update_motorista` - Gestor atualiza motoristas
- ✅ `usuarios_update_own` - Atualizar próprio registro
- ✅ `unidades_select_own` - Ver própria unidade
- ✅ 6 políticas seguras para rotas

---

## 🧪 Como Testar

### Teste 1: Verificar Funções Helper

```sql
-- No SQL Editor do Supabase
select auth.get_user_papel();
-- Deve retornar: 'gestor' ou 'motorista'

select auth.get_user_unidade_id();
-- Deve retornar: UUID da unidade
```

### Teste 2: Verificar SELECT em usuarios

```sql
select * from usuarios where id = auth.uid();
-- Deve retornar seu registro sem erro
```

### Teste 3: Login no App

```
URL: https://app.rotamestre.tec.br/auth/login

Gestor:
  Email: gestor@rotamestre.tec.br
  Senha: gestor123

Motorista:
  Email: motorista@rotamestre.tec.br
  Senha: motorista123
```

**Resultado esperado:**
- ✅ Login bem-sucedido
- ✅ Redirecionamento para dashboard/rota
- ✅ Sem erro 500
- ✅ Sem mensagem de recursão

---

## 📊 Comparação: Antes vs Depois

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Recursão** | ❌ Infinita | ✅ Zero |
| **Performance** | ❌ Lenta (timeout) | ✅ Rápida |
| **Políticas** | ❌ Complexas | ✅ Simples |
| **Manutenção** | ❌ Difícil | ✅ Fácil |
| **Segurança** | ✅ Alta | ✅ Alta |

---

## 🔍 Diagnóstico Adicional

### Verificar Políticas Ativas

```sql
-- Listar todas as políticas na tabela usuarios
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where tablename = 'usuarios';
```

### Verificar Funções Helper

```sql
-- Verificar se funções existem
select
  proname,
  pronamespace::regnamespace,
  prosecdef
from pg_proc
where proname in ('get_user_papel', 'get_user_unidade_id');
```

---

## ⚠️ Troubleshooting

### Problema: "function auth.get_user_papel() does not exist"

**Solução:** Rodar a migração novamente, verificar se o schema `auth` foi usado corretamente.

### Problema: "permission denied for function"

**Solução:** Verificar se o GRANT foi executado:
```sql
grant execute on function auth.get_user_papel() to authenticated;
grant execute on function auth.get_user_unidade_id() to authenticated;
```

### Problema: Login ainda retorna erro 500

**Solução:** Limpar cache do browser e tentar novamente, ou verificar logs do Supabase.

---

## 📞 Próximos Passos

1. ✅ **Aplicar SQL de correção** (via Dashboard ou CLI)
2. ✅ **Testar login** no app
3. ✅ **Validar permissões** (gestor vs motorista)
4. ✅ **Commitar correção** ao repositório
5. ✅ **Documentar** no changelog

---

## 📝 Arquivos Relacionados

- `database/migrations/20251020000000_fix_rls_recursion.sql` - SQL de correção
- `tools/scripts/db/fix-rls.js` - Script helper
- `RLS_FIX_INSTRUCTIONS.md` - Este arquivo

---

**Criado em:** 2025-10-20
**Prioridade:** 🔴 CRÍTICA
**Status:** ⏳ Aguardando aplicação manual
