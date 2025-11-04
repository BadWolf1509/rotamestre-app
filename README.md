# 📱 Rota Mestre - App

App mobile/web para gestores e motoristas.

**Stack:** React Native 0.81.5 + Expo 54 + TypeScript + Supabase

## 🚀 Setup Rápido

```bash
npm install
cp .env.example .env
# Preencher: SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_MAPS_API_KEY
npm start
```

## 🛠️ Comandos

```bash
npm start              # Dev mode (Expo)
npm run build:web      # Build web
npm run android        # Android emulator
npm run ios            # iOS emulator (macOS only)
```

## 🌐 Deploy

```bash
git push origin main   # Deploy automático (Vercel)
vercel --prod          # Deploy manual
```

**Produção:** https://app.rotamestre.tec.br

## 📚 Documentação

Consulte `/docs/DEV_GUIDE.md` (na raiz do projeto) para informações completas sobre:
- Setup detalhado
- Arquitetura do banco
- Troubleshooting
- Design system
