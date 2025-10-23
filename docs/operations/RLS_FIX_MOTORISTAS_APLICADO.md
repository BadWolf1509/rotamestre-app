# ✅ Correção de RLS - Motoristas [APLICADA]

## 🎯 Problema Resolvido

Os motoristas existiam no banco mas o RLS estava bloqueando a visualização pelos gestores.

**Status:** ✅ **CORRIGIDO em 22/10/2025**

## 📝 Migration Aplicada

Migration criada em:
`database/migrations/20251022180740_fix_rls_usuarios_visibility.sql`

**Aplicada via:** Supabase Dashboard (SQL Editor)
**Data:** 22/10/2025

---

## 📋 Opção 1: Aplicar via Supabase Dashboard (MAIS FÁCIL)

### Passo 1: Acesse o SQL Editor
https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql

### Passo 2: Cole o SQL abaixo e clique em "Run"

```sql
-- ========================================
-- CORREÇÃO RLS - Tabela usuarios
-- Permite gestores verem motoristas da mesma unidade
-- ========================================

-- 1. Remover políticas antigas que podem estar bloqueando
DROP POLICY IF EXISTS "Gestores podem ver usuários da mesma unidade" ON usuarios;
DROP POLICY IF EXISTS "Usuários podem ver próprio perfil" ON usuarios;
DROP POLICY IF EXISTS "usuarios_select_policy" ON usuarios;

-- 2. Criar política correta para SELECT
CREATE POLICY "usuarios_select_policy" ON usuarios
FOR SELECT
USING (
  -- Usuário pode ver seu próprio perfil
  auth.uid() = id
  OR
  -- Gestores podem ver todos da mesma unidade
  (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.papel = 'gestor'
      AND u.unidade_id = usuarios.unidade_id
    )
  )
);

-- 3. Política para INSERT (apenas gestores)
DROP POLICY IF EXISTS "usuarios_insert_policy" ON usuarios;
CREATE POLICY "usuarios_insert_policy" ON usuarios
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND u.papel = 'gestor'
  )
);

-- 4. Política para UPDATE
DROP POLICY IF EXISTS "usuarios_update_policy" ON usuarios;
CREATE POLICY "usuarios_update_policy" ON usuarios
FOR UPDATE
USING (
  -- Próprio usuário pode atualizar seu perfil
  auth.uid() = id
  OR
  -- Gestor pode atualizar usuários da mesma unidade
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND u.papel = 'gestor'
    AND u.unidade_id = usuarios.unidade_id
  )
);
```

### Passo 3: Verificar
Após executar, recarregue: http://localhost:8081/gestor/motoristas

✅ Deve mostrar: **Carlos Santos - Motorista**

---

## 📋 Opção 2: Aplicar via Supabase CLI

### Pré-requisitos
Você precisa configurar a senha do banco de dados no Supabase CLI.

### Passo 1: Obter a senha do banco
1. Acesse: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/settings/database
2. Clique em "Reset database password" (ou copie a existente)
3. Copie a nova senha

### Passo 2: Configurar a senha
```bash
# Opção A: Via variável de ambiente
export PGPASSWORD="sua_senha_aqui"

# Opção B: Atualizar .env
# Adicione ou atualize:
SUPABASE_DB_PASSWORD=sua_senha_aqui
```

### Passo 3: Aplicar a migration
```bash
npx supabase@latest db push
```

### Passo 4: Verificar
```bash
# Ver migrations aplicadas
npx supabase@latest migration list
```

---

## 📋 Opção 3: Aplicar via Script Node.js (COM SENHA CORRETA)

### Passo 1: Atualizar a senha em .env
Abra `.env` e atualize `SUPABASE_DB_PASSWORD` com a senha correta do banco.

### Passo 2: Executar o script
```bash
node fix-rls-pg.js
```

---

## ✅ Como Confirmar que Funcionou

### Console do Navegador (F12)
```
🔍 Carregando motoristas...
👤 userData: {id: '6b2994cc-...', papel: 'gestor', ...}
🏢 unidade_id: dcb0f84c-8b2f-4465-9dfd-7dc0cfe35079
📊 Resultado query motoristas: {motoristasData: Array(1), motoristasError: null}
✅ Motoristas encontrados: 1
```

### Tela Motoristas
```
┌─────────────────────────────────────────┐
│ 👤 Carlos Santos - Motorista            │
│ 📧 motorista@rotamestre.tec.br          │
│ 📊 0 rotas • 0 concluídas               │
│ ✅ Ativo                                 │
└─────────────────────────────────────────┘
```

---

## 🔍 O Que a Correção Faz

### Antes (Bloqueado ❌)
- Gestores não conseguiam ver motoristas
- Query retornava Array(0)
- RLS bloqueava a consulta

### Depois (Funcionando ✅)
- **SELECT**: Usuário vê próprio perfil + Gestores veem todos da mesma unidade
- **INSERT**: Apenas gestores podem criar usuários
- **UPDATE**: Usuário atualiza próprio perfil + Gestores atualizam usuários da unidade

---

## 🚨 Se Continuar Dando Erro

1. **Faça logout e login novamente**
   - Isso atualiza o token de autenticação

2. **Limpe o cache do navegador**
   - Ctrl+Shift+Del → Limpar tudo

3. **Verifique as políticas no Dashboard**
   https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/auth/policies

4. **Verifique os logs do Supabase**
   ```bash
   npx supabase@latest db logs
   ```

---

## 📞 Suporte

- **Dashboard**: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd
- **SQL Editor**: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql
- **Políticas RLS**: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/auth/policies
- **Docs RLS**: https://supabase.com/docs/guides/auth/row-level-security

---

**✨ Recomendação: Use a Opção 1 (Dashboard) - É a mais rápida e confiável!**
