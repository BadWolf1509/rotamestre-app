import { Ionicons } from '@expo/vector-icons';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

type CheckStatus = 'ok' | 'warning' | 'error' | 'loading';

interface ChecklistStatus {
  gps: CheckStatus;
  internet: CheckStatus;
  battery: CheckStatus;
  batteryLevel: number;
}

interface PreRouteChecklistProps {
  /** Callback quando o status muda - retorna se pode iniciar a rota */
  onStatusChange?: (canStart: boolean, allOk: boolean) => void;
  /** Se true, mostra versão compacta (apenas ícones) */
  compact?: boolean;
}

/**
 * Checklist Pré-Rota
 * Verifica GPS, Internet e Bateria antes do motorista iniciar a rota
 *
 * - GPS: Crítico - bloqueia início se desativado
 * - Internet: Warning se instável, mas permite iniciar
 * - Bateria: Warning se < 20%, crítico se < 10%
 */
export function PreRouteChecklist({ onStatusChange, compact = false }: PreRouteChecklistProps) {
  const { theme } = useUnistyles();
  const [status, setStatus] = useState<ChecklistStatus>({
    gps: 'loading',
    internet: 'loading',
    battery: 'loading',
    batteryLevel: 100,
  });
  const [isChecking, setIsChecking] = useState(true);

  const checkGPS = useCallback(async (): Promise<CheckStatus> => {
    try {
      // Primeiro verificar permissão
      const { status: permStatus } = await Location.getForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        return 'error';
      }

      // Depois verificar se o serviço está ativo
      const enabled = await Location.hasServicesEnabledAsync();
      return enabled ? 'ok' : 'error';
    } catch (error) {
      console.warn('[PreRouteChecklist] GPS check error:', error);
      return 'error';
    }
  }, []);

  const checkInternet = useCallback(async (): Promise<{ status: CheckStatus }> => {
    try {
      const state = await Network.getNetworkStateAsync();

      if (!state.isConnected) {
        return { status: 'error' };
      }

      // isInternetReachable pode ser null em alguns casos
      if (state.isInternetReachable === false) {
        return { status: 'warning' };
      }

      return { status: 'ok' };
    } catch (error) {
      console.warn('[PreRouteChecklist] Internet check error:', error);
      return { status: 'warning' };
    }
  }, []);

  const checkBattery = useCallback(async (): Promise<{ status: CheckStatus; level: number }> => {
    try {
      // Web não suporta Battery API do expo
      if (Platform.OS === 'web') {
        // Tentar usar a Battery API nativa do browser
        if ('getBattery' in navigator) {
          try {
            const battery = await (navigator as any).getBattery();
            const percentage = Math.round(battery.level * 100);
            if (percentage < 10) return { status: 'error', level: percentage };
            if (percentage < 20) return { status: 'warning', level: percentage };
            return { status: 'ok', level: percentage };
          } catch {
            // Fallback se a API não funcionar
            return { status: 'ok', level: 100 };
          }
        }
        return { status: 'ok', level: 100 };
      }

      const level = await Battery.getBatteryLevelAsync();
      const percentage = Math.round(level * 100);

      // -1 significa que não conseguiu ler (simulador, por exemplo)
      if (percentage < 0) {
        return { status: 'ok', level: 100 };
      }

      if (percentage < 10) return { status: 'error', level: percentage };
      if (percentage < 20) return { status: 'warning', level: percentage };
      return { status: 'ok', level: percentage };
    } catch (error) {
      console.warn('[PreRouteChecklist] Battery check error:', error);
      return { status: 'ok', level: 100 };
    }
  }, []);

  const checkAllStatus = useCallback(async () => {
    setIsChecking(true);

    try {
      const [gpsStatus, internetResult, batteryResult] = await Promise.all([
        checkGPS(),
        checkInternet(),
        checkBattery(),
      ]);

      const newStatus: ChecklistStatus = {
        gps: gpsStatus,
        internet: internetResult.status,
        battery: batteryResult.status,
        batteryLevel: batteryResult.level,
      };

      setStatus(newStatus);

      // GPS é crítico - sem ele não pode iniciar
      // Internet e bateria são warnings mas não bloqueiam
      const canStart = gpsStatus !== 'error';
      const allOk =
        gpsStatus === 'ok' &&
        internetResult.status === 'ok' &&
        batteryResult.status === 'ok';

      onStatusChange?.(canStart, allOk);
    } catch (error) {
      console.error('[PreRouteChecklist] Error checking status:', error);
    } finally {
      setIsChecking(false);
    }
  }, [checkGPS, checkInternet, checkBattery, onStatusChange]);

  // Check inicial e re-check a cada 5 segundos
  useEffect(() => {
    checkAllStatus();

    const interval = setInterval(checkAllStatus, 5000);
    return () => clearInterval(interval);
  }, [checkAllStatus]);

  const openSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else if (Platform.OS === 'android') {
      Linking.openSettings();
    }
    // Web: não há settings para abrir
  }, []);

  const requestGPSPermission = useCallback(async () => {
    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus === 'granted') {
        // Re-check após permissão concedida
        checkAllStatus();
      } else {
        // Se negou, abrir settings
        openSettings();
      }
    } catch (error) {
      console.error('[PreRouteChecklist] Error requesting GPS permission:', error);
      openSettings();
    }
  }, [checkAllStatus, openSettings]);

  const getStatusIcon = (itemStatus: CheckStatus): { icon: string; color: string } => {
    switch (itemStatus) {
      case 'ok':
        return { icon: 'checkmark-circle', color: theme.colors.success };
      case 'warning':
        return { icon: 'warning', color: theme.colors.warning };
      case 'error':
        return { icon: 'close-circle', color: theme.colors.error };
      default:
        return { icon: 'ellipsis-horizontal', color: theme.colors.gray400 };
    }
  };

  const allOk =
    status.gps === 'ok' && status.internet === 'ok' && status.battery === 'ok';
  const hasError = status.gps === 'error' || status.battery === 'error';
  const hasWarning =
    status.internet === 'warning' || status.battery === 'warning';

  // Versão compacta - apenas ícones inline
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {isChecking ? (
          <ActivityIndicator size="small" color={theme.colors.gray400} />
        ) : (
          <>
            <View style={styles.compactItem}>
              <Ionicons
                name={getStatusIcon(status.gps).icon as any}
                size={16}
                color={getStatusIcon(status.gps).color}
              />
              <Text style={styles.compactLabel}>GPS</Text>
            </View>
            <View style={styles.compactItem}>
              <Ionicons
                name={getStatusIcon(status.internet).icon as any}
                size={16}
                color={getStatusIcon(status.internet).color}
              />
              <Text style={styles.compactLabel}>Rede</Text>
            </View>
            <View style={styles.compactItem}>
              <Ionicons
                name={getStatusIcon(status.battery).icon as any}
                size={16}
                color={getStatusIcon(status.battery).color}
              />
              <Text style={styles.compactLabel}>{status.batteryLevel}%</Text>
            </View>
          </>
        )}
      </View>
    );
  }

  // Versão completa
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons
          name={
            allOk
              ? 'checkmark-circle'
              : hasError
                ? 'alert-circle'
                : 'warning'
          }
          size={18}
          color={
            allOk
              ? theme.colors.success
              : hasError
                ? theme.colors.error
                : theme.colors.warning
          }
        />
        <Text style={styles.title}>CHECKLIST PRÉ-ROTA</Text>
        {isChecking && (
          <ActivityIndicator
            size="small"
            color={theme.colors.gray400}
            style={styles.loader}
          />
        )}
      </View>

      {/* GPS */}
      <ChecklistItem
        label="GPS ativo"
        status={status.gps}
        theme={theme}
        onAction={status.gps === 'error' ? requestGPSPermission : undefined}
        actionLabel="Ativar"
      />

      {/* Internet */}
      <ChecklistItem
        label={
          status.internet === 'warning'
            ? 'Conexão instável'
            : status.internet === 'error'
              ? 'Sem internet'
              : 'Internet conectada'
        }
        status={status.internet}
        theme={theme}
      />

      {/* Battery */}
      <ChecklistItem
        label={status.battery === 'ok' ? 'Bateria > 20%' : 'Bateria baixa'}
        status={status.battery}
        suffix={`${status.batteryLevel}%`}
        theme={theme}
        isLast
      />

      {/* Message */}
      <View style={styles.messageContainer}>
        <Ionicons
          name="bulb-outline"
          size={14}
          color={allOk ? theme.colors.success : theme.colors.warning}
        />
        <Text
          style={[
            styles.message,
            { color: allOk ? theme.colors.success : theme.colors.warning },
          ]}
        >
          {allOk
            ? 'Tudo pronto para iniciar!'
            : hasError
              ? status.gps === 'error'
                ? 'Ative o GPS para iniciar a rota'
                : 'Carregue o celular antes de iniciar'
              : 'Recomendamos verificar a conexão'}
        </Text>
      </View>
    </View>
  );
}

