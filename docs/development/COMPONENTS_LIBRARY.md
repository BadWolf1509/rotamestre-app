# 🧩 Biblioteca de Componentes - RotaMestre

**Versão:** 1.0
**Data:** 23/10/2025
**Status:** ✅ 9 Componentes Prontos

---

## 📋 Visão Geral

Biblioteca completa de **9 componentes reutilizáveis** que usam **Design Tokens** para garantir consistência visual em toda a aplicação.

### ✅ Componentes Disponíveis

| # | Componente | Tipo | Linhas | Status |
|---|------------|------|--------|--------|
| 1 | **Badge.tsx** | Novo | ~140 | ✅ |
| 2 | **Input.tsx** | Novo | ~260 | ✅ |
| 3 | **EmptyState.tsx** | Novo | ~140 | ✅ |
| 4 | **Progress.tsx** | Novo | ~180 | ✅ |
| 5 | **Modal.tsx** | Novo | ~250 | ✅ |
| 6 | **Button.tsx** | Migrado | ~190 | ✅ |
| 7 | **Card.tsx** | Migrado | ~70 | ✅ |
| 8 | **ConfirmDialog.tsx** | Migrado | ~200 | ✅ |
| 9 | **SkeletonLoader.tsx** | Migrado | ~140 | ✅ |

**Total:** 9 componentes, ~1570 linhas

---

## 🎨 Componentes Novos (5)

### 1. Badge - Badge de Status

**Arquivo:** `src/components/Badge.tsx`

#### Props
```tsx
status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
label?: string                    // Label customizado
size?: 'small' | 'medium' | 'large'
variant?: 'filled' | 'outlined'
style?: ViewStyle
```

#### Exemplos
```tsx
import Badge from '@/components/Badge';

// Badge básico
<Badge status="em_andamento" />

// Badge pequeno outlined
<Badge status="concluida" size="small" variant="outlined" />

// Badge com label customizado
<Badge status="pendente" label="Aguardando" />
```

#### Features
- ✅ 4 status com cores semânticas
- ✅ 3 tamanhos (small, medium, large)
- ✅ 2 variantes (filled, outlined)
- ✅ Labels padrão em português
- ✅ Usa `getBadgeColor()` dos design tokens

---

### 2. Input - Campo de Entrada Completo

**Arquivo:** `src/components/Input.tsx`

#### Props
```tsx
label?: string
error?: string
helperText?: string
leftIcon?: keyof typeof Ionicons.glyphMap
rightIcon?: keyof typeof Ionicons.glyphMap
onRightIconPress?: () => void
size?: 'small' | 'medium' | 'large'
required?: boolean
containerStyle?: ViewStyle
// + todas as props de TextInput
```

#### Exemplos
```tsx
import Input from '@/components/Input';

// Input básico
<Input
  label="Email"
  placeholder="seu@email.com"
  value={email}
  onChangeText={setEmail}
/>

// Input com erro
<Input
  label="Senha"
  error="Senha deve ter no mínimo 6 caracteres"
  secureTextEntry
/>

// Input com ícone esquerdo
<Input
  label="Buscar"
  leftIcon="search-outline"
  placeholder="Buscar rotas..."
/>

// Input com ícone direito clicável (mostrar/ocultar senha)
<Input
  label="Senha"
  rightIcon={showPassword ? "eye-outline" : "eye-off-outline"}
  onRightIconPress={() => setShowPassword(!showPassword)}
  secureTextEntry={!showPassword}
/>

// Input obrigatório
<Input label="Nome" required />

// Input com helper text
<Input
  label="CPF"
  helperText="Apenas números, sem pontos ou traços"
/>
```

#### Features
- ✅ Label opcional com asterisco para required
- ✅ Mensagem de erro
- ✅ Helper text
- ✅ Ícones Ionicons (esquerda/direita)
- ✅ Ícone direito clicável
- ✅ 3 tamanhos
- ✅ Estados visuais (default, error, disabled)
- ✅ Acessibilidade (minHeight 44px)

---

### 3. EmptyState - Estado Vazio

**Arquivo:** `src/components/EmptyState.tsx`

#### Props
```tsx
icon?: keyof typeof Ionicons.glyphMap  // Padrão: 'file-tray-outline'
title: string
description?: string
actionLabel?: string
onActionPress?: () => void
style?: ViewStyle
```

#### Exemplos
```tsx
import EmptyState from '@/components/EmptyState';

// Empty state básico
<EmptyState
  title="Nenhuma rota encontrada"
  description="Crie sua primeira rota para começar"
/>

// Empty state com ação
<EmptyState
  icon="add-circle-outline"
  title="Nenhum motorista cadastrado"
  description="Adicione motoristas para gerenciar rotas"
  actionLabel="Adicionar Motorista"
  onActionPress={() => navigation.navigate('NovoMotorista')}
/>

// Empty state de busca
<EmptyState
  icon="search-outline"
  title="Nenhum resultado encontrado"
  description="Tente usar outros termos de busca"
/>

// Empty state de erro
<EmptyState
  icon="alert-circle-outline"
  title="Erro ao carregar dados"
  actionLabel="Tentar Novamente"
  onActionPress={() => refetch()}
/>
```

