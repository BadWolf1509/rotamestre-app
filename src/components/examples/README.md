# 📚 Componentes de Exemplo - RotaMestre

Esta pasta contém componentes de exemplo que demonstram como usar corretamente os **Design Tokens** do Brand Guidelines em componentes reais do RotaMestre.

## 🎯 Objetivo

Estes exemplos servem como:
- ✅ **Referência visual** para novos componentes
- ✅ **Boas práticas** de implementação
- ✅ **Guia de uso** dos design tokens
- ✅ **Template** para componentes similares

## 📁 Componentes Disponíveis

### `RouteCard.tsx`

Card de rota que demonstra:
- ✅ Uso completo de design tokens (cores, tipografia, espaçamento)
- ✅ Badges de status com cores semânticas
- ✅ Ícones do Ionicons
- ✅ Progress bar com animação
- ✅ Layout responsivo e hierarquia visual
- ✅ Sombras e border radius conforme guidelines

**Exemplo de Uso:**
```tsx
import RouteCard from '@/components/examples/RouteCard';

<RouteCard
  driverName="João Silva"
  routeId="Rota #1234"
  status="em_andamento"
  completedStops={3}
  totalStops={8}
  distanceKm={12.5}
  onPress={() => console.log('Card pressionado')}
/>
```

## 🎨 Design Tokens Utilizados

Todos os componentes importam os tokens de `@/lib/design-tokens`:

```tsx
import {
  colors,         // Paleta de cores completa
  typography,     // Estilos de texto pré-definidos
  spacing,        // Espaçamentos 4-point grid
  borderRadius,   // Border radius padrão
  shadows,        // Sombras (elevações)
  getBadgeColor,  // Função utilitária para badges
} from '@/lib/design-tokens';
```

## 📖 Documentação Completa

Para consultar todos os tokens e guidelines:
- **Brand Guidelines:** `docs/BRAND_GUIDELINES.md`
- **Design Tokens:** `src/lib/design-tokens.ts`

## ✨ Como Criar Novos Componentes

1. **Importe os design tokens:**
   ```tsx
   import { colors, typography, spacing, borderRadius, shadows } from '@/lib/design-tokens';
   ```

2. **Use os tokens nos estilos:**
   ```tsx
   const styles = StyleSheet.create({
     container: {
       backgroundColor: colors.background.primary,
       padding: spacing.md,
       borderRadius: borderRadius.lg,
       ...shadows.card,
     },
     title: {
       ...typography.styles.h3,
     },
     text: {
       ...typography.styles.body,
     },
   });
   ```

3. **Siga o Brand Guidelines:**
   - Cores semânticas para status
   - Espaçamento 4-point grid
   - Tipografia consistente (Viga + Nunito Sans)
   - Ícones do Ionicons (outline)

## 🚀 Próximos Exemplos

Componentes que serão adicionados:
- [ ] `Button.tsx` - Variantes de botão (primary, secondary, outline, ghost)
- [ ] `Input.tsx` - Input com estados (default, focus, error, disabled)
- [ ] `Badge.tsx` - Badge de status reutilizável
- [ ] `EmptyState.tsx` - Empty state com ícone e CTA
- [ ] `SkeletonLoader.tsx` - Loading state (já existe em src/components/)

## 💡 Dicas

- **Sempre** use design tokens ao invés de valores hardcoded
- **Prefira** estilos pré-definidos (`typography.styles.h3`) quando disponíveis
- **Consulte** o Brand Guidelines antes de criar novos estilos
- **Teste** em diferentes tamanhos de tela (mobile, tablet, web)

---

**Última atualização:** 23/10/2025
**Mantido por:** Equipe RotaMestre
