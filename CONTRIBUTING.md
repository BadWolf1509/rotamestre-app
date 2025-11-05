# 🛠️ Guia de Desenvolvimento - Rota Mestre

> Guia prático para desenvolver no projeto como dev solo

---

## 📋 Índice

1. [Setup Inicial](#setup-inicial)
2. [Estrutura do Código](#estrutura-do-código)
3. [Padrões de Código](#padrões-de-código)
4. [Trabalhando com Design System](#design-system)
5. [Trabalhando com Database](#database)
6. [Testes](#testes)
7. [Git Workflow](#git-workflow)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Setup Inicial

### Requisitos
- Node.js 18+
- npm 9+
- Git
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (para Android) ou Xcode (para iOS)

### Instalação

```bash
git clone https://github.com/BadWolf1509/rotamestre-app.git
cd rotamestre-app
npm install
cp .env.example .env
# Preencher .env com credenciais
npm start
```

---

## 📁 Estrutura do Código

```
app/                        # Telas (Expo Router)
├── auth/                   # Login, registro
├── gestor/                 # Dashboard gestor
├── motorista/              # App motorista
├── perfil/                 # Perfil
└── unidade/                # Gestão unidade

src/
├── components/             # Componentes reutilizáveis
│   ├── Button.tsx         # Botão padrão
│   ├── Toast.tsx          # Notificações
│   └── DataTable.tsx      # Tabela responsiva
│
├── hooks/                  # Custom hooks
│   ├── useToast.ts        # Sistema de toasts
│   ├── useBreakpoint.ts   # Responsividade
│   └── useProfile.ts      # Perfil do usuário
│
├── lib/                    # Libs e utils
│   ├── supabase.ts        # Cliente Supabase
│   └── utils.ts           # Funções auxiliares
│
├── styles/                 # Design system
│   └── unistyles.ts       # Tema e tokens
│
└── types/                  # TypeScript types
    └── database.types.ts  # Tipos do Supabase
```

---

## 🎨 Padrões de Código

### TypeScript

**Sempre use tipos explícitos:**
```tsx
// ✅ BOM
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

// ❌ RUIM
function Button(props: any) { ... }
```

### Componentes

**Padrão de componente funcional:**
```tsx
import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface MyComponentProps {
  title: string;
  onPress?: () => void;
}

export function MyComponent({ title, onPress }: MyComponentProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
  },
  title: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
}));
```

### Hooks

**Custom hooks sempre começam com `use`:**
```tsx
import { useState, useEffect } from 'react';

export function useProfile(userId: string) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  async function loadProfile() {
    // lógica...
  }

  return { profile, loading, refresh: loadProfile };
}
```

---

## 🎨 Design System (Unistyles v3)

### Cores

```tsx
// Usar sempre theme.colors
const styles = StyleSheet.create(theme => ({
  primary: {
    backgroundColor: theme.colors.primary,
    color: theme.colors.white,
  },
  success: {
    backgroundColor: theme.colors.success,
  },
  error: {
    backgroundColor: theme.colors.error,
  },
}));
```

**Cores disponíveis:**
- `primary`, `primaryDark`, `primaryLight`
- `secondary`, `secondaryDark`
- `success`, `warning`, `error`, `info`
- `gray50` até `gray900`
- `white`, `black`

### Espaçamento

```tsx
// Usar sempre theme.spacing
padding: theme.spacing.lg,      // 16px
marginTop: theme.spacing['2xl'], // 24px
gap: theme.spacing.sm,           // 8px
```

**Tamanhos:** `xs`(4), `sm`(8), `md`(12), `lg`(16), `xl`(20), `2xl`(24), `3xl`(32), `4xl`(40), `5xl`(48)

### Typography

```tsx
// Usar sempre theme.typography
fontSize: theme.typography.lg,              // 18px
fontFamily: theme.typography.fontSansBold,  // Lato-Bold
```

**Sizes:** `xs`(12), `sm`(14), `base`(16), `lg`(18), `xl`(20), `2xl`(24), `3xl`(30), `4xl`(36)

**Families:** `fontSans`, `fontSansLight`, `fontSansMedium`, `fontSansSemiBold`, `fontSansBold`

### Responsividade

```tsx
import { useBreakpoint } from '@/hooks/useBreakpoint';

export function MyScreen() {
  const { isDesktop, isMobile } = useBreakpoint();

  return isDesktop ? <DesktopLayout /> : <MobileLayout />;
}
```

---

## 🗄️ Database (Supabase)

### Estrutura das Tabelas

| Tabela | Colunas Principais | RLS |
|--------|-------------------|-----|
| `profiles` | id, nome, email, papel, unidade_id | ✅ Por papel |
| `unidades` | id, nome, cnpj, endereco | ✅ Por unidade |
| `rotas` | id, data, motorista_id, status | ✅ Por papel + unidade |
| `paradas` | id, rota_id, endereco, ordem, status, foto_url | ✅ Via rota |

### Aplicar Migrations

```bash
cd tools/scripts
node apply-migration.js nome-da-migration.sql
```

**Ver todas migrations:** [database/MIGRATIONS.md](database/MIGRATIONS.md)

### Tipos TypeScript

Os tipos são gerados automaticamente do Supabase:

```bash
npx supabase gen types typescript --project-id xezslsyxjivunmhhyxtd > src/types/database.types.ts
```

### Queries Comuns

```tsx
import { supabase } from '@/lib/supabase';

// Buscar perfil do usuário
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

// Buscar rotas do gestor
const { data: rotas } = await supabase
  .from('rotas')
  .select(`
    *,
    motorista:profiles!motorista_id(nome, email),
    paradas(count)
  `)
  .eq('unidade_id', unidadeId)
  .order('data', { ascending: false });

// Criar nova rota
const { data, error } = await supabase
  .from('rotas')
  .insert({
    motorista_id: motoristId,
    data: new Date().toISOString(),
    status: 'pendente',
  })
  .select()
  .single();
```

---

## 🧪 Testes

### Rodar Testes

```bash
npm test                # Rodar todos os testes
npm test Button         # Testar apenas Button
npm run test:coverage   # Ver cobertura
```

### Estrutura de Testes

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button Component', () => {
  it('deve renderizar corretamente', () => {
    const { getByText } = render(<Button>Clique</Button>);
    expect(getByText('Clique')).toBeTruthy();
  });

  it('deve chamar onPress quando clicado', () => {
    const mockPress = jest.fn();
    const { getByText } = render(
      <Button onPress={mockPress}>Clique</Button>
    );

    fireEvent.press(getByText('Clique'));
    expect(mockPress).toHaveBeenCalledTimes(1);
  });
});
```

---

## 🔀 Git Workflow

### Branches

- `main` - Produção (protegida)
- `develop` - Desenvolvimento
- `feature/nome` - Features
- `fix/nome` - Correções

### Commits

Use Conventional Commits:

```bash
feat: adiciona botão de deletar rota
fix: corrige erro no upload de foto
docs: atualiza README
refactor: simplifica hook useProfile
style: ajusta espaçamento no dashboard
```

### Pull Requests

Não precisa de PR (dev solo). Push direto:

```bash
git add .
git commit -m "feat: adiciona nova funcionalidade"
git push origin main
```

Deploy automático no Vercel.

---

## 🐛 Troubleshooting

### Metro Bundler Travando

```bash
npx expo start --clear
# ou
rm -rf node_modules/.cache
```

### Erro de TypeScript

```bash
npm run typecheck
```

### Build Android Falhando

```bash
cd android
./gradlew clean
cd ..
npx expo prebuild --clean
```

### Supabase RLS Bloqueando Query

```sql
-- Ver políticas ativas
SELECT * FROM pg_policies WHERE tablename = 'rotas';

-- Testar como usuário
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "user-id-here"}';
SELECT * FROM rotas;
```

### Expo Go Não Carregando

Verifique se:
1. Mobile e PC estão na mesma rede
2. Firewall não está bloqueando porta 8081
3. Use modo Tunnel: `npx expo start --tunnel`

### Google Maps Não Aparecendo

Verifique `.env`:
```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
```

E se a API key tem permissões para:
- Maps JavaScript API (web)
- Maps SDK for Android/iOS (mobile)

---

## 📚 Recursos Úteis

- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)
- [Supabase Docs](https://supabase.com/docs)
- [Unistyles Docs](https://reactnativeunistyles.vercel.app/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)

---

## 💡 Dicas Finais

1. **Sempre use o design system** - Não crie cores ou espaçamentos customizados
2. **Teste em mobile e web** - A maioria dos bugs acontece em uma plataforma específica
3. **Commits pequenos e frequentes** - Melhor que um commit gigante
4. **Documente código complexo** - Seu eu futuro agradece
5. **Use o console do Supabase** - Para debugar queries SQL
6. **Aproveite o hot reload** - Salve e veja mudanças instantâneas

---

**Dúvidas?** Consulte o [README.md](README.md) principal ou abra uma issue.

**Última atualização:** 05/11/2025
