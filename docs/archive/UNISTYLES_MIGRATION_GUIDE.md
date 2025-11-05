# Guia de Migração para React Native Unistyles

## ⚠️ Configuração Importante - Unistyles v3

O Unistyles v3 requer:
1. **React 19+** - Atualizado para 19.2.0 ✅
2. **React Native 0.78+** - Atualizado para 0.82.1 ✅
3. **Babel plugin com opção `root`** - Configurado em babel.config.js ✅
4. **Import do unistyles.ts** - Deve estar em app/_layout.tsx ✅

### Configuração do Babel (IMPORTANTE)

O plugin Babel do Unistyles v3 **requer** a opção `root`. Para projetos Expo Router:

```javascript
// babel.config.js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-unistyles/plugin', { root: 'app' }], // 'app' para Expo Router
    ],
  };
};
```

### API Correta do Unistyles v3

```tsx
// Imports corretos
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

// No componente
const { theme } = useUnistyles();

// Criar estilos (note: theme => não (theme) =>)
const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.gray50,
  },
}));

// Usar estilos (note: styles.container(theme) - chamada de função)
<View style={styles.container(theme)}>
```

## ✅ Componentes Já Migrados

### Dashboard Gestor (100% Completo)
- ✅ **StatsCard.tsx** - Componente compartilhado de estatísticas
- ✅ **RotaCard.tsx** - Card de rota compartilhado
- ✅ **DashboardMobile.tsx** - Layout mobile com scroll vertical
- ✅ **DashboardDesktop.tsx** - Layout desktop com sidebar
- ✅ **Sidebar.tsx** - Navegação lateral desktop
- ✅ **RotasTable.tsx** - Tabela de rotas estilo desktop

## 🔄 Padrão de Migração

### 1. Imports
```tsx
// ANTES (v2 ou NativeWind)
import { createStyleSheet, useStyles } from 'react-native-unistyles';

// DEPOIS (Unistyles v3)
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
```

### 2. Usar Hook useUnistyles
```tsx
// No componente
export function MyComponent() {
  const { theme } = useUnistyles(); // Apenas theme, não styles

  return (
    <View style={styles.container(theme)}> {/* Passar theme como parâmetro */}
      <Text style={styles.title(theme)}>Hello</Text>
    </View>
  );
}
```

### 3. Criar Stylesheet com StyleSheet.create
```tsx
// No final do arquivo (FORA do componente)
const styles = StyleSheet.create(theme => ({ // Não 'stylesheet', use 'styles'
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography['2xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
}));
```

### 4. Substituir className por style
```tsx
// ANTES
<View className="flex-1 bg-gray-50 p-4">
  <Text className="text-2xl font-sans-bold text-gray-900">
    Título
  </Text>
</View>

// DEPOIS
<View style={styles.container}>
  <Text style={styles.title}>
    Título
  </Text>
</View>

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography['2xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
}));
```

### 5. Cores Dinâmicas
```tsx
// ANTES
function getStatusColor(status: string): string {
  switch (status) {
    case 'concluida':
      return '#10b981';
    default:
      return '#6b7280';
  }
}

// DEPOIS
function getStatusColor(status: string, theme: any): string {
  switch (status) {
    case 'concluida':
      return theme.colors.success;
    default:
      return theme.colors.gray500;
  }
}

// No componente
const statusColor = getStatusColor(rota.status, theme);
```

## 🎨 Design Tokens Disponíveis

### Cores (theme.colors)
```typescript
primary, primaryDark, primaryLight, primaryBg
secondary, secondaryDark, secondaryLight, secondaryBg
success, successBg
warning, warningBg
error, errorBg
info, infoBg
gray50, gray100, ...gray900
white, black, transparent
purple
```

### Espaçamento (theme.spacing)
```typescript
xs: 4, sm: 8, md: 12, lg: 16, xl: 20
'2xl': 24, '3xl': 32, '4xl': 40, '5xl': 48, '6xl': 64
```

### Border Radius (theme.borderRadius)
```typescript
sm: 8, md: 10, lg: 12, xl: 16, full: 9999
```

### Tipografia (theme.typography)
```typescript
// Families
fontDisplay, fontSans, fontSansLight, fontSansMedium,
fontSansSemiBold, fontSansBold, fontSansExtraBold

// Sizes
xs: 12, sm: 14, base: 16, lg: 18, xl: 20
'2xl': 24, '3xl': 30, '4xl': 36
```

### Sombras (theme.shadows)
```typescript
sm: { shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation }
md: { ... }
lg: { ... }

// Uso
container: {
  ...theme.shadows.md,
}
```

## 📱 Breakpoints Disponíveis

```typescript
breakpoints = {
  xs: 0,     // Mobile pequeno
  sm: 576,   // Mobile grande
  md: 768,   // Tablet
  lg: 1024,  // Desktop
  xl: 1280,  // Desktop grande
}
```

