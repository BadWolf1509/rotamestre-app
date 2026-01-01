# Design System Multi-Plataforma - Plano Completo

## 1) Objetivo
Padronizar o design visual do sistema inteiro (100% das telas, fluxos e componentes) em Web, iOS e Android, mantendo identidade de marca e previsibilidade de UI, com variacoes controladas por plataforma quando necessario.

## 2) Principios
- Single source of truth para tokens e estilos base.
- Tokens semanticos acima de cores/medidas cruas.
- Componentes compositivos e reutilizaveis.
- Acessibilidade e consistencia como criterios de aceitacao.
- Textos em PT-BR com acentuacao correta e padronizada em toda a interface.
- Quando houver mais de uma opcao, padronizar pela melhor pratica de desenvolvimento e pelo contexto do produto.
- Variacao por plataforma apenas quando houver justificativa (HIG/Material/Web).

## 3) Escopo e plataformas
- Web (React Native Web / Expo)
- iOS (React Native)
- Android (React Native)
- Cobertura: 100% das telas, fluxos, estados e componentes compartilhados.
- Modos: light/dark, densidade (compact/regular) e acessibilidade (alto contraste).

## 4) Fase 0 - Diagnostico e alinhamento
Objetivo: entender o estado atual e definir o alvo.
- Inventario de tokens existentes (cores, tipografia, espacamentos, raios, sombras, motion).
- Auditoria visual das telas principais (gestor, motorista, auth, mapas).
- Mapeamento de divergencias (hardcoded colors, estilos locais, componentes duplicados).
- Inventario de textos/labels e inconsistencias de acentuacao e caracteres especiais.
- Inventario completo de telas/componentes e matriz de cobertura (baseline 0-100%).
- Definir nomenclatura, criterios de variacao por plataforma e politicas de contribuicao.
- Definir guia de linguagem PT-BR e validar fontes com suporte total a caracteres especiais.
- Definir padroes de UI por modulo (ex: Gestor) e checklist de consistencia entre telas.

Entregaveis:
- Relatorio de gaps e lista priorizada de telas/componentes.
- Arquivo de decisoes (ADR) com o escopo do design system.

## 5) Arquitetura de tokens
### 5.1 Taxonomia
- Core tokens: valores brutos (brand colors, escala tipografica, spacing, radius).
- Semantic tokens: uso semantico (text.primary, surface.card, status.warning).
- Component tokens: tokens especificos por componente (button.height, input.border).

### 5.2 Modos e densidade
- Light e Dark alinhados a contraste minimo (WCAG).
- Densidade: regular e compact (desktop).
- Opcional: tema "driver safe" com contraste e animacao reduzida.

### 5.3 Variacoes por plataforma
- iOS: respeitar HIG (tamanho de toque, barras, safe areas, tipografia).
- Android: respeitar Material (elevation, ripple, fontes, paddings).
- Web: hover/focus/keyboard, grid e espacamentos responsivos.
- Todos: manter cores e tipografia de marca como baseline.

### 5.4 Naming convention
- Prefixo por categoria: color.*, typography.*, spacing.*, radius.*, shadow.*, motion.*.
- Tokens semanticos: text.*, surface.*, border.*, status.*.
- Component tokens: component.button.*, component.input.*.

Entregaveis:
- `tokens/core.json`, `tokens/semantic.json`, `tokens/components.json`.
- Mapeamento de overrides por plataforma (ios/android/web).

## 6) Pipeline de tokens
### 6.1 Fonte
Opcao A: Figma como fonte primaria (Tokens Studio).
Opcao B: Codigo como fonte primaria (JSON versionado).

### 6.2 Build
- Gerar outputs para:
  - TS/JS (app RN/web)
  - CSS variables (web)
  - Android XML (colors/dimens)
  - iOS Swift/Asset Catalog
- Ferramentas sugeridas: Style Dictionary ou pipeline custom.

### 6.3 Versionamento
- Semver para tokens e componentes.
- Changelog automatico com breaking changes.

Entregaveis:
- Script de build + CI para validar consistencia.
- Outputs por plataforma publicados no repo.

