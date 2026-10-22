/**
 * ParadaBottomSheet - Bottom sheet com detalhes e ações para uma parada
 *
 * Refatorado para usar DesktopModal do design-system:
 * - Web: HTML5 <dialog> com focus trap e ESC nativo
 * - Mobile: Bottom sheet responsivo
 * - Acessibilidade melhorada (ARIA roles)
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';

import { DesktopModal } from '@/components/desktop/DesktopModal';
import { logger } from '@/lib/logger';
import { rotuloDoPino } from '@/lib/motorista/pinosPorLocal';
import { rotuloTipoParada } from '@/lib/motorista/rotuloTipoParada';
import { showNavigationOptions } from '@/utils/navigation';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  tipo?: string | null;
  telefone?: string | null;
  is_checkpoint?: boolean;
}

interface ParadaBottomSheetProps {
  parada: Parada | null;
  /**
   * Todos os serviços do pino (entrega + retirada no mesmo local), por
   * `ordem`, incluindo `parada`. Com mais de um, o sheet lista cada um.
   */
  servicosNoLocal?: Parada[];
  visible: boolean;
  onClose: () => void;
  onNavigate?: (parada: Parada) => void;
  onMarkComplete?: (parada: Parada) => void | Promise<void>;
  onViewDetails?: (parada: Parada) => void;
}

export function ParadaBottomSheet({
  parada,
  servicosNoLocal,
  visible,
  onClose,
  onNavigate,
  onMarkComplete,
  onViewDetails,
}: ParadaBottomSheetProps) {
  const { theme } = useUnistyles();

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
      case 'pulada':
        return 'Pulada';
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

  const agrupado = (servicosNoLocal?.length ?? 0) > 1;
  const servicos = agrupado ? (servicosNoLocal as Parada[]) : [parada];

  return (
    <DesktopModal
      visible={visible}
      onClose={onClose}
      title={
        agrupado
          ? `Paradas ${rotuloDoPino(servicos)}`
          : `Parada ${parada.ordem}`
      }
      maxWidth={480}
      contentStyle={styles.modalContent}
    >
      {/* Header com badge e status */}
      <View style={styles.headerInfo}>
        <View
          style={[
            styles.orderBadge,
            { backgroundColor: getStatusColor(parada.status) },
          ]}
        >
          <Text style={styles.orderText}>
            {agrupado ? rotuloDoPino(servicos) : parada.ordem}
          </Text>
        </View>
        <View style={styles.headerDetails}>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(parada.status) },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(parada.status) },
              ]}
            >
              {getStatusLabel(parada.status)}
            </Text>
          </View>
        </View>
      </View>

      {/* Endereço */}
      <View style={styles.addressContainer}>
        <Ionicons
          name="location-outline"
          size={20}
          color={theme.colors.gray500}
        />
        <Text style={styles.addressText}>{parada.endereco}</Text>
      </View>

      {/* Serviços do local: o "Concluir" abaixo emenda um no outro */}
      {agrupado && (
        <View style={styles.servicosContainer}>
          <Text style={styles.servicosTitulo}>Neste local</Text>
          {servicos.map((s) => (
            <View
              key={s.id}
              style={styles.servicoLinha}
              testID={`servico-no-local-${s.id}`}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: getStatusColor(s.status) },
                ]}
              />
              <Text style={styles.tipoText}>
                {`${s.ordem} · ${rotuloTipoParada(s.tipo ?? '').titulo} · ${getStatusLabel(s.status)}`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Tipo (se disponível) */}
      {!agrupado && parada.tipo && (
        <View style={styles.tipoContainer}>
          <Ionicons
            name={
              parada.tipo === 'entrega'
                ? 'cube-outline'
                : 'arrow-up-circle-outline'
            }
            size={18}
            color={theme.colors.gray500}
          />
          <Text style={styles.tipoText}>
            {rotuloTipoParada(parada.tipo).titulo}
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
            accessibilityRole="button"
            accessibilityLabel={`Navegar para parada ${parada.ordem}`}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Ionicons name="navigate" size={20} color={theme.colors.white} />
            </View>
            <Text style={styles.actionText}>Navegar</Text>
          </TouchableOpacity>
        )}

        {/* Botão de marcar como concluída - só mostra se pendente ou em andamento */}
        {(parada.status === 'pendente' || parada.status === 'em_andamento') &&
          onMarkComplete && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                onMarkComplete(parada);
                onClose();
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Concluir parada ${parada.ordem}`}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: theme.colors.success },
                ]}
              >
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={theme.colors.white}
                />
              </View>
              <Text style={styles.actionText}>Concluir</Text>
            </TouchableOpacity>
          )}

        {/* Ligar: veio do balão do pino, onde não recebia toque no Android */}
        {parada.telefone && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              // Sem discador (tablet, web sem handler de tel:) a promessa rejeita.
              Linking.openURL(`tel:${parada.telefone}`).catch((e) =>
                logger.warn('Não foi possível abrir o discador', e),
              )
            }
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Ligar para ${parada.telefone}`}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: theme.colors.info },
              ]}
            >
              <Ionicons name="call" size={20} color={theme.colors.white} />
            </View>
            <Text style={styles.actionText}>Ligar</Text>
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
            accessibilityRole="button"
            accessibilityLabel={`Ver detalhes da parada ${parada.ordem}`}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: theme.colors.gray500 },
              ]}
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={theme.colors.white}
              />
            </View>
            <Text style={styles.actionText}>Detalhes</Text>
          </TouchableOpacity>
        )}
      </View>
    </DesktopModal>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  modalContent: {
    // Remover padding extra do content do DesktopModal já aplicado
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['3'],
    marginBottom: theme.spacing['4'],
  },
  headerDetails: {
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
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSansBold,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1.5'],
  },
  statusDot: {
    width: theme.spacing['2'],
    height: theme.spacing['2'],
    borderRadius: theme.spacing['1'],
  },
  statusText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansMedium,
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
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
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
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.textSecondary,
  },
  servicosContainer: {
    gap: theme.spacing['2'],
    marginBottom: theme.spacing['5'],
  },
  servicosTitulo: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.textSecondary,
  },
  servicoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['2'],
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: theme.spacing['4'],
    paddingTop: theme.spacing['2'],
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
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.text,
  },
}));
