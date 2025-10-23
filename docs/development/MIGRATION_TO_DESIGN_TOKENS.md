# 🔄 Guia de Migração para Design Tokens

**Data:** 23/10/2025
**Status:** Em Andamento
**Prioridade:** Média

---

## 📋 Contexto

O projeto RotaMestre agora possui um sistema completo de **Design Tokens** (`src/lib/design-tokens.ts`) que substitui e expande o sistema de cores existente (`src/styles/colors.ts`).

### Comparação

| Aspecto | Sistema Antigo | Sistema Novo (Design Tokens) |
|---------|----------------|------------------------------|
| **Arquivo** | `src/styles/colors.ts` | `src/lib/design-tokens.ts` |
| **Escopo** | Apenas cores | Cores + Tipografia + Espaçamento + Sombras + etc |
| **Linhas** | ~78 linhas | ~450 linhas |
| **Tokens** | ~50 valores | ~180+ valores |
| **Documentação** | Inline | Guia completo (650 linhas) |
| **Funções** | Nenhuma | 3 funções utilitárias |
| **Exemplos** | Nenhum | 5 exemplos práticos + componente RouteCard |

---

## 🎯 Objetivos da Migração

1. ✅ Unificar sistema de design em um único arquivo
2. ✅ Adicionar tokens de tipografia, espaçamento, sombras, etc
3. ✅ Fornecer funções utilitárias para badges e status
4. ✅ Melhorar documentação e exemplos
5. ✅ Facilitar manutenção e escalabilidade

---

## 📁 Arquivos Afetados

### Componentes que Usam `@/styles/colors`

1. `src/components/Button.tsx`
2. `src/components/Card.tsx`
3. Outros componentes (verificar com grep)

### Buscar Todos os Usos

```bash
# Buscar importações de colors
grep -r "from '@/styles/colors'" src/

# Buscar valores hardcoded (exemplo)
grep -r "#1e5aa8" src/
grep -r "fontSize: 16" src/
grep -r "padding: 16" src/
```

---

## 🔄 Plano de Migração

### Fase 1: Preparação (Concluída ✅)
- [x] Criar `src/lib/design-tokens.ts`
- [x] Documentar uso em `DESIGN_TOKENS_GUIDE.md`
- [x] Criar componente de exemplo (`RouteCard.tsx`)
- [x] Validar aliases no `tsconfig.json`

### Fase 2: Migração Gradual (Recomendado)

**Abordagem:** Migrar componente por componente, testando cada um.

#### 2.1 Componentes de Exemplo (CONCLUÍDO ✅)
- [x] `src/components/examples/RouteCard.tsx` - Já usa design tokens

#### 2.2 Componentes Core (PRÓXIMO)
- [ ] `src/components/Button.tsx`
- [ ] `src/components/Card.tsx`
- [ ] `src/components/ConfirmDialog.tsx`

#### 2.3 Componentes de Mapa
- [ ] `src/components/MapaRotas.tsx`
- [ ] `src/components/MapaMobile.tsx`
- [ ] Outros componentes de mapa

#### 2.4 Telas (app/)
- [ ] `app/gestor/*.tsx`
- [ ] `app/motorista/*.tsx`
- [ ] `app/auth/*.tsx`

### Fase 3: Limpeza (FUTURO)
- [ ] Depreciar `src/styles/colors.ts` (manter temporariamente para compatibilidade)
- [ ] Remover valores hardcoded restantes
- [ ] Atualizar documentação de componentes

---

## 🔧 Como Migrar um Componente

### Passo 1: Atualizar Importações

**Antes:**
```tsx
import { colors } from '@/styles/colors';
```

**Depois:**
```tsx
import { colors, typography, spacing, borderRadius, shadows } from '@/lib/design-tokens';
```

### Passo 2: Substituir Valores Hardcoded

#### Cores

**Antes:**
```tsx
backgroundColor: '#1e5aa8'
color: '#ffffff'
fontSize: 16
```

**Depois:**
```tsx
backgroundColor: colors.primary.main
color: colors.white
fontSize: typography.fontSize.md
```

#### Espaçamento

**Antes:**
```tsx
padding: 16
marginBottom: 8
```

**Depois:**
```tsx
padding: spacing.md
marginBottom: spacing.sm
```

#### Tipografia

**Antes:**
```tsx
fontSize: 16,
fontWeight: '600',
color: '#111827',
```

**Depois:**
```tsx
...typography.styles.h3
```

#### Sombras

**Antes:**
```tsx
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.1,
shadowRadius: 4,
elevation: 3,
```

**Depois:**
```tsx
...shadows.card
```

#### Border Radius

**Antes:**
```tsx
borderRadius: 12
```

**Depois:**
```tsx
borderRadius: borderRadius.lg
```

### Passo 3: Usar Funções Utilitárias

**Antes:**
```tsx
const badgeColor = status === 'pendente'
  ? { bg: '#FEF3C7', text: '#f59e0b' }
  : status === 'em_andamento'
  ? { bg: '#DBEAFE', text: '#3b82f6' }
  : // ... mais condições
```

**Depois:**
```tsx
import { getBadgeColor } from '@/lib/design-tokens';

const { background, text } = getBadgeColor(status);
```

### Passo 4: Testar

