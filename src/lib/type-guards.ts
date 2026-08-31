/**
 * Type guards and runtime type checking utilities
 * Use these instead of `as any` or `as unknown as` patterns
 */

import { Platform } from 'react-native';

import type { Coordenadas } from '@/types/endereco';
import type {
  StatusRota,
  StatusCheckpoint,
  Checkpoint,
  Rota,
} from '@/types/rota';
import type {
  Usuario,
  TipoUsuario,
  UnidadeDB,
  UsuarioUnidade,
} from '@/types/usuario';

// ============================================================================
// Basic Type Guards
// ============================================================================

/**
 * Check if value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Check if value is a valid number (not NaN)
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Check if value is a valid UUID string
 */
export function isUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Check if value is a valid ISO date string
 */
export function isISODateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

// ============================================================================
// Coordinate Guards
// ============================================================================

/**
 * Check if value has valid latitude and longitude
 */
export function hasValidCoordinates(value: unknown): value is Coordenadas {
  if (!isObject(value)) return false;
  const { latitude, longitude } = value as Partial<Coordenadas>;
  return (
    isValidNumber(latitude) &&
    isValidNumber(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Check if an object has optional coordinates that are valid when present
 */
export function hasOptionalCoordinates(
  value: unknown,
): value is { latitude?: number; longitude?: number } {
  if (!isObject(value)) return false;
  const { latitude, longitude } = value as {
    latitude?: unknown;
    longitude?: unknown;
  };

  // Both undefined is valid
  if (latitude === undefined && longitude === undefined) return true;

  // Both must be valid numbers if present
  if (latitude !== undefined && longitude !== undefined) {
    return hasValidCoordinates({ latitude, longitude });
  }

  return false;
}

// ============================================================================
// Route & Checkpoint Guards
// ============================================================================

// `Record<StatusRota, true>` em vez de `StatusRota[]` de propósito: um array
// anotado protege contra valor INVÁLIDO, mas não contra valor FALTANDO — e foi
// exatamente assim que `nao_executada` ficou de fora, fazendo `isRota()`
// reprovar toda rota expirada (o banco já tem 17 delas). Nenhuma das duas
// guardas é consumida em produção hoje, só em teste, então era mina e não
// incêndio — mas a mina continuaria armada.
//
// Com o Record, esquecer um valor novo de `StatusRota` vira erro de compilação
// aqui, não bug silencioso. Mesmo padrão vale para `validStatusCheckpoint`
// abaixo, hoje correto — deixado como está para não mexer no que não quebrou.
const STATUS_ROTA_VALIDOS: Record<StatusRota, true> = {
  pendente: true,
  em_andamento: true,
  concluida: true,
  cancelada: true,
  nao_executada: true,
};

const validStatusRota = Object.keys(STATUS_ROTA_VALIDOS) as StatusRota[];
const validStatusCheckpoint: StatusCheckpoint[] = [
  'pendente',
  'concluida',
  'pulada',
];

/**
 * Check if value is a valid StatusRota
 */
export function isStatusRota(value: unknown): value is StatusRota {
  return (
    typeof value === 'string' && validStatusRota.includes(value as StatusRota)
  );
}

/**
 * Check if value is a valid StatusCheckpoint
 */
export function isStatusCheckpoint(value: unknown): value is StatusCheckpoint {
  return (
    typeof value === 'string' &&
    validStatusCheckpoint.includes(value as StatusCheckpoint)
  );
}

/**
 * Check if value is a valid Checkpoint object
 */
export function isCheckpoint(value: unknown): value is Checkpoint {
  if (!isObject(value)) return false;
  const obj = value as Partial<Checkpoint>;
  return (
    isUUID(obj.id) &&
    isUUID(obj.rota_id) &&
    typeof obj.endereco === 'object' &&
    typeof obj.ordem === 'number' &&
    isStatusCheckpoint(obj.status)
  );
}

/**
 * Check if value is a valid Rota object (minimal check)
 */
export function isRota(value: unknown): value is Rota {
  if (!isObject(value)) return false;
  const obj = value as Partial<Rota>;
  return isUUID(obj.id) && isUUID(obj.unidade_id) && isStatusRota(obj.status);
}

// ============================================================================
// User & Auth Guards
// ============================================================================

const validTipoUsuario: TipoUsuario[] = ['gestor', 'motorista'];

/**
 * Check if value is a valid TipoUsuario
 */
export function isTipoUsuario(value: unknown): value is TipoUsuario {
  return (
    typeof value === 'string' && validTipoUsuario.includes(value as TipoUsuario)
  );
}

/**
 * Check if value is a valid Usuario object (minimal check)
 */
export function isUsuario(value: unknown): value is Usuario {
  if (!isObject(value)) return false;
  const obj = value as Partial<Usuario>;
  return (
    isUUID(obj.id) &&
    typeof obj.email === 'string' &&
    typeof obj.nome === 'string' &&
    isTipoUsuario(obj.papel)
  );
}

/**
 * Check if value is a valid UnidadeDB object (minimal check)
 */
export function isUnidadeDB(value: unknown): value is UnidadeDB {
  if (!isObject(value)) return false;
  const obj = value as Partial<UnidadeDB>;
  return (
    isUUID(obj.id) &&
    typeof obj.nome === 'string' &&
    typeof obj.ativa === 'boolean'
  );
}

/**
 * Check if value is a valid UsuarioUnidade object
 */
export function isUsuarioUnidade(value: unknown): value is UsuarioUnidade {
  if (!isObject(value)) return false;
  const obj = value as Partial<UsuarioUnidade>;
  return (
    isUUID(obj.id) &&
    isUUID(obj.usuario_id) &&
    isUUID(obj.unidade_id) &&
    isTipoUsuario(obj.papel)
  );
}

// ============================================================================
// Supabase Response Guards
// ============================================================================

/**
 * Type for Supabase query response
 */
export interface SupabaseResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

/**
 * Check if Supabase response has data (no error)
 */
export function hasSupabaseData<T>(
  response: SupabaseResponse<T>,
): response is { data: T; error: null } {
  return response.error === null && response.data !== null;
}

/**
 * Check if Supabase response has error
 */
export function hasSupabaseError<T>(
  response: SupabaseResponse<T>,
): response is { data: null; error: { message: string; code?: string } } {
  return response.error !== null;
}

/**
 * Extract data from Supabase response or throw
 */
export function extractSupabaseData<T>(
  response: SupabaseResponse<T>,
  errorMessage = 'Supabase query failed',
): T {
  if (hasSupabaseError(response)) {
    throw new Error(`${errorMessage}: ${response.error.message}`);
  }
  if (response.data === null) {
    throw new Error(`${errorMessage}: No data returned`);
  }
  return response.data;
}

/**
 * Check if Supabase response data is an array
 */
export function isSupabaseArray<T>(
  response: SupabaseResponse<T>,
): response is { data: T & unknown[]; error: null } {
  return hasSupabaseData(response) && Array.isArray(response.data);
}

// ============================================================================
// Platform-specific Guards
// ============================================================================

/**
 * Type-safe Platform.OS check
 */
export function isPlatformOS(
  os: 'ios' | 'android' | 'web' | 'windows' | 'macos',
): boolean {
  return Platform.OS === os;
}

/**
 * Check if running on web platform
 */
export function isWeb(): boolean {
  return isPlatformOS('web');
}

/**
 * Check if running on native platform (iOS or Android)
 */
export function isNative(): boolean {
  return isPlatformOS('ios') || isPlatformOS('android');
}

// ============================================================================
// React Native State Guards
// ============================================================================

/**
 * Type guard for pressable state with hovered property (web)
 */
export interface PressableStateWithHover {
  pressed: boolean;
  hovered?: boolean;
}

export function hasPressableHover(
  state: unknown,
): state is PressableStateWithHover {
  if (!isObject(state)) return false;
  if (!('pressed' in state)) return false;
  const pressedValue = (state as { pressed: unknown }).pressed;
  return typeof pressedValue === 'boolean';
}

/**
 * Safely extract hovered state from pressable
 */
export function isHovered(state: unknown): boolean {
  if (hasPressableHover(state)) {
    return state.hovered === true;
  }
  return false;
}

/**
 * Safely extract pressed state from pressable
 */
export function isPressed(state: unknown): boolean {
  if (hasPressableHover(state)) {
    return state.pressed === true;
  }
  return false;
}

// ============================================================================
// DOM/Web Guards
// ============================================================================

/**
 * Check if value is an HTMLElement (web only)
 */
export function isHTMLElement(value: unknown): value is HTMLElement {
  if (typeof window === 'undefined') return false;
  return value instanceof HTMLElement;
}

/**
 * Check if value is an HTMLInputElement (web only)
 */
export function isHTMLInputElement(value: unknown): value is HTMLInputElement {
  if (typeof window === 'undefined') return false;
  return value instanceof HTMLInputElement;
}

/**
 * Safely focus an element if it's focusable
 */
export function safeFocus(element: unknown): void {
  if (isHTMLElement(element) && typeof element.focus === 'function') {
    element.focus();
  }
}

// ============================================================================
// Data Access Helpers
// ============================================================================

/**
 * Safely access a property on an object with type checking
 */
export function getProperty<T>(
  obj: unknown,
  key: string,
  validator?: (value: unknown) => value is T,
): T | undefined {
  if (!isObject(obj)) return undefined;
  const value = obj[key];
  if (validator) {
    return validator(value) ? value : undefined;
  }
  return value as T | undefined;
}

/**
 * Safely access a string property
 */
export function getStringProperty(
  obj: unknown,
  key: string,
): string | undefined {
  return getProperty(obj, key, isNonEmptyString);
}

/**
 * Safely access a number property
 */
export function getNumberProperty(
  obj: unknown,
  key: string,
): number | undefined {
  return getProperty(obj, key, isValidNumber);
}

/**
 * Type-safe object key accessor for DataTable columns
 */
export function getColumnValue<T extends Record<string, unknown>>(
  item: T,
  key: keyof T,
): T[keyof T] {
  return item[key];
}

// ============================================================================
// Icon Type Guards (for Ionicons)
// ============================================================================

/**
 * Common Ionicons names used in the app
 */
export type IoniconName =
  | 'home'
  | 'home-outline'
  | 'map'
  | 'map-outline'
  | 'person'
  | 'person-outline'
  | 'settings'
  | 'settings-outline'
  | 'warning'
  | 'warning-outline'
  | 'checkmark'
  | 'checkmark-circle'
  | 'close'
  | 'close-circle'
  | 'add'
  | 'remove'
  | 'chevron-forward'
  | 'chevron-back'
  | 'menu'
  | 'search'
  | 'refresh'
  | 'time'
  | 'time-outline'
  | 'location'
  | 'location-outline'
  | 'navigate'
  | 'navigate-outline'
  | 'car'
  | 'car-outline'
  | 'bicycle'
  | 'walk'
  | 'trending-up'
  | 'trending-down'
  | 'stats-chart'
  | 'analytics'
  | 'calendar'
  | 'calendar-outline'
  | 'notifications'
  | 'notifications-outline'
  | 'log-out'
  | 'log-out-outline'
  | 'camera'
  | 'camera-outline'
  | 'image'
  | 'image-outline'
  | 'document'
  | 'document-outline'
  | 'folder'
  | 'folder-outline'
  | 'cloud-upload'
  | 'cloud-download'
  | 'sync'
  | 'alert-circle'
  | 'information-circle'
  | 'help-circle'
  | 'trash'
  | 'trash-outline'
  | 'create'
  | 'create-outline'
  | 'eye'
  | 'eye-outline'
  | 'eye-off'
  | 'eye-off-outline'
  | 'copy'
  | 'copy-outline'
  | 'share'
  | 'share-outline'
  | 'download'
  | 'upload'
  | 'link'
  | 'mail'
  | 'mail-outline'
  | 'call'
  | 'call-outline'
  | 'chatbubble'
  | 'chatbubble-outline'
  | 'globe'
  | 'globe-outline'
  | 'lock-closed'
  | 'lock-open'
  | 'key'
  | 'finger-print'
  | 'shield-checkmark'
  | 'flag'
  | 'flag-outline'
  | 'star'
  | 'star-outline'
  | 'heart'
  | 'heart-outline'
  | 'bookmark'
  | 'bookmark-outline'
  | 'play'
  | 'pause'
  | 'stop'
  | 'skip-forward'
  | 'skip-back'
  | 'volume-high'
  | 'volume-low'
  | 'volume-mute'
  | 'moon'
  | 'sunny'
  | 'partly-sunny'
  | 'cloudy'
  | 'rainy'
  | 'thunderstorm'
  | 'snow'
  | 'wifi'
  | 'wifi-outline'
  | 'bluetooth'
  | 'cellular'
  | 'battery-full'
  | 'battery-half'
  | 'battery-low'
  | 'flash'
  | 'flashlight'
  | 'qr-code'
  | 'barcode'
  | 'scan'
  | 'print';

/**
 * Assert that a string is a valid Ionicon name
 * Returns the string as IoniconName type if valid, undefined otherwise
 */
export function asIoniconName(name: string): IoniconName | undefined {
  // This is a simplified check - in production you might want a full list
  const commonIcons = new Set<string>([
    'home',
    'home-outline',
    'map',
    'map-outline',
    'person',
    'person-outline',
    'settings',
    'settings-outline',
    'warning',
    'warning-outline',
    'checkmark',
    'checkmark-circle',
    'close',
    'close-circle',
    'add',
    'remove',
    'chevron-forward',
    'chevron-back',
    'menu',
    'search',
    'refresh',
    'time',
    'time-outline',
    'location',
    'location-outline',
    'navigate',
    'navigate-outline',
    'car',
    'car-outline',
    'calendar',
    'calendar-outline',
    'notifications',
    'notifications-outline',
    'log-out',
    'log-out-outline',
    'camera',
    'camera-outline',
    'image',
    'image-outline',
    'trash',
    'trash-outline',
    'create',
    'create-outline',
    'eye',
    'eye-outline',
    'eye-off',
    'eye-off-outline',
    'alert-circle',
    'information-circle',
    'help-circle',
    'flag',
    'flag-outline',
  ]);

  if (commonIcons.has(name)) {
    return name as IoniconName;
  }

  // Allow any name ending with -outline if base exists
  if (name.endsWith('-outline')) {
    const base = name.replace('-outline', '');
    if (commonIcons.has(base)) {
      return name as IoniconName;
    }
  }

  return undefined;
}
