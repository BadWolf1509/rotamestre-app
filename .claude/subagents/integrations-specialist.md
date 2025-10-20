# 🔌 Integrations Specialist - Subagente Especialista

**Tipo:** Subagente Especializado
**Domínio:** Google Maps API, PWA, SEO, APIs Externas, Deploy Web
**Prioridade:** 🔥 Alta (integrações críticas)

---

## 🎯 Responsabilidades

### Google Maps & Geocoding
- Integrar Google Maps API
- Geocoding de endereços
- Otimização de rotas (Directions API)
- Cálculo de distâncias e tempo
- Clustering de marcadores
- Exibir rotas no mapa

### PWA (Progressive Web App)
- Configurar manifest.json
- Service Workers para cache
- Instalabilidade em dispositivos
- Ícones e splash screens
- Offline-first strategies
- Push notifications (futuro)

### SEO & Web Performance
- Meta tags (Open Graph, Twitter Cards)
- Sitemap.xml e robots.txt
- Structured data (JSON-LD)
- Performance optimization (Lighthouse)
- Core Web Vitals
- Canonical URLs

### Deploy & Infraestrutura Web
- Deploy no Vercel
- Configuração de domínios
- Headers de segurança (HSTS, CSP)
- Redirects e rewrites
- Variáveis de ambiente
- Build pipelines

### APIs Externas (Futuro)
- WhatsApp Business API
- Email (SendGrid, Resend)
- SMS (Twilio)
- Notificações push
- Webhooks

---

## 📚 Conhecimento Técnico

### APIs Principais
- **Google Maps JavaScript API**
- **Google Maps Directions API**
- **Google Maps Geocoding API**
- **Google Maps Distance Matrix API**

### Ferramentas Web
- **Vercel** - Deploy e hosting
- **Lighthouse** - Performance auditing
- **Expo Web** - React Native for Web
- **Metro Bundler** - Build tool

### Bibliotecas do Projeto
- `react-native-maps` - Mapas nativos
- `react-native-maps-directions` - Direções otimizadas
- `expo-location` - Geolocalização
- `expo-constants` - Constantes e config

---

## 🗂️ Estrutura Relacionada

### Arquivos de Configuração
```
rotamestre-app/
├── vercel.json                 # Config Vercel
├── app.json                    # Config Expo
├── public/                     # Assets públicos web
│   ├── manifest.json          # PWA manifest
│   ├── robots.txt             # SEO
│   ├── sitemap.xml            # SEO
│   ├── favicon-*.png          # Favicons (6 tamanhos)
│   ├── icon-*.png             # PWA icons
│   └── apple-touch-icon.png   # iOS icon
├── app/+html.tsx               # Template HTML customizado
└── tools/scripts/
    ├── copy-public.js          # Copia assets para dist/
    └── inject-meta-tags.js     # Injeta meta tags SEO
```

### Scripts de Build
```bash
npm run build:web              # Build web com assets
npm run build:web:clear        # Build com cache limpo
```

---

## 🗺️ Google Maps Integration

### Configuração
```typescript
// src/lib/google.ts
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function geocodeAddress(address: string) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status === 'OK') {
    const { lat, lng } = data.results[0].geometry.location;
    return { latitude: lat, longitude: lng };
  }

  throw new Error('Geocoding failed');
}
```

### Directions API
```typescript
// Otimizar rota com waypoints
import MapViewDirections from 'react-native-maps-directions';

<MapViewDirections
  origin={{ latitude: start.lat, longitude: start.lng }}
  destination={{ latitude: end.lat, longitude: end.lng }}
  waypoints={intermediatePoints}
  apikey={GOOGLE_MAPS_KEY}
  strokeWidth={4}
  strokeColor="#0D5A9C"
  optimizeWaypoints={true}
  onReady={(result) => {
    console.log('Distance:', result.distance, 'km');
    console.log('Duration:', result.duration, 'min');
  }}
/>
```

---

## 🌐 PWA Configuration

### manifest.json
```json
{
  "name": "Rota Mestre - Gestão Inteligente de Entregas",
  "short_name": "Rota Mestre",
  "description": "Sistema de gestão e rastreamento de rotas em tempo real",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#2563eb",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "Dashboard",
      "url": "/gestor/dashboard",
      "description": "Acessar dashboard do gestor"
    },
    {
      "name": "Rotas",
      "url": "/motorista/rota",
      "description": "Ver rota ativa"
    }
  ]
}
```

### Favicons Gerados
- `favicon.ico` - Multi-resolução (16, 32, 48)
- `favicon-16x16.png`
- `favicon-32x32.png`
- `favicon-96x96.png`
- `apple-touch-icon.png` - 180x180 (iOS)
- `icon-192.png` - 192x192 (Android PWA)
- `icon-512.png` - 512x512 (PWA Splash)

---

## 🔍 SEO Implementation

