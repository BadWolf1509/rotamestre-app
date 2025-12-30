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
- Revisar foco visivel em componentes customizados.
- Validar targets de toque em cards clicaveis.
