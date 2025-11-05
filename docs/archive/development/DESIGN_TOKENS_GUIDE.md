# 🎨 Guia de Uso - Design Tokens

**Versão:** 1.0
**Data:** 23/10/2025
**Status:** Oficial

---

## 📋 Índice

1. [O que são Design Tokens?](#1-o-que-são-design-tokens)
2. [Como Importar](#2-como-importar)
3. [Tokens Disponíveis](#3-tokens-disponíveis)
4. [Exemplos Práticos](#4-exemplos-práticos)
5. [Funções Utilitárias](#5-funções-utilitárias)
6. [Boas Práticas](#6-boas-práticas)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. O que são Design Tokens?

Design Tokens são **valores centralizados** que garantem **consistência visual** em toda a aplicação. Em vez de usar valores hardcoded (`#1e5aa8`, `16px`, `700`), você usa tokens semânticos (`colors.primary.main`, `spacing.md`, `typography.fontWeight.bold`).

### Benefícios

✅ **Consistência:** Todos os componentes usam os mesmos valores
✅ **Manutenibilidade:** Alterar um token atualiza toda a aplicação
✅ **Escalabilidade:** Fácil adicionar dark mode, temas, etc
✅ **Documentação:** Tokens servem como documentação viva
✅ **Brand Guidelines:** Reflete exatamente o design oficial

---

## 2. Como Importar

### Importação Simples (tokens específicos)

```tsx
import { colors, typography, spacing } from '@/lib/design-tokens';
```

### Importação Completa

```tsx
import tokens from '@/lib/design-tokens';

// Uso: tokens.colors.primary.main
```

### Importação de Funções Utilitárias

```tsx
import { getBadgeColor, getStatusColor, getStatusIcon } from '@/lib/design-tokens';
```

---

## 3. Tokens Disponíveis

### 3.1 Cores (`colors`)

#### Cores Primárias
```tsx
colors.primary.main    // #1e5aa8 - Azul RotaMestre
colors.primary.dark    // #0D5A9C - Azul Escuro
colors.primary.light   // #3b82f6 - Azul Claro

colors.secondary.main  // #f7a02a - Laranja (CTA)
colors.secondary.dark  // #e68a00 - Laranja Escuro
colors.secondary.light // #ffb84d - Laranja Claro
```

#### Cores Semânticas (Status)
```tsx
colors.success  // #10b981 - Verde (Concluído)
colors.warning  // #f59e0b - Amarelo (Pendente)
colors.error    // #ef4444 - Vermelho (Cancelado)
colors.info     // #3b82f6 - Azul (Em Andamento)
```

#### Escala de Cinzas
```tsx
colors.gray[50]   // #f9fafb - Background muito claro
colors.gray[100]  // #f3f4f6 - Background secundário
colors.gray[200]  // #e5e7eb - Borders sutis
colors.gray[300]  // #d1d5db - Borders padrão
colors.gray[400]  // #9ca3af - Texto desabilitado
colors.gray[500]  // #6b7280 - Texto secundário
colors.gray[600]  // #4b5563 - Texto normal
colors.gray[700]  // #374151 - Texto escuro
colors.gray[800]  // #1f2937 - Texto muito escuro
colors.gray[900]  // #111827 - Texto preto
```

#### Backgrounds
```tsx
colors.background.primary   // #ffffff - Fundo principal
colors.background.secondary // #f9fafb - Fundo secundário
colors.background.tertiary  // #f3f4f6 - Áreas específicas
```

#### Bordas
```tsx
colors.border.light   // #e5e7eb - Borders sutis
colors.border.medium  // #d1d5db - Borders padrão
colors.border.dark    // #9ca3af - Borders em destaque
```

#### Overlays
```tsx
colors.overlay.light   // rgba(0, 0, 0, 0.1)  - Overlay sutil
colors.overlay.medium  // rgba(0, 0, 0, 0.5)  - Overlay padrão
colors.overlay.dark    // rgba(0, 0, 0, 0.8)  - Overlay escuro
```

#### Cores de Texto (Atalhos Semânticos)
```tsx
colors.text.primary    // #111827 - Texto principal (gray[900])
colors.text.secondary  // #6b7280 - Texto secundário (gray[500])
colors.text.tertiary   // #9ca3af - Texto terciário (gray[400])
colors.text.disabled   // #d1d5db - Texto desabilitado (gray[300])
colors.text.inverse    // #ffffff - Texto em fundos escuros
colors.text.link       // #1e5aa8 - Links (primary.main)
```

**Nota:** Estas cores são atalhos para facilitar o uso. Você também pode usar `colors.gray[900]`, `colors.gray[500]`, etc.

### 3.2 Tipografia (`typography`)

#### Famílias de Fonte
```tsx
typography.fontFamily.display    // 'Viga' - Títulos grandes
typography.fontFamily.body       // 'Nunito Sans' - Interface
typography.fontFamily.semibold   // 'Nunito Sans' - Botões
```

#### Tamanhos de Fonte
```tsx
typography.fontSize['5xl']  // 36 - Landing page
typography.fontSize['4xl']  // 32 - Títulos principais
typography.fontSize['3xl']  // 28 - Headers H1
typography.fontSize['2xl']  // 24 - Subtítulos H2
typography.fontSize.xl      // 20 - Títulos H3
typography.fontSize.lg      // 18 - Destaques
typography.fontSize.md      // 16 - Corpo, botões
typography.fontSize.sm      // 14 - Textos secundários
typography.fontSize.xs      // 12 - Labels, captions
```

#### Pesos de Fonte
```tsx
typography.fontWeight.light     // '300'
typography.fontWeight.regular   // '400'
typography.fontWeight.medium    // '500'
typography.fontWeight.semibold  // '600'
typography.fontWeight.bold      // '700'
typography.fontWeight.extrabold // '800'
```

#### Estilos Pré-Definidos
```tsx
typography.styles.h1      // Título Principal (Viga, 28px)
typography.styles.h2      // Subtítulo (Nunito Bold, 20px)
typography.styles.h3      // Título de Card (Nunito Semibold, 16px)
typography.styles.body    // Corpo de Texto (Nunito Regular, 14px)
typography.styles.caption // Textos Pequenos (Nunito Regular, 12px)
typography.styles.button  // Texto de Botão (Nunito Semibold, 16px)
```

### 3.3 Espaçamento (`spacing`)

```tsx
spacing.xs    // 4px  - Muito pequeno
spacing.sm    // 8px  - Pequeno (ícone + texto)
spacing.md    // 16px - Padrão (padding de cards)
spacing.lg    // 24px - Seções
spacing.xl    // 32px - Grande
spacing['2xl'] // 40px - Extra grande
spacing['3xl'] // 48px - Landing pages
```

### 3.4 Border Radius (`borderRadius`)

```tsx
borderRadius.sm   // 6px   - Inputs, tags
borderRadius.md   // 8px   - Botões
borderRadius.lg   // 12px  - Cards
borderRadius.xl   // 16px  - Modals
borderRadius.full // 9999px - Pills, avatares
```

### 3.5 Sombras (`shadows`)

```tsx
shadows.card     // Elevação 1 (cards)
shadows.modal    // Elevação 2 (modals, dropdowns)
shadows.floating // Elevação 3 (FAB, tooltips)
shadows.none     // Sem sombra
```

### 3.6 Opacidades (`opacity`)

```tsx
opacity[10]  // 0.1  - Overlay muito sutil
opacity[25]  // 0.25 - Hover states
opacity[50]  // 0.5  - Disabled states
opacity[75]  // 0.75 - Overlays escuros
opacity[90]  // 0.9  - Quase opaco
```

### 3.7 Transições (`transitions`)

```tsx
transitions.duration.fast    // 150ms - Hover
transitions.duration.normal  // 250ms - Padrão
transitions.duration.slow    // 350ms - Modals

transitions.easing.easeOut   // Entrada de elementos
transitions.easing.easeIn    // Saída de elementos
transitions.easing.easeInOut // Bidirecional
```

### 3.8 Z-Index (`zIndex`)

```tsx
zIndex.base     // 0    - Base
zIndex.header   // 10   - Headers fixos
zIndex.dropdown // 20   - Dropdowns
zIndex.modal    // 30   - Modals
zIndex.toast    // 40   - Toasts
zIndex.tooltip  // 50   - Tooltips
zIndex.max      // 9999 - Excepcional
```

### 3.9 Ícones (`icons`)

```tsx
icons.size.sm  // 16px - Labels inline
icons.size.md  // 20px - Botões, inputs
icons.size.lg  // 24px - Botões grandes
icons.size.xl  // 32px - Empty states

icons.spacing  // 8px - Espaçamento padrão com texto
```

---

## 4. Exemplos Práticos

### 4.1 Card Simples

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '@/lib/design-tokens';

export default function SimpleCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Título do Card</Text>
      <Text style={styles.text}>Texto do card aqui.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  title: {
    ...typography.styles.h3,
    marginBottom: spacing.sm,
  },
  text: {
    ...typography.styles.body,
  },
});
```

### 4.2 Botão Primário

```tsx
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/lib/design-tokens';

export default function PrimaryButton({ label, onPress }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minHeight: 44, // Acessibilidade
  },
  buttonText: {
    ...typography.styles.button,
    color: colors.white,
  },
});
```

### 4.3 Badge de Status

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { spacing, borderRadius, getBadgeColor } from '@/lib/design-tokens';

export default function StatusBadge({ status }) {
  const { background, text } = getBadgeColor(status);

  const labels = {
    pendente: 'Pendente',
    em_andamento: 'Em Andamento',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  };

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.badgeText, { color: text }]}>
        {labels[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
```

### 4.4 Input com Label

```tsx
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/lib/design-tokens';

export default function LabeledInput({ label, value, onChangeText }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.styles.body,
    fontSize: typography.fontSize.sm,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: typography.fontSize.md,
    minHeight: 44, // Acessibilidade
  },
});
```

### 4.5 Progress Bar

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/lib/design-tokens';

export default function ProgressBar({ progress, label }) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.progressBackground}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.styles.caption,
    marginBottom: spacing.xs,
  },
  progressBackground: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary.main,
  },
  progressText: {
    ...typography.styles.caption,
    color: colors.gray[600],
    textAlign: 'right',
  },
});
```

---

## 5. Funções Utilitárias

### 5.1 `getBadgeColor(status)`

Retorna as cores corretas para um badge de status.

```tsx
import { getBadgeColor } from '@/lib/design-tokens';

