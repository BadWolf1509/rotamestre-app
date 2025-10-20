# 🔧 Correção RLS - Instruções Finais

## ❌ Por que a conexão via terminal não funcionou

Tentamos aplicar a correção via terminal usando várias abordagens:

### Tentativas realizadas:

1. **PostgreSQL Client direto**
   - ❌ Erro: "Tenant or user not found"
   - Motivo: SERVICE_ROLE_KEY não é aceito como senha PostgreSQL

2. **Supabase CLI `db push`**
   - ❌ Erro: "Tenant or user not found"
   - Motivo: Requer autenticação diferente

3. **Connection string com pooler**
   - ❌ Erro: "Tenant or user not found"
   - Motivo: SERVICE_ROLE_KEY ≠ Database Password

### 🔑 Explicação

O Supabase usa diferentes credenciais:

| Tipo | Uso | Disponível? |
|------|-----|-------------|
| **ANON_KEY** | API REST pública | ✅ Sim |
| **SERVICE_ROLE_KEY** | API REST admin | ✅ Sim |
| **Database Password** | PostgreSQL direto | ❌ Não temos |

**Conclusão:** Para conectar diretamente ao PostgreSQL, precisaríamos da **Database Password**, que é diferente do SERVICE_ROLE_KEY e não está disponível no `.env`.

---

## ✅ SOLUÇÃO: Aplicar via Dashboard (RECOMENDADO)

O método oficial e mais seguro é usar o **SQL Editor do Supabase Dashboard**.

### 📋 Passo a Passo Final

**1. Abra o SQL Editor**
   ```
   https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql/new
   ```
   _(O navegador já foi aberto automaticamente)_

**2. Copie o SQL**

   O arquivo já está aberto no VS Code:
   ```
   database/migrations/20251020000000_fix_rls_recursion.sql
   ```

   **No VS Code:**
   - Pressione: `Ctrl+A` (selecionar tudo)
   - Pressione: `Ctrl+C` (copiar)

**3. Cole no Dashboard**

   **No navegador (SQL Editor):**
   - Clique no editor
   - Pressione: `Ctrl+V` (colar)
   - Verifique se todo o SQL foi colado (216 linhas)

**4. Execute o SQL**

   - Clique no botão **"Run"** (▶️) no canto superior direito
   - Aguarde a execução (5-10 segundos)

**5. Verifique o resultado**

   Você deve ver mensagens como:
   ```
   ✅ DROP POLICY
   ✅ CREATE OR REPLACE FUNCTION
   ✅ CREATE POLICY
   ✅ GRANT
   ```

---

## 🧪 Como testar se funcionou

### Teste 1: Login no App

**URL:** https://app.rotamestre.tec.br/auth/login

**Credenciais de teste:**

| Tipo | Email | Senha |
|------|-------|-------|
| Gestor | gestor@rotamestre.tec.br | gestor123 |
| Motorista | motorista@rotamestre.tec.br | motorista123 |

**Resultado esperado:**
- ✅ Login bem-sucedido (sem erro 500)
- ✅ Redirecionamento correto:
  - Gestor → `/gestor/dashboard`
  - Motorista → `/motorista/rota`
- ✅ Sem mensagem "infinite recursion detected"

### Teste 2: Verificar funções (opcional)

No SQL Editor, execute:

```sql
-- Verificar se funções helper existem
SELECT
  proname as "Função",
  pronamespace::regnamespace as "Schema",
  prosecdef as "Security Definer"
FROM pg_proc
WHERE proname IN ('get_user_papel', 'get_user_unidade_id');
```

**Resultado esperado:**
```
Função              | Schema | Security Definer
--------------------|--------|------------------
get_user_papel      | auth   | true
get_user_unidade_id | auth   | true
```

### Teste 3: Verificar políticas (opcional)

```sql
-- Contar políticas por tabela
SELECT
  tablename,
  COUNT(*) as total_policies
FROM pg_policies
WHERE tablename IN ('usuarios', 'unidades', 'rotas')
GROUP BY tablename
ORDER BY tablename;
```

