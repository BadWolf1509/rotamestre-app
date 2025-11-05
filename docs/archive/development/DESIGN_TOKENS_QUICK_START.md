# ⚡ Design Tokens - Quick Start

**Versão:** 1.0
**Data:** 23/10/2025

---

## 🚀 Começando em 2 Minutos

### 1. Importar os Tokens

```tsx
import { colors, typography, spacing, borderRadius, shadows } from '@/lib/design-tokens';
import { StyleSheet } from 'react-native';
```

### 2. Usar nos Estilos

```tsx
const styles = StyleSheet.create({
  // ✅ Título Principal
  title: {
    ...typography.styles.h1,        // Viga, 28px, bold
    color: colors.text.primary,     // #111827 (cinza escuro)
  },

  // ✅ Card Simples
  card: {
    padding: spacing.md,                 // 16px
    backgroundColor: colors.background.primary,  // #ffffff
    borderRadius: borderRadius.lg,       // 12px
    ...shadows.card,                     // Sombra padrão
  },

  // ✅ Texto Secundário
  description: {
    ...typography.styles.body,      // Nunito Sans, 14px, regular
    color: colors.text.secondary,   // #6b7280 (cinza médio)
    marginTop: spacing.sm,          // 8px
  },
});
```

---

## 📚 Exemplos Comuns

### Card de Conteúdo

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '@/lib/design-tokens';

export default function ContentCard({ title, description }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
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
  description: {
    ...typography.styles.body,
    color: colors.text.secondary,
  },
});
```

### Botão Primário

```tsx
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/lib/design-tokens';

export default function PrimaryButton({ label, onPress }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary.main,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minHeight: 44, // Acessibilidade
  },
  text: {
    ...typography.styles.button,
    color: colors.white,
  },
});
```

### Input com Label

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
        placeholderTextColor={colors.text.tertiary}
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
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    minHeight: 44,
  },
});
```

### Badge de Status

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { borderRadius, getBadgeColor } from '@/lib/design-tokens';

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
      <Text style={[styles.text, { color: text }]}>
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
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
```

### Lista com Separadores

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/lib/design-tokens';

export default function ListItem({ title, subtitle }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    ...typography.styles.h3,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.styles.caption,
    color: colors.text.secondary,
  },
});
```

---

## 🎨 Atalhos Úteis

### Cores de Texto

```tsx
// ✅ Use atalhos semânticos
color: colors.text.primary     // Texto principal
color: colors.text.secondary   // Texto secundário
color: colors.text.tertiary    // Texto terciário
color: colors.text.disabled    // Texto desabilitado
color: colors.text.inverse     // Texto em fundos escuros
color: colors.text.link        // Links

// Ou use a escala de cinzas diretamente
color: colors.gray[900]  // Mesmo que text.primary
color: colors.gray[500]  // Mesmo que text.secondary
```

### Espaçamentos Comuns

```tsx
padding: spacing.xs        // 4px  - Muito pequeno
padding: spacing.sm        // 8px  - Pequeno
padding: spacing.md        // 16px - Padrão (MAIS USADO)
padding: spacing.lg        // 24px - Grande
padding: spacing.xl        // 32px - Muito grande

// Combine para criar espaçamentos customizados
paddingVertical: spacing.sm    // 8px vertical
paddingHorizontal: spacing.md  // 16px horizontal
```

### Tipografia Pré-Definida

```tsx
// ✅ Use estilos pré-definidos sempre que possível
...typography.styles.h1      // Título principal (Viga, 28px)
...typography.styles.h2      // Subtítulo (Nunito Bold, 20px)
...typography.styles.h3      // Título de card (Nunito Semibold, 16px)
...typography.styles.body    // Corpo de texto (Nunito, 14px)
...typography.styles.caption // Textos pequenos (Nunito, 12px)
...typography.styles.button  // Texto de botão (Nunito Semibold, 16px)

// E sobrescreva apenas o necessário
...typography.styles.h3,
color: colors.primary.main,  // Muda apenas a cor
```

### Cores de Status

```tsx
// ✅ Use as cores semânticas
backgroundColor: colors.success  // Verde - Concluído
backgroundColor: colors.warning  // Amarelo - Pendente
backgroundColor: colors.error    // Vermelho - Erro
backgroundColor: colors.info     // Azul - Informação

// Ou use a função utilitária para badges
const { background, text } = getBadgeColor('em_andamento');
```

---

## 🎯 Boas Práticas

### ✅ FAZER

```tsx
// ✅ Usar tokens
backgroundColor: colors.primary.main
padding: spacing.md
...typography.styles.h3

// ✅ Sobrescrever apenas o necessário
...typography.styles.body,
color: colors.primary.main,

// ✅ Usar funções utilitárias
const { background, text } = getBadgeColor(status);
```

### ❌ EVITAR

```tsx
// ❌ Valores hardcoded
backgroundColor: '#1e5aa8'
padding: 16
fontSize: 14

// ❌ Recriar estilos existentes
fontSize: 16,
fontWeight: '600',
lineHeight: 24,
// Em vez disso: ...typography.styles.h3
```

---

## 📱 Exemplo Completo

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  getBadgeColor,
} from '@/lib/design-tokens';

interface TaskCardProps {
  title: string;
  status: 'pendente' | 'em_andamento' | 'concluida';
  dueDate: string;
  onPress: () => void;
}

export default function TaskCard({ title, status, dueDate, onPress }: TaskCardProps) {
  const { background, text } = getBadgeColor(status);

  const statusLabels = {
    pendente: 'Pendente',
    em_andamento: 'Em Andamento',
    concluida: 'Concluída',
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.badge, { backgroundColor: background }]}>
          <Text style={[styles.badgeText, { color: text }]}>
            {statusLabels[status]}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Ionicons name="calendar-outline" size={16} color={colors.text.secondary} />
        <Text style={styles.date}>{dueDate}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Card
  card: {
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.styles.h3,
    flex: 1,
    marginRight: spacing.sm,
  },

  // Badge
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    ...typography.styles.caption,
    fontWeight: '600',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  date: {
    ...typography.styles.caption,
    color: colors.text.secondary,
  },
});
```

---

## 🔗 Links Úteis

- **Design Tokens (código):** `src/lib/design-tokens.ts`
- **Guia Completo:** `docs/development/DESIGN_TOKENS_GUIDE.md`
- **Exemplo RouteCard:** `src/components/examples/RouteCard.tsx`
- **Brand Guidelines:** `docs/BRAND_GUIDELINES.md`

---

## 💡 Dica Final

**Sempre que criar um novo componente:**

1. Importe os tokens necessários
2. Use estilos pré-definidos (`typography.styles.*`)
3. Use tokens ao invés de valores hardcoded
4. Consulte o RouteCard como referência
5. Teste em diferentes telas e estados

**Atalho mental:**
- **Cores?** → `colors.*`
- **Texto?** → `typography.styles.*`
- **Espaço?** → `spacing.*`
- **Status?** → `getBadgeColor(status)`

---

**Última atualização:** 23/10/2025
**Mantido por:** Equipe RotaMestre