- Rodar a aplicação
- Verificar visual do componente
- Testar em diferentes estados (hover, focus, disabled, etc)
- Validar em mobile e web

---

## 📝 Exemplo Completo de Migração

### Button.tsx - ANTES

```tsx
import { colors } from '@/styles/colors';

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary.main,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
  },
  text: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
```

### Button.tsx - DEPOIS

```tsx
import { colors, typography, spacing, borderRadius } from '@/lib/design-tokens';

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary.main,
    paddingVertical: 12, // Ou spacing.sm + spacing.xs (pode manter 12)
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: 44,
  },
  text: {
    ...typography.styles.button, // Inclui color, fontSize, fontWeight
  },
});
```

---

## ⚠️ Cuidados Durante a Migração

### 1. Compatibilidade Retroativa

**Não delete** `src/styles/colors.ts` imediatamente. Mantenha por um tempo para compatibilidade.

### 2. Valores Exatos

Alguns valores podem diferir ligeiramente:

| Antigo | Novo | Nota |
|--------|------|------|
| `primary.light: '#4a90e2'` | `primary.light: '#3b82f6'` | Atualizado no Brand Guidelines v3.0 |
| Outros iguais | Outros iguais | Maioria dos valores é idêntica |

**Ação:** Testar visualmente após migração.

### 3. Espaçamentos Personalizados

Se um componente usa `padding: 10` (valor não padrão), você tem 2 opções:

**Opção A:** Manter hardcoded (se for excepcional)
```tsx
padding: 10 // Caso específico, não seguir grid
```

**Opção B:** Ajustar para o grid (recomendado)
```tsx
padding: spacing.sm // 8px (mais próximo)
// ou
padding: spacing.md // 16px (mais próximo)
```

### 4. Tipografia com Variações

Se você precisa de um estilo H3 mas com cor diferente:

```tsx
// ✅ CORRETO
...typography.styles.h3,
color: colors.primary.main, // Sobrescreve a cor
```

---

## 🧪 Testes Após Migração

### Checklist Visual

- [ ] Cores estão corretas
- [ ] Tamanhos de fonte estão legíveis
- [ ] Espaçamentos estão adequados
- [ ] Sombras estão visíveis (iOS e Android)
- [ ] Border radius está correto
- [ ] Componente funciona em mobile e web
- [ ] Estados (hover, focus, disabled) funcionam

### Checklist Técnico

- [ ] Sem warnings no console
- [ ] TypeScript sem erros
- [ ] Hot reload funciona
- [ ] Build de produção funciona
- [ ] Performance não degradou

---

## 📊 Progresso da Migração

### Status Atual

| Categoria | Total | Migrados | Pendentes | %  |
|-----------|-------|----------|-----------|-----|
| **Exemplos** | 1 | 1 | 0 | 100% |
| **Core** | 3 | 0 | 3 | 0% |
| **Mapa** | 6 | 0 | 6 | 0% |
| **Telas** | ~15 | 0 | ~15 | 0% |
| **TOTAL** | ~25 | 1 | ~24 | 4% |

### Próximos Passos

1. **Prioridade Alta:**
   - [ ] Migrar `Button.tsx`
   - [ ] Migrar `Card.tsx`

2. **Prioridade Média:**
   - [ ] Migrar `ConfirmDialog.tsx`
   - [ ] Migrar telas principais (`app/gestor/dashboard.tsx`, etc)

3. **Prioridade Baixa:**
   - [ ] Migrar componentes de mapa
   - [ ] Limpar `src/styles/colors.ts`

---

## 🎯 Benefícios Após Migração Completa

### Para o Código
✅ **Consistência:** Todos os componentes usam os mesmos valores
✅ **Manutenibilidade:** Alterar um token atualiza toda a aplicação
✅ **Documentação:** Código autodocumentado com tokens semânticos
✅ **Escalabilidade:** Fácil adicionar dark mode, temas, etc

### Para os Desenvolvedores
✅ **Produtividade:** Não precisa lembrar valores de cor, tamanho, etc
✅ **Autocomplete:** TypeScript sugere todos os tokens disponíveis
✅ **Exemplos:** Componente RouteCard como referência
✅ **Guia Completo:** 650 linhas de documentação

### Para o Produto
✅ **Visual Polido:** Segue Brand Guidelines à risca
✅ **Experiência Consistente:** Todos os componentes harmonizam
✅ **Profissionalismo:** Design coeso e bem executado

---

## 💡 Dicas Finais

1. **Migre gradualmente:** Não tente migrar tudo de uma vez
2. **Teste cada componente:** Visual e funcionalmente
3. **Use RouteCard como referência:** Componente bem estruturado
4. **Consulte o guia:** `DESIGN_TOKENS_GUIDE.md` tem exemplos práticos
5. **Peça revisão:** Valide visualmente antes de commitar

---

## 📚 Recursos

- **Design Tokens:** `src/lib/design-tokens.ts`
- **Guia de Uso:** `docs/development/DESIGN_TOKENS_GUIDE.md`
- **Componente Exemplo:** `src/components/examples/RouteCard.tsx`
- **Brand Guidelines:** `docs/BRAND_GUIDELINES.md`

---

**Última atualização:** 23/10/2025
**Mantido por:** Equipe RotaMestre
