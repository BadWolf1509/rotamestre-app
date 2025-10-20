# 🚀 Plano de Implementação - Ecossistema RotaMestre

## 📋 Visão Geral

Este documento detalha o plano de implementação completo para todos os componentes do ecossistema RotaMestre.

---

## 1. 📱 App Web (Expo Web) - app.rotamestre.tec.br

### Objetivo
Hospedar a versão web do aplicativo React Native usando Expo Web.

### Stack Tecnológico
- **Framework**: Expo (React Native Web)
- **Build**: Metro Bundler
- **Deploy**: Vercel ou Netlify
- **Domain**: app.rotamestre.tec.br

### Passos de Implementação

#### 1.1 Preparar Build Web

```bash
# 1. Instalar dependências web
npm install react-dom react-native-web

# 2. Adicionar configuração web no app.json
# (já configurado)

# 3. Build para web
npx expo export:web

# 4. Testar localmente
npx serve dist
```

#### 1.2 Otimizações para Web

**Criar arquivo `metro.config.js`:**

```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('cjs');

module.exports = config;
```

**Adicionar PWA support (`app.json`):**

```json
{
  "expo": {
    "web": {
      "favicon": "./assets/favicon.png",
      "bundler": "metro",
      "config": {
        "firebase": {
          "measurementId": "G-XXXXXXXXXX"
        }
      },
      "build": {
        "babel": {
          "include": ["@expo/vector-icons"]
        }
      }
    }
  }
}
```

#### 1.3 Deploy para Vercel

**Criar `vercel.json` (específico para app):**

```json
{
  "buildCommand": "npx expo export:web",
  "outputDirectory": "dist",
  "devCommand": "npx expo start --web",
  "installCommand": "npm install",
  "framework": null,
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Deploy:**

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Configurar domínio customizado
vercel domains add app.rotamestre.tec.br
```

#### 1.4 Configurar DNS

```dns
app.rotamestre.tec.br.    IN    CNAME    cname.vercel-dns.com.
```

#### 1.5 Checklist

- [ ] Build web funcionando localmente
- [ ] PWA manifest configurado
- [ ] Service worker configurado (offline support)
- [ ] Deploy na Vercel bem-sucedido
- [ ] DNS configurado e propagado
- [ ] SSL/TLS ativo
- [ ] Performance otimizada (Lighthouse > 90)
- [ ] Analytics configurado (Google Analytics/Vercel Analytics)

---

## 2. 🧭 Painel Gestor (Next.js) - painel.rotamestre.tec.br

### Objetivo
Dashboard administrativo para gestão avançada de unidades, usuários e analytics.

### Stack Tecnológico
- **Framework**: Next.js 14 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **Charts**: Recharts
- **Tables**: TanStack Table
- **Auth**: Supabase Auth
- **Deploy**: Vercel

### Estrutura do Projeto

```
painel-rotamestre/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Dashboard overview
│   │   ├── clientes/             # Gerenciar clientes
│   │   ├── usuarios/             # Gerenciar usuários
│   │   ├── rotas/                # Visualizar rotas
│   │   ├── analytics/            # Analytics
│   │   ├── faturamento/          # Financeiro
│   │   └── configuracoes/        # Settings
│   └── api/
│       └── [...supabase]/        # API routes
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── charts/                   # Chart components
│   └── tables/                   # Table components
├── lib/
│   ├── supabase.ts              # Supabase client
│   └── utils.ts
└── public/
```

### Passos de Implementação

#### 2.1 Setup Inicial

```bash
# Criar projeto Next.js
npx create-next-app@latest painel-rotamestre --typescript --tailwind --app

cd painel-rotamestre

# Instalar dependências
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install @radix-ui/react-* class-variance-authority clsx tailwind-merge
npm install recharts @tanstack/react-table
npm install lucide-react date-fns zod react-hook-form @hookform/resolvers
```

#### 2.2 Configurar shadcn/ui

