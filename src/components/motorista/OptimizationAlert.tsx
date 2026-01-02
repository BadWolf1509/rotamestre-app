import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

  if (!visible || !optimization) return null;

  return (
    <>
      {/* Alert Banner */}
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
            >
              <Ionicons name="close-circle-outline" size={20} color={theme.colors.error} />
              <Text style={styles.rejectButtonText}>Ignorar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.detailsButton}
              onPress={() => setShowDetails(true)}
            >
              <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.detailsButtonText}>Detalhes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={handleAccept}
            >
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
              <Text style={styles.acceptButtonText}>
                {autoAcceptTimer ? `Aceitar (${autoAcceptTimer}s)` : 'Aceitar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Details Modal */}
      <Modal
        visible={showDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalhes da Otimização</Text>
              <TouchableOpacity
                onPress={() => setShowDetails(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.gray700} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
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

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalRejectButton]}
                  onPress={() => {
                    setShowDetails(false);
                    handleReject();
                  }}
                >
                  <Text style={styles.modalRejectButtonText}>Manter Rota Atual</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalAcceptButton]}
                  onPress={() => {
                    setShowDetails(false);
                    handleAccept();
                  }}
                >
                  <Text style={styles.modalAcceptButtonText}>Aplicar Otimização</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    // Brand guideline: text shadow for white text on colored background
    textShadowColor: withOpacity(theme.colors.black, 0.25),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: withOpacity(theme.colors.black, 0.5),
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_WIDTH - 32,
    maxHeight: '80%',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  modalCloseButton: {
    padding: theme.spacing.xs,
  },
  modalBody: {
    padding: theme.spacing.xl,
  },
  detailSection: {
    marginBottom: theme.spacing.xl + 4,
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
    color: theme.colors.gray500,
  },
  stopAddressMoved: {
    color: theme.colors.secondaryDark,
    fontFamily: theme.typography.fontSansMedium,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl + 4,
  },
  modalButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  modalRejectButton: {
    backgroundColor: theme.colors.gray100,
  },
  modalRejectButtonText: {
    color: theme.colors.gray500,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  modalAcceptButton: {
    backgroundColor: theme.colors.success,
  },
  modalAcceptButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));

