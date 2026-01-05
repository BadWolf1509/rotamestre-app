/**
 * ParadaBottomSheet - Bottom sheet com detalhes e ações para uma parada
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  Modal,
} from 'react-native';

import { withOpacity } from '@/utils/color';
import { showNavigationOptions } from '@/utils/navigation';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

const SHEET_HEIGHT = 320;

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  tipo?: string | null;
  is_checkpoint?: boolean;
}

interface ParadaBottomSheetProps {
  parada: Parada | null;
  visible: boolean;
  onClose: () => void;
  onNavigate?: (parada: Parada) => void;
  onMarkComplete?: (parada: Parada) => void | Promise<void>;
  onViewDetails?: (parada: Parada) => void;
}

export function ParadaBottomSheet({
  parada,
  visible,
  onClose,
  onNavigate,
  onMarkComplete,
  onViewDetails,
}: ParadaBottomSheetProps) {
  const { theme } = useUnistyles();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  // Animar entrada/saída
  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 15,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  // Gesture handler para arrastar para fechar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          // Fechar se arrastou mais de 100px ou velocidade alta
          onClose();
        } else {
          // Voltar para posição original
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 15,
          }).start();
        }
      },
    })
  ).current;

  // Função para obter cor baseada no status
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'concluida':
        return theme.colors.success;
      case 'em_andamento':
        return theme.colors.info;
      case 'pendente':
        return theme.colors.warning;
      default:
        return theme.colors.gray500;
    }
  };

  // Função para obter label do status
  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'concluida':
        return 'Concluída';
      case 'em_andamento':
        return 'Em andamento';
      case 'pendente':
        return 'Pendente';
      default:
        return status;
    }
  };

  // Handler para navegar
  const handleNavigate = () => {
    if (parada && parada.latitude && parada.longitude) {
      if (onNavigate) {
        onNavigate(parada);
      } else {
        showNavigationOptions({
          latitude: parada.latitude,
          longitude: parada.longitude,
          label: `Parada ${parada.ordem} - ${parada.endereco}`,
        });
      }
      onClose();
    }
  };

  if (!parada) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Overlay escurecido */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Handle para arrastar */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Conteúdo */}
        <View style={styles.content}>
          {/* Header com número da parada e status */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.orderBadge, { backgroundColor: getStatusColor(parada.status) }]}>
                <Text style={styles.orderText}>{parada.ordem}</Text>
              </View>
              <View>
                <Text style={styles.title}>Parada {parada.ordem}</Text>
                <View style={styles.statusContainer}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(parada.status) }]} />
                  <Text style={[styles.statusText, { color: getStatusColor(parada.status) }]}>
                    {getStatusLabel(parada.status)}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.gray500} />
            </TouchableOpacity>
          </View>

          {/* Endereço */}
          <View style={styles.addressContainer}>
            <Ionicons name="location-outline" size={20} color={theme.colors.gray500} />
            <Text style={styles.addressText}>{parada.endereco}</Text>
          </View>

          {/* Tipo (se disponível) */}
          {parada.tipo && (
            <View style={styles.tipoContainer}>
              <Ionicons
                name={parada.tipo === 'entrega' ? 'cube-outline' : 'arrow-up-circle-outline'}
                size={18}
                color={theme.colors.gray500}
              />
              <Text style={styles.tipoText}>
                {parada.tipo === 'entrega' ? 'Entrega' : 'Retirada'}
              </Text>
            </View>
          )}

          {/* Botões de ação */}
          <View style={styles.actions}>
            {/* Botão de navegar - só mostra se tiver coordenadas */}
            {parada.latitude && parada.longitude && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleNavigate}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIcon, { backgroundColor: theme.colors.primary }]}>
                  <Ionicons name="navigate" size={20} color={theme.colors.white} />
                </View>
                <Text style={styles.actionText}>Navegar</Text>
              </TouchableOpacity>
            )}

            {/* Botão de marcar como concluída - só mostra se pendente ou em andamento */}
            {(parada.status === 'pendente' || parada.status === 'em_andamento') && onMarkComplete && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  onMarkComplete(parada);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIcon, { backgroundColor: theme.colors.success }]}>
                  <Ionicons name="checkmark" size={20} color={theme.colors.white} />
                </View>
                <Text style={styles.actionText}>Concluir</Text>
              </TouchableOpacity>
            )}

            {/* Botão de ver detalhes */}
            {onViewDetails && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  onViewDetails(parada);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIcon, { backgroundColor: theme.colors.gray500 }]}>
                  <Ionicons name="information-circle-outline" size={20} color={theme.colors.white} />
                </View>
                <Text style={styles.actionText}>Detalhes</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  overlay: {
    flex: 1,
    backgroundColor: withOpacity(theme.colors.black, 0.5),
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.spacing['5'],
    borderTopRightRadius: theme.spacing['5'],
    minHeight: SHEET_HEIGHT,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing['3'],
  },
  handle: {
    width: 40,
    height: theme.spacing['1'],
    borderRadius: theme.spacing['0.5'],
    backgroundColor: theme.colors.gray300,
  },
  content: {
    paddingHorizontal: theme.spacing['5'],
    paddingBottom: theme.spacing['8'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing['4'],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['3'],
    flex: 1,
  },
  orderBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderText: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1.5'],
    marginTop: theme.spacing['1'],
  },
  statusDot: {
    width: theme.spacing['2'],
    height: theme.spacing['2'],
    borderRadius: theme.spacing['1'],
  },
  statusText: {
    fontSize: theme.typography.sm, // 14px
    fontWeight: '500',
  },
  closeButton: {
    padding: theme.spacing['1'],
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing['2.5'],
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing['3'],
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing['3'],
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  tipoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['2'],
    marginBottom: theme.spacing['5'],
  },
  tipoText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: theme.spacing['4'],
  },
  actionButton: {
    alignItems: 'center',
    gap: theme.spacing['2'],
    flex: 1,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
}));