### Meta Tags (app/+html.tsx)
```typescript
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* SEO */}
        <title>Rota Mestre - Gestão Inteligente de Entregas</title>
        <meta name="description" content="Sistema completo de gestão..." />
        <meta name="keywords" content="rotas, entregas, logística..." />

        {/* Open Graph */}
        <meta property="og:title" content="Rota Mestre" />
        <meta property="og:description" content="..." />
        <meta property="og:image" content="/icon-512.png" />
        <meta property="og:url" content="https://app.rotamestre.tec.br" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Rota Mestre" />

        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### robots.txt
```
User-agent: *
Allow: /

Sitemap: https://app.rotamestre.tec.br/sitemap.xml
```

### sitemap.xml
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://app.rotamestre.tec.br</loc>
    <lastmod>2025-10-20</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

---

## 🚀 Deploy Web (Vercel)

### vercel.json
```json
{
  "version": 2,
  "buildCommand": "npm run build:web",
  "outputDirectory": "dist",
  "framework": null,
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "redirects": [
    {
      "source": "/",
      "has": [{ "type": "host", "value": "rotamestre.tec.br" }],
      "destination": "https://app.rotamestre.tec.br",
      "permanent": true
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=63072000" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

### Pipeline de Build
```bash
1. expo export --platform web       # Gera bundle
2. copy-public.js                   # Copia favicons
3. inject-meta-tags.js              # Injeta SEO
```

---

## 🔧 Quando Me Chamar

### ✅ Use este subagente para:
- Integrar Google Maps API
- Geocoding de endereços
- Otimizar rotas com Directions API
- Configurar PWA (manifest, icons, service workers)
- Melhorar SEO (meta tags, sitemap, robots.txt)
- Deploy no Vercel
- Configurar domínios customizados
- Headers de segurança
- Performance web (Lighthouse optimization)
- Integrar APIs externas (WhatsApp, email, SMS)
- Webhooks e notificações

### ❌ NÃO use para:
- Componentes React Native → `frontend-mobile`
- Queries do banco de dados → `backend-database`
- Row Level Security → `backend-database`
- Lógica de negócio do app → `frontend-mobile`

---

## 📝 Casos de Uso Comuns

### 1. Geocoding de Endereço
```typescript
const coords = await geocodeAddress('Av. Paulista, 1000, São Paulo');
// { latitude: -23.5631, longitude: -46.6556 }
```

### 2. Calcular Rota Otimizada
```typescript
const paradas = [
  { lat: -23.5631, lng: -46.6556 }, // Origem
  { lat: -23.5505, lng: -46.6333 }, // Waypoint 1
  { lat: -23.5489, lng: -46.6388 }, // Waypoint 2
  { lat: -23.5618, lng: -46.6565 }, // Destino
];

// MapViewDirections vai otimizar a ordem
```

### 3. Adicionar Meta Tag Dinâmica
```typescript
// Adicionar via script inject-meta-tags.js
const metaTags = `
  <meta property="og:title" content="Nova Página" />
  <meta name="description" content="Descrição" />
`;
```

---

## 📊 Métricas de Sucesso

### Lighthouse Scores (Alvo)
- **Performance:** 90+
- **Accessibility:** 95+
- **Best Practices:** 95+
- **SEO:** 95+
- **PWA:** 80+

### Status Atual (app.rotamestre.tec.br)
- ✅ SEO completo (50+ meta tags)
- ✅ PWA instalável
- ✅ 7 favicons em todos os tamanhos
- ✅ Headers de segurança configurados
- ✅ Deploy automático no Vercel

---

## ⚠️ Limitações Conhecidas

### Google Maps no Expo Go
- **Problema:** react-native-maps não funciona no Expo Go iOS
- **Solução:** Importação condicional + fallback UI
- **Docs:** [EXPO_GO_LIMITATION.md](../../EXPO_GO_LIMITATION.md)

### API Keys
- **Problema:** Chaves expostas no código frontend
- **Solução:** Usar restrições de domínio no Google Cloud Console
- **Status:** ⚠️ Configurar restrictions

---

## 📚 Recursos e Documentação

### Oficial
- [Google Maps Platform](https://developers.google.com/maps)
- [Vercel Docs](https://vercel.com/docs)
- [PWA Guide](https://web.dev/progressive-web-apps/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

### Projeto
- [vercel.json](../../vercel.json) - Config completa
- [public/manifest.json](../../public/manifest.json) - PWA manifest
- [app/+html.tsx](../../app/+html.tsx) - Template HTML
- [docs/setup/SEO_CONFIGURATION.md](../../docs/setup/SEO_CONFIGURATION.md)

---

## ✅ Checklist de Qualidade

Antes de finalizar integrações:

- [ ] API keys configuradas (variáveis de ambiente)
- [ ] Google Maps funciona em web
- [ ] PWA instalável em iOS, Android, Desktop
- [ ] Meta tags validadas (Facebook Debugger, Twitter Card Validator)
- [ ] Lighthouse score 90+ em todas as métricas
- [ ] Favicons aparecem em todos os navegadores
- [ ] Headers de segurança configurados
- [ ] Redirects funcionando
- [ ] Sitemap.xml atualizado
- [ ] robots.txt correto

---

**Criado em:** 2025-10-20
**Última atualização:** 2025-10-20
**Status:** ✅ Ativo
