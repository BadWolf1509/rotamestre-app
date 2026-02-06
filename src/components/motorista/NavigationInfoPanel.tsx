/**
 * NavigationInfoPanel - Bottom info panel for NavigationMode
 *
 * Extracted from NavigationMode.tsx to reduce component size.
 * Purely presentational component — no state, only props.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';

import type { ParadaData } from '@/context/RouteStatusContext';
import type { NavigationPreferences } from '@/hooks/navigation';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface NavigationInfoPanelProps {
  currentStop: ParadaData;
  nextStop?: ParadaData | null;
  realParadas: ParadaData[];
  currentStopIndex: number;
  distance: number | null;
  eta: string | null;
  speed: number;
  isEntrega: boolean;
  preferences: NavigationPreferences;
  pulseAnim: Animated.Value;
  buttonScaleAnims: {
    skip: Animated.Value;
    maps: Animated.Value;
    complete: Animated.Value;
  };
  formatDistance: (meters: number) => string;
  getSpeedColor: (speedKmh: number) => string;
  onAnimateButtonPress: (button: 'skip' | 'maps' | 'complete', pressed: boolean) => void;
  onComplete: () => Promise<void>;
  onSkip: () => Promise<void>;
  onOpenInMaps: () => void;
}

export const NavigationInfoPanel = React.memo(function NavigationInfoPanel({
  currentStop,
  nextStop,
  realParadas,
  currentStopIndex,
  distance,
  eta,
  speed,
  isEntrega,
  preferences,
  pulseAnim,
  buttonScaleAnims,
  formatDistance,
  getSpeedColor,
  onAnimateButtonPress,
  onComplete,
  onSkip,
  onOpenInMaps,
}: NavigationInfoPanelProps) {
  const { theme } = useUnistyles();

  return (
    <>
      {/* Progress Indicator (only real stops, not checkpoints) */}
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

      {/* Distance and ETA */}
      <View style={styles.mainInfo}>
        <Animated.View
          style={[
            styles.distanceContainer,
            distance !== null && distance < 100 && {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Text
            style={[
              styles.distanceValue,
              distance !== null && distance < 100 && styles.distanceValueNear,
            ]}
          >
            {distance ? formatDistance(distance) : '--'}
          </Text>
          <Text style={styles.distanceLabel}>
            {distance !== null && distance < 100 ? '🎯 Chegando!' : 'distância'}
          </Text>
        </Animated.View>

        <View style={styles.separator} />

        <View style={styles.etaContainer}>
          <Text style={styles.etaValue}>{eta || '--'}</Text>
          <Text style={styles.etaLabel}>chegada</Text>
        </View>

        {preferences.showSpeedometer && (
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
      <View style={styles.actions}>
        <Animated.View style={{ flex: 1, transform: [{ scale: buttonScaleAnims.skip }] }}>
          <TouchableOpacity
            style={[styles.actionButton, styles.skipButton]}
            onPress={onSkip}
            onPressIn={() => onAnimateButtonPress('skip', true)}
            onPressOut={() => onAnimateButtonPress('skip', false)}
            activeOpacity={1}
          >
            <Ionicons name="arrow-forward-circle-outline" size={20} color={theme.colors.warning} />
            <Text style={styles.skipButtonText}>Pular</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{ flex: 1, transform: [{ scale: buttonScaleAnims.maps }] }}>
          <TouchableOpacity
            style={[styles.actionButton, styles.mapsButton]}
            onPress={onOpenInMaps}
            onPressIn={() => onAnimateButtonPress('maps', true)}
            onPressOut={() => onAnimateButtonPress('maps', false)}
            activeOpacity={1}
          >
            <Ionicons name="navigate" size={20} color={theme.colors.white} />
            <Text style={styles.mapsButtonText}>
              {preferences.internalNavigation ? 'Navegar' : 'Abrir no Maps'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{ flex: 1, transform: [{ scale: buttonScaleAnims.complete }] }}>
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={onComplete}
            onPressIn={() => onAnimateButtonPress('complete', true)}
            onPressOut={() => onAnimateButtonPress('complete', false)}
            activeOpacity={1}
          >
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
            <Text style={styles.completeButtonText}>Concluir</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
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
    fontFamily: theme.typography.fontSansSemiBold,
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
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  distanceContainer: {
    alignItems: 'center',
  },
  distanceValue: {
    fontSize: theme.typography.fontSize['3xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  distanceLabel: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  distanceValueNear: {
    color: theme.colors.success,
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
    fontFamily: theme.typography.fontSansSemiBold,
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
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  speedUnit: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  destinationInfo: {
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  destinationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  destinationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
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
    fontFamily: theme.typography.fontSansSemiBold,
  },
  typeBadgeTextEntrega: {
    color: theme.colors.success,
  },
  typeBadgeTextRetirada: {
    color: theme.colors.warning,
  },
  destinationLabel: {
    fontSize: theme.typography.fontSize.xs - 2,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
    letterSpacing: 0.5,
  },
  nextStopHint: {
    fontSize: theme.typography.fontSize.xs - 2,
    color: theme.colors.gray400,
  },
  destinationAddress: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
    marginBottom: theme.spacing.sm,
  },
  recipientText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  observationBox: {
    backgroundColor: theme.colors.warningBg,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  observationText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.secondaryDark,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs + 2,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  skipButton: {
    backgroundColor: theme.colors.warningBg,
  },
  skipButtonText: {
    color: theme.colors.warning,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
  },
  mapsButton: {
    backgroundColor: theme.colors.primary,
  },
  mapsButtonText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
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
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
    textShadowColor: withOpacity(theme.colors.black, 0.25),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
}));