## 7) Biblioteca de componentes
### 7.1 Inventario e padronizacao
- Listar todos os componentes atuais e unificar variantes.
- Definir componentes base: Button, Text, Input, Card, Badge/Chip, Modal, Toast, List, EmptyState.
- Garantir estados: default, hover (web), focus, pressed, disabled, loading, error.
- Cobrir componentes de feature-level (dashboards, tabelas, filtros, mapas, cards) com composicao via base components.

### 7.2 Variacoes por plataforma
- iOS: adaptacoes em navegacao, pads e feedback haptico.
- Android: ripple, elevation e paddings Material.
- Web: hover/active/focus-visible, tamanhos minimos e grid.

### 7.3 Composicao e extensao
- Componente base -> variantes -> composicoes por modulo.
- Proibir estilos inline com cores fora dos tokens.

Entregaveis:
- Pasta `src/design-system/components/*`.
- Documentacao de props, variantes e exemplos.
- Padroes por modulo (ex: Gestor) com especificacao de filtros, badges, tabelas, modais e empty states.

## 8) Documentacao e guidelines
- Manual de uso com exemplos reais (Do/Don’t).
- Referencias de tipografia, cores e contraste.
- Tabelas de tokens e mapeamento semantico.
- Exemplos por plataforma (iOS/Android/Web).

Entregaveis:
- `docs/design-system/*` com guias e referencias.
- Pagina de showcase (Storybook ou app interna).
- Mapa de cobertura por tela/componente (meta 100%).

## 9) Governanca
- Ownership: Design + Front-end (Design Ops).
- Processo de mudanca:
  - Proposta -> revisao -> aprovar -> implementar -> release.
- Politica de deprecacao (prazo, fallback, migracao).
- Checklists de revisao visual por PR.
- Checklist de consistencia entre telas similares do mesmo modulo.
- Decisao de padrao baseada em melhores praticas + contexto do produto.

Entregaveis:
- Guia de contribuicao do design system.
- Template de PR com checklist visual.

## 10) Adocao e migracao
### 10.1 Estrategia
- Migracao incremental por modulo/tela.
- Priorizar telas de alto uso e componentes compartilhados.
- Bloquear novas cores hardcoded (lint + code review).
- Meta final: 100% das telas/fluxos usando tokens e componentes do design system.
- Remover temas/estilos legados quando a cobertura atingir 100%.

### 10.2 Plano em ondas
1. Unificar tokens e tema base.
2. Migrar componentes base.
3. Migrar telas criticas (auth, dashboard, mapa, notificacoes).
4. Cobrir areas restantes.
5. Migrar o restante do projeto ate 100% de cobertura.
6. Remover legado e endurecer regras (lint/CI).

Entregaveis:
- Plano de migracao por sprint.
- Metricas de progresso (percentual de tokens usados).

### 10.3 Plano detalhado por ondas (execucao)
| Wave | Escopo principal | Responsavel | Duracao sugerida | Saidas |
| --- | --- | --- | --- | --- |
| 0 | Base de tokens + lint + docs iniciais | FE + Design | 1-2 semanas | tokens alinhados, regras de lint, guias |
| 1 | Componentes base (Button, Input, Modal, Text, Icon) + showcase | FE | 1 semana | componentes padronizados, tela de showcase |
| 2 | Auth + onboarding + perfis | FE | 1-2 semanas | fluxos de entrada migrados |
| 3 | Dashboard + mapas (gestor/motorista) | FE + QA | 2 semanas | telas criticas com tokens e componentes |
| 4 | Notificacoes + configuracoes + suportes | FE | 1-2 semanas | backlog restante migrado |
| 5 | Telas e componentes restantes ate 100% | FE | 2-3 semanas | cobertura total de telas e componentes |
| 6 | Remocao de legado + QA visual + governanca | FE + Design + QA | 1-2 semanas | baseline visual, lint/CI endurecido, legado removido |

