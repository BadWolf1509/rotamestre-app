# 🚀 Guia de Deploy - RotaMestre

**Última atualização:** 2025-10-20
**Plataforma:** Vercel
**Status:** ✅ Deploy automatizado configurado

---

## 📊 Overview

O projeto usa **deploy automatizado via Git** na Vercel:

- **Push para `main`** → Deploy automático de produção
- **Pull Requests** → Preview deploy automático
- **CLI Vercel** → Deploy manual (quando necessário)

**URL de Produção:** https://app.rotamestre.tec.br

---

## ✅ Pré-requisitos

### 1. Variáveis de Ambiente

As seguintes variáveis devem estar configuradas no **Vercel Dashboard**:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
EXPO_PUBLIC_BASE_URL=https://app.rotamestre.tec.br
EXPO_PUBLIC_API_URL=https://your-project.supabase.co
```

**Como adicionar:**
1. Acesse: https://vercel.com/wellintonribeiro-projects/rotamestre-app/settings/environment-variables
2. Adicione cada variável para: **Production**, **Preview** e **Development**

---

### 2. Build Command Configurado

O `vercel.json` já está configurado com o build correto:

```json
{
  "buildCommand": "npm run build:web",
  "outputDirectory": "dist",
  "framework": null
}
```

**O que acontece no build:**
1. `expo export --platform web` → Gera arquivos web
2. `copy-public.js` → Copia favicons e assets para dist/
3. `inject-meta-tags.js` → Injeta meta tags SEO no HTML

---

## 🚀 Métodos de Deploy

### Método 1: Deploy Automático via Git (Recomendado)

```bash
# Fazer mudanças no código
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# Vercel detecta o push e faz deploy automático
# Acompanhe em: https://vercel.com/wellintonribeiro-projects/rotamestre-app
```

**Vantagens:**
- ✅ Automático e rápido
- ✅ Histórico completo de deploys
- ✅ Rollback fácil
- ✅ Preview automático em PRs

---

### Método 2: Deploy Manual via CLI

```bash
# Preview deploy (testar antes de produção)
vercel

# Deploy de produção
vercel --prod

# Deploy forçado (limpa cache)
vercel --prod --force
```

**Quando usar:**
- 🔧 Debugging de problemas
- 🚨 Deploy urgente sem commit
- 🧪 Testar configuração local

---

### Método 3: Redeploy via Dashboard

1. Acesse: https://vercel.com/wellintonribeiro-projects/rotamestre-app
2. Clique no deploy mais recente
3. Clique em **"Redeploy"**
4. Selecione **"Redeploy"** (ou "Redeploy with Cache")

**Quando usar:**
- ⚙️ Mudou variáveis de ambiente
- 🔄 Quer rebuild sem mudar código

---

## 📋 Checklist Pré-Deploy

### Configuração

- [x] Variáveis de ambiente configuradas no Vercel
- [x] `vercel.json` com buildCommand correto
- [x] DNS configurado (app.rotamestre.tec.br)
- [x] SSL/TLS ativo (Let's Encrypt)

### Assets e SEO

- [x] Favicons gerados (6 tamanhos)
- [x] `public/manifest.json` (PWA)
- [x] `public/robots.txt`
- [x] `public/sitemap.xml`
- [x] Meta tags SEO em `app/+html.tsx`

### Build Local (Opcional)

```bash
# Testar build localmente antes de deploy
npm run build:web

# Verificar se dist/ foi gerado corretamente
ls -la dist/

# Deve conter:
# - _expo/
# - favicon*.png (6 arquivos)
# - manifest.json
# - robots.txt
# - sitemap.xml
# - index.html (com meta tags injetadas)
```

---

## 🧪 Checklist Pós-Deploy

### 1. Funcionalidades Básicas

- [ ] Homepage carrega: https://app.rotamestre.tec.br
- [ ] Login funciona: /auth/login
  - Gestor: `gestor@rotamestre.tec.br` / `gestor123`
  - Motorista: `motorista@rotamestre.tec.br` / `motorista123`
- [ ] Redirecionamento correto após login
  - Gestor → `/gestor/dashboard`
  - Motorista → `/motorista/rota`
- [ ] Logout funciona

---

### 2. SEO e Meta Tags

```bash
# Verificar favicon
curl -I https://app.rotamestre.tec.br/favicon-32x32.png
# Deve retornar: HTTP/2 200

# Verificar manifest.json
curl https://app.rotamestre.tec.br/manifest.json | jq
# Deve conter: name, short_name, icons, etc

# Verificar robots.txt
curl https://app.rotamestre.tec.br/robots.txt
# Deve conter: User-agent: *, Sitemap: ...

# Verificar meta tags
curl -s https://app.rotamestre.tec.br | grep -i "og:title"
# Deve conter meta tags Open Graph
```

**Checklist visual:**
- [ ] Favicon aparece na aba do navegador
- [ ] Título correto: "Rota Mestre - Gestão..."
- [ ] Meta description presente (View Source)
- [ ] Open Graph tags presentes
- [ ] PWA instalável (ícone aparece no navegador)

---

### 3. Performance e Segurança

```bash
# Verificar HTTPS
curl -I https://app.rotamestre.tec.br | grep "strict-transport-security"
# Deve conter: strict-transport-security: max-age=...

