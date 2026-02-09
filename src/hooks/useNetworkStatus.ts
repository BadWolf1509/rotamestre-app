import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { useEffect, useState, useCallback } from 'react';

export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: ConnectionType;
  isWifi: boolean;
  isCellular: boolean;
  details: NetInfoState | null;
}

/**
 * Hook para monitorar status de conectividade de rede
 * Usa @react-native-community/netinfo para detectar mudanças em tempo real
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isConnected, isWifi, connectionType } = useNetworkStatus();
 *
 *   if (!isConnected) {
 *     return <OfflineBanner />;
 *   }
 *
 *   return <OnlineContent />;
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    connectionType: 'unknown',
    isWifi: false,
    isCellular: false,
    details: null,
  });

  const parseNetInfoState = useCallback((state: NetInfoState): NetworkStatus => {
    let connectionType: ConnectionType;

    switch (state.type) {
      case NetInfoStateType.wifi:
        connectionType = 'wifi';
        break;
      case NetInfoStateType.cellular:
        connectionType = 'cellular';
        break;
      case NetInfoStateType.ethernet:
        connectionType = 'ethernet';
        break;
      case NetInfoStateType.none:
        connectionType = 'none';
        break;
      default:
        connectionType = 'unknown';
    }

    return {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      connectionType,
      isWifi: state.type === NetInfoStateType.wifi,
      isCellular: state.type === NetInfoStateType.cellular,
      details: state,
    };
  }, []);

  useEffect(() => {
    // Obter status inicial
    NetInfo.fetch().then((state) => {
      setNetworkStatus(parseNetInfoState(state));
    });

    // Escutar mudanças de conectividade
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkStatus(parseNetInfoState(state));
    });

    return () => {
      unsubscribe();
    };
  }, [parseNetInfoState]);

  return networkStatus;
}

/**
 * Hook simplificado que retorna apenas se está conectado
 *
 * @example
 * ```tsx
 * const isOnline = useIsOnline();
 * ```
 */
export function useIsOnline(): boolean {
  const { isConnected, isInternetReachable } = useNetworkStatus();

  // isInternetReachable pode ser null enquanto verifica
  // Nesse caso, confiar apenas em isConnected
  if (isInternetReachable === null) {
    return isConnected;
  }

  return isConnected && isInternetReachable;
}