// Componente interno para cada item do checklist
function ChecklistItem({
  label,
  status,
  suffix,
  onAction,
  actionLabel,
  theme,
  isLast = false,
}: {
  label: string;
  status: CheckStatus;
  suffix?: string;
  onAction?: () => void;
  actionLabel?: string;
  theme: Theme;
  isLast?: boolean;
}) {
  const getStatusVisual = () => {
    switch (status) {
      case 'ok':
        return { icon: 'checkmark-circle', color: theme.colors.success };
      case 'warning':
        return { icon: 'warning', color: theme.colors.warning };
      case 'error':
        return { icon: 'close-circle', color: theme.colors.error };
      default:
        // Loading state - usar ícone mais visível
        return { icon: 'radio-button-off', color: theme.colors.gray400 };
    }
  };

  const { icon, color } = getStatusVisual();
  const isLoading = status === 'loading';

  return (
    <View style={[styles.item, !isLast && styles.itemBorder]}>
      <View style={styles.itemLeft}>
        {isLoading ? (
          <ActivityIndicator size={18} color={theme.colors.gray400} />
        ) : (
          <Ionicons name={icon as any} size={18} color={color} />
        )}
        <Text style={styles.itemLabel}>{label}</Text>
      </View>
      <View style={styles.itemRight}>
        {suffix && (
          <Text style={[styles.itemSuffix, { color }]}>{suffix}</Text>
        )}
        {onAction && (
          <TouchableOpacity
            onPress={onAction}
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            activeOpacity={0.7}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.gray50,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.gray600,
    letterSpacing: 0.5,
  },
  loader: {
    marginLeft: 'auto',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemLabel: {
    fontSize: 14,
    color: theme.colors.gray700,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemSuffix: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  message: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Compact version styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.gray50,
    borderRadius: 8,
  },
  compactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactLabel: {
    fontSize: 11,
    color: theme.colors.gray600,
    fontWeight: '500',
  },
}));
