# Design System - Release Notes

## [2.0.0] - 2025-12-30

### Added
- **Temas High Contrast**: `lightHighContrast` e `darkHighContrast` com valores de gray modificados para maior contraste WCAG
- **Temas Compact Density**: `lightCompact` e `darkCompact` para layouts desktop mais densos
- **Componentes Skeleton**: `Skeleton`, `SkeletonCard`, `SkeletonList` para loading states
- **ConfirmModal**: Modal de confirmação com modo destrutivo (digitação obrigatória)
- **SupportModal**: Modal de suporte integrado documentado na tela showcase
- **Toggle de Tema**: Persistência de preferência em AsyncStorage
- **Toggle de Alto Contraste**: Botão na tela /design-system para alternar contraste
- **Toggle de Densidade**: Botão na tela /design-system para alternar compact/regular
- **Seção de Estados Interativos**: Demonstração de hover, focus, pressed na tela showcase
- **PropsTable**: Componente para documentação de props inline

### Changed
- **High Contrast Gray Values**: Temas de alto contraste agora modificam valores de `gray400-gray700` diretamente
- **Barrel Export**: `@/design-system` agora exporta 23 componentes base, desktop, mobile e gestor
- **Coverage Matrix**: 100% das telas migradas para tokens do design system (Wave 5b completa)

### Fixed
- **Visibilidade de texto em alto contraste**: Componentes que usavam `theme.colors.gray600/700` agora respeitam high contrast
- **Toggle de tema web**: `data-theme` atualizado corretamente no HTML root

### Migration Notes
- Wave 1-5b: Todas as telas agora usam tokens semânticos
- Wave 6: Remoção de legado em andamento (`src/styles/theme.ts`, `src/lib/design-tokens.ts`)

---

## [Unreleased]

### Added
-

### Changed
-

### Deprecated
-

### Removed
-

### Fixed
- 

## Template
Version: x.y.z
Data: YYYY-MM-DD

Resumo:
- 

Tokens:
- 

Componentes:
- 

Breaking Changes:
- 

Migracao:
- 

Snapshots/Visual:
- 
