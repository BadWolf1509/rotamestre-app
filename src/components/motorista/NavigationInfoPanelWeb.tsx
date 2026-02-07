/**
 * NavigationInfoPanelWeb.tsx - Info panel for NavigationMode (Web)
 *
 * Extracted from NavigationMode.web.tsx to keep components focused.
 * Shows distance, ETA, speed, destination info, progress, and action buttons.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import type { ParadaData } from '@/context/RouteStatusContext';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export interface NavigationInfoPanelWebProps {
  /** All real (non-checkpoint) paradas for progress display */
  realParadas: ParadaData[];
  /** The current destination stop */
  currentStop: ParadaData;
  /** The next stop after current (for hint display) */
  nextStop?: ParadaData | null;
  /** 1-based index of current stop among realParadas */
  currentStopIndex: number;
  /** Whether current stop is an entrega (vs retirada) */
  isEntrega: boolean;
  /** Whether driver is near the destination */
  isNearDestination: boolean;
  /** Distance in meters to current stop (null if unknown) */
  distanceToStop: number | null;
  /** Estimated time of arrival string */
  eta: string | null;
  /** Current speed in km/h */
  speed: number;
  /** Whether to show the speedometer section */
  showSpeedometer: boolean;
  /** Format distance in meters to human-readable string */
  formatDistance: (meters: number) => string;
  /** Get color string based on speed value */
  getSpeedColor: (speedKmh: number) => string;
  /** Called when driver skips this stop */
  onSkip: () => void;
  /** Called when driver completes this stop */
  onComplete: () => void;
  /** Called when driver wants to open external navigation */
  onOpenExternalNavigation: () => void;
}

