/**
 * Central export for all domain types
 *
 * Usage:
 * import { Rota, Parada, Usuario, Coordenadas } from '@/types';
 */

// Endereco types
export type { Coordenadas, Endereco, EnderecoGeocodificado } from './endereco';

// Usuario types
export type {
  TipoUsuario,
  UnidadeDB,
  UnidadeComSede,
  UsuarioUnidade,
  Usuario,
  AuthState,
} from './usuario';

// Rota types
export type {
  TipoCheckpoint,
  StatusRota,
  StatusCheckpoint,
  Checkpoint,
  Rota,
  RotaOtimizada,
  ResumoRota,
} from './rota';

// Notification types
export type {
  NotificationType,
  Notificacao,
  MotoristaLocation,
  NotificacaoComDetalhes,
} from './notifications';

// Unidade types
export type { Unidade } from './unidade';

// Web-specific style types (for React Native Web)
export type {
  WebViewStyle,
  WebTextStyle,
  WebCompatibleViewStyle,
  WebCompatibleTextStyle,
  PressableStateWithHover,
} from './web-styles';

// ============================================================================
// Type Aliases (for convenience and backwards compatibility)
// ============================================================================

/**
 * Alias for Checkpoint - commonly called "Parada" in the UI
 */
export type { Checkpoint as Parada } from './rota';

/**
 * Alias for StatusCheckpoint
 */
export type { StatusCheckpoint as ParadaStatus } from './rota';

/**
 * Alias for StatusRota
 */
export type { StatusRota as RotaStatus } from './rota';

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