Criterios de saida por wave:
- Nenhum hex novo fora de tokens (lint verde).
- Componentes base usados nas telas do escopo.
- Auditoria visual e ajustes finais registrados.
- Cobertura acumulada registrada, com meta 100% no fim da Wave 6.
- Textos revisados com acentuacao correta e consistencia de linguagem no escopo da wave.
- Consistencia entre telas similares do modulo validada.

### 10.4 Revisao linguistica e caracteres especiais (PT-BR)
- Auditar toda a interface para corrigir acentuacao, cedilha e caracteres especiais faltantes.
- Garantir UTF-8 e fontes com cobertura PT-BR em todas as plataformas.
- Atualizar testes/snapshots quando houver ajustes de textos.
- Executar revisao por onda, com checklist de linguagem no PR.

### 10.5 Padronizacao entre telas similares
- Definir padroes de UI por modulo (ex: Gestor) e aplicar nas telas do escopo.
- Criar backlog de inconsistencias entre telas e tratar por wave.
- Priorizar padroes de filtros, badges de status, tipografia de tabelas, modais e empty states.
- Validar consistencia com auditoria comparativa antes de marcar "Done".

## 11) Qualidade e testes
- Testes de consistencia de tokens (snapshot/contraste).
- Visual regression (Playwright/Chromatic).
- A11y (focus, contraste, tamanho minimo de toque).
- Performance (carga de fontes, re-render por tema).
- Checklist linguistico (acentuacao, pontuacao, ortografia PT-BR) + validacao de fontes.
- Revisao comparativa entre telas do mesmo modulo (desktop e mobile).

Entregaveis:
- Suite de testes automatizados.
- Relatorio de cobertura visual.

## 12) Timeline sugerida (exemplo)
- Semana 1-2: diagnostico + definicao de tokens e naming.
- Semana 3-4: pipeline de tokens + tema base.
- Semana 5-7: componentes base + docs iniciais.
- Semana 8-10: migracao das telas criticas.
- Semana 11-13: migracao do restante ate 100%.
- Semana 14-15: remocao de legado, QA e governanca.

## 13) Riscos e mitigacoes
- Drift entre plataformas -> pipeline unico + testes de paridade.
- Regressao visual -> visual regression + feature flags.
- Resistencia a migracao -> quick wins e guias claros.

## 14) Proximas acoes imediatas

### Concluido (2025-12-31)
- ✅ Escolher fonte de verdade dos tokens (`src/utils/styles.base.ts`)
- ✅ Definir lista minima de componentes base (28 componentes exportados)
- ✅ Criar backlog de migracao por tela/modulo (Waves 1-6 documentadas)
- ✅ Alinhar governanca e aprovacoes (`docs/design-system-governance.md`)
- ✅ Criar matriz de cobertura (100% das telas migradas)
- ✅ Criar backlog de revisao linguistica PT-BR (`src/lib/statusLabels.ts`)
- ✅ Criar backlog de inconsistencias (`docs/design-system-inconsistencies.md` - 16 itens resolvidos)
- ✅ Feature sub-exports (`motorista.ts`, `gestor.ts`, `map.ts`)
- ✅ Platform variations documentadas (`design-system-platform-variations.md`)
- ✅ Acessibilidade documentada (touch targets, focus rings)

### Status das Waves (2025-12-31) - COMPLETO ✅
| Wave | Status | Observacoes |
|------|--------|-------------|
| 0 | ✅ Completa | Tokens base + lint + docs |
| 1 | ✅ Completa | Componentes base migrados |
| 2 | ✅ Completa | Auth screens |
| 3 | ✅ Completa | Gestor screens |
| 4 | ✅ Completa | Motorista screens |
| 5 | ✅ Completa | Core components |
| 5b | ✅ Completa | Telas restantes (100% cobertura) |
| 6 | ✅ Completa | Legado removido, ESLint endurecido, design-tokens interno |
| 6.1 | ✅ Completa | Visual regression 8 temas, ADRs documentados |
| 6.2 | ✅ Completa | Sub-exports, platform docs, acessibilidade |

### Pendente
✅ **Nenhuma pendencia P0-P2.**

Melhorias incrementais (P3):
- Padronizar tipografia de DataTable entre telas (ADR documentado)