const status = 'em_andamento';
const { background, text } = getBadgeColor(status);

// background: '#DBEAFE' (azul claro)
// text: '#3b82f6' (azul)
```

**Status aceitos:**
- `'pendente'` → Amarelo
- `'em_andamento'` → Azul
- `'concluida'` → Verde
- `'cancelada'` → Vermelho

### 5.2 `getStatusColor(status)`

Retorna a cor correta para um ícone ou texto de status.

```tsx
import { getStatusColor } from '@/lib/design-tokens';

const color = getStatusColor('concluida');
// color: '#10b981' (verde)
```

### 5.3 `getStatusIcon(status)`

Retorna o nome do ícone (Ionicons) para cada status.

```tsx
import { getStatusIcon } from '@/lib/design-tokens';
import { Ionicons } from '@expo/vector-icons';

const iconName = getStatusIcon('em_andamento');
// iconName: 'play-circle'

<Ionicons name={iconName} size={24} color={getStatusColor('em_andamento')} />
```

---

## 6. Boas Práticas

### ✅ FAZER

1. **Sempre use tokens ao invés de valores hardcoded**
   ```tsx
   ✅ backgroundColor: colors.primary.main
   ❌ backgroundColor: '#1e5aa8'
   ```

2. **Use estilos pré-definidos quando disponíveis**
   ```tsx
   ✅ ...typography.styles.h3
   ❌ fontSize: 16, fontWeight: '600', lineHeight: 24
   ```

3. **Use spacing para margens e paddings**
   ```tsx
   ✅ padding: spacing.md
   ❌ padding: 16
   ```

4. **Use funções utilitárias para badges e status**
   ```tsx
   ✅ getBadgeColor(status)
   ❌ status === 'pendente' ? '#FEF3C7' : ...
   ```

5. **Consulte o Brand Guidelines antes de criar novos estilos**

### ❌ EVITAR

1. **Não crie valores hardcoded**
   ```tsx
   ❌ backgroundColor: '#1e5aa8'
   ❌ padding: 16
   ❌ fontSize: 14
   ```

2. **Não duplique estilos**
   ```tsx
   ❌ titleStyle: { fontSize: 16, fontWeight: '600', ... }
   ✅ ...typography.styles.h3
   ```

3. **Não use cores erradas para status**
   ```tsx
   ❌ Verde para "pendente"
   ❌ Vermelho para "concluído"
   ```

4. **Não ignore acessibilidade**
   ```tsx
   ❌ minHeight: 30 (área de toque muito pequena)
   ✅ minHeight: 44 (mínimo recomendado)
   ```

---

## 7. Troubleshooting

### Problema: "Cannot find module '@/lib/design-tokens'"

**Solução:** Verifique se o alias `@/*` está configurado no `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Problema: "Spread types may only be created from object types"

**Solução:** Use spread operator corretamente:
```tsx
✅ ...typography.styles.h3
❌ typography.styles.h3
```

### Problema: Fontes não carregam

**Solução:** Certifique-se de que as fontes estão carregadas no `app/_layout.tsx`:
```tsx
import { useFonts } from 'expo-font';

const [loaded] = useFonts({
  'Viga': require('../assets/fonts/Viga-Regular.ttf'),
  'Nunito Sans': require('../assets/fonts/NunitoSans-VariableFont_*.ttf'),
});
```

### Problema: Sombras não aparecem no Android

**Solução:** Use a propriedade `elevation` junto com `shadow*`:
```tsx
...shadows.card  // Já inclui elevation
```

---

## 📚 Referências

- **Brand Guidelines:** `docs/BRAND_GUIDELINES.md`
- **Design Tokens:** `src/lib/design-tokens.ts`
- **Componentes de Exemplo:** `src/components/examples/`
- **Ionicons:** https://ionic.io/ionicons

---

**Última atualização:** 23/10/2025
**Versão:** 1.0
**Mantido por:** Equipe RotaMestre
