import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { defaultTheme, useUnistyles } from '@/utils/styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const colors = defaultTheme.colors;

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
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
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

const styles = StyleSheet.create({
  alertBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: colors.white,
    borderRadius: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  alertContent: {
    padding: 16,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
  },
  alertSubtitle: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  reasonText: {
    fontSize: 13,
    color: colors.gray500,
    marginBottom: 12,
    paddingLeft: 52,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingLeft: 52,
  },
  confidenceLabel: {
    fontSize: 12,
    color: colors.gray500,
    marginRight: 8,
  },
  confidenceBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.gray200,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  rejectButton: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.error,
  },
  rejectButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
  detailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.gray100,
  },
  detailsButtonText: {
    color: defaultTheme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: colors.success,
  },
  acceptButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_WIDTH - 32,
    maxHeight: '80%',
    backgroundColor: colors.white,
    borderRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
  },
  detailValue: {
    fontSize: 14,
    color: colors.gray900,
    lineHeight: 20,
  },
  orderComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderColumn: {
    flex: 1,
  },
  orderColumnTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray500,
    marginBottom: 8,
    textAlign: 'center',
  },
  arrowContainer: {
    paddingTop: 20,
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors.gray50,
    borderRadius: 6,
    marginBottom: 4,
  },
  stopItemMoved: {
    backgroundColor: colors.warningBg,
  },
  stopNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray700,
    textAlign: 'center',
    lineHeight: 24,
  },
  stopNumberMoved: {
    backgroundColor: colors.warning,
    color: colors.white,
  },
  stopAddress: {
    flex: 1,
    fontSize: 11,
    color: colors.gray500,
  },
  stopAddressMoved: {
    color: colors.secondaryDark,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalRejectButton: {
    backgroundColor: colors.gray100,
  },
  modalRejectButtonText: {
    color: colors.gray500,
    fontSize: 14,
    fontWeight: '600',
  },
  modalAcceptButton: {
    backgroundColor: colors.success,
  },
  modalAcceptButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});


