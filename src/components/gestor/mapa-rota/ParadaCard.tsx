/**
 * ParadaCard - Card de exibição de uma parada
 * Inclui telefone clicável, foto com overlay melhorado e placeholder
 */

import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';

import { useUnistyles } from '@/utils/styles';

import { styles } from './styles';

import type { Parada } from './types';

interface ParadaCardProps {
  parada: Parada;
  index: number;
  onImagePress: (url: string) => void;
  selected?: boolean;
  onPress?: (id: string) => void;
  onLayoutCapture?: (id: string, y: number) => void;
}

export const ParadaCard = React.memo<ParadaCardProps>(
  ({ parada, index, onImagePress, selected, onPress, onLayoutCapture }) => {
    const { theme } = useUnistyles();
    const [imageError, setImageError] = useState(false);

    const handlePhonePress = useCallback(() => {
      if (parada.telefone) {
        const phoneNumber = parada.telefone.replace(/\D/g, '');
        Linking.openURL(`tel:${phoneNumber}`);
      }
    }, [parada.telefone]);

    const handleWhatsAppPress = useCallback(() => {
      if (parada.telefone) {
        const phoneNumber = parada.telefone.replace(/\D/g, '');
        // Adiciona código do país se não tiver
        const formattedPhone = phoneNumber.startsWith('55') ? phoneNumber : `55${phoneNumber}`;
        Linking.openURL(`https://wa.me/${formattedPhone}`);
      }
    }, [parada.telefone]);

    // Mostra placeholder se: concluída sem foto OU se a imagem falhou ao carregar
    const showPhotoPlaceholder =
      parada.status === 'concluida' && (!parada.foto_url || imageError);

    return (
      <View
        style={[styles.paradaCard, selected && styles.paradaCardSelected]}
        onLayout={(e) => onLayoutCapture?.(parada.id, e.nativeEvent.layout.y)}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onPress?.(parada.id)}
          style={styles.paradaHeader}
        >
          <View style={styles.paradaNumero}>
            <Text style={styles.paradaNumeroText}>{index + 1}</Text>
          </View>
          <View style={styles.paradaHeaderInfo}>
            <View style={styles.paradaHeaderTop}>
              <Text style={styles.paradaEndereco} numberOfLines={2}>
                {parada.endereco}
              </Text>
              <View style={styles.paradaTags}>
                <View
                  style={[
                    styles.tipoTag,
                    parada.tipo === 'entrega' ? styles.tipoTagEntrega : styles.tipoTagRetirada,
                  ]}
                >
                  <Text style={styles.tipoTagText}>
                    {parada.tipo === 'entrega' ? 'Entrega' : 'Retirada'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusTag,
                    parada.status === 'concluida' && styles.statusTagConcluida,
                    parada.status === 'pendente' && styles.statusTagPendente,
                    parada.status === 'em_andamento' && styles.statusTagEmAndamento,
                  ]}
                >
                  <Text style={styles.statusTagText}>
                    {parada.status === 'concluida' && 'Concluida'}
                    {parada.status === 'pendente' && 'Pendente'}
                    {parada.status === 'em_andamento' && 'Em andamento'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {(parada.destinatario || parada.telefone || parada.observacoes) && (
          <View style={styles.paradaDetalhes}>
            <View style={styles.paradaMetaGrid}>
              {parada.destinatario && (
                <View style={styles.paradaMetaItem}>
                  <Text style={styles.paradaMetaLabel}>Destinatario</Text>
                  <Text style={styles.paradaMetaValue}>{parada.destinatario}</Text>
                </View>
              )}
              {parada.telefone && (
                <View style={styles.paradaMetaItem}>
                  <Text style={styles.paradaMetaLabel}>Telefone</Text>
                  <View style={styles.paradaTelefoneLink}>
                    <TouchableOpacity onPress={handlePhonePress} activeOpacity={0.7}>
                      <Text style={styles.paradaTelefoneLinkText}>{parada.telefone}</Text>
                    </TouchableOpacity>
                    {Platform.OS !== 'web' && (
                      <TouchableOpacity
                        onPress={handleWhatsAppPress}
                        activeOpacity={0.7}
                        style={{ marginLeft: 8 }}
                      >
                        <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
            {parada.observacoes && (
              <View style={[styles.paradaMetaItem, styles.paradaMetaItemFull]}>
                <Text style={styles.paradaMetaLabel}>Observacoes</Text>
                <Text style={styles.paradaMetaValue}>{parada.observacoes}</Text>
              </View>
            )}
          </View>
        )}

        {/* Foto da entrega com overlay melhorado */}
        {parada.foto_url && !imageError && (
          <TouchableOpacity
            style={styles.paradaFotoContainer}
            onPress={() => onImagePress(parada.foto_url!)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: parada.foto_url }}
              style={styles.paradaFoto}
              onError={() => setImageError(true)}
            />
            <View style={styles.paradaFotoOverlay}>
              <View style={styles.paradaFotoOverlayIcon}>
                <Ionicons name="expand-outline" size={22} color={theme.colors.gray700} />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Placeholder quando concluída mas sem foto */}
        {showPhotoPlaceholder && (
          <View style={styles.paradaFotoPlaceholder}>
            <Ionicons name="camera-outline" size={24} color={theme.colors.gray400} />
            <Text style={styles.paradaFotoPlaceholderText}>Sem foto registrada</Text>
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

ParadaCard.displayName = 'ParadaCard';
