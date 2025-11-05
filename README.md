# 📱 Rota Mestre - App

> Sistema completo de gestão de rotas para gestores e motoristas

**Stack:** React Native 0.81.5 • Expo 54 • TypeScript • Supabase • Unistyles • Google Maps

**Produção:** https://app.rotamestre.tec.br

---

## 🚀 Setup Rápido (< 5 min)

```bash
# 1. Clone e instale
git clone https://github.com/BadWolf1509/rotamestre-app.git
cd rotamestre-app
npm install

# 2. Configure variáveis de ambiente
cp .env.example .env
# Preencha: SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_MAPS_API_KEY

# 3. Rode o app
npm start              # Dev mode (Expo)
npm run android        # Android emulator
npm run ios            # iOS emulator (macOS only)
npm run web            # Web (localhost:8081)
```

**URLs Locais:**
- 📱 **App (mobile/web):** http://localhost:8081
- 🗺️ **Painel admin:** (futuro)

---

## 📁 Estrutura do Projeto

```
rotamestre-app/
├── app/                    # Telas (Expo Router)
│   ├── auth/              # Login, registro
│   ├── gestor/            # Dashboard, rotas, motoristas
│   ├── motorista/         # Rotas ativas, checkpoints
│   ├── perfil/            # Perfil do usuário
│   └── unidade/           # Gestão de unidade
│
├── src/
│   ├── components/        # Componentes reutilizáveis
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Supabase, utils
│   ├── styles/            # Design tokens (Unistyles)
│   └── types/             # TypeScript types
│
├── database/              # Migrations SQL
├── tools/                 # MCPs, scripts
└── docs/                  # Documentação detalhada
```

---

## 🛠️ Comandos Principais

### Desenvolvimento
```bash
npm start                  # Dev mode (Expo)
npm run typecheck          # Verificar erros TypeScript
npm test                   # Rodar testes (futuro)
npm run lint               # Lint do código
```

### Build & Deploy
```bash
npm run build:web          # Build para web
git push origin main       # Deploy automático (Vercel)
vercel --prod              # Deploy manual
```

### Database
```bash
cd tools/scripts
node apply-migration.js    # Aplicar migrations
```

---

## 🎨 Design System

Utilizamos **React Native Unistyles v3** com design tokens centralizados:

```typescript
// src/styles/unistyles.ts
const theme = {
  colors: {
    primary: '#1e5aa8',
    success: '#10b981',
    gray50: '#f9fafb',
    // ... +40 cores
  },
  spacing: {
    sm: 8,
    md: 12,
    lg: 16,
    // ... 10 tamanhos
  },
  typography: { /* fonts, sizes */ },
  shadows: { /* sm, md, lg */ },
  borderRadius: { /* sm, md, lg, full */ },
};
```

**Uso:**
```tsx
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export function MyComponent() {
  const { theme } = useUnistyles();

  return <View style={styles.container} />;
}

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.lg,
  },
}));
```

---

## 🗄️ Banco de Dados (Supabase)

### Principais Tabelas

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Usuários (gestor, motorista, master) |
| `unidades` | Unidades operacionais |
| `rotas` | Rotas de entrega |
| `paradas` | Paradas (checkpoints) de cada rota |

### Migrations

Todas as migrations SQL estão consolidadas em:
- 📄 [database/MIGRATIONS.md](database/MIGRATIONS.md) ← **Ver aqui**

Para aplicar uma migration:
```bash
cd tools/scripts
node apply-migration.js nome-da-migration.sql
```

---

## 🔐 Autenticação

Sistema de auth com Supabase:

**Roles disponíveis:**
- `master` - Super admin (acesso total)
- `gestor` - Gerencia rotas e motoristas
- `motorista` - Visualiza e atualiza rotas próprias

**RLS (Row Level Security):**
- ✅ Gestores veem apenas dados da sua unidade
- ✅ Motoristas veem apenas rotas próprias
- ✅ Master vê tudo

---

## 🧩 Principais Recursos

### ✅ Implementado

- ✅ **Auth completo** (login, logout, recuperação de senha)
- ✅ **Dashboard gestor** (desktop e mobile)
- ✅ **Gestão de rotas** (criar, editar, excluir)
- ✅ **Gestão de motoristas** (CRUD completo)
- ✅ **App do motorista** (visualizar rotas, marcar checkpoints)
- ✅ **Upload de fotos** (comprovantes de entrega)
- ✅ **Mapas** (Google Maps web, react-native-maps mobile)
- ✅ **Responsivo** (mobile-first com melhorias desktop)
- ✅ **Design system** (Unistyles v3)

### 🚧 Em Desenvolvimento

- 🚧 Notificações push
- 🚧 Relatórios e analytics
- 🚧 Histórico detalhado
- 🚧 Testes automatizados

---

## 📚 Documentação Detalhada

Para informações técnicas detalhadas, consulte:

- 📄 [CHANGELOG](CHANGELOG.md) - Histórico de mudanças
- 📄 [CONTRIBUTING.md](CONTRIBUTING.md) - Guia de desenvolvimento
- 📄 [database/MIGRATIONS.md](database/MIGRATIONS.md) - Migrations SQL
- 📂 [docs/archive/](docs/archive/) - Documentação histórica

---

## 🐛 Troubleshooting

### Build falha no Android
```bash
cd android
./gradlew clean
cd ..
npx expo prebuild --clean
```

### Erro de cache no Metro
```bash
npx expo start --clear
```

### Erro de tipos TypeScript
```bash
npm run typecheck
```

### Supabase connection error
Verifique se `.env` está configurado com as credenciais corretas:
```env
EXPO_PUBLIC_SUPABASE_URL=https://xezslsyxjivunmhhyxtd.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 📞 Suporte

**Issues:** https://github.com/BadWolf1509/rotamestre-app/issues

**Dev:** Wellinton Ribeiro (dev solo)

---

## 📝 Licença

Proprietário - Rota Mestre © 2025

---

**Última atualização:** 05/11/2025
