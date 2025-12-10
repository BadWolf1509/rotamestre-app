import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Utilitários de feedback háptico para ações do motorista
 * Melhora a UX ao dirigir com feedback tátil
 */

// Verificar se haptics está disponível
const isHapticsAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Feedback leve - para toques em botões normais
 */
export async function lightHaptic() {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Silenciar erros de haptics
  }
}

/**
 * Feedback médio - para ações importantes (navegar, confirmar)
 */
export async function mediumHaptic() {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Silenciar erros de haptics
  }
}

/**
 * Feedback forte - para ações críticas (iniciar rota, finalizar)
 */
export async function heavyHaptic() {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // Silenciar erros de haptics
  }
}

/**
 * Feedback de sucesso - para ações concluídas com êxito
 */
export async function successHaptic() {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Silenciar erros de haptics
  }
}

/**
 * Feedback de aviso - para alertas ou ações que requerem atenção
 */
export async function warningHaptic() {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Silenciar erros de haptics
  }
}

/**
 * Feedback de erro - para ações que falharam
 */
export async function errorHaptic() {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Silenciar erros de haptics
  }
}

/**
 * Feedback de seleção - para mudança de opções/tabs
 */
export async function selectionHaptic() {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Silenciar erros de haptics
  }
}

/**
 * Wrapper que adiciona haptic a qualquer função
 */
export function withHaptic<T extends (...args: any[]) => any>(
  fn: T,
  hapticType: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' = 'light'
): T {
  const hapticFn = {
    light: lightHaptic,
    medium: mediumHaptic,
    heavy: heavyHaptic,
    success: successHaptic,
    warning: warningHaptic,
    error: errorHaptic,
    selection: selectionHaptic,
  }[hapticType];

  return (async (...args: Parameters<T>) => {
    await hapticFn();
    return fn(...args);
  }) as T;
}
