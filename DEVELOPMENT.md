# 🚀 Guia de Desenvolvimento - RotaMestre

## 🛠️ Setup Local

### Requisitos
- Node.js 18+
- npm ou yarn
- Android Studio (para Android) ou Xcode (para iOS)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/BadWolf1509/rotamestre-app.git
cd rotamestre-app

# Instale dependências
npm install

# Configure .env
cp .env.example .env
# Edite .env com suas credenciais Supabase e Google Maps
```

### Variáveis de Ambiente

```env
EXPO_PUBLIC_SUPABASE_URL=https://xezslsyxjivunmhhyxtd.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-key-here
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-key-here
```

---

## 📱 Executando o App

### Modo Desenvolvimento

```bash
# Iniciar servidor Expo
npm start

# Web
npm run web                # http://localhost:8081

# Mobile
npm run android            # Android emulator
npm run ios                # iOS simulator (macOS)
```

### Build para Produção

```bash
# Web
npm run build:web
vercel --prod              # Deploy no Vercel

# Android APK
eas build --platform android --profile preview
```

---

## 📂 Estrutura do Projeto

```
rotamestre-app/
├── app/                   # Rotas (Expo Router)
│   ├── (auth)/           # Login, registro
│   ├── gestor/           # Dashboard gestor
│   └── motorista/        # App motorista
│
├── src/
│   ├── components/       # Componentes UI
│   ├── hooks/            # Custom hooks
│   ├── lib/              # Supabase, utils
│   └── types/            # TypeScript types
│
├── database/             # SQL migrations
└── __tests__/            # Testes Jest + Maestro
```

---

## 🎨 Design System (Unistyles)

```typescript
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  container: {
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
}));
```

**Tokens disponíveis:**
- `theme.colors.*` - Paleta de cores
- `theme.spacing.*` - Espaçamentos (xs, sm, md, lg, xl, 2xl, 3xl)
- `theme.typography.*` - Tamanhos e fontes
- `theme.shadows.*` - Elevações
- `theme.borderRadius.*` - Bordas arredondadas

---

## 🧪 Testes

### Testes Unitários (Jest)

```bash
# Todos os testes
npm test

# Modo watch
npm run test:watch

# Cobertura
npm run test:coverage
```

### Testes E2E (Maestro)

```bash
# Instalar Maestro
curl -Ls https://get.maestro.mobile.dev | bash

# Executar fluxo
maestro test .maestro/login-gestor.yaml
```

---

## 🔍 Debugging

### TypeScript

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

### Limpar Cache

```bash
npx expo start --clear
```

---

## 📦 Dependências Principais

- **Expo SDK 54** - Framework
- **React Native** - UI nativa
- **TypeScript** - Type safety
- **Supabase** - Backend (auth, database, storage)
- **Unistyles** - Design system
- **Expo Router** - Navegação
- **react-native-maps** - Mapas mobile
- **react-hook-form + zod** - Formulários

---

## 🐛 Troubleshooting Comum

### Erro: Metro bundler

```bash
npx expo start --clear
```

### Erro: Android build

```bash
cd android && ./gradlew clean && cd ..
npx expo prebuild --clean
```

### Erro: Types não encontrados

```bash
npm run typecheck
```

### Erro: Supabase connection

Verifique credenciais no `.env`

---

## 📝 Convenções de Código

- **Componentes**: PascalCase (`MyComponent.tsx`)
- **Hooks**: camelCase com prefixo `use` (`useAuth.ts`)
- **Utilitários**: camelCase (`formatDate.ts`)
- **Tipos**: PascalCase (`UserProfile`)
- **Constantes**: UPPER_SNAKE_CASE (`API_BASE_URL`)

---

## 🚀 Deploy

### Web (Vercel)

```bash
git push origin main       # Deploy automático
```

### Mobile (EAS)

```bash
eas build --platform android
eas submit --platform android
```

---

**Última atualização:** 19/11/2025