export const NavigationInfoPanelWeb = React.memo(function NavigationInfoPanelWeb({
  realParadas,
  currentStop,
  nextStop,
  currentStopIndex,
  isEntrega,
  isNearDestination,
  distanceToStop,
  eta,
  speed,
  showSpeedometer,
  formatDistance,
  getSpeedColor,
  onSkip,
  onComplete,
  onOpenExternalNavigation,
}: NavigationInfoPanelWebProps) {
  const { theme } = useUnistyles();
  const [buttonPressed, setButtonPressed] = React.useState<string | null>(null);

  return (
    <View style={styles.infoContainer}>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        {realParadas.map((parada, index) => {
          const isCompleted = parada.status === 'concluida';
          const isCurrent = parada.id === currentStop.id;
          const isPending = parada.status === 'pendente' && !isCurrent;
          return (
            <React.Fragment key={parada.id}>
              <View
                style={[
                  styles.progressDot,
                  isCompleted && styles.progressDotCompleted,
                  isCurrent && styles.progressDotCurrent,
                  isPending && styles.progressDotPending,
                ]}
              >
                {isCurrent && (
                  <Ionicons name="navigate" size={10} color={theme.colors.white} />
                )}
                {isCompleted && (
                  <Ionicons name="checkmark" size={10} color={theme.colors.white} />
                )}
                {isPending && (
                  <Text style={styles.progressDotText}>{index + 1}</Text>
                )}
              </View>
              {index < realParadas.length - 1 && (
                <View
                  style={[
                    styles.progressLine,
                    isCompleted && styles.progressLineCompleted,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Distance, ETA and Speed */}
      <View style={styles.mainInfo}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            ...(isNearDestination && { animation: 'pip-pulse 1s ease-in-out infinite' }),
          }}
        >
          <Text
            style={[
              styles.distanceValue,
              isNearDestination && styles.distanceValueNear,
            ]}
          >
            {distanceToStop ? formatDistance(distanceToStop) : '--'}
          </Text>
          <Text style={styles.distanceLabel}>
            {isNearDestination ? '🎯 Chegando!' : 'distância'}
          </Text>
        </div>

        <View style={styles.separator} />

        <View style={styles.etaContainer}>
          <Text style={styles.etaValue}>{eta || '--'}</Text>
          <Text style={styles.etaLabel}>chegada</Text>
        </View>

        {showSpeedometer && (
          <>
            <View style={styles.separator} />
            <View style={styles.speedContainer}>
              <Text style={[styles.speedValue, { color: getSpeedColor(speed) }]}>
                {speed}
              </Text>
              <Text style={styles.speedUnit}>km/h</Text>
            </View>
          </>
        )}
      </View>

      {/* Current Destination */}
      <View style={styles.destinationInfo}>
        <View style={styles.destinationHeader}>
          <View style={styles.destinationHeaderLeft}>
            <View
              style={[
                styles.typeBadge,
                isEntrega ? styles.typeBadgeEntrega : styles.typeBadgeRetirada,
              ]}
            >
              <Ionicons
                name={isEntrega ? 'cube' : 'arrow-up-circle'}
                size={12}
                color={isEntrega ? theme.colors.success : theme.colors.warning}
              />
              <Text
                style={[
                  styles.typeBadgeText,
                  isEntrega ? styles.typeBadgeTextEntrega : styles.typeBadgeTextRetirada,
                ]}
              >
                {isEntrega ? 'Entrega' : 'Retirada'}
              </Text>
            </View>
            <Text style={styles.destinationLabel}>
              • Parada {currentStopIndex}/{realParadas.length}
            </Text>
          </View>
          {nextStop && (
            <Text style={styles.nextStopHint}>
              Próxima: {nextStop.endereco.split(',')[0]}
            </Text>
          )}
        </View>
        <Text style={styles.destinationAddress}>{currentStop.endereco}</Text>

        {currentStop.destinatario && (
          <View style={styles.recipientInfo}>
            <Ionicons name="person-outline" size={14} color={theme.colors.gray500} />
            <Text style={styles.recipientText}>{currentStop.destinatario}</Text>
          </View>
        )}

        {currentStop.observacoes && (
          <View style={styles.observationBox}>
            <Text style={styles.observationText}>{currentStop.observacoes}</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.skipButton,
            buttonPressed === 'skip' && styles.buttonPressed,
          ]}
          onPress={onSkip}
          onPressIn={() => setButtonPressed('skip')}
          onPressOut={() => setButtonPressed(null)}
          activeOpacity={1}
        >
          <Ionicons name="arrow-forward-circle-outline" size={20} color={theme.colors.warning} />
          <Text style={styles.skipButtonText}>Pular</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.mapsButton,
            buttonPressed === 'maps' && styles.buttonPressed,
          ]}
          onPress={onOpenExternalNavigation}
          onPressIn={() => setButtonPressed('maps')}
          onPressOut={() => setButtonPressed(null)}
          activeOpacity={1}
        >
          <Ionicons name="navigate" size={20} color={theme.colors.white} />
          <Text style={styles.mapsButtonText}>Abrir no Maps</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.completeButton,
            buttonPressed === 'complete' && styles.buttonPressed,
          ]}
          onPress={onComplete}
          onPressIn={() => setButtonPressed('complete')}
          onPressOut={() => setButtonPressed(null)}
          activeOpacity={1}
        >
          <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
          <Text style={styles.completeButtonText}>Concluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  infoContainer: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingTop: theme.spacing['3'],
    paddingHorizontal: theme.spacing['4'],
    paddingBottom: 30,
    elevation: 10,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['2'],
    marginBottom: theme.spacing['2'],
  },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray300,
  },
  progressDotCompleted: {
    backgroundColor: theme.colors.success,
  },
  progressDotCurrent: {
    backgroundColor: theme.colors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  progressDotPending: {
    backgroundColor: theme.colors.gray300,
  },
  progressDotText: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.colors.gray600,
  },
  progressLine: {
    width: 20,
    height: 2,
    backgroundColor: theme.colors.gray300,
    marginHorizontal: 2,
  },
  progressLineCompleted: {
    backgroundColor: theme.colors.success,
  },
  mainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: theme.spacing['4'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  distanceValue: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: '700',
    color: theme.colors.gray900,
  },
  distanceValueNear: {
    color: theme.colors.success,
  },
  distanceLabel: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  separator: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.gray200,
  },
  etaContainer: {
    alignItems: 'center',
  },
  etaValue: {
    fontSize: theme.typography.fontSize.xl + 4,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  etaLabel: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  speedContainer: {
    alignItems: 'center',
  },
  speedValue: {
    fontSize: theme.typography.fontSize['2xl'] + 4,
    fontWeight: '700',
    color: theme.colors.gray900,
  },
  speedUnit: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  destinationInfo: {
    paddingVertical: theme.spacing['4'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  destinationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing['2'],
  },
  destinationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1'],
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing['2'],
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  typeBadgeEntrega: {
    backgroundColor: withOpacity(theme.colors.success, 0.15),
  },
  typeBadgeRetirada: {
    backgroundColor: withOpacity(theme.colors.warning, 0.15),
  },
  typeBadgeText: {
    fontSize: theme.typography.fontSize.xs - 2,
    fontWeight: '600',
  },
  typeBadgeTextEntrega: {
    color: theme.colors.success,
  },
  typeBadgeTextRetirada: {
    color: theme.colors.warning,
  },
  destinationLabel: {
    fontSize: theme.typography.fontSize.xs - 2,
    fontWeight: '600',
    color: theme.colors.gray500,
    letterSpacing: 0.5,
  },
  nextStopHint: {
    fontSize: theme.typography.fontSize.xs - 2,
    color: theme.colors.gray400,
  },
  destinationAddress: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing['2'],
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing['2'],
  },
  recipientText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  observationBox: {
    backgroundColor: theme.colors.warningBg,
    padding: theme.spacing['2'],
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing['2'],
  },
  observationText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.secondaryDark,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing['2'],
    paddingTop: theme.spacing['4'],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.borderRadius.sm,
    gap: 6,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  skipButton: {
    backgroundColor: theme.colors.warningBg,
  },
  skipButtonText: {
    color: theme.colors.warning,
    fontWeight: '600',
    fontSize: theme.typography.fontSize.sm,
  },
  mapsButton: {
    backgroundColor: theme.colors.primary,
  },
  mapsButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: theme.typography.fontSize.sm,
    textShadowColor: withOpacity(theme.colors.black, 0.25),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  completeButton: {
    backgroundColor: theme.colors.success,
  },
  completeButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: theme.typography.fontSize.sm,
    textShadowColor: withOpacity(theme.colors.black, 0.25),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
}));
