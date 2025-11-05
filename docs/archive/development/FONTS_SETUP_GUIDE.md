# 🔤 Guia de Configuração de Fontes - RotaMestre

**Data:** 23/10/2025
**Status:** ⚠️ Fontes instaladas mas não carregadas
**Prioridade:** Alta

---

## ⚠️ Status Atual

### ✅ Instaladas (package.json)
```json
"@expo-google-fonts/nunito-sans": "^0.4.2",
"@expo-google-fonts/viga": "^0.4.1",
"expo-font": "~14.0.9",
```

### ❌ NÃO Carregadas
O `app/_layout.tsx` não está carregando as fontes customizadas.

**Impacto:** A aplicação está usando fontes do sistema ao invés de Viga e Nunito Sans.

---

## 🔧 Solução: Carregar as Fontes

### Opção 1: Via Expo Google Fonts (Recomendado)

#### 1. Atualizar `app/_layout.tsx`

Adicione o carregamento das fontes no topo do arquivo:

```tsx
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform, View, Text } from 'react-native';
import Toast from 'react-native-toast-message';
// ✨ ADICIONAR ESTES IMPORTS
import { useFonts } from 'expo-font';
import {
  NunitoSans_300Light,
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NunitoSans_800ExtraBold,
} from '@expo-google-fonts/nunito-sans';
import { Viga_400Regular } from '@expo-google-fonts/viga';
import * as SplashScreen from 'expo-splash-screen';

// ✨ PREVENIR AUTO-HIDE DO SPLASH
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // ✨ CARREGAR AS FONTES
  const [fontsLoaded, fontError] = useFonts({
    // Nunito Sans (variável)
    'Nunito Sans': NunitoSans_400Regular,
    'NunitoSans-Light': NunitoSans_300Light,
    'NunitoSans-Regular': NunitoSans_400Regular,
    'NunitoSans-Medium': NunitoSans_500Medium,
    'NunitoSans-SemiBold': NunitoSans_600SemiBold,
    'NunitoSans-Bold': NunitoSans_700Bold,
    'NunitoSans-ExtraBold': NunitoSans_800ExtraBold,

    // Viga
    'Viga': Viga_400Regular,
  });

  // ✨ ESCONDER SPLASH QUANDO FONTES CARREGAREM
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // ✨ MOSTRAR LOADING ENQUANTO FONTES NÃO CARREGAM
  if (!fontsLoaded && !fontError) {
    return null; // Ou um loading component
  }

  // ✨ SE HOUVER ERRO, MOSTRAR MENSAGEM
  if (fontError) {
    console.error('Erro ao carregar fontes:', fontError);
    // Continua com fontes do sistema
  }

  // ... resto do código existente
  useEffect(() => {
    // Configurar título da página para web apenas
    if (Platform.OS === 'web') {
      // ... código existente
    }
  }, []);

  return (
    <>
      <Stack screenOptions={{ /* ... */ }}>
        {/* ... screens existentes */}
      </Stack>
      <Toast config={{ /* ... */ }} />
    </>
  );
}
```

#### 2. Instalar Dependência (se necessário)

```bash
npm install expo-splash-screen
```

---

### Opção 2: Via Arquivos de Fonte (Manual)

Se preferir usar arquivos de fonte locais:

#### 1. Baixar as Fontes

**Nunito Sans:**
- https://fonts.google.com/specimen/Nunito+Sans
- Baixar variável (variable font) ou pesos individuais (300, 400, 500, 600, 700, 800)

**Viga:**
- https://fonts.google.com/specimen/Viga
- Baixar peso 400 (único disponível)

#### 2. Colocar na Pasta `assets/fonts/`

```
assets/
└── fonts/
    ├── NunitoSans-VariableFont_YTLC,opsz,wdth,wght.ttf
    ├── NunitoSans-Light.ttf (opcional)
    ├── NunitoSans-Regular.ttf (opcional)
    ├── NunitoSans-Medium.ttf (opcional)
    ├── NunitoSans-SemiBold.ttf (opcional)
    ├── NunitoSans-Bold.ttf (opcional)
    ├── NunitoSans-ExtraBold.ttf (opcional)
    └── Viga-Regular.ttf
```

#### 3. Carregar no `app/_layout.tsx`

```tsx
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Viga': require('../assets/fonts/Viga-Regular.ttf'),
    'Nunito Sans': require('../assets/fonts/NunitoSans-VariableFont_YTLC,opsz,wdth,wght.ttf'),
    // Ou pesos individuais:
    'NunitoSans-Light': require('../assets/fonts/NunitoSans-Light.ttf'),
    'NunitoSans-Regular': require('../assets/fonts/NunitoSans-Regular.ttf'),
    'NunitoSans-Medium': require('../assets/fonts/NunitoSans-Medium.ttf'),
    'NunitoSans-SemiBold': require('../assets/fonts/NunitoSans-SemiBold.ttf'),
    'NunitoSans-Bold': require('../assets/fonts/NunitoSans-Bold.ttf'),
    'NunitoSans-ExtraBold': require('../assets/fonts/NunitoSans-ExtraBold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  // ... resto do código
}
```

