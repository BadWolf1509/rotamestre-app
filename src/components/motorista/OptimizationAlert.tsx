/**
 * OptimizationAlert - Alerta de otimização de rota
 *
 * Componente com duas partes:
 * 1. Banner animado (slide-in do topo) - Mantido como Animated.View para animações customizadas
 * 2. Modal de detalhes - Refatorado para usar DesktopModal do design-system
 *
 * Melhorias:
 * - Modal de detalhes com HTML5 <dialog> na web (focus trap, ESC nativo)
 * - API declarativa de botões
 * - Melhor acessibilidade (ARIA roles)
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { DesktopModal } from '@/components/desktop/DesktopModal';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface OptimizationAlertProps {
  visible: boolean;
  optimization: {
    timeSaved: number;
    newOrder: any[];
    reason: string;
    confidence: number;
  } | null;
  currentOrder: any[];
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
}

export function OptimizationAlert({
  visible,
  optimization,
  currentOrder,
  onAccept,
  onReject,
  onClose,
}: OptimizationAlertProps) {
  const { theme } = useUnistyles();
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [showDetails, setShowDetails] = useState(false);
  const [autoAcceptTimer, setAutoAcceptTimer] = useState<number | null>(null);

  useEffect(() => {
    if (visible && optimization) {
      // Slide in animation
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }).start();

      // Pulse animation for attention
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Auto-accept timer if confidence is high
      if (optimization.confidence > 80) {
        setAutoAcceptTimer(30); // 30 seconds
      }
    } else {
      // Slide out
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [optimization, pulseAnim, slideAnim, visible]);

  const handleAccept = useCallback(() => {
    setAutoAcceptTimer(null);
    onAccept();

    // Animate out
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [onAccept, slideAnim]);

  const handleReject = useCallback(() => {
    setAutoAcceptTimer(null);
    onReject();

    // Animate out
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [onReject, slideAnim]);

  // Countdown for auto-accept
  useEffect(() => {
    if (autoAcceptTimer === null || autoAcceptTimer <= 0) return;

    const timer = setTimeout(() => {
      setAutoAcceptTimer(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    if (autoAcceptTimer === 1) {
      handleAccept();
    }

    return () => clearTimeout(timer);
  }, [autoAcceptTimer, handleAccept]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 80) return theme.colors.success;
    if (confidence > 60) return theme.colors.warning;
    return theme.colors.secondary;
  };

  const getTrafficIcon = () => {
    if (optimization?.reason.includes('congestionamento')) {
      return 'warning';
    }
    if (optimization?.reason.includes('urgentes')) {
      return 'time';
    }
    return 'trending-up';
  };

  // Handlers para o modal de detalhes
  const handleDetailsAccept = useCallback(() => {
    setShowDetails(false);
    handleAccept();
  }, [handleAccept]);

  const handleDetailsReject = useCallback(() => {
    setShowDetails(false);
    handleReject();
  }, [handleReject]);

  if (!visible || !optimization) return null;

  return (
    <>
      {/* Alert Banner - Mantido como Animated.View para animações customizadas */}
      <Animated.View
        style={[
          styles.alertBanner,
          {
            transform: [
              { translateY: slideAnim },
              { scale: pulseAnim },
            ],
          },
        ]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <View style={styles.alertContent}>
          <View style={styles.alertHeader}>
            <View style={styles.iconContainer}>
              <Ionicons
                name={getTrafficIcon()}
                size={24}
                color={theme.colors.primary}
              />
            </View>

            <View style={styles.alertTextContainer}>
              <Text style={styles.alertTitle}>Rota Melhor Disponível!</Text>
              <Text style={styles.alertSubtitle}>
                Economize {optimization.timeSaved} minutos
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityLabel="Fechar alerta"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={theme.colors.gray500} />
            </TouchableOpacity>
          </View>

          <Text style={styles.reasonText}>{optimization.reason}</Text>

          {/* Confidence Indicator */}
          <View style={styles.confidenceContainer}>
            <Text style={styles.confidenceLabel}>Confiança:</Text>
            <View style={styles.confidenceBar}>
              <View
                style={[
                  styles.confidenceFill,
                  {
                    width: `${optimization.confidence}%`,
                    backgroundColor: getConfidenceColor(optimization.confidence),
                  },
                ]}
              />
            </View>
            <Text style={[
              styles.confidenceValue,
              { color: getConfidenceColor(optimization.confidence) }
            ]}>
              {optimization.confidence}%
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={handleReject}
              accessibilityLabel="Ignorar otimização"
              accessibilityRole="button"
            >
              <Ionicons name="close-circle-outline" size={20} color={theme.colors.error} />
              <Text style={styles.rejectButtonText}>Ignorar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.detailsButton}
              onPress={() => setShowDetails(true)}
              accessibilityLabel="Ver detalhes da otimização"
              accessibilityRole="button"
            >
              <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.detailsButtonText}>Detalhes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={handleAccept}
              accessibilityLabel={autoAcceptTimer ? `Aceitar otimização em ${autoAcceptTimer} segundos` : 'Aceitar otimização'}
              accessibilityRole="button"
            >
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
              <Text style={styles.acceptButtonText}>
                {autoAcceptTimer ? `Aceitar (${autoAcceptTimer}s)` : 'Aceitar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Details Modal - Usando DesktopModal do design-system */}
      <DesktopModal
        visible={showDetails}
        onClose={() => setShowDetails(false)}
        title="Detalhes da Otimização"
        maxWidth={520}
        primaryButton={{
          text: 'Aplicar Otimização',
          onPress: handleDetailsAccept,
          color: theme.colors.success,
        }}
        secondaryButton={{
          text: 'Manter Rota Atual',
          onPress: handleDetailsReject,
        }}
      >
        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
          {/* Time Savings */}
          <View style={styles.detailSection}>
            <View style={styles.detailHeader}>
              <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.detailTitle}>Economia de Tempo</Text>
            </View>
            <Text style={styles.detailValue}>
              {optimization.timeSaved} minutos ({Math.round(optimization.timeSaved / 60 * 10) / 10} horas)
            </Text>
          </View>

          {/* Reason */}
          <View style={styles.detailSection}>
            <View style={styles.detailHeader}>
              <Ionicons name="bulb-outline" size={20} color={theme.colors.warning} />
              <Text style={styles.detailTitle}>Motivo</Text>
            </View>
            <Text style={styles.detailValue}>{optimization.reason}</Text>
          </View>

          {/* New Order */}
          <View style={styles.detailSection}>
            <View style={styles.detailHeader}>
              <Ionicons name="list-outline" size={20} color={theme.colors.success} />
              <Text style={styles.detailTitle}>Nova Ordem Sugerida</Text>
            </View>

            <View style={styles.orderComparison}>
              {/* Current Order */}
              <View style={styles.orderColumn}>
                <Text style={styles.orderColumnTitle}>Ordem Atual</Text>
                {currentOrder.map((stop, index) => (
                  <View key={`current-${stop.id}`} style={styles.stopItem}>
                    <Text style={styles.stopNumber}>{index + 1}</Text>
                    <Text style={styles.stopAddress} numberOfLines={1}>
                      {stop.endereco.split(',')[0]}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Arrow */}
              <View style={styles.arrowContainer}>
                <Ionicons name="arrow-forward" size={24} color={theme.colors.primary} />
              </View>

              {/* New Order */}
              <View style={styles.orderColumn}>
                <Text style={styles.orderColumnTitle}>Nova Ordem</Text>
                {optimization.newOrder.map((stop, index) => {
                  const oldIndex = currentOrder.findIndex(s => s.id === stop.id);
                  const moved = oldIndex !== index;

                  return (
                    <View
                      key={`new-${stop.id}`}
                      style={[
                        styles.stopItem,
                        moved && styles.stopItemMoved,
                      ]}
                    >
                      <Text style={[
                        styles.stopNumber,
                        moved && styles.stopNumberMoved,
                      ]}>
                        {index + 1}
                      </Text>
                      <Text
                        style={[
                          styles.stopAddress,
                          moved && styles.stopAddressMoved,
                        ]}
                        numberOfLines={1}
                      >
                        {stop.endereco.split(',')[0]}
                      </Text>
                      {moved && (
                        <Ionicons
                          name={oldIndex > index ? 'arrow-up' : 'arrow-down'}
                          size={14}
                          color={theme.colors.primary}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </ScrollView>
      </DesktopModal>
    </>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  alertBanner: {
    position: 'absolute',
    top: 50,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: theme.spacing.sm,
    elevation: 10,
    zIndex: 1000,
  },
  alertContent: {
    padding: theme.spacing.lg,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  alertSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.success,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  reasonText: {
    fontSize: theme.typography.fontSize.xs + 1,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.md,
    paddingLeft: 52,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingLeft: 52,
  },
  confidenceLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    marginRight: theme.spacing.sm,
  },
  confidenceBar: {
    flex: 1,
    height: 6,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.xs,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: theme.borderRadius.xs,
  },
  confidenceValue: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    marginLeft: theme.spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs + 2,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.sm,
  },
  rejectButton: {
    backgroundColor: theme.colors.errorBg,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  rejectButtonText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  detailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs + 2,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.gray100,
  },
  detailsButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  acceptButton: {
    backgroundColor: theme.colors.success,
  },
  acceptButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    textShadowColor: withOpacity(theme.colors.black, 0.25),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Estilos do conteúdo do modal de detalhes
  modalBody: {
    maxHeight: 400,
  },
  detailSection: {
    marginBottom: theme.spacing.xl,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  detailTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  detailValue: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray900,
    lineHeight: theme.typography.fontSize.sm * 1.4,
  },
  orderComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  orderColumn: {
    flex: 1,
  },
  orderColumnTitle: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  arrowContainer: {
    paddingTop: theme.spacing.xl,
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
  },
  stopItemMoved: {
    backgroundColor: theme.colors.warningBg,
  },
  stopNumber: {
    width: 24,
    height: 24,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
    textAlign: 'center',
    lineHeight: 24,
  },
  stopNumberMoved: {
    backgroundColor: theme.colors.warning,
    color: theme.colors.white,
  },
  stopAddress: {
    flex: 1,
    fontSize: theme.typography.fontSize.xs - 1,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
  },
  stopAddressMoved: {
    color: theme.colors.secondaryDark,
    fontFamily: theme.typography.fontSansMedium,
  },
}));
