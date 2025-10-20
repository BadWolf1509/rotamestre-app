# 🚀 Checklist de Deploy - Rota Mestre

## Status Atual

- ✅ SEO configurado
- ✅ Favicons gerados
- ✅ PWA manifest criado
- ⏳ Aguardando Supabase estabilizar
- ⏳ Aplicar correção RLS
- ⏳ Build e deploy

---

## 📋 Checklist Pré-Deploy

### 1. Supabase RLS Fix

- [ ] Verificar status: https://status.supabase.com
- [ ] Aguardar região US-EAST-1 ficar "Operational"
- [ ] Executar: `tools\scripts\db\quick-apply.bat`
  - OU aplicar via Dashboard: [SQL Editor](https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql/new)
- [ ] Testar login: gestor@rotamestre.tec.br / gestor123

### 2. Verificar Configurações

- [x] Variáveis de ambiente (.env)
  - [x] EXPO_PUBLIC_SUPABASE_URL
  - [x] EXPO_PUBLIC_SUPABASE_ANON_KEY
  - [x] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
  - [x] EXPO_PUBLIC_BASE_URL
  - [x] EXPO_PUBLIC_API_URL

- [x] SEO e Meta Tags
  - [x] app/+html.tsx
  - [x] public/manifest.json
  - [x] public/robots.txt
  - [x] public/sitemap.xml

- [x] Favicons
  - [x] 6 tamanhos gerados em public/

### 3. Build do Projeto

```bash
# Limpar build anterior
npx expo export --platform web --clear

# Build de produção
npx expo export --platform web

# Verificar dist/
# Deve conter: _expo/, favicon*.png, manifest.json, etc
```

### 4. Configurar Vercel

```bash
# Verificar variáveis de ambiente no Vercel
vercel env ls

# Deve ter:
# - EXPO_PUBLIC_SUPABASE_URL (production, preview, development)
# - EXPO_PUBLIC_SUPABASE_ANON_KEY (production, preview, development)
# - EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (production, preview, development)
# - EXPO_PUBLIC_BASE_URL (production, preview, development)
# - EXPO_PUBLIC_API_URL (production, preview, development)
```

### 5. Deploy Vercel

```bash
# Preview deploy (testar primeiro)
vercel

# Deploy de produção
vercel --prod

# Aguardar URL:
# https://app.rotamestre.tec.br
```

---

## 🧪 Checklist Pós-Deploy

### Funcionalidades Básicas

