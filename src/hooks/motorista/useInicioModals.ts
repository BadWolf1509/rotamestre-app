/**
 * useInicioModals - Gerencia estados de modals/UI da tela inicio do motorista
 *
 * Consolida 11 useState em um único useReducer para:
 * - Reduzir re-renders desnecessários
 * - Centralizar lógica de transição de modais
 * - Facilitar debugging (dispatch actions são rastreáveis)
 */

import { useReducer, useCallback } from 'react';

import type { ParadaData } from '@/context/RouteStatusContext';

// --- State ---

export interface InicioModalsState {
  // Modal visibility
  showIncidentWizard: boolean;
  /**
   * Parada a que o incidente se refere. Antes o wizard usava sempre o
   * `currentStop`; explicitar permite reabrir um rascunho interrompido na
   * parada certa, que pode nao ser a atual.
   */
  selectedParadaForIncident: ParadaData | null;
  showCompletionFlow: boolean;
  showSupportModal: boolean;
  showCompleteRouteModal: boolean;
  showSkipModal: boolean;

  // UI toggles
  navigationMode: boolean;
  miniMapExpanded: boolean;

  // Data associated with modals
  selectedParadaForCompletion: ParadaData | null;
  selectedParadaForSkip: ParadaData | null;
}

const initialState: InicioModalsState = {
  showIncidentWizard: false,
  selectedParadaForIncident: null,
  showCompletionFlow: false,
  showSupportModal: false,
  showCompleteRouteModal: false,
  showSkipModal: false,
  navigationMode: false,
  miniMapExpanded: false,
  selectedParadaForCompletion: null,
  selectedParadaForSkip: null,
};

// --- Actions ---

type ModalAction =
  | { type: 'OPEN_INCIDENT_WIZARD'; parada: ParadaData | null }
  | { type: 'CLOSE_INCIDENT_WIZARD' }
  | { type: 'OPEN_COMPLETION_FLOW'; parada: ParadaData }
  | { type: 'CLOSE_COMPLETION_FLOW' }
  | { type: 'OPEN_SUPPORT' }
  | { type: 'CLOSE_SUPPORT' }
  | { type: 'OPEN_COMPLETE_ROUTE' }
  | { type: 'CLOSE_COMPLETE_ROUTE' }
  | { type: 'OPEN_SKIP_MODAL'; parada: ParadaData }
  | { type: 'CLOSE_SKIP_MODAL' }
  | { type: 'SET_NAVIGATION_MODE'; enabled: boolean }
  | { type: 'TOGGLE_MINI_MAP' }
  | { type: 'COLLAPSE_MINI_MAP' }
  | { type: 'RESET_ALL' };

// --- Reducer ---

function modalReducer(
  state: InicioModalsState,
  action: ModalAction,
): InicioModalsState {
  switch (action.type) {
    case 'OPEN_INCIDENT_WIZARD':
      return {
        ...state,
        showIncidentWizard: true,
        selectedParadaForIncident: action.parada,
      };
    case 'CLOSE_INCIDENT_WIZARD':
      return {
        ...state,
        showIncidentWizard: false,
        selectedParadaForIncident: null,
      };

    case 'OPEN_COMPLETION_FLOW':
      return {
        ...state,
        showCompletionFlow: true,
        selectedParadaForCompletion: action.parada,
      };
    case 'CLOSE_COMPLETION_FLOW':
      return {
        ...state,
        showCompletionFlow: false,
        selectedParadaForCompletion: null,
      };

    case 'OPEN_SUPPORT':
      return { ...state, showSupportModal: true };
    case 'CLOSE_SUPPORT':
      return { ...state, showSupportModal: false };

    case 'OPEN_COMPLETE_ROUTE':
      return { ...state, showCompleteRouteModal: true };
    case 'CLOSE_COMPLETE_ROUTE':
      return { ...state, showCompleteRouteModal: false };

    case 'OPEN_SKIP_MODAL':
      return {
        ...state,
        showSkipModal: true,
        selectedParadaForSkip: action.parada,
      };
    case 'CLOSE_SKIP_MODAL':
      return { ...state, showSkipModal: false, selectedParadaForSkip: null };

    case 'SET_NAVIGATION_MODE':
      return { ...state, navigationMode: action.enabled };

    case 'TOGGLE_MINI_MAP':
      return { ...state, miniMapExpanded: !state.miniMapExpanded };
    case 'COLLAPSE_MINI_MAP':
      return { ...state, miniMapExpanded: false };

    case 'RESET_ALL':
      return initialState;

    default:
      return state;
  }
}

// --- Hook ---

export function useInicioModals() {
  const [state, dispatch] = useReducer(modalReducer, initialState);

  // Convenience actions (stable references via useCallback)
  const openIncidentWizard = useCallback(
    (parada: ParadaData | null = null) =>
      dispatch({ type: 'OPEN_INCIDENT_WIZARD', parada }),
    [],
  );
  const closeIncidentWizard = useCallback(
    () => dispatch({ type: 'CLOSE_INCIDENT_WIZARD' }),
    [],
  );

  const openCompletionFlow = useCallback(
    (parada: ParadaData) => dispatch({ type: 'OPEN_COMPLETION_FLOW', parada }),
    [],
  );
  const closeCompletionFlow = useCallback(
    () => dispatch({ type: 'CLOSE_COMPLETION_FLOW' }),
    [],
  );

  const openSupport = useCallback(() => dispatch({ type: 'OPEN_SUPPORT' }), []);
  const closeSupport = useCallback(
    () => dispatch({ type: 'CLOSE_SUPPORT' }),
    [],
  );

  const openCompleteRoute = useCallback(
    () => dispatch({ type: 'OPEN_COMPLETE_ROUTE' }),
    [],
  );
  const closeCompleteRoute = useCallback(
    () => dispatch({ type: 'CLOSE_COMPLETE_ROUTE' }),
    [],
  );

  const openSkipModal = useCallback(
    (parada: ParadaData) => dispatch({ type: 'OPEN_SKIP_MODAL', parada }),
    [],
  );
  const closeSkipModal = useCallback(
    () => dispatch({ type: 'CLOSE_SKIP_MODAL' }),
    [],
  );

  const setNavigationMode = useCallback(
    (enabled: boolean) => dispatch({ type: 'SET_NAVIGATION_MODE', enabled }),
    [],
  );
  const toggleMiniMap = useCallback(
    () => dispatch({ type: 'TOGGLE_MINI_MAP' }),
    [],
  );

  return {
    // State
    ...state,

    // Actions
    openIncidentWizard,
    closeIncidentWizard,
    openCompletionFlow,
    closeCompletionFlow,
    openSupport,
    closeSupport,
    openCompleteRoute,
    closeCompleteRoute,
    openSkipModal,
    closeSkipModal,
    setNavigationMode,
    toggleMiniMap,
  };
}
