# 👥 Criar Usuários de Teste - RotaMestre

## 🎯 Objetivo

Criar 2 usuários de teste no Supabase para validar o sistema:
- 1 **Gestor** (administrador da unidade)
- 1 **Motorista** (executor de rotas)

---

## 📋 Método 1: Via Supabase Dashboard (Recomendado)

### Passo 1: Acessar o Supabase Dashboard

```
https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd
```

### Passo 2: Ir para Authentication

1. No menu lateral, clique em **Authentication**
2. Clique na aba **Users**

### Passo 3: Criar Usuário Gestor

1. Clique em **Add User** → **Create new user**
2. Preencha os dados:
   - **Email:** `gestor@rotamestre.tec.br`
   - **Password:** `gestor123`
   - **Auto Confirm User:** ✅ Marcar (para não precisar confirmar email)
3. Clique em **Create user**
4. **Copie o UUID** gerado (ex: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### Passo 4: Criar Usuário Motorista

1. Clique em **Add User** → **Create new user**
2. Preencha os dados:
   - **Email:** `motorista@rotamestre.tec.br`
   - **Password:** `motorista123`
   - **Auto Confirm User:** ✅ Marcar
3. Clique em **Create user**
4. **Copie o UUID** gerado

---

## 📋 Método 2: Via SQL Editor (Mais Rápido)

### Passo 1: Acessar SQL Editor

```
https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql
```

### Passo 2: Executar Script SQL

Cole e execute o seguinte script:

```sql
-- ====================================================================
-- CRIAR USUÁRIOS DE TESTE NO SUPABASE AUTH
-- ====================================================================

-- 1. Criar Gestor
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'gestor@rotamestre.tec.br',
  crypt('gestor123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"João Silva - Gestor"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- 2. Criar Motorista
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '20000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'motorista@rotamestre.tec.br',
  crypt('motorista123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Carlos Santos - Motorista"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- 3. Criar identidades
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '{"sub":"10000000-0000-0000-0000-000000000001","email":"gestor@rotamestre.tec.br"}',
    'email',
    now(),
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '{"sub":"20000000-0000-0000-0000-000000000001","email":"motorista@rotamestre.tec.br"}',
    'email',
    now(),
    now(),
    now()
  );

-- ✅ Usuários criados com sucesso!
```

---

## 🗃️ Método 3: Aplicar Dados de Teste Completos

### Passo 1: Aplicar Migration de Seed

```bash
cd c:\Users\welli\rotamestre-app
npx supabase db push
```

Isso vai aplicar o arquivo `99999999999999_seed_test_data.sql` que cria:
- ✅ 1 Unidade de teste
- ✅ 2 Usuários (tabela usuarios)
- ✅ 2 Rotas de exemplo
- ✅ 8 Paradas
- ✅ 3 Logs

### Passo 2: Criar usuários no Auth manualmente

Use o **Método 1** ou **Método 2** acima para criar no `auth.users`.

---

## ✅ Credenciais Criadas

Após executar, você terá:

### 👨‍💼 Gestor
- **Email:** `gestor@rotamestre.tec.br`
- **Senha:** `gestor123`
- **Papel:** Administrador da Unidade Centro
- **Permissões:**
  - ✅ Criar rotas
  - ✅ Gerenciar motoristas
  - ✅ Ver dashboard com KPIs
  - ✅ Acessar histórico completo

### 🚚 Motorista
- **Email:** `motorista@rotamestre.tec.br`
- **Senha:** `motorista123`
- **Papel:** Executor de rotas
- **Permissões:**
  - ✅ Ver rotas do dia
  - ✅ Iniciar/finalizar rotas
  - ✅ Concluir/pular paradas
  - ✅ Ver histórico pessoal

---

## 🧪 Testar Login

### 1. Acessar o App
```
https://app.rotamestre.tec.br
```

### 2. Fazer Login como Gestor
- Email: `gestor@rotamestre.tec.br`
- Senha: `gestor123`
- Deve redirecionar para: `/gestor/dashboard`

### 3. Fazer Logout e Login como Motorista
- Email: `motorista@rotamestre.tec.br`
- Senha: `motorista123`
- Deve redirecionar para: `/motorista/rota`

---

## 📊 Dados de Teste Incluídos

### Rota #1 - Em Andamento
- **Motorista:** Carlos Santos
- **Status:** Em andamento (2h atrás)
- **Paradas:** 5 total
  - ✅ Rua Augusta, 500 (concluída)
  - ✅ Av. Faria Lima, 2000 (concluída)
  - ⏳ Rua Oscar Freire, 800 (pendente)
  - ⏳ Av. Rebouças, 3000 (pendente)
  - ⏳ Rua Haddock Lobo, 1500 (pendente)
- **Distância:** 25.5 km

### Rota #2 - Pendente (Amanhã)
- **Motorista:** Carlos Santos
- **Status:** Pendente
- **Paradas:** 3 total
  - ⏳ Av. Ipiranga, 1000
  - ⏳ Praça da República, 100
  - ⏳ Rua 25 de Março, 500
- **Distância:** 18.3 km

---

## 🔧 Troubleshooting

### Erro: "Email already registered"
**Solução:** O email já existe. Use outro email ou delete o usuário existente.

### Erro: "User already exists"
**Solução:** Delete o usuário no Dashboard:
1. Authentication > Users
2. Encontre o usuário
3. Clique nos 3 pontos (⋮) > Delete user

### Login não funciona
**Solução:**
1. Verifique se usuário foi confirmado (email_confirmed_at não é NULL)
2. Verifique se a senha está correta
3. Verifique se o usuário está na tabela `usuarios` (não só em `auth.users`)

### RLS bloqueia acesso
**Solução:**
1. Verifique se o `id` do auth.users é o mesmo do `usuarios.id`
2. Verifique se o usuário tem `unidade_id` preenchido
3. Rode: `SELECT * FROM usuarios WHERE email = 'gestor@rotamestre.tec.br';`

---

## 🚀 Próximos Passos

Após criar os usuários:

1. ✅ Testar login no app
2. ✅ Validar redirecionamento (gestor → dashboard, motorista → rota)
3. ✅ Testar CRUD de motoristas (como gestor)
4. ✅ Testar criação de rotas (como gestor)
5. ✅ Testar visualização de rotas (como motorista)
6. ✅ Testar conclusão de paradas (como motorista)
7. ✅ Validar RLS (gestor não vê outras unidades)

---

---

## 📋 Método 4: Via Script Node.js (✅ EXECUTADO)

### O Mais Simples e Automático!

```bash
cd scripts
npm install
npm run create-users
```

Este script:
- ✅ Busca automaticamente a unidade ativa
- ✅ Cria os 2 usuários no `auth.users`
- ✅ Cria os registros na tabela `usuarios`
- ✅ Associa à unidade correta
- ✅ Confirma email automaticamente

### Resultado da Execução

```
✅ Usuários criados com sucesso!

👤 GESTOR
   Email: gestor@rotamestre.tec.br
   Senha: gestor123
   ID: 6b2994cc-2b5c-4839-a495-528882b8d94e

👤 MOTORISTA
   Email: motorista@rotamestre.tec.br
   Senha: motorista123
   ID: 3765e2d7-4b5a-421d-8aae-fe284168f4a3
```

---

**Criado em:** 2025-10-20
**Tempo estimado:** 5 minutos
**Status:** ✅ CONCLUÍDO - Usuários criados com sucesso!