```bash
npx shadcn-ui@latest init

# Adicionar componentes
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add table
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add form
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add select
npx shadcn-ui@latest add toast
```

#### 2.3 Configurar Supabase

**lib/supabase.ts:**

```typescript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const supabaseClient = createClientComponentClient()

export const supabaseServer = () =>
  createServerComponentClient({ cookies })
```

#### 2.4 Criar Layout Principal

**app/(dashboard)/layout.tsx:**

```typescript
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

#### 2.5 Dashboard Overview

**app/(dashboard)/page.tsx:**

```typescript
import { KPICards } from '@/components/kpi-cards'
import { RevenueChart } from '@/components/charts/revenue-chart'
import { ActiveRoutesTable } from '@/components/tables/active-routes'

export default async function DashboardPage() {
  // Fetch data from Supabase
  const kpis = await fetchKPIs()
  const routes = await fetchActiveRoutes()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <KPICards data={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart />
        <ActiveRoutesTable routes={routes} />
      </div>
    </div>
  )
}
```

#### 2.6 Deploy

```bash
# Deploy para Vercel
vercel --prod

# Configurar domínio
vercel domains add painel.rotamestre.tec.br
```

#### 2.7 Checklist

- [ ] Next.js 14 configurado
- [ ] shadcn/ui instalado e customizado
- [ ] Autenticação Supabase integrada
- [ ] Dashboard overview implementado
- [ ] KPIs e charts funcionando
- [ ] Tabelas de dados implementadas
- [ ] CRUD de clientes/usuários
- [ ] Deploy na Vercel
- [ ] DNS configurado
- [ ] Permissões RLS verificadas

---

## 3. 📚 Docs Técnicos - docs.rotamestre.tec.br

### Objetivo
Documentação técnica completa do projeto, API e guias de integração.

### Stack Tecnológico
- **Framework**: Docusaurus 3
- **Search**: Algolia DocSearch
- **Deploy**: GitHub Pages ou Vercel
- **Domain**: docs.rotamestre.tec.br

### Estrutura do Projeto

```
docs-rotamestre/
├── docs/
│   ├── intro.md
│   ├── getting-started/
│   │   ├── installation.md
│   │   ├── quickstart.md
│   │   └── authentication.md
│   ├── api/
│   │   ├── rest-api.md
│   │   ├── graphql.md
│   │   └── webhooks.md
│   ├── guides/
│   │   ├── routing.md
│   │   ├── optimization.md
│   │   └── integrations.md
│   └── reference/
│       ├── database-schema.md
│       ├── rls-policies.md
│       └── environment-vars.md
├── blog/
├── static/
└── docusaurus.config.js
```

### Passos de Implementação

#### 3.1 Setup Inicial

```bash
# Criar projeto Docusaurus
npx create-docusaurus@latest docs-rotamestre classic --typescript

cd docs-rotamestre

# Instalar dependências adicionais
npm install @docusaurus/plugin-content-docs
npm install @docusaurus/theme-search-algolia
```

#### 3.2 Configurar Docusaurus

**docusaurus.config.ts:**

```typescript
import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';

