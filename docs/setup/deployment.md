# 🚀 Guia de Deploy - RotaMestre

## 📋 Índice
- [Configurações de Redirecionamento](#configurações-de-redirecionamento)
- [Deploy Web (Vercel)](#deploy-web-vercel)
- [Deploy Web (Netlify)](#deploy-web-netlify)
- [Deploy Web (Nginx)](#deploy-web-nginx)
- [Deploy Mobile (iOS/Android)](#deploy-mobile-iosandroid)
- [Variáveis de Ambiente](#variáveis-de-ambiente)

---

## 🔒 Configurações de Redirecionamento

### Forçar HTTPS e Remover WWW

O projeto está configurado para:
- ✅ Forçar HTTPS em todas as requisições
- ✅ Redirecionar `www.rotamestre.tec.br` → `rotamestre.tec.br`
- ✅ Redirecionar `www.app.rotamestre.tec.br` → `app.rotamestre.tec.br`
- ✅ Headers de segurança (HSTS, XSS Protection, etc.)

---

## 🌐 Deploy Web (Vercel)

### 1. Configuração Automática

O arquivo `vercel.json` já está configurado com:
- Redirecionamentos www → non-www
- Force HTTPS
- Security headers

### 2. Deploy via CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### 3. Deploy via GitHub

1. Conecte seu repositório no [Vercel Dashboard](https://vercel.com)
2. Configure as variáveis de ambiente
3. Deploy automático a cada push na branch `main`

### 4. Variáveis de Ambiente (Vercel)

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-key
EXPO_PUBLIC_BASE_URL=https://rotamestre.tec.br
EXPO_PUBLIC_API_URL=https://api.rotamestre.tec.br
```

---

## 🌐 Deploy Web (Netlify)

### 1. Configuração Automática

O arquivo `_redirects` já está configurado com redirecionamentos.

### 2. Deploy via CLI

```bash
# Instalar Netlify CLI
npm i -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

### 3. Arquivo netlify.toml (opcional)

```toml
[build]
  command = "npx expo export:web"
  publish = "dist"

[[redirects]]
  from = "https://www.rotamestre.tec.br/*"
  to = "https://rotamestre.tec.br/:splat"
  status = 301
  force = true

[[redirects]]
  from = "http://rotamestre.tec.br/*"
  to = "https://rotamestre.tec.br/:splat"
  status = 301
  force = true

[[headers]]
  for = "/*"
  [headers.values]
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
```

---

## 🖥️ Deploy Web (Nginx)

### 1. Usar configuração fornecida

```bash
# Copiar configuração
sudo cp nginx.conf /etc/nginx/sites-available/rotamestre

# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/rotamestre /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 2. Certificados SSL (Let's Encrypt)

```bash
# Instalar certbot
sudo apt install certbot python3-certbot-nginx

# Obter certificados
sudo certbot --nginx -d rotamestre.tec.br -d www.rotamestre.tec.br

# Renovação automática já está configurada
```

---

## 📱 Deploy Mobile (iOS/Android)

### Build de Desenvolvimento

```bash
# iOS (requer macOS)
npx expo run:ios

# Android
npx expo run:android
```

### Build de Produção (EAS Build)

#### 1. Instalar EAS CLI

```bash
npm install -g eas-cli
eas login
```

#### 2. Configurar EAS

```bash
eas build:configure
```

#### 3. Build iOS

```bash
# Development build
eas build --platform ios --profile development

# Production build
eas build --platform ios --profile production
```

#### 4. Build Android

```bash
# Development build
eas build --platform android --profile development

# Production build (AAB para Google Play)
eas build --platform android --profile production
```

#### 5. Submeter para Lojas

```bash
# iOS App Store
eas submit --platform ios

# Google Play Store
eas submit --platform android
```

### Configuração eas.json

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCD123456"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

---

## 🔐 Variáveis de Ambiente

### Arquivo .env (local)

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

### EAS Secrets (para builds)

```bash
# Adicionar secrets ao EAS
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..."
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value "AIza..."
```

---

## 📦 Checklist de Deploy

### Pré-Deploy
- [ ] Atualizar versão em `app.json`
- [ ] Testar build local: `npx expo run:ios` / `npx expo run:android`
- [ ] Verificar variáveis de ambiente
- [ ] Executar testes (quando implementados)
- [ ] Verificar RLS policies no Supabase

### Deploy Web
- [ ] Build web: `npx expo export:web`
- [ ] Deploy para Vercel/Netlify
- [ ] Verificar redirecionamentos HTTPS
- [ ] Testar URLs: rotamestre.tec.br, www.rotamestre.tec.br
- [ ] Verificar security headers

### Deploy Mobile
- [ ] Atualizar certificados de assinatura
- [ ] Build iOS: `eas build --platform ios --profile production`
- [ ] Build Android: `eas build --platform android --profile production`
- [ ] Testar builds em dispositivos reais
- [ ] Submit para App Store / Google Play

### Pós-Deploy
- [ ] Monitorar logs de erro (Sentry/LogRocket)
- [ ] Verificar analytics
- [ ] Atualizar documentação
- [ ] Notificar equipe/usuários

---

## 🛠️ Troubleshooting

### Erro: "HTTPS redirect not working"
- Verificar configuração do servidor (Vercel/Netlify/Nginx)
- Checar DNS records (A/CNAME)
- Validar certificados SSL

### Erro: "WWW redirect loop"
- Verificar ordem dos redirects no `vercel.json` ou `_redirects`
- Confirmar que não há conflitos no DNS

### Erro: "Build failed on EAS"
- Verificar secrets configurados: `eas secret:list`
- Checar logs: `eas build:view [BUILD_ID]`
- Validar `app.json` e `eas.json`

### Erro: "Google Maps not showing"
- Confirmar API Key no `.env`
- Verificar API Key habilitada no Google Cloud Console
- Checar permissões de localização no `app.json`

---

## 📚 Recursos Adicionais

- [Expo Documentation](https://docs.expo.dev/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Vercel Redirects](https://vercel.com/docs/concepts/projects/project-configuration#redirects)
- [Netlify Redirects](https://docs.netlify.com/routing/redirects/)
- [Nginx SSL Config](https://ssl-config.mozilla.org/)

---

**Última atualização**: 2025-10-20
**Versão do App**: 1.0.0
