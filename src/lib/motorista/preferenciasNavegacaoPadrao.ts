/**
 * Tipos e padrões das preferências de navegação do motorista.
 *
 * Módulo puro, de propósito: sem `expo-*`, `react-native` ou Supabase. A tela
 * de Configurações, o hook do modo navegação e o serviço de localização leem a
 * MESMA tabela daqui, sem puxar o serviço (e o que ele registra ao ser
 * importado) só para saber um padrão.
 */

/** Para onde o botão "Navegar" leva: o mapa do app ou o app externo. */
export type ModoNavegar = 'mapa' | 'externo';

export interface NavigationState {
  enabled: boolean;
  /**
   * Destino do botão "Navegar". Substituiu `autoAdvance` ("Avanço
   * Automático") em 05/10/2026: desde 02/10 nada avança sozinho, e o nome
   * prometia exatamente o comportamento que gerou entregas sem foto.
   */
  navegarCom: ModoNavegar;
  vibrationAlerts: boolean;
  proximityRadius: number;
  // Extended preferences from NavigationSettings
  showSpeedometer?: boolean;
  preventScreenSleep?: boolean;
  // Unified preferences (migrated from configuracoes.tsx)
  preferredNavApp?: 'waze' | 'google_maps' | 'apple_maps' | 'default';
  // Navigation session state
  rotaId?: string;
  currentStopId?: string;
  nextStopId?: string;
  currentStopLocation?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * As preferências com todas as chaves obrigatórias — o que
 * `getNavigationPreferences` devolve.
 */
export type PreferenciasDeNavegacao = NavigationState &
  Required<
    Pick<
      NavigationState,
      'showSpeedometer' | 'preventScreenSleep' | 'preferredNavApp'
    >
  >;

/**
 * Fonte única dos padrões. Antes existiam três cópias, em arquivos
 * diferentes; elas concordavam por sorte, não por construção.
 */
export const PREFERENCIAS_PADRAO: PreferenciasDeNavegacao = {
  enabled: true,
  navegarCom: 'mapa',
  vibrationAlerts: true,
  proximityRadius: 50,
  showSpeedometer: true,
  preventScreenSleep: true,
  preferredNavApp: 'default',
};
