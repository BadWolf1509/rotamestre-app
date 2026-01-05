/**
 * ParadaCardCompact - Card compacto de parada para melhor densidade de informação
 * Layout otimizado: Header com endereço completo, Body com detalhes de contato
 */

import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';

import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { Parada } from './types';

interface ParadaCardCompactProps {
  parada: Parada;
  index: number;
  onImagePress: (url: string) => void;
  selected?: boolean;
  onPress?: (id: string) => void;
  onLayoutCapture?: (id: string, y: number) => void;
  /** Status da rota (para controlar exibição de ações de edição) */
  rotaStatus?: string;
  /** Callback para remover a parada */
  onRemove?: (parada: Parada) => void;
  /** Callback para editar a parada */
  onEdit?: (parada: Parada) => void;
}

export const ParadaCardCompact = React.memo<ParadaCardCompactProps>(
  ({ parada, index: _index, onImagePress, selected, onPress, onLayoutCapture, rotaStatus, onRemove, onEdit }) => {
    const { theme } = useUnistyles();
    const [imageError, setImageError] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const handlePhonePress = useCallback(() => {
      if (parada.telefone) {
        const phoneNumber = parada.telefone.replace(/\D/g, '');
        Linking.openURL(`tel:${phoneNumber}`);
      }
    }, [parada.telefone]);

    const handleWhatsAppPress = useCallback(() => {
      if (parada.telefone) {
        const phoneNumber = parada.telefone.replace(/\D/g, '');
        const formattedPhone = phoneNumber.startsWith('55') ? phoneNumber : `55${phoneNumber}`;
        Linking.openURL(`https://wa.me/${formattedPhone}`);
      }
    }, [parada.telefone]);

    const handleCardPress = useCallback(() => {
      onPress?.(parada.id);
      setExpanded((prev) => !prev);
    }, [onPress, parada.id]);

    const statusConfig = {
      concluida: { name: 'checkmark-circle' as const, color: theme.colors.success, label: 'OK' },
      pendente: { name: 'time' as const, color: theme.colors.warning, label: 'Pend' },
      em_andamento: { name: 'navigate' as const, color: theme.colors.info, label: 'Em rota' },
      pulada: { name: 'close-circle' as const, color: theme.colors.gray500, label: 'Pulada' },
    };

    const status = statusConfig[parada.status as keyof typeof statusConfig] || statusConfig.pendente;
    const hasPhoto = parada.foto_url && !imageError;
    const showPhotoPlaceholder = parada.status === 'concluida' && !hasPhoto;
    const tipoIcon = parada.tipo === 'entrega' ? 'cube' : 'swap-horizontal';
    const tipoColor = parada.tipo === 'entrega' ? theme.colors.info : theme.colors.warning;

    return (
      <View
        style={[styles.card, selected && styles.cardSelected]}
        onLayout={(e) => onLayoutCapture?.(parada.id, e.nativeEvent.layout.y)}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleCardPress}
          style={styles.cardContent}
        >
          {/* Badge de ordem com cor do status */}
          <View style={[styles.orderBadge, { backgroundColor: status.color }]}>
            <Text style={styles.orderText}>{parada.ordem}</Text>
          </View>

          {/* Conteúdo principal - Endereço completo */}
          <View style={styles.mainContent}>
            <Text style={styles.address} numberOfLines={2}>
              {parada.endereco}
            </Text>
          </View>

          {/* Ícone do tipo (entrega/retirada) */}
          <View style={[styles.typeIconContainer, { backgroundColor: `${tipoColor}15` }]}>
            <Ionicons name={tipoIcon} size={16} color={tipoColor} />
          </View>

          {/* Status */}
          <View style={styles.statusContainer}>
            <Ionicons name={status.name} size={16} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>

          {/* Chevron para expandir */}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.colors.gray400}
            style={styles.chevron}
          />
        </TouchableOpacity>

        {/* Área expandida com detalhes */}
        {expanded && (
          <View style={styles.expandedContent}>
            {/* Destinatário */}
            {parada.destinatario && (
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={14} color={theme.colors.gray500} />
                <Text style={styles.detailText}>{parada.destinatario}</Text>
              </View>
            )}

            {/* Telefone */}
            {parada.telefone && (
              <View style={styles.detailRow}>
                <Ionicons name="call-outline" size={14} color={theme.colors.gray500} />
                <Text style={styles.detailText}>{parada.telefone}</Text>
              </View>
            )}

            {/* Observações */}
            {parada.observacoes && (
              <View style={styles.detailRow}>
                <Ionicons name="document-text-outline" size={14} color={theme.colors.gray500} />
                <Text style={styles.detailText}>{parada.observacoes}</Text>
              </View>
            )}

            {/* Ações de comunicação */}
            {(parada.telefone || hasPhoto) && (
              <View style={styles.actions}>
                {parada.telefone && (
                  <>
                    <TouchableOpacity style={styles.actionButton} onPress={handlePhonePress}>
                      <Ionicons name="call" size={16} color={theme.colors.primary} />
                      <Text style={styles.actionText}>Ligar</Text>
                    </TouchableOpacity>
                    {Platform.OS !== 'web' && (
                      <TouchableOpacity style={styles.actionButton} onPress={handleWhatsAppPress}>
                        <Ionicons name="logo-whatsapp" size={16} color={theme.colors.whatsapp} />
                        <Text style={[styles.actionText, { color: theme.colors.whatsapp }]}>WhatsApp</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
                {hasPhoto && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => onImagePress(parada.foto_url!)}
                  >
                    <Ionicons name="image" size={16} color={theme.colors.info} />
                    <Text style={[styles.actionText, { color: theme.colors.info }]}>Ver foto</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Thumbnail da foto (se houver) */}
            {hasPhoto && (
              <TouchableOpacity
                style={styles.photoContainer}
                onPress={() => onImagePress(parada.foto_url!)}
              >
                <Image
                  source={{ uri: parada.foto_url ?? undefined }}
                  style={styles.photo}
                  onError={() => setImageError(true)}
                />
              </TouchableOpacity>
            )}

            {/* Indicador de foto ausente */}
            {showPhotoPlaceholder && (
              <View style={styles.noPhotoIndicator}>
                <Ionicons name="camera-outline" size={20} color={theme.colors.gray400} />
                <Text style={styles.noPhotoText}>Sem foto registrada</Text>
              </View>
            )}

            {/* Ações de Edição (apenas para paradas pendentes em rotas editáveis) */}
            {parada.status === 'pendente' &&
              (rotaStatus === 'pendente' || rotaStatus === 'em_andamento') && (
                <View style={styles.editActions}>
                  {onEdit && (
                    <TouchableOpacity
                      style={styles.editActionButton}
                      onPress={() => onEdit(parada)}
                    >
                      <Ionicons name="create-outline" size={16} color={theme.colors.secondary} />
                      <Text style={[styles.actionText, { color: theme.colors.secondary }]}>Editar</Text>
                    </TouchableOpacity>
                  )}
                  {onRemove && (
                    <TouchableOpacity
                      style={[styles.editActionButton, styles.removeButton]}
                      onPress={() => onRemove(parada)}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                      <Text style={[styles.actionText, { color: theme.colors.error }]}>Remover</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
          </View>
        )}
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.parada.id === nextProps.parada.id &&
      prevProps.parada.status === nextProps.parada.status &&
      prevProps.parada.foto_url === nextProps.parada.foto_url &&
      prevProps.parada.endereco === nextProps.parada.endereco &&
      prevProps.index === nextProps.index &&
      prevProps.selected === nextProps.selected &&
      prevProps.rotaStatus === nextProps.rotaStatus
    );
  }
);

ParadaCardCompact.displayName = 'ParadaCardCompact';

const styles = StyleSheet.create((theme: Theme) => ({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm + 2,
    gap: theme.spacing.sm,
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs + 1,
    fontWeight: '700',
  },
  mainContent: {
    flex: 1,
    gap: theme.spacing['0.5'],
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  address: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['0.5'],
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  recipient: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray600,
    maxWidth: 120,
  },
  phoneLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['0.5'],
  },
  phoneText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  typeTag: {
    paddingHorizontal: theme.spacing['1.5'],
    paddingVertical: theme.spacing['0.5'],
    borderRadius: theme.borderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeTagEntrega: {
    backgroundColor: theme.colors.infoBg,
  },
  typeTagRetirada: {
    backgroundColor: theme.colors.warningBg,
  },
  typeTagText: {
    fontSize: theme.typography.fontSize.xs, // Min readable (WCAG AA)
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  typeTagTextEntrega: {
    color: theme.colors.info,
  },
  typeTagTextRetirada: {
    color: theme.colors.warning,
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: withOpacity(theme.colors.black, 0.5),
    padding: theme.spacing['0.5'],
    borderTopLeftRadius: theme.borderRadius.xs,
  },
  typeIconContainer: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoContainer: {
    marginTop: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 120,
    borderRadius: theme.borderRadius.md,
  },
  noPhotoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.xs,
  },
  noPhotoText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray400,
  },
  chevron: {
    marginLeft: theme.spacing.xs,
  },
  expandedContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
    gap: theme.spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  detailText: {
    flex: 1,
    fontSize: theme.typography.fontSize.xs + 1,
    color: theme.colors.gray700,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1'],
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.sm,
  },
  actionText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  editActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  editActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1'],
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  removeButton: {
    borderColor: `${theme.colors.error}30`,
    backgroundColor: `${theme.colors.error}05`,
  },
}));