const config: Config = {
  title: 'RotaMestre Docs',
  tagline: 'Documentação técnica e guias de integração',
  favicon: 'img/favicon.ico',

  url: 'https://docs.rotamestre.tec.br',
  baseUrl: '/',

  organizationName: 'rotamestre',
  projectName: 'docs',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'pt-BR',
    locales: ['pt-BR', 'en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/rotamestre/docs/tree/main/',
        },
        blog: {
          showReadingTime: true,
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'RotaMestre',
      logo: {
        alt: 'RotaMestre Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/rotamestre',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started',
            },
            {
              label: 'API Reference',
              to: '/docs/api',
            },
          ],
        },
        {
          title: 'Comunidade',
          items: [
            {
              label: 'Discord',
              href: 'https://discord.gg/rotamestre',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/rotamestre',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} RotaMestre.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  },
};

export default config;
```

#### 3.3 Criar Documentação Inicial

**docs/intro.md:**

```markdown
---
sidebar_position: 1
---

# Introdução

Bem-vindo à documentação do **RotaMestre**!

## O que é o RotaMestre?

RotaMestre é uma plataforma completa para gestão e otimização de rotas de entrega...

## Começando

- [Instalação](./getting-started/installation)
- [Quickstart](./getting-started/quickstart)
- [Autenticação](./getting-started/authentication)

## Recursos

- ✅ Otimização de rotas
- ✅ Rastreamento em tempo real
- ✅ Dashboard analytics
- ✅ API REST completa
```

**docs/api/rest-api.md:**

```markdown
---
sidebar_position: 1
---

# REST API

## Autenticação

Todas as requisições devem incluir o token JWT:

\`\`\`bash
curl -H "Authorization: Bearer <token>" \
     https://api.rotamestre.tec.br/api/v1/rotas
\`\`\`

## Endpoints

### Listar Rotas

\`\`\`http
GET /api/v1/rotas
\`\`\`

**Response:**

\`\`\`json
{
  "data": [
    {
      "id": "uuid",
      "motorista_id": "uuid",
      "status": "em_andamento",
      "paradas": []
    }
  ]
}
\`\`\`
```

#### 3.4 Deploy

**GitHub Pages:**

```bash
# Build
npm run build

# Deploy (usando gh-pages)
npm install --save-dev gh-pages
npm run deploy
```

**Vercel:**

```bash
# Deploy
vercel --prod

# Configurar domínio
vercel domains add docs.rotamestre.tec.br
```

#### 3.5 Configurar DNS

```dns
docs.rotamestre.tec.br.    IN    CNAME    rotamestre.github.io.
# ou
docs.rotamestre.tec.br.    IN    CNAME    cname.vercel-dns.com.
```

#### 3.6 Checklist

- [ ] Docusaurus configurado
- [ ] Estrutura de docs criada
- [ ] Documentação inicial escrita
- [ ] API reference completa
- [ ] Guias de integração
- [ ] Search configurado (Algolia)
- [ ] Deploy automatizado
- [ ] DNS configurado
- [ ] Analytics configurado

---

## 4. 🔗 API Gateway - api.rotamestre.tec.br

### Objetivo
Expor API pública com endpoints para rotas, otimização e autenticação.

### Stack Tecnológico
- **Runtime**: Supabase Edge Functions (Deno)
- **Proxy**: Cloudflare Workers (opcional)
- **Rate Limiting**: Upstash Redis
- **Monitoring**: Sentry + Supabase Logs

### Arquitetura

```
Client → api.rotamestre.tec.br → Supabase Edge Functions → PostgreSQL
                                  ↓
                            Rate Limiter (Redis)
                                  ↓
                            Auth Middleware
                                  ↓
                            Business Logic
```

### Estrutura do Projeto

```
supabase/functions/
├── _shared/
│   ├── cors.ts
│   ├── auth.ts
│   └── rate-limit.ts
├── auth/
│   └── index.ts              # POST /auth/login, /auth/register
├── rotas/
│   ├── index.ts              # GET, POST /rotas
│   └── [id].ts               # GET, PATCH, DELETE /rotas/:id
├── otimizacao/
│   └── index.ts              # POST /otimizacao/calcular
└── webhooks/
    └── tracking.ts           # POST /webhooks/tracking
```

### Passos de Implementação

#### 4.1 Setup Edge Functions

```bash
# Instalar Supabase CLI
npm install -g supabase

# Inicializar projeto (se ainda não)
supabase init

# Criar função de exemplo
supabase functions new rotas
```

#### 4.2 Implementar Autenticação

**supabase/functions/_shared/auth.ts:**

```typescript
import { createClient } from '@supabase/supabase-js'

export async function verifyAuth(req: Request) {
  const authHeader = req.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }

  const token = authHeader.replace('Bearer ', '')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw new Error('Invalid token')
  }

  return user
}
```

#### 4.3 Implementar Rate Limiting

**supabase/functions/_shared/rate-limit.ts:**

```typescript
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_URL')!,
  token: Deno.env.get('UPSTASH_REDIS_TOKEN')!,
})

export async function checkRateLimit(userId: string): Promise<boolean> {
  const key = `rate_limit:${userId}`
  const limit = 100 // requests per minute

  const count = await redis.incr(key)

  if (count === 1) {
    await redis.expire(key, 60)
  }

  return count <= limit
}
```

#### 4.4 Endpoint de Rotas

**supabase/functions/rotas/index.ts:**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { verifyAuth } from '../_shared/auth.ts'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar autenticação
    const user = await verifyAuth(req)

    // Rate limiting
    const allowed = await checkRateLimit(user.id)
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Criar cliente Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // GET /rotas
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('rotas')
        .select('*')
        .eq('motorista_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /rotas
    if (req.method === 'POST') {
      const body = await req.json()

      const { data, error } = await supabase
        .from('rotas')
        .insert({
          ...body,
          motorista_id: user.id,
        })
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

#### 4.5 Deploy Edge Functions

```bash
# Deploy todas as funções
supabase functions deploy

# Ou deploy individual
supabase functions deploy rotas

# Configurar secrets
supabase secrets set UPSTASH_REDIS_URL=https://...
supabase secrets set UPSTASH_REDIS_TOKEN=...
```

#### 4.6 Configurar CNAME Custom

```dns
api.rotamestre.tec.br.    IN    CNAME    xezslsyxjivunmhhyxtd.supabase.co.
```

**Ou usar proxy (Cloudflare Workers):**

```javascript
// worker.js
export default {
  async fetch(request) {
    const url = new URL(request.url)

    // Reescrever URL
    url.hostname = 'xezslsyxjivunmhhyxtd.supabase.co'

    // Forward request
    return fetch(url, request)
  }
}
```

#### 4.7 Checklist

- [ ] Edge Functions implementadas
- [ ] Autenticação JWT funcionando
- [ ] Rate limiting configurado
- [ ] CORS configurado
- [ ] Endpoints testados
- [ ] Documentação da API escrita
- [ ] Deploy realizado
- [ ] DNS configurado
- [ ] Monitoring configurado (Sentry)
- [ ] Logs configurados

---

## 📅 Cronograma de Implementação

### Semana 1-2: App Web
- Dias 1-3: Build e otimizações web
- Dias 4-5: Deploy e testes
- Dias 6-7: DNS e monitoring

### Semana 3-4: Painel Gestor
- Dias 1-5: Setup e desenvolvimento
- Dias 6-7: Deploy e testes

### Semana 5: Documentação
- Dias 1-3: Setup Docusaurus e estrutura
- Dias 4-5: Escrever documentação
- Dias 6-7: Deploy e Algolia search

### Semana 6: API Gateway
- Dias 1-3: Edge Functions e rate limiting
- Dias 4-5: Testes e monitoring
- Dias 6-7: Deploy e documentação

---

## ✅ Checklist Geral

### Infraestrutura
- [ ] DNS configurado para todos os domínios
- [ ] SSL/TLS ativo em todos
- [ ] Monitoring configurado (Uptime + Performance)
- [ ] Error tracking (Sentry)
- [ ] Analytics configurado

### Segurança
- [ ] HTTPS forçado
- [ ] Headers de segurança
- [ ] Rate limiting implementado
- [ ] CORS configurado corretamente
- [ ] Secrets gerenciados (Vercel/Supabase)

### Performance
- [ ] CDN configurado (Vercel/Cloudflare)
- [ ] Images otimizadas
- [ ] Code splitting
- [ ] Lazy loading
- [ ] Lighthouse score > 90

### Documentação
- [ ] README atualizado
- [ ] API docs completa
- [ ] Guias de deploy
- [ ] Troubleshooting guides

---

**Última atualização**: 2025-10-20
**Mantido por**: Equipe RotaMestre