- [ ] **Homepage carrega** (https://app.rotamestre.tec.br)
- [ ] **Login funciona** (/auth/login)
  - [ ] Gestor: gestor@rotamestre.tec.br / gestor123
  - [ ] Motorista: motorista@rotamestre.tec.br / motorista123
- [ ] **Redirecionamento correto** após login
  - [ ] Gestor → /gestor/dashboard
  - [ ] Motorista → /motorista/rota
- [ ] **Logout funciona**

### SEO e Meta Tags

- [ ] **Favicon aparece** na aba do navegador
- [ ] **Título correto:** "Rota Mestre - Gestão Inteligente de Entregas..."
- [ ] **Meta description** presente (View Source)
- [ ] **Open Graph tags** presentes
  - [ ] Facebook Debugger: https://developers.facebook.com/tools/debug/
  - [ ] LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/
- [ ] **Twitter Cards** funcionando
  - [ ] Validator: https://cards-dev.twitter.com/validator

### PWA

- [ ] **Instalável no Chrome Desktop**
  - Menu (⋮) → Install Rota Mestre
- [ ] **Instalável no Android**
  - Banner "Add to Home Screen"
- [ ] **Instalável no iOS**
  - Safari → Share → Add to Home Screen
- [ ] **Ícones corretos** em todas as plataformas

### Performance

- [ ] **Lighthouse Score** (Chrome DevTools → Lighthouse)
  - [ ] Performance: 70+
  - [ ] Accessibility: 90+
  - [ ] Best Practices: 90+
  - [ ] SEO: 90+
  - [ ] PWA: 80+

### SEO Files

- [ ] **robots.txt** acessível: /robots.txt
- [ ] **sitemap.xml** acessível: /sitemap.xml
- [ ] **manifest.json** acessível: /manifest.json

### Domínios

- [ ] **app.rotamestre.tec.br** resolvendo
- [ ] **HTTPS ativo** (certificado válido)
- [ ] **Redirect www → non-www** (se aplicável)

---

## 🔍 Testes Detalhados

### 1. Teste de Login (Crítico)

```
URL: https://app.rotamestre.tec.br/auth/login

Gestor:
  Email: gestor@rotamestre.tec.br
  Senha: gestor123
  Esperado: Redirect para /gestor/dashboard

Motorista:
  Email: motorista@rotamestre.tec.br
  Senha: motorista123
  Esperado: Redirect para /motorista/rota
```

**Verificar:**
- [ ] Sem erro 500
- [ ] Sem "infinite recursion detected"
- [ ] Redirecionamento imediato
- [ ] Dados do usuário carregam

### 2. Teste de SEO

**View Source (Ctrl+U):**
```html
<!-- Deve conter: -->
<title>Rota Mestre - Gestão Inteligente de Entregas...</title>
<meta name="description" content="Sistema completo..." />
<meta property="og:image" content="..." />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="/favicon-32x32.png" />
<link rel="manifest" href="/manifest.json" />
```

### 3. Teste de PWA

**Chrome Desktop:**
1. Abrir https://app.rotamestre.tec.br
2. Olhar na barra de endereço: deve aparecer ícone de instalação
3. Clicar em instalar
4. App abre em janela standalone
5. Ícone correto na barra de tarefas

**Mobile (Android/iOS):**
1. Abrir no navegador
2. Aguardar banner ou usar menu Share
3. Add to Home Screen
4. Abrir do ícone
5. App abre fullscreen

### 4. Teste de Performance

**Lighthouse (Chrome):**
```
F12 → Lighthouse → Generate Report → Mobile/Desktop

Scores esperados:
- Performance: 70-85 (web build)
- Accessibility: 90-100
- Best Practices: 90-100
- SEO: 90-100
- PWA: 80-100
```

**Core Web Vitals:**
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1

---

## 🐛 Troubleshooting

### Problema: Login retorna erro 500

**Causa:** RLS não aplicado ou Supabase ainda instável

**Solução:**
1. Verificar status.supabase.com
2. Aplicar correção RLS: `tools\scripts\db\quick-apply.bat`
3. Limpar cache: Ctrl+Shift+Delete
4. Tentar novamente

### Problema: Favicon não aparece

**Causa:** Cache do navegador ou build não atualizado

**Solução:**
1. Hard refresh: Ctrl+Shift+R
2. Rebuild: `npx expo export --platform web --clear`
3. Redeploy: `vercel --prod`
4. Limpar cache do Vercel (se necessário)

### Problema: PWA não instalável

**Causa:** Manifest.json não acessível ou HTTPS inativo

**Solução:**
1. Verificar: https://app.rotamestre.tec.br/manifest.json
2. Verificar HTTPS válido
3. Verificar service worker (DevTools → Application)
4. Chrome flags: chrome://flags/#unsafely-treat-insecure-origin-as-secure

### Problema: Meta tags não aparecem

**Causa:** Build não incluiu +html.tsx ou SSR não ativo

**Solução:**
1. Verificar `app/+html.tsx` existe
2. Rebuild com `--clear`
3. View Source (Ctrl+U) para verificar
4. Usar ferramentas debugger (Facebook, Twitter)

---

## 📊 Métricas de Sucesso

### KPIs Técnicos

- [ ] Uptime: 99%+
- [ ] Load time: < 3s
- [ ] Lighthouse SEO: 90+
- [ ] Lighthouse PWA: 80+
- [ ] Zero erros de login

### KPIs de Negócio

- [ ] Taxa de conversão login: > 80%
- [ ] Taxa de instalação PWA: > 10%
- [ ] Bounce rate: < 40%
- [ ] Sessões por usuário: > 3

---

## 🔔 Monitoramento

### Ferramentas Recomendadas

1. **Google Analytics** (futuro)
   - Pageviews
   - User sessions
   - Conversion tracking

2. **Google Search Console**
   - Indexação
   - Search performance
   - Core Web Vitals

3. **Vercel Analytics**
   - Web Vitals
   - Top pages
   - Traffic sources

4. **Supabase Logs**
   - API errors
   - Database queries
   - Authentication events

---

## 📝 Próximos Passos

### Curto Prazo (1-7 dias)

- [ ] Aplicar correção RLS
- [ ] Deploy de produção
- [ ] Testar em todas as plataformas
- [ ] Submeter ao Google Search Console
- [ ] Criar og-image.png e twitter-image.png

### Médio Prazo (1-4 semanas)

- [ ] Implementar Google Analytics
- [ ] Criar página institucional (rotamestre.tec.br)
- [ ] Criar documentação (docs.rotamestre.tec.br)
- [ ] Tirar screenshots para PWA manifest
- [ ] Implementar service worker para offline

### Longo Prazo (1-3 meses)

- [ ] SEO local (Google My Business)
- [ ] Link building
- [ ] Content marketing (blog)
- [ ] App stores (iOS/Android)
- [ ] Certificações (ISO, etc)

---

## 📞 Links Úteis

### Deploy

- Vercel Dashboard: https://vercel.com/dashboard
- Vercel CLI Docs: https://vercel.com/docs/cli

### Supabase

- Dashboard: https://supabase.com/dashboard
- Status: https://status.supabase.com
- SQL Editor: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql

### SEO Tools

- Google Search Console: https://search.google.com/search-console
- Facebook Debugger: https://developers.facebook.com/tools/debug/
- Twitter Validator: https://cards-dev.twitter.com/validator
- Lighthouse: Chrome DevTools (F12)

---

**Data:** 2025-10-20
**Status:** ⏳ Aguardando Supabase estabilizar
**Próximo:** Aplicar RLS → Build → Deploy → Testar

