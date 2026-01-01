# Design System - Acessibilidade

## Objetivo
Garantir que todos os componentes e telas atendam requisitos basicos de acessibilidade (WCAG 2.1 AA) em web e mobile.

## Checklist de UI
- Contraste minimo (texto vs fundo) conforme WCAG.
- Foco visivel no web (focus-visible + outline consistente).
- Tamanho minimo de toque >= 44px.
- Labels acessiveis em botoes, inputs e icones interativos.
- Estados claros: default, hover, focus, pressed, disabled, loading.

## Recomendacoes por plataforma
- Web: navegacao por teclado e foco visivel em todos os controles.
- iOS: respeitar VoiceOver e areas seguras.
- Android: respeitar TalkBack e feedback de toque.

## Processo de Auditoria
1) Validar contrastes (tokens semanticos).
2) Verificar foco/teclado nas telas criticas.
3) Revisar targets de toque e estados.
4) Registrar gaps e correcoes no PR.

## Pendencias conhecidas
✅ Todas as pendencias P0-P2 resolvidas (2025-12-31).

## Implementacoes de Acessibilidade

### Touch Targets (via `platformOverrides`)
Configurado em `src/design-system/tokens/platform.ts`:
- **iOS**: 44px minimo (HIG compliance)
- **Android**: 48px minimo (Material Design)
- **Web**: Mouse-based, sem restricao

### Focus Ring (Web)
Configurado em `src/design-system/tokens/platform.ts`:
- **Cor**: `primary` com 25% opacidade
- **Largura**: 2px
- Aplicado em `Input.tsx` e outros componentes interativos

### Componentes com Focus Visivel
- `Input.tsx` - usa `platformOverrides.web.focusRing`
- `MapaWeb.tsx` - outline de 2px solid
- `Button.tsx` - estados de pressed/focus

## Melhorias Implementadas (2025-12-30)

### High Contrast Mode
- Temas `lightHighContrast` e `darkHighContrast` disponiveis.
- Valores de gray400-gray700 ajustados para maior contraste.
- Toggle de alto contraste na tela /design-system.

### Semantic Colors
- StatusBadge usa cores semanticas (success, warning, error, info).
- Cores de status padronizadas em `src/lib/statusLabels.ts`.

### Visual Regression
- 8 combinacoes de tema testadas (inclui high contrast).
- Cobertura de contrastes validada visualmente.