#### Features
- ✅ Ícone customizável (64px, Ionicons)
- ✅ Título e descrição
- ✅ Botão CTA opcional
- ✅ Casos de uso: lista vazia, busca, erro

---

### 4. Progress - Barra de Progresso

**Arquivo:** `src/components/Progress.tsx`

#### Props
```tsx
progress: number                  // 0 a 1 (0% a 100%)
label?: string
showPercentage?: boolean          // Padrão: true
size?: 'small' | 'medium' | 'large'
color?: 'primary' | 'success' | 'warning' | 'error'
animated?: boolean                // Padrão: true
style?: ViewStyle
```

#### Exemplos
```tsx
import Progress from '@/components/Progress';

// Progress bar básica
<Progress progress={0.65} />

// Progress bar com label
<Progress
  progress={completedStops / totalStops}
  label="Paradas concluídas"
/>

// Progress bar sem porcentagem
<Progress
  progress={0.5}
  label="Carregando..."
  showPercentage={false}
/>

// Progress bar verde (sucesso)
<Progress
  progress={1.0}
  label="Upload completo"
  color="success"
/>

// Progress bar amarela (atenção)
<Progress
  progress={0.4}
  label="Espaço em disco"
  color="warning"
/>

// Progress bar vermelha (crítico)
<Progress
  progress={0.9}
  label="Limite de requisições"
  color="error"
/>
```

#### Features
- ✅ Animação suave (500ms)
- ✅ Label e porcentagem opcionais
- ✅ 3 tamanhos (6px, 8px, 12px)
- ✅ 4 cores semânticas
- ✅ Clamp automático (0-1)

---

### 5. Modal - Modal Reutilizável

**Arquivo:** `src/components/Modal.tsx`

#### Props
```tsx
visible: boolean
onClose: () => void
title?: string
children: React.ReactNode
size?: 'small' | 'medium' | 'large' | 'full'
showCloseButton?: boolean         // Padrão: true
animationType?: 'none' | 'slide' | 'fade'  // Padrão: 'fade'
transparent?: boolean             // Padrão: true
style?: ViewStyle
```

#### Exemplos
```tsx
import Modal from '@/components/Modal';

// Modal básico
<Modal
  visible={visible}
  onClose={() => setVisible(false)}
  title="Confirmar Ação"
>
  <Text>Tem certeza que deseja continuar?</Text>
  <Button title="Confirmar" onPress={handleConfirm} />
</Modal>

// Modal pequeno
<Modal
  visible={visible}
  onClose={() => setVisible(false)}
  size="small"
  title="Aviso"
>
  <Text>Operação concluída com sucesso!</Text>
</Modal>

// Modal full screen
<Modal
  visible={visible}
  onClose={() => setVisible(false)}
  size="full"
  title="Editor"
>
  {/* Conteúdo que precisa de tela cheia */}
</Modal>

// Modal sem botão de fechar
<Modal
  visible={visible}
  onClose={() => {}}
  showCloseButton={false}
>
  <ActivityIndicator />
  <Text>Carregando...</Text>
</Modal>

// Modal com animação de slide
<Modal
  visible={visible}
  onClose={() => setVisible(false)}
  animationType="slide"
  title="Nova Rota"
>
  {/* Formulário */}
</Modal>
```

#### Features
- ✅ Overlay escuro clicável
- ✅ Header com título e botão fechar
- ✅ 4 tamanhos (70%, 85%, 95%, 100%)
- ✅ Animações (fade, slide)
- ✅ Z-index correto
- ✅ Máx height 80% (exceto full)

---

## 🔄 Componentes Migrados (4)

### 6. Button (Migrado)

**Arquivo:** `src/components/Button.tsx`

#### Mudanças
- ✅ `@/styles/colors` → `@/lib/design-tokens`
- ✅ Usa `borderRadius.md`, `spacing.*`, `typography.*`
- ✅ Mantém todas as features originais

#### Props
```tsx
title: string
onPress: () => void
variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
size?: 'small' | 'medium' | 'large'
icon?: keyof typeof Ionicons.glyphMap
iconPosition?: 'left' | 'right'
loading?: boolean
disabled?: boolean
fullWidth?: boolean
```

---

### 7. Card (Migrado)

**Arquivo:** `src/components/Card.tsx`

#### Mudanças
- ✅ `@/styles/colors` → `@/lib/design-tokens`
- ✅ Usa `borderRadius.lg`, `shadows.card`
- ✅ Mantém todas as features originais

#### Props
```tsx
children: React.ReactNode
variant?: 'elevated' | 'outlined' | 'filled'
padding?: 'none' | 'small' | 'medium' | 'large'
onPress?: () => void
```

---

### 8. ConfirmDialog (Migrado)

