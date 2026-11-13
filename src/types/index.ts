/**
 * Estilo web compartilhado.
 *
 * Os tipos de domínio vêm direto do arquivo de cada um
 * (`@/types/rota`, `@/types/usuario`, `@/types/parada-map`, …): a reexportação
 * central e os utilitários sem uso (`DeepPartial`, `StrictOmit`, …) saíram na
 * faxina de 13/11/2026.
 */

// Web-specific style types (for React Native Web)
export type { PressableStateWithHover } from './web-styles';
