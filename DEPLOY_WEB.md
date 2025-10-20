# 🚀 Deploy Web - RotaMestre

## ✅ Status: Build Web Funcionando!

O build web do RotaMestre foi testado e está pronto para deploy.

---

## 📊 Informações do Build

**Comando de Build:**
```bash
npx expo export --platform web
```

**Resultados:**
- ✅ Bundle gerado: 1.9 MB
- ✅ 943 módulos incluídos
- ✅ 18 assets (imagens)
- ✅ Tempo de build: ~22 segundos
- ✅ Output: `dist/` directory

**Estrutura do Build:**
```
dist/
├── _expo/
│   └── static/
│       ├── css/
│       └── js/
├── assets/
├── favicon.ico
├── index.html
└── metadata.json
```

---

## 🌐 Deploy para Vercel

### Método 1: CLI (Mais Rápido)

```bash
# 1. Instalar Vercel CLI (se ainda não tiver)
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod

# 4. Configurar domínio customizado
vercel domains add app.rotamestre.tec.br
```

### Método 2: GitHub (Automático)

1. **Push para GitHub:**
   ```bash
   git add .
   git commit -m "feat: Adiciona build web do Expo"
   git push origin main
   ```

2. **Conectar no Vercel:**
   - Acesse https://vercel.com
   - Click "New Project"
   - Importe o repositório `rotamestre-app`
   - Configure:
     - **Framework Preset**: Other
     - **Build Command**: `npx expo export --platform web`
     - **Output Directory**: `dist`
     - **Install Command**: `npm install --legacy-peer-deps`

3. **Adicionar Variáveis de Ambiente:**
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
   - `EXPO_PUBLIC_BASE_URL`
   - `EXPO_PUBLIC_API_URL`

4. **Deploy:**
   - Click "Deploy"
   - Aguarde ~2 minutos

5. **Configurar Domínio:**
   - Settings → Domains
   - Add `app.rotamestre.tec.br`
   - Configurar DNS (CNAME)

---

## 🌐 Deploy para Netlify

```bash
# 1. Instalar Netlify CLI
npm i -g netlify-cli

# 2. Login
netlify login

# 3. Deploy
netlify deploy --prod --dir=dist

# 4. Configurar domínio
netlify domains:add app.rotamestre.tec.br
```

**netlify.toml:**
```toml
[build]
  command = "npx expo export --platform web"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## 🌍 Configuração DNS

### Para Vercel:

```dns
app.rotamestre.tec.br.    300   IN   CNAME   cname.vercel-dns.com.
```

### Para Netlify:

```dns
app.rotamestre.tec.br.    300   IN   CNAME   rotamestre-app.netlify.app.
```

---

## 🔧 Variáveis de Ambiente

Copie do `.env.example` e configure na plataforma de deploy:

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Google Maps
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyB...

# URLs
EXPO_PUBLIC_BASE_URL=https://rotamestre.tec.br
EXPO_PUBLIC_API_URL=https://api.rotamestre.tec.br
```

---

## ✅ Pós-Deploy Checklist

### Verificações Básicas
- [ ] Site acessível em https://app.rotamestre.tec.br
- [ ] SSL/TLS funcionando (cadeado verde)
- [ ] Redirects funcionando (www → non-www)
- [ ] Todas as rotas carregando corretamente

### Funcionalidades
- [ ] Login/autenticação funcionando
- [ ] Dashboard gestor acessível
- [ ] Dashboard motorista acessível
- [ ] Mapas carregando (ou placeholder)
- [ ] Formulários validando

### Performance
- [ ] Lighthouse Performance > 80
- [ ] First Contentful Paint < 2s
- [ ] Time to Interactive < 3s
- [ ] Bundle size otimizado

### SEO e Analytics
- [ ] Meta tags configuradas
- [ ] Analytics funcionando
- [ ] Sitemap gerado
- [ ] robots.txt configurado

---

## 📊 Monitoramento

### Vercel Analytics (Incluído)
```
Performance metrics
Web Vitals
Traffic analytics
```

### Google Analytics (Opcional)

Adicione no `app.json`:
```json
{
  "expo": {
    "web": {
      "config": {
        "firebase": {
          "measurementId": "G-XXXXXXXXXX"
        }
      }
    }
  }
}
```

---

## 🐛 Troubleshooting

### Erro: "Build failed"

```bash
# Limpar cache
rm -rf dist/ .expo/ node_modules/
npm install --legacy-peer-deps
npx expo export --platform web
```

### Erro: "Module not found"

Verifique se todas as dependências estão instaladas:
```bash
npm install react-dom react-native-web --legacy-peer-deps
```

### Erro: "Deployment timeout"

Aumente o timeout no `vercel.json`:
```json
{
  "functions": {
    "build": {
      "maxDuration": 300
    }
  }
}
```

### Build muito lento

```bash
# Use variável de ambiente para otimizar
EXPO_USE_FAST_REFRESH=false npx expo export --platform web
```

---

## 🚀 Performance Tips

### 1. Code Splitting

Já configurado automaticamente pelo Metro bundler.

### 2. Image Optimization

```typescript
import { Image } from 'expo-image'

<Image
  source={{ uri: 'https://...' }}
  placeholder={blurhash}
  contentFit="cover"
  transition={1000}
/>
```

### 3. Lazy Loading

```typescript
import { lazy, Suspense } from 'react'

const HeavyComponent = lazy(() => import('./HeavyComponent'))

<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

### 4. Bundle Analyzer

```bash
npx expo export --platform web --bundle-output bundle.js
npx source-map-explorer bundle.js
```

---

## 📝 Comandos Úteis

```bash
# Build local
npx expo export --platform web

# Preview local
npx serve dist

# Deploy Vercel
vercel --prod

# Deploy Netlify
netlify deploy --prod --dir=dist

# Limpar cache
rm -rf .expo dist

# Rebuild completo
npm run clean && npm install && npx expo export --platform web
```

---

## 🔗 Links Úteis

- [Expo Web Documentation](https://docs.expo.dev/workflow/web/)
- [Vercel Documentation](https://vercel.com/docs)
- [Netlify Documentation](https://docs.netlify.com/)
- [React Native Web](https://necolas.github.io/react-native-web/)

---

**Status**: ✅ Pronto para Deploy
**Última atualização**: 2025-10-20
**Build testado**: Sim
**Tempo estimado de deploy**: 5-10 minutos
