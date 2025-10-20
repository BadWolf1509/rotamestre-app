# 🔐 Configuração de Variáveis de Ambiente - Vercel

## 🚨 Problema Atual

O app está retornando o erro:
```
Uncaught Error: supabaseUrl is required.
```

Isso acontece porque as variáveis de ambiente **não foram configuradas no Vercel**.

---

## ✅ Solução: Adicionar Variáveis via Dashboard

### Passo 1: Acessar Configurações do Projeto

```
https://vercel.com/wellintonribeiro-projects/rotamestre-app/settings/environment-variables
```

### Passo 2: Adicionar Cada Variável

Clique em **"Add New"** e adicione as seguintes variáveis:

#### 1. EXPO_PUBLIC_SUPABASE_URL
- **Key:** `EXPO_PUBLIC_SUPABASE_URL`
- **Value:** `https://your-project.supabase.co`
- **Environments:**
  - ✅ Production
  - ✅ Preview
  - ✅ Development

#### 2. EXPO_PUBLIC_SUPABASE_ANON_KEY
- **Key:** `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Value:** `YOUR_SUPABASE_ANON_KEY`
- **Environments:**
  - ✅ Production
  - ✅ Preview
  - ✅ Development

#### 3. EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
- **Key:** `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- **Value:** `YOUR_GOOGLE_MAPS_API_KEY`
- **Environments:**
  - ✅ Production
  - ✅ Preview
  - ✅ Development

#### 4. EXPO_PUBLIC_BASE_URL
- **Key:** `EXPO_PUBLIC_BASE_URL`
- **Value:** `https://app.rotamestre.tec.br`
- **Environments:**
  - ✅ Production
  - ✅ Preview
  - ✅ Development

#### 5. EXPO_PUBLIC_API_URL
- **Key:** `EXPO_PUBLIC_API_URL`
- **Value:** `https://api.rotamestre.tec.br`
- **Environments:**
  - ✅ Production
  - ✅ Preview
  - ✅ Development

---

## 🔄 Passo 3: Redeploy

Após adicionar todas as variáveis, você precisa fazer um **redeploy** para que elas sejam aplicadas:

### Opção A: Via Dashboard (Mais Rápido)
1. Acesse: https://vercel.com/wellintonribeiro-projects/rotamestre-app/deployments
2. Clique no último deployment
3. Clique no botão **"Redeploy"** no canto superior direito
4. Confirme com **"Redeploy"**

### Opção B: Via CLI
```bash
cd c:\Users\welli\rotamestre-app
vercel --prod
```

---

## ⏱️ Tempo de Propagação

- **Redeploy:** ~30-60 segundos
- **SSL:** Já configurado (reutilizado)
- **DNS:** Já propagado (sem mudanças)

---

## ✅ Validação

Após o redeploy, teste novamente:

```bash
# 1. Abrir no navegador
https://app.rotamestre.tec.br

# 2. Verificar console (F12)
# Não deve mais aparecer: "supabaseUrl is required"

# 3. Testar login
# Deve aparecer a tela de login do Supabase
```

---

## 📋 Checklist

- [ ] Acessar configurações de Environment Variables
- [ ] Adicionar EXPO_PUBLIC_SUPABASE_URL
- [ ] Adicionar EXPO_PUBLIC_SUPABASE_ANON_KEY
- [ ] Adicionar EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
- [ ] Adicionar EXPO_PUBLIC_BASE_URL
- [ ] Adicionar EXPO_PUBLIC_API_URL
- [ ] Fazer redeploy (via Dashboard ou CLI)
- [ ] Aguardar 1-2 minutos
- [ ] Testar https://app.rotamestre.tec.br
- [ ] Validar que não há erro "supabaseUrl is required"

---

## 🔐 Segurança

### Variáveis Públicas (EXPO_PUBLIC_*)
Essas variáveis são **públicas** e serão expostas no bundle JavaScript. Isso é esperado e seguro para:
- ✅ Supabase URL (público)
- ✅ Supabase Anon Key (público, protegido por RLS)
- ✅ Google Maps API Key (público, com restrições de domínio)

### Variáveis Privadas (Sem EXPO_PUBLIC_)
Para variáveis sensíveis, use **sem o prefixo EXPO_PUBLIC_**:
- ❌ **NÃO** adicione `SUPABASE_SERVICE_ROLE_KEY` no Vercel
- ❌ **NÃO** adicione `SUPABASE_DB_PASSWORD` no Vercel

Essas devem ficar apenas no backend (Supabase Edge Functions ou Next.js API Routes).

---

## 🛠️ Troubleshooting

### Erro persiste após redeploy
1. Limpar cache do navegador (Ctrl+Shift+Delete)
2. Abrir em aba anônima
3. Verificar se variáveis foram salvas: Settings > Environment Variables

### Variáveis não aparecem no build
1. Certifique-se que usou o prefixo `EXPO_PUBLIC_`
2. Fazer novo deploy (não redeploy)
3. Verificar logs: `vercel logs`

### Google Maps não carrega
1. Verificar API Key no Google Cloud Console
2. Adicionar domínio autorizado: `app.rotamestre.tec.br`
3. Habilitar APIs:
   - Maps JavaScript API
   - Directions API
   - Geocoding API

---

## 📊 Variáveis Configuradas

| Variável | Valor | Tipo | Status |
|----------|-------|------|--------|
| EXPO_PUBLIC_SUPABASE_URL | https://your-project.supabase.co | Público | ⏳ Pendente |
| EXPO_PUBLIC_SUPABASE_ANON_KEY | eyJhbGc... | Público | ⏳ Pendente |
| EXPO_PUBLIC_GOOGLE_MAPS_API_KEY | AIzaSyC... | Público | ⏳ Pendente |
| EXPO_PUBLIC_BASE_URL | https://app.rotamestre.tec.br | Público | ⏳ Pendente |
| EXPO_PUBLIC_API_URL | https://api.rotamestre.tec.br | Público | ⏳ Pendente |

---

## 🚀 Próximos Passos

1. ✅ Adicionar variáveis no Vercel
2. ✅ Fazer redeploy
3. ✅ Testar login
4. ✅ Validar Google Maps
5. ✅ Testar funcionalidades completas

---

**Link direto para configuração:**
👉 https://vercel.com/wellintonribeiro-projects/rotamestre-app/settings/environment-variables

**Tempo estimado:** 5 minutos

---

**Criado em:** 2025-10-20
**Status:** 🟡 Aguardando configuração manual
