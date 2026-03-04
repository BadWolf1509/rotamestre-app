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
  showPiPMap: boolean;
  showOptimization: boolean;
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
  optimization: any;
}

const initialState: InicioModalsState = {
  showIncidentWizard: false,
  showPiPMap: false,
  showOptimization: false,
  showCompletionFlow: false,
  showSupportModal: false,
  showCompleteRouteModal: false,
  showSkipModal: false,
  navigationMode: false,
  miniMapExpanded: false,
  selectedParadaForCompletion: null,
  selectedParadaForSkip: null,
  optimization: null,
};

// --- Actions ---

type ModalAction =
  | { type: 'OPEN_INCIDENT_WIZARD' }
  | { type: 'CLOSE_INCIDENT_WIZARD' }
  | { type: 'OPEN_PIP_MAP' }
  | { type: 'CLOSE_PIP_MAP' }
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
  | { type: 'SET_OPTIMIZATION'; data: any }
  | { type: 'DISMISS_OPTIMIZATION' }
  | { type: 'CLEAR_OPTIMIZATION' }
  | { type: 'RESET_ALL' };

// --- Reducer ---

function modalReducer(state: InicioModalsState, action: ModalAction): InicioModalsState {
  switch (action.type) {
    case 'OPEN_INCIDENT_WIZARD':
      return { ...state, showIncidentWizard: true };
    case 'CLOSE_INCIDENT_WIZARD':
      return { ...state, showIncidentWizard: false };

    case 'OPEN_PIP_MAP':
      return { ...state, showPiPMap: true, miniMapExpanded: false };
    case 'CLOSE_PIP_MAP':
      return { ...state, showPiPMap: false };

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
      return { ...state, showSkipModal: true, selectedParadaForSkip: action.parada };
    case 'CLOSE_SKIP_MODAL':
      return { ...state, showSkipModal: false, selectedParadaForSkip: null };

    case 'SET_NAVIGATION_MODE':
      return { ...state, navigationMode: action.enabled };

    case 'TOGGLE_MINI_MAP':
      return { ...state, miniMapExpanded: !state.miniMapExpanded };
    case 'COLLAPSE_MINI_MAP':
      return { ...state, miniMapExpanded: false };

    case 'SET_OPTIMIZATION':
      return { ...state, optimization: action.data, showOptimization: true };
    case 'DISMISS_OPTIMIZATION':
      return { ...state, showOptimization: false };
    case 'CLEAR_OPTIMIZATION':
      return { ...state, showOptimization: false, optimization: null };

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
  const openIncidentWizard = useCallback(() => dispatch({ type: 'OPEN_INCIDENT_WIZARD' }), []);
  const closeIncidentWizard = useCallback(() => dispatch({ type: 'CLOSE_INCIDENT_WIZARD' }), []);

  const openPiPMap = useCallback(() => dispatch({ type: 'OPEN_PIP_MAP' }), []);
  const closePiPMap = useCallback(() => dispatch({ type: 'CLOSE_PIP_MAP' }), []);

  const openCompletionFlow = useCallback(
    (parada: ParadaData) => dispatch({ type: 'OPEN_COMPLETION_FLOW', parada }),
    [],
  );
  const closeCompletionFlow = useCallback(() => dispatch({ type: 'CLOSE_COMPLETION_FLOW' }), []);

  const openSupport = useCallback(() => dispatch({ type: 'OPEN_SUPPORT' }), []);
  const closeSupport = useCallback(() => dispatch({ type: 'CLOSE_SUPPORT' }), []);

  const openCompleteRoute = useCallback(() => dispatch({ type: 'OPEN_COMPLETE_ROUTE' }), []);
  const closeCompleteRoute = useCallback(() => dispatch({ type: 'CLOSE_COMPLETE_ROUTE' }), []);

  const openSkipModal = useCallback(
    (parada: ParadaData) => dispatch({ type: 'OPEN_SKIP_MODAL', parada }),
    [],
  );
  const closeSkipModal = useCallback(() => dispatch({ type: 'CLOSE_SKIP_MODAL' }), []);

  const setNavigationMode = useCallback(
    (enabled: boolean) => dispatch({ type: 'SET_NAVIGATION_MODE', enabled }),
    [],
  );
  const toggleMiniMap = useCallback(() => dispatch({ type: 'TOGGLE_MINI_MAP' }), []);

  const setOptimization = useCallback(
    (data: any) => dispatch({ type: 'SET_OPTIMIZATION', data }),
    [],
  );
  const dismissOptimization = useCallback(() => dispatch({ type: 'DISMISS_OPTIMIZATION' }), []);
  const clearOptimization = useCallback(() => dispatch({ type: 'CLEAR_OPTIMIZATION' }), []);

  return {
    // State
    ...state,

    // Actions
    openIncidentWizard,
    closeIncidentWizard,
    openPiPMap,
    closePiPMap,
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
    setOptimization,
    dismissOptimization,
    clearOptimization,
  };
}
