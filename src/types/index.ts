/**
 * Tipos utilitários e o estilo web compartilhado.
 *
 * Os tipos de domínio vêm direto do arquivo de cada um
 * (`@/types/rota`, `@/types/usuario`, `@/types/parada-map`, …): a reexportação
 * central saiu na faxina de 13/11/2026 porque ninguém importava por ela.
 */

// Web-specific style types (for React Native Web)
export type { PressableStateWithHover } from './web-styles';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Makes all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extracts the element type from an array type
 */
export type ArrayElement<T> = T extends (infer U)[] ? U : never;

/**
 * Makes specific keys K of T required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Omits specific keys K from T
 */
export type StrictOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