# Verificar headers de segurança
curl -I https://app.rotamestre.tec.br | grep "x-"
# Deve conter: x-frame-options, x-content-type-options, etc
```

**Ferramentas online:**
- [ ] SSL Labs: https://www.ssllabs.com/ssltest/ → Score A+
- [ ] PageSpeed Insights: https://pagespeed.web.dev/ → Score 90+
- [ ] Lighthouse (Chrome DevTools) → PWA Score 80+

---

### 4. Funcionalidades Específicas

**Gestor:**
- [ ] Dashboard carrega dados
- [ ] Criar nova entrega funciona
- [ ] Listar entregas funciona
- [ ] Filtros e buscas funcionam

**Motorista:**
- [ ] Rota carrega corretamente
- [ ] Mapa (Google Maps) funciona
- [ ] Otimização de rota funciona
- [ ] Marcar checkpoint funciona

---

## 🔧 Troubleshooting

### ❌ Build falha com erro de TypeScript

**Erro:**
```
Type error: Property 'X' does not exist on type 'Y'
```

**Solução:**
```bash
# Verificar tipos localmente
npm run type-check

# Corrigir erros de tipo
# Fazer commit e push
```

---

### ❌ Favicons não aparecem

**Causa:** Scripts de build não executaram corretamente

**Solução:**
```bash
# Verificar se buildCommand está correto em vercel.json
cat vercel.json | grep buildCommand

# Deve ser: "npm run build:web"
# Se estiver diferente, corrigir e fazer novo deploy

# Forçar rebuild
vercel --prod --force
```

---

### ❌ Meta tags não aparecem

**Causa:** `inject-meta-tags.js` não executou

**Solução:**
```bash
# Verificar se index.html tem meta tags
cat dist/index.html | grep "og:title"

# Se não tiver, executar manualmente:
npm run build:web

# Verificar novamente e fazer deploy
```

---

### ❌ Variáveis de ambiente não funcionam

**Causa:** Variáveis não definidas no Vercel ou não têm prefixo `EXPO_PUBLIC_`

**Solução:**
1. Acesse: https://vercel.com/wellintonribeiro-projects/rotamestre-app/settings/environment-variables
2. Verifique se todas as variáveis existem
3. Verifique se têm prefixo `EXPO_PUBLIC_`
4. Adicione para: Production, Preview, Development
5. Faça redeploy (Vercel Dashboard)

---

### ❌ App funciona localmente mas não em produção

**Causas comuns:**
1. Variáveis de ambiente diferentes
2. Build de produção com otimizações quebra código
3. Paths absolutos vs relativos

**Solução:**
```bash
# Testar build de produção localmente
npm run build:web
npx serve dist

# Acessar localhost:3000 e testar
# Se funcionar local mas não em Vercel, verificar:
# - Logs de build no Vercel
# - Runtime logs no Vercel
# - Network tab no Chrome DevTools
```

---

## 📊 Monitoramento

### Logs de Deploy

**Dashboard Vercel:**
https://vercel.com/wellintonribeiro-projects/rotamestre-app/deployments

**CLI:**
```bash
# Listar deploys recentes
vercel ls

# Ver logs de um deploy específico
vercel logs <deployment-url>
```

---

### Analytics

**Vercel Analytics:**
https://vercel.com/wellintonribeiro-projects/rotamestre-app/analytics

**Métricas importantes:**
- Page views
- Unique visitors
- Core Web Vitals (LCP, FID, CLS)
- Performance score

---

## 🔄 Rollback

### Via Dashboard (Fácil)

1. Acesse: https://vercel.com/wellintonribeiro-projects/rotamestre-app/deployments
2. Encontre o deploy antigo que estava funcionando
3. Clique nos 3 pontinhos (...)
4. Clique em **"Promote to Production"**

---

### Via CLI

```bash
# Listar deploys
vercel ls

# Promover um deploy antigo para produção
vercel promote <deployment-url>
```

---

## 🔗 Links Úteis

- **Vercel Dashboard:** https://vercel.com/wellintonribeiro-projects/rotamestre-app
- **Vercel Deployments:** https://vercel.com/wellintonribeiro-projects/rotamestre-app/deployments
- **Vercel Settings:** https://vercel.com/wellintonribeiro-projects/rotamestre-app/settings
- **Vercel Analytics:** https://vercel.com/wellintonribeiro-projects/rotamestre-app/analytics
- **Supabase Dashboard:** https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd

---

## ✅ Deploy bem-sucedido!

Após completar todos os passos:

- ✅ Deploy automático via Git configurado
- ✅ Variáveis de ambiente configuradas
- ✅ Build pipeline funcionando (expo + scripts)
- ✅ Favicons e assets copiados
- ✅ Meta tags SEO injetadas
- ✅ SSL/TLS ativo (A+ score)
- ✅ PWA instalável
- ✅ Performance otimizada (90+ score)

**Status:** 🟢 Produção

**URL:** https://app.rotamestre.tec.br

---

**Responsável:** Wellinton Ribeiro
**Projeto:** RotaMestre App
**Data:** 2025-10-20
