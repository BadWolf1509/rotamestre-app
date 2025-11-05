# 🌐 Ecossistema RotaMestre - Arquitetura de Domínios

## 📊 Visão Geral

O **RotaMestre** possui uma arquitetura multi-domínio para separar responsabilidades e otimizar a experiência do usuário.

---

## 🗺️ Mapa de Domínios

| Endereço | Função | Tecnologia | Status |
|----------|--------|------------|--------|
| **rotamestre.tec.br** | Site institucional / Landing page | Next.js / Static | ✅ Ativo |
| **www.rotamestre.tec.br** | Redirect → rotamestre.tec.br | 301 Redirect | ✅ Ativo |
| **app.rotamestre.tec.br** | Aplicação Web / PWA | Expo Web | ✅ Ativo |
| **painel.rotamestre.tec.br** | Dashboard Administrativo | Next.js | 🟡 Planejado |
| **docs.rotamestre.tec.br** | Documentação Técnica | Docusaurus / MkDocs | 🟡 Planejado |
| **api.rotamestre.tec.br** | API Pública / Edge Functions | Supabase Edge | ✅ Ativo |

---

## 📍 Detalhamento dos Domínios

### 1. 🏠 rotamestre.tec.br
**Domínio Principal - Site Institucional**

**Propósito:**
- Landing page pública
- Informações sobre o produto
- Cases de sucesso
- Contato comercial
- Blog (opcional)

**Tecnologia Sugerida:**
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Deploy**: Vercel
- **CMS**: Sanity.io ou Contentful (opcional)

**Estrutura:**
```
/                    # Home
/sobre              # Sobre a empresa
/solucoes           # Soluções oferecidas
/precos             # Planos e preços
/contato            # Formulário de contato
/blog               # Blog (opcional)
/termos             # Termos de uso
/privacidade        # Política de privacidade
```

**Features:**
- ✅ SEO otimizado
- ✅ Analytics integrado
- ✅ Formulário de leads
- ✅ Chat ao vivo (Intercom/Crisp)
- ✅ Multilíngue (PT/EN/ES)

---

### 2. 🔄 www.rotamestre.tec.br
**Redirecionamento WWW → Non-WWW**

**Propósito:**
- Redirecionar para `rotamestre.tec.br`
- Manter consistência de branding
- SEO (evitar conteúdo duplicado)

**Configuração:**
```
HTTP 301: www.rotamestre.tec.br → rotamestre.tec.br
```

**Headers:**
```
Strict-Transport-Security: max-age=63072000
```

---

### 3. 📱 app.rotamestre.tec.br
**Aplicação Web / PWA**

**Propósito:**
- App web responsivo
- Progressive Web App (PWA)
- Acesso via navegador mobile/desktop
- Mesmo código do app mobile (Expo Web)

**Tecnologia:**
- **Framework**: Expo (React Native Web)
- **Build**: `npx expo export:web`
- **Deploy**: Vercel / Netlify
- **Offline**: Service Workers

**Features:**
- ✅ Login/autenticação
- ✅ Dashboard gestor
- ✅ Dashboard motorista
- ✅ Mapas integrados
- ✅ Notificações push
- ✅ Instalável (Add to Home Screen)

**Usuários:**
- 👨‍💼 Gestores de frota
- 🚚 Motoristas
- 📊 Administradores

---

### 4. 🎛️ painel.rotamestre.tec.br
**Dashboard Administrativo (Backoffice)**

**Propósito:**
- Painel interno para equipe RotaMestre
- Analytics avançado
- Gerenciamento de clientes
- Configurações de sistema
- Suporte técnico

**Tecnologia Sugerida:**
- **Framework**: Next.js 14+ (App Router)
- **UI**: shadcn/ui + Tailwind
- **Charts**: Recharts / Chart.js
- **Tables**: TanStack Table
- **Deploy**: Vercel

**Estrutura:**
```
/                    # Dashboard overview
/clientes            # Gerenciar clientes
/usuarios            # Gerenciar usuários
/rotas               # Visualizar todas rotas
/analytics           # Analytics e métricas
/faturamento         # Gestão financeira
/suporte             # Tickets de suporte
/configuracoes       # Configurações do sistema
/logs                # Logs de auditoria
```

**Features:**
- ✅ Multi-tenant (por unidade)
- ✅ Relatórios exportáveis (PDF/Excel)
- ✅ Gráficos em tempo real
- ✅ Logs de auditoria
- ✅ Role-based access (Admin/Support/Sales)

**Permissões:**
- 👑 Super Admin (acesso total)
- 🛠️ Suporte (leitura + tickets)
- 💼 Comercial (clientes + analytics)

---

### 5. 📚 docs.rotamestre.tec.br
**Documentação Técnica**

**Propósito:**
- Documentação de API
- Guias de integração
- Changelog
- SDK documentation
- Tutoriais

**Tecnologia Sugerida:**
- **Framework**: Docusaurus 3 ou MkDocs
- **Deploy**: GitHub Pages / Vercel
- **Versionamento**: Git-based
- **Search**: Algolia DocSearch

**Estrutura:**
```
/                    # Home da documentação
/getting-started     # Primeiros passos
/api                 # Referência da API
  /rest              # REST endpoints
  /graphql           # GraphQL schema
  /webhooks          # Webhooks
/sdk                 # SDKs
  /javascript        # SDK JavaScript
  /react-native      # SDK React Native
  /python            # SDK Python (futuro)
/guides              # Guias e tutoriais
  /authentication    # Autenticação
  /routing           # Otimização de rotas
  /integrations      # Integrações (ERP, etc)
/changelog           # Histórico de mudanças
/support             # FAQ e suporte
```