**Resultado esperado:**
```
tablename | total_policies
----------|---------------
rotas     | 6
unidades  | 1
usuarios  | 5
```

---

## 📊 Resumo das Alterações

### ❌ Removidas (12 políticas recursivas)

**Tabela `usuarios`:**
- "Gestores podem visualizar usuarios da mesma unidade"
- "Gestores podem inserir motoristas na mesma unidade"
- "Gestores podem atualizar motoristas da mesma unidade"

**Tabela `unidades`:**
- "Gestores podem visualizar sua unidade"
- "Motoristas podem visualizar sua unidade"

**Tabela `rotas`:**
- "Gestores podem visualizar rotas de sua unidade"
- "Motoristas podem visualizar suas proprias rotas"
- "Gestores podem inserir rotas em sua unidade"
- "Gestores podem atualizar rotas de sua unidade"
- "Motoristas podem atualizar suas proprias rotas"
- "Gestores podem deletar rotas de sua unidade"

### ✅ Criadas (13 itens)

**Funções Helper (2):**
- `auth.get_user_papel()` - Retorna papel do usuário logado
- `auth.get_user_unidade_id()` - Retorna unidade do usuário logado

**Políticas `usuarios` (5):**
- `usuarios_select_own` - Ver próprio registro
- `usuarios_select_same_unit` - Gestor vê usuários da unidade
- `usuarios_insert_motorista` - Gestor cria motoristas
- `usuarios_update_motorista` - Gestor atualiza motoristas
- `usuarios_update_own` - Atualizar próprio registro

**Políticas `unidades` (1):**
- `unidades_select_own` - Ver própria unidade

**Políticas `rotas` (6):**
- `rotas_select_gestor` - Gestor vê rotas da unidade
- `rotas_select_motorista` - Motorista vê suas rotas
- `rotas_insert_gestor` - Gestor cria rotas
- `rotas_update_gestor` - Gestor atualiza rotas
- `rotas_update_motorista` - Motorista atualiza suas rotas
- `rotas_delete_gestor` - Gestor deleta rotas

---

## ⚠️ Troubleshooting

### Problema: "function auth.get_user_papel() already exists"

**Solução:** Ignorar. A função já foi criada anteriormente, o que é bom!

### Problema: "policy ... does not exist"

**Solução:** Normal. Significa que a política já foi removida ou nunca existiu.

### Problema: Login ainda retorna erro 500

**Possíveis causas:**

1. **SQL não foi executado completamente**
   - Verifique se todas as 216 linhas foram coladas
   - Tente executar novamente

2. **Cache do navegador**
   - Limpe o cache: `Ctrl+Shift+Delete`
   - Ou tente em aba anônima: `Ctrl+Shift+N`

3. **Erro diferente**
   - Abra o Console do navegador: `F12`
   - Veja a mensagem de erro exata
   - Compartilhe o erro para diagnóstico

---

## 📞 Próximos Passos

1. ✅ **Aplicar SQL** no Dashboard (você está aqui)
2. ✅ **Testar login** com credenciais de teste
3. ✅ **Validar redirecionamento** (gestor/motorista)
4. ✅ **Commitar mudanças** ao repositório (opcional)

---

## 📝 Arquivos Criados

Durante o processo, foram criados os seguintes arquivos de auxílio:

- `tools/scripts/db/fix-rls.js` - Script de instruções inicial
- `tools/scripts/db/apply-rls-fix.js` - Tentativa via Supabase client
- `tools/scripts/db/apply-rls-fix-v2.js` - Tentativa via API REST
- `tools/scripts/db/apply-rls-fix-direct.js` - Tentativa via conexão direta
- `tools/scripts/db/apply-rls-fix-pooler.js` - Tentativa via pooler
- `tools/scripts/db/show-rls-fix.js` - Abrir Dashboard e VS Code
- `RLS_FIX_INSTRUCTIONS.md` - Instruções detalhadas
- `RLS_FIX_FINAL_INSTRUCTIONS.md` - Este arquivo

---

**Data:** 2025-10-20
**Status:** ⏳ Aguardando aplicação manual via Dashboard
**Prioridade:** 🔴 CRÍTICA

