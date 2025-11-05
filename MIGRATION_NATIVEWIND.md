# Migração: NativeWind → StyleSheet Puro

## 🔍 Problema Identificado

**NativeWind não é confiável** para Expo + React Native Web devido a:
- Incompatibilidades entre v2 e v4
- Problemas com PostCSS assíncrono
- Configuração complexa do Metro bundler
- Erros de build na web

## ✅ Solução: StyleSheet Nativo do React Native

Substituir classes Tailwind (`className`) por `StyleSheet.create()`.

## 📝 Mudanças Necessárias

### 1. Componentes que precisam ser reescritos:

#### ❌ ANTES (com className - NÃO FUNCIONA):
```tsx
<View className="flex-1 bg-gray-50 p-4">
  <Text className="text-2xl font-bold text-gray-900">
    Dashboard
  </Text>
</View>
```

#### ✅ DEPOIS (com StyleSheet - FUNCIONA):
```tsx
<View style={styles.container}>
  <Text style={styles.title}>
    Dashboard
  </Text>
</View>

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
});
```

### 2. Arquivos que precisam ser atualizados:

- ✅ **StatsCard.tsx** - JÁ CORRIGIDO
- ⚠️ **RotaCard.tsx** - PRECISA CORRIGIR
- ⚠️ **DashboardMobile.tsx** - PRECISA CORRIGIR
- ⚠️ **DashboardDesktop.tsx** - PRECISA CORRIGIR
- ⚠️ **Sidebar.tsx** - PRECISA CORRIGIR
- ⚠️ **RotasTable.tsx** - PRECISA CORRIGIR

### 3. Theme System Criado:

Arquivo: `src/styles/theme.ts`

Contém todos os design tokens:
- `colors` - Paleta de cores completa
- `spacing` - Sistema de espaçamento
- `borderRadius` - Raios de borda
- `typography` - Fontes e tamanhos
- `shadows` - Sombras padronizadas

**Uso**:
```tsx
import { colors, spacing, borderRadius } from '@/styles/theme';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
});
```

### 4. Arquivos para deletar:

- ❌ `tailwind.config.js`
- ❌ `global.css`
- ❌ `nativewind-env.d.ts`

## 🚀 Próximos Passos

### Opção A: Eu reescrevo todos os componentes (RECOMENDADO)
Posso reescrever todos os 6 componentes para usar StyleSheet puro.

### Opção B: Você continua com layout atual
Manter o dashboard mobile funcionando (já funciona) e adiar desktop.

### Opção C: Usar biblioteca alternativa
- `react-native-unistyles` - Melhor que NativeWind
- `tamagui` - Mais complexo mas poderoso

## 💡 Recomendação

**Opção A** é a melhor: StyleSheet puro é:
- ✅ 100% confiável
- ✅ Performance otimizada
- ✅ Sem dependências externas
- ✅ Funciona em todas as plataformas
- ✅ Tipagem perfeita com TypeScript

Quer que eu reescreva todos os componentes desktop agora?