### Uso de Breakpoints
```tsx
// No stylesheet
const stylesheet = createStyleSheet((theme) => ({
  container: {
    variants: {
      breakpoint: {
        xs: {
          padding: theme.spacing.sm,
        },
        md: {
          padding: theme.spacing.lg,
        },
        lg: {
          padding: theme.spacing['2xl'],
        },
      },
    },
  },
}));
```

## 📋 Telas Pendentes de Migração

### Gestor (app/gestor/)
- ⏳ **nova-entrega.tsx** - Formulário de nova rota
- ⏳ **motoristas.tsx** - Lista de motoristas
- ⏳ **historico.tsx** - Histórico de rotas
- ⏳ **mapa-rota.tsx** - Visualização de mapa

### Motorista (app/motorista/)
- ⏳ **rota.tsx** - Tela principal do motorista
- ⏳ **checkpoints.tsx** - Checkpoints da rota
- ⏳ **resumo.tsx** - Resumo da rota
- ⏳ **historico.tsx** - Histórico do motorista

### Auth (app/auth/)
- ⏳ **login.tsx** - Tela de login
- ⏳ **register.tsx** - Cadastro
- ⏳ **forgot-password.tsx** - Recuperação de senha

### Perfil (app/perfil/)
- ⏳ **index.tsx** - Perfil do usuário
- ⏳ **trocar-senha.tsx** - Trocar senha

### Onboarding
- ⏳ **first-password.tsx** - Primeira senha

### Unidade (app/unidade/)
- ⏳ **index.tsx** - Gestão de unidade
- ⏳ **equipe.tsx** - Equipe da unidade
- ⏳ **transferir.tsx** - Transferência

## 🚀 Como Migrar uma Tela

1. **Abrir o arquivo da tela**
2. **Adicionar imports do Unistyles**
3. **Adicionar `const { styles, theme } = useStyles(stylesheet)` no componente**
4. **Substituir todos os `className` por `style={styles.xxx}`**
5. **Criar `const stylesheet = createStyleSheet((theme) => ({ ... }))` no final**
6. **Mapear classes Tailwind para propriedades de estilo**:
   - `flex-1` → `flex: 1`
   - `bg-gray-50` → `backgroundColor: theme.colors.gray50`
   - `p-4` → `padding: theme.spacing.lg`
   - `rounded-lg` → `borderRadius: theme.borderRadius.lg`
   - `text-2xl` → `fontSize: theme.typography['2xl']`
   - `font-sans-bold` → `fontFamily: theme.typography.fontSansBold`

## 💡 Dicas

### 1. Agrupar estilos relacionados
```tsx
// Bom
const stylesheet = createStyleSheet((theme) => ({
  // Container styles
  container: { ... },
  content: { ... },

  // Header styles
  header: { ... },
  headerTitle: { ... },
  headerSubtitle: { ... },

  // Button styles
  primaryButton: { ... },
  secondaryButton: { ... },
}));
```

### 2. Reutilizar estilos com spread
```tsx
baseButton: {
  padding: theme.spacing.lg,
  borderRadius: theme.borderRadius.lg,
  alignItems: 'center',
},
primaryButton: {
  ...baseButton, // não funciona em Unistyles
  backgroundColor: theme.colors.primary,
},
// Melhor: usar arrays de estilos
<TouchableOpacity style={[styles.baseButton, styles.primaryButton]}>
```

### 3. Condicionais de estilo
```tsx
// No componente
<View style={[
  styles.row,
  isActive && styles.rowActive,
  index % 2 === 0 ? styles.rowEven : styles.rowOdd,
]}>
```

### 4. Estilos inline quando necessário
```tsx
// Para valores dinâmicos
<View style={[styles.badge, { backgroundColor: statusColor }]}>
<View style={[styles.progressBar, { width: `${percent}%` }]}>
```

## ⚠️ Problemas Comuns

### 1. `gap` não funciona em todas as plataformas
```tsx
// Solução: use marginBottom ou marginRight
items: {
  marginBottom: theme.spacing.md,
}
```

### 2. `minHeight: '100vh'` não funciona em React Native
```tsx
// Solução: use flex
container: {
  flex: 1, // ocupa toda a altura disponível
}
```

### 3. Pseudo-classes (hover, active) não existem
```tsx
// Use activeOpacity em TouchableOpacity
<TouchableOpacity activeOpacity={0.7} style={styles.button}>
```

## 🎯 Resultado Esperado

Depois de migrar todas as telas:
- ✅ Design system consistente em todo o app
- ✅ Suporte a breakpoints responsivos
- ✅ Performance otimizada (Unistyles compila em tempo de execução)
- ✅ TypeScript com autocomplete completo
- ✅ Sem dependências de NativeWind ou Tailwind
- ✅ Código mais limpo e manutenível