**Features:**
- ✅ Search integrado (Algolia)
- ✅ Versionamento de docs
- ✅ Dark mode
- ✅ Code playground (RunKit)
- ✅ Exemplos interativos
- ✅ OpenAPI spec (Swagger)

**Formato:**
```markdown
---
title: Autenticação
description: Como autenticar na API do RotaMestre
sidebar_position: 1
---

# Autenticação

O RotaMestre usa tokens JWT...
```

---

### 6. 🔌 api.rotamestre.tec.br
**API Pública / Edge Functions**

**Propósito:**
- Endpoint público da API
- Proxy para Supabase Edge Functions
- Webhooks externos
- Integrações com terceiros

**Tecnologia:**
- **Backend**: Supabase Edge Functions (Deno)
- **Proxy**: Cloudflare Workers ou Vercel Edge
- **Rate Limiting**: Upstash Redis
- **Monitoring**: Datadog / New Relic

**Endpoints:**
```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
GET    /api/v1/rotas
POST   /api/v1/rotas
GET    /api/v1/rotas/:id
PATCH  /api/v1/rotas/:id
DELETE /api/v1/rotas/:id
POST   /api/v1/webhooks/tracking
GET    /api/v1/analytics
```

**Features:**
- ✅ REST API
- ✅ GraphQL (opcional)
- ✅ Rate limiting (100 req/min)
- ✅ API Keys
- ✅ CORS configurado
- ✅ Request/Response logging
- ✅ Error tracking (Sentry)

**Autenticação:**
```bash
curl -H "Authorization: Bearer <token>" \
     https://api.rotamestre.tec.br/api/v1/rotas
```

**Rate Limits:**
- Free: 100 req/min
- Básico: 500 req/min
- Pro: 2000 req/min
- Enterprise: Ilimitado

---

## 🔐 Segurança e SSL

### Certificados SSL
Todos os domínios devem ter SSL/TLS:
- **Provedor**: Let's Encrypt (gratuito) ou Cloudflare SSL
- **Renovação**: Automática (via Certbot ou Cloudflare)
- **Protocolo**: TLS 1.3
- **Cipher Suites**: Modernos e seguros

### Headers de Segurança
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'
```

### CORS
```javascript
// api.rotamestre.tec.br
Access-Control-Allow-Origin: https://app.rotamestre.tec.br
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## 🌍 DNS Configuration

### Registros DNS (exemplo)

```dns
; Domínio principal
rotamestre.tec.br.           A     76.76.21.21
rotamestre.tec.br.           AAAA  2606:4700:...

; WWW redirect
www.rotamestre.tec.br.       CNAME rotamestre.tec.br.

; App web
app.rotamestre.tec.br.       CNAME cname.vercel-dns.com.

; Painel admin
painel.rotamestre.tec.br.    CNAME cname.vercel-dns.com.

; Documentação
docs.rotamestre.tec.br.      CNAME username.github.io.

; API
api.rotamestre.tec.br.       CNAME xezslsyxjivunmhhyxtd.supabase.co.

; Email (MX)
rotamestre.tec.br.           MX 10 mx1.zoho.com.
rotamestre.tec.br.           MX 20 mx2.zoho.com.

; SPF (anti-spam)
rotamestre.tec.br.           TXT   "v=spf1 include:zoho.com ~all"

; DMARC
_dmarc.rotamestre.tec.br.    TXT   "v=DMARC1; p=quarantine; rua=mailto:dmarc@rotamestre.tec.br"
```

---

## 📊 Monitoramento

### Uptime Monitoring
- **Ferramenta**: UptimeRobot ou Pingdom
- **Endpoints**: Todos os 5 domínios
- **Frequência**: A cada 5 minutos
- **Alertas**: Email/SMS/Slack

### Performance Monitoring
- **Ferramenta**: Datadog, New Relic ou Vercel Analytics
- **Métricas**:
  - Response time (p50, p95, p99)
  - Error rate
  - Throughput (req/s)
  - CPU/Memory usage

### Error Tracking
- **Ferramenta**: Sentry
- **Integração**: Todos os apps (web + mobile)
- **Alertas**: Slack #tech-alerts

---

## 🚀 Roadmap de Implementação

### Fase 1 - MVP (Atual) ✅
- [x] rotamestre.tec.br (placeholder)
- [x] app.rotamestre.tec.br (Expo web)
- [x] api.rotamestre.tec.br (Supabase)

### Fase 2 - Expansão 🟡
- [ ] Criar site institucional (rotamestre.tec.br)
- [ ] Deploy docs.rotamestre.tec.br (Docusaurus)
- [ ] Configurar DNS para todos os domínios
- [ ] Implementar SSL/TLS em todos

### Fase 3 - Backoffice 🔵
- [ ] Desenvolver painel.rotamestre.tec.br
- [ ] Integrar analytics
- [ ] Sistema de suporte
- [ ] Relatórios avançados

### Fase 4 - Escalabilidade ⚪
- [ ] CDN (Cloudflare)
- [ ] Load balancing
- [ ] Auto-scaling
- [ ] Multi-region deployment

---

## 📞 Contatos e Suporte

### Equipe Técnica
- **DevOps**: devops@rotamestre.tec.br
- **Backend**: backend@rotamestre.tec.br
- **Frontend**: frontend@rotamestre.tec.br

### Suporte
- **Email**: suporte@rotamestre.tec.br
- **WhatsApp**: +55 11 9xxxx-xxxx
- **Slack**: #suporte-rotamestre

---

## 📚 Recursos Adicionais

- [Documentação Supabase](https://supabase.com/docs)
- [Expo Documentation](https://docs.expo.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Docusaurus Documentation](https://docusaurus.io/)

---

**Última atualização**: 2025-10-20
**Versão**: 1.0.0
**Mantido por**: Equipe RotaMestre
