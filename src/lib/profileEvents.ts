/**
 * Sistema simples de eventos para sincronização de perfil
 * Usado para notificar useUser quando o perfil é atualizado em useProfile
 */

type ProfileEventListener = () => void;

const listeners: Set<ProfileEventListener> = new Set();

/**
 * Registra um listener para eventos de atualização de perfil
 */
export function onProfileUpdate(listener: ProfileEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Emite evento de atualização de perfil para todos os listeners
 */
export function emitProfileUpdate(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn('[ProfileEvents] Erro ao chamar listener:', error);
    }
  });
}
