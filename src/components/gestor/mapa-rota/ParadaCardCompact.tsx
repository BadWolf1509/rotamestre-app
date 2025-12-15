/**
 * ParadaCardCompact - Card compacto de parada para melhor densidade de informação
 * Layout otimizado: 1-2 linhas por card, foto como thumbnail
 */

import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { Parada } from './types';

interface ParadaCardCompactProps {
  parada: Parada;
  index: number;
  onImagePress: (url: string) => void;
  selected?: boolean;
  onPress?: (id: string) => void;
  onLayoutCapture?: (id: string, y: number) => void;
}

export const ParadaCardCompact = React.memo<ParadaCardCompactProps>(
  ({ parada, index, onImagePress, selected, onPress, onLayoutCapture }) => {
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

    const statusIcon = {
      concluida: { name: 'checkmark-circle' as const, color: theme.colors.success },
      pendente: { name: 'time' as const, color: theme.colors.warning },
      em_andamento: { name: 'navigate' as const, color: theme.colors.info },
    };

    const status = statusIcon[parada.status as keyof typeof statusIcon] || statusIcon.pendente;
    const hasPhoto = parada.foto_url && !imageError;
    const showPhotoPlaceholder = parada.status === 'concluida' && !hasPhoto;

    // Truncar endereço para exibição compacta
    const shortAddress = parada.endereco.length > 45
      ? parada.endereco.substring(0, 45) + '...'
      : parada.endereco;

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
          {/* Número da parada */}
          <View style={[styles.orderBadge, { backgroundColor: status.color }]}>
            <Text style={styles.orderText}>{index + 1}</Text>
          </View>

          {/* Conteúdo principal */}
          <View style={styles.mainContent}>
            {/* Linha 1: Endereço + Status */}
            <View style={styles.row1}>
              <Text style={styles.address} numberOfLines={1}>
                {shortAddress}
              </Text>
              <View style={styles.statusContainer}>
                <Ionicons name={status.name} size={16} color={status.color} />
                <Text style={[styles.statusText, { color: status.color }]}>
                  {parada.status === 'concluida' ? 'OK' : parada.status === 'pendente' ? 'Pend' : 'Em rota'}
                </Text>
              </View>
            </View>

            {/* Linha 2: Destinatário + Telefone + Tipo */}
            <View style={styles.row2}>
              {parada.destinatario && (
                <Text style={styles.recipient} numberOfLines={1}>
                  {parada.destinatario}
                </Text>
              )}
              {parada.telefone && (
                <TouchableOpacity onPress={handlePhonePress} style={styles.phoneLink}>
                  <Ionicons name="call-outline" size={12} color={theme.colors.primary} />
                  <Text style={styles.phoneText}>{parada.telefone}</Text>
                </TouchableOpacity>
              )}
              <View style={[styles.typeTag, parada.tipo === 'entrega' ? styles.typeTagEntrega : styles.typeTagRetirada]}>
                <Text style={styles.typeTagText}>
                  {parada.tipo === 'entrega' ? 'E' : 'R'}
                </Text>
              </View>
            </View>
          </View>

          {/* Thumbnail da foto (se houver) */}
          {hasPhoto && (
            <TouchableOpacity
              style={styles.thumbnail}
              onPress={() => onImagePress(parada.foto_url!)}
            >
              <Image
                source={{ uri: parada.foto_url }}
                style={styles.thumbnailImage}
                onError={() => setImageError(true)}
              />
              <View style={styles.thumbnailOverlay}>
                <Ionicons name="image-outline" size={14} color="#FFF" />
              </View>
            </TouchableOpacity>
          )}

          {/* Indicador de foto ausente */}
          {showPhotoPlaceholder && (
            <View style={styles.noPhotoIndicator}>
              <Ionicons name="camera-outline" size={16} color={theme.colors.gray400} />
            </View>
          )}

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
            {/* Endereço completo */}
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={14} color={theme.colors.gray500} />
              <Text style={styles.detailText}>{parada.endereco}</Text>
            </View>

            {/* Observações */}
            {parada.observacoes && (
              <View style={styles.detailRow}>
                <Ionicons name="document-text-outline" size={14} color={theme.colors.gray500} />
                <Text style={styles.detailText}>{parada.observacoes}</Text>
              </View>
            )}

            {/* Ações */}
            <View style={styles.actions}>
              {parada.telefone && (
                <>
                  <TouchableOpacity style={styles.actionButton} onPress={handlePhonePress}>
                    <Ionicons name="call" size={16} color={theme.colors.primary} />
                    <Text style={styles.actionText}>Ligar</Text>
                  </TouchableOpacity>
                  {Platform.OS !== 'web' && (
                    <TouchableOpacity style={styles.actionButton} onPress={handleWhatsAppPress}>
                      <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                      <Text style={[styles.actionText, { color: '#25D366' }]}>WhatsApp</Text>
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
      prevProps.index === nextProps.index &&
      prevProps.selected === nextProps.selected
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
    gap: 2,
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
    gap: 3,
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
    gap: 3,
  },
  phoneText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  typeTag: {
    width: 18,
    height: 18,
    borderRadius: 4,
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
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.gray700,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 2,
    borderTopLeftRadius: 4,
  },
  noPhotoIndicator: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderStyle: 'dashed',
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
    gap: 4,
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
}));