---

## 🎯 Recomendação

**Use a Opção 1 (Expo Google Fonts)** porque:
- ✅ Já está instalado
- ✅ Mais fácil de manter
- ✅ Otimizado pelo Expo
- ✅ Sem arquivos de fonte no repositório

---

## ✅ Validar Instalação

### 1. Testar no Código

Após carregar as fontes, teste:

```tsx
import { Text, StyleSheet } from 'react-native';

export default function TestFont() {
  return (
    <>
      <Text style={styles.viga}>Teste Viga</Text>
      <Text style={styles.nunitoRegular}>Teste Nunito Regular</Text>
      <Text style={styles.nunitoBold}>Teste Nunito Bold</Text>
    </>
  );
}

const styles = StyleSheet.create({
  viga: {
    fontFamily: 'Viga',
    fontSize: 28,
  },
  nunitoRegular: {
    fontFamily: 'Nunito Sans',
    fontSize: 16,
  },
  nunitoBold: {
    fontFamily: 'Nunito Sans',
    fontWeight: '700',
    fontSize: 16,
  },
});
```

### 2. Verificar no Console

Se houver erro, você verá no console:
```
Erro ao carregar fontes: [mensagem de erro]
```

### 3. Verificar Visualmente

As fontes devem ser claramente diferentes:
- **Viga:** Fonte display, bold por natureza, geométrica
- **Nunito Sans:** Fonte arredondada, mais suave, profissional

---

## 🐛 Troubleshooting

### Problema: "Font family not found"

**Causa:** Fontes não foram carregadas ou nome incorreto.

**Solução:**
1. Verificar se `useFonts` retornou `true` em `fontsLoaded`
2. Verificar se o nome da fonte está exatamente como no `useFonts`
3. Limpar cache: `npx expo start --clear`

### Problema: Fonte não está bold/italic

**Causa:** Peso ou estilo não disponível.

**Solução:**
```tsx
// ❌ ERRADO
fontFamily: 'Nunito Sans',
fontWeight: '900', // Peso não existe

// ✅ CORRETO
fontFamily: 'NunitoSans-ExtraBold', // Peso 800 (máximo)
```

### Problema: Fontes carregam devagar

**Causa:** Fontes grandes ou muitas variantes.

**Solução:**
1. Carregar apenas pesos usados (400, 600, 700)
2. Usar Expo Google Fonts (otimizado)
3. Preload com `SplashScreen.preventAutoHideAsync()`

---

## 📊 Pesos Disponíveis

### Nunito Sans
| Peso | Valor | Nome |
|------|-------|------|
| Light | 300 | NunitoSans_300Light |
| Regular | 400 | NunitoSans_400Regular |
| Medium | 500 | NunitoSans_500Medium |
| SemiBold | 600 | NunitoSans_600SemiBold |
| Bold | 700 | NunitoSans_700Bold |
| ExtraBold | 800 | NunitoSans_800ExtraBold |

### Viga
| Peso | Valor | Nome |
|------|-------|------|
| Regular | 400 | Viga_400Regular |

**Nota:** Viga só tem peso 400, mas é bold por natureza.

---

## 🎨 Design Tokens Atualizados

Após carregar as fontes, os design tokens funcionarão corretamente:

```tsx
import { typography } from '@/lib/design-tokens';

const styles = StyleSheet.create({
  title: {
    ...typography.styles.h1, // ✅ Agora usa Viga
  },
  body: {
    ...typography.styles.body, // ✅ Agora usa Nunito Sans
  },
});
```

---

## 📝 Checklist de Instalação

- [ ] Verificar que pacotes estão instalados (package.json)
- [ ] Adicionar imports no `app/_layout.tsx`
- [ ] Adicionar `useFonts` hook
- [ ] Adicionar `expo-splash-screen`
- [ ] Testar carregamento (fontsLoaded = true)
- [ ] Validar visualmente (Viga e Nunito Sans aparecem)
- [ ] Testar design tokens (`typography.styles.*`)
- [ ] Limpar cache se necessário (`npx expo start --clear`)

---

## 🚀 Próximos Passos

Após carregar as fontes:

1. **Testar visualmente**
   - Abrir app no simulador/device
   - Verificar se fontes estão corretas

2. **Usar nos componentes**
   - Aplicar `typography.styles.*` nos componentes
   - Substituir `fontWeight` hardcoded por estilos pré-definidos

3. **Migrar componentes existentes**
   - Ver: `docs/development/MIGRATION_TO_DESIGN_TOKENS.md`

---

## 📚 Links Úteis

- **Expo Google Fonts:** https://github.com/expo/google-fonts
- **Nunito Sans:** https://fonts.google.com/specimen/Nunito+Sans
- **Viga:** https://fonts.google.com/specimen/Viga
- **Expo Font:** https://docs.expo.dev/versions/latest/sdk/font/
- **Design Tokens:** `src/lib/design-tokens.ts`

---

**Última atualização:** 23/10/2025
**Mantido por:** Equipe RotaMestre