**Arquivo:** `src/components/ConfirmDialog.tsx`

#### Mudanças
- ✅ Migrado para design tokens
- ✅ Usa `colors.*`, `typography.styles.*`, `spacing.*`
- ✅ Ícones com cores semânticas
- ✅ Mantém todas as features originais

#### Props
```tsx
visible: boolean
title: string
message: string
confirmText?: string
cancelText?: string
onConfirm: () => void
onCancel: () => void
type?: 'default' | 'destructive' | 'success'
```

---

### 9. SkeletonLoader (Migrado)

**Arquivo:** `src/components/SkeletonLoader.tsx`

#### Mudanças
- ✅ `@/styles/colors` → `@/lib/design-tokens`
- ✅ Usa `spacing.md`, `borderRadius.lg`
- ✅ Mantém performance (limite 7 skeletons)

#### Componentes
```tsx
<Skeleton />           // Skeleton individual
<SkeletonCard />       // Card skeleton
<SkeletonList />       // Lista de skeletons
<SkeletonDashboard />  // Dashboard completo
```

---

## 📊 Comparação: Antes vs Depois

### Antes
```tsx
// ❌ Valores hardcoded
backgroundColor: '#1e5aa8'
padding: 16
fontSize: 14
borderRadius: 8

// ❌ Import de arquivo antigo
import { colors } from '@/styles/colors'
```

### Depois
```tsx
// ✅ Design tokens
backgroundColor: colors.primary.main
padding: spacing.md
fontSize: typography.fontSize.sm
borderRadius: borderRadius.md

// ✅ Import centralizado
import { colors, typography, spacing, borderRadius } from '@/lib/design-tokens'
```

---

## 🎯 Benefícios Alcançados

### Consistência Visual
- ✅ Todos os 9 componentes usam os mesmos tokens
- ✅ Cores, tipografia, espaçamento padronizados
- ✅ Visual coeso em toda aplicação

### Manutenibilidade
- ✅ Alterar um token atualiza todos os componentes
- ✅ Fácil ajustar tema/dark mode no futuro
- ✅ Código DRY (Don't Repeat Yourself)

### Produtividade
- ✅ 9 componentes prontos para usar
- ✅ Não precisa criar do zero
- ✅ Tipados com TypeScript
- ✅ Documentação inline com exemplos

### Qualidade
- ✅ Acessibilidade (minHeight 44px nos botões/inputs)
- ✅ Animações suaves
- ✅ Estados visuais claros
- ✅ Seguem Brand Guidelines

---

## 🚀 Como Usar na Prática

### Criar uma Tela com Componentes

```tsx
import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import Badge from '@/components/Badge';
import Input from '@/components/Input';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import Progress from '@/components/Progress';
import EmptyState from '@/components/EmptyState';

export default function MinhaTelaScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <ScrollView style={{ padding: 16 }}>
      {/* Card com formulário */}
      <Card variant="elevated" padding="medium">
        <Badge status="em_andamento" style={{ marginBottom: 16 }} />

        <Input
          label="Email"
          leftIcon="mail-outline"
          value={email}
          onChangeText={setEmail}
          required
        />

        <Input
          label="Senha"
          leftIcon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          required
        />

        <Progress progress={0.5} label="Progresso" />

        <Button
          title="Entrar"
          variant="primary"
          fullWidth
          onPress={handleLogin}
        />
      </Card>

      {/* Empty state se não houver dados */}
      {items.length === 0 && (
        <EmptyState
          title="Nenhum item"
          description="Adicione seu primeiro item"
          actionLabel="Adicionar"
          onActionPress={() => {}}
        />
      )}
    </ScrollView>
  );
}
```

---

## 📚 Próximos Passos

### Componentes Futuros (Sugestões)
- [ ] `Tabs` - Navegação em abas
- [ ] `Dropdown` - Menu dropdown
- [ ] `Checkbox` - Checkbox customizado
- [ ] `Radio` - Radio button customizado
- [ ] `Switch` - Toggle switch
- [ ] `Tooltip` - Tooltip informativo
- [ ] `Toast` - Notificação temporária
- [ ] `Avatar` - Avatar de usuário
- [ ] `Chip` - Chip/Tag selecionável

### Melhorias
- [ ] Criar Storybook para visualizar componentes
- [ ] Adicionar testes unitários
- [ ] Criar variante dark mode
- [ ] Adicionar mais exemplos práticos

---

## 🔗 Links Úteis

- **Design Tokens:** `src/lib/design-tokens.ts`
- **Quick Start:** `docs/development/DESIGN_TOKENS_QUICK_START.md`
- **Guia Completo:** `docs/development/DESIGN_TOKENS_GUIDE.md`
- **Brand Guidelines:** `docs/BRAND_GUIDELINES.md`
- **Exemplos:** `src/components/examples/`

---

**Última atualização:** 23/10/2025
**Versão:** 1.0
**Mantido por:** Equipe RotaMestre
