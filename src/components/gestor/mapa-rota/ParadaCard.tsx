/**
 * ParadaCard - Card de exibição de uma parada
 * Inclui telefone clicável, foto com overlay melhorado e placeholder
 */

import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';

import { SKIP_REASON_LABELS } from '@/constants/skipReasons';
import { useSignedUrl } from '@/hooks/storage/useSignedUrl';
import { podeAlterarParada } from '@/lib/gestor/paradaEditavel';
import { rotuloTipoParada } from '@/lib/motorista/rotuloTipoParada';
import { useUnistyles } from '@/utils/styles';

import { styles } from './styles';

import type { Parada } from './types';

interface ParadaCardProps {
  parada: Parada;
  index: number;
  onImagePress: (url: string) => void;
  selected?: boolean;
  onPress?: (id: string) => void;
  /** Situação da rota: com `onEdit`/`onRemove`, decide se as ações aparecem. */
  rotaStatus?: string;
  onEdit?: (parada: Parada) => void;
  onRemove?: (parada: Parada) => void;
}

export const ParadaCard = React.memo<ParadaCardProps>(
  ({
    parada,
    index: _index,
    onImagePress,
    selected,
    onPress,
    rotaStatus,
    onEdit,
    onRemove,
  }) => {
    const { theme } = useUnistyles();
    const [imageError, setImageError] = useState(false);
    const { url: fotoUrl } = useSignedUrl(parada.foto_url);

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
        const formattedPhone = phoneNumber.startsWith('55')
          ? phoneNumber
          : `55${phoneNumber}`;
        Linking.openURL(`https://wa.me/${formattedPhone}`);
      }
    }, [parada.telefone]);

    // Mostra placeholder se: concluída sem foto (signed url null) OU se a imagem falhou ao carregar
    const showPhotoPlaceholder =
      parada.status === 'concluida' && (!fotoUrl || imageError);

    return (
      <View style={[styles.paradaCard, selected && styles.paradaCardSelected]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onPress?.(parada.id)}
          style={styles.paradaHeader}
        >
          <View style={styles.paradaNumero}>
            <Text style={styles.paradaNumeroText}>{parada.ordem}</Text>
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
                    parada.tipo === 'entrega'
                      ? styles.tipoTagEntrega
                      : styles.tipoTagRetirada,
                  ]}
                >
                  <Text style={styles.tipoTagText}>
                    {rotuloTipoParada(parada.tipo).titulo}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusTag,
                    parada.status === 'concluida' && styles.statusTagConcluida,
                    parada.status === 'pendente' && styles.statusTagPendente,
                    parada.status === 'em_andamento' &&
                      styles.statusTagEmAndamento,
                    parada.status === 'pulada' && styles.statusTagPulada,
                  ]}
                >
                  <Text style={styles.statusTagText}>
                    {parada.status === 'concluida' && 'Concluída'}
                    {parada.status === 'pendente' && 'Pendente'}
                    {parada.status === 'em_andamento' && 'Em andamento'}
                    {parada.status === 'pulada' && 'Pulada'}
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
                  <Text style={styles.paradaMetaLabel}>Destinatário</Text>
                  <Text style={styles.paradaMetaValue}>
                    {parada.destinatario}
                  </Text>
                </View>
              )}
              {parada.telefone && (
                <View style={styles.paradaMetaItem}>
                  <Text style={styles.paradaMetaLabel}>Telefone</Text>
                  <View style={styles.paradaTelefoneLink}>
                    <TouchableOpacity
                      onPress={handlePhonePress}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.paradaTelefoneLinkText}>
                        {parada.telefone}
                      </Text>
                    </TouchableOpacity>
                    {Platform.OS !== 'web' && (
                      <TouchableOpacity
                        onPress={handleWhatsAppPress}
                        activeOpacity={0.7}
                        style={{ marginLeft: 8 }}
                      >
                        <Ionicons
                          name="logo-whatsapp"
                          size={18}
                          color={theme.colors.success}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
            {parada.observacoes && (
              <View style={[styles.paradaMetaItem, styles.paradaMetaItemFull]}>
                <Text style={styles.paradaMetaLabel}>Observações</Text>
                <Text style={styles.paradaMetaValue}>{parada.observacoes}</Text>
              </View>
            )}
          </View>
        )}

        {/* Motivo do skip (quando parada pulada) */}
        {parada.status === 'pulada' && (
          <View style={styles.skipReasonContainer}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color={theme.colors.warning}
            />
            <Text style={styles.skipReasonText}>
              {parada.motivo_skip
                ? SKIP_REASON_LABELS[parada.motivo_skip]
                : 'Sem motivo informado'}
            </Text>
          </View>
        )}

        {/* Texto do motorista no pulo (Migration 73); "Observações" acima é do gestor */}
        {parada.status === 'pulada' && parada.observacao_pulo ? (
          <View style={styles.skipReasonContainer}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={14}
              color={theme.colors.warning}
            />
            <Text style={styles.skipReasonText}>
              {`Motorista: ${parada.observacao_pulo}`}
            </Text>
          </View>
        ) : null}

        {/* Foto da entrega com overlay melhorado */}
        {fotoUrl && !imageError && (
          <TouchableOpacity
            style={styles.paradaFotoContainer}
            onPress={() => onImagePress(fotoUrl)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: fotoUrl }}
              style={styles.paradaFoto}
              onError={() => setImageError(true)}
            />
            <View style={styles.paradaFotoOverlay}>
              <View style={styles.paradaFotoOverlayIcon}>
                <Ionicons
                  name="expand-outline"
                  size={22}
                  color={theme.colors.gray700}
                />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Placeholder quando concluída mas sem foto */}
        {showPhotoPlaceholder && (
          <View style={styles.paradaFotoPlaceholder}>
            <Ionicons
              name="camera-outline"
              size={24}
              color={theme.colors.gray400}
            />
            <Text style={styles.paradaFotoPlaceholderText}>
              Sem foto registrada
            </Text>
          </View>
        )}

        {/* Editar/remover: mesma regra do ParadaCardCompact (desktop) */}
        {podeAlterarParada(parada.status, rotaStatus) &&
          (onEdit || onRemove) && (
            <View style={styles.paradaAcoes}>
              {onEdit && (
                <TouchableOpacity
                  style={styles.paradaAcaoBotao}
                  onPress={() => onEdit(parada)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Editar parada"
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color={theme.colors.secondary}
                  />
                  <Text
                    style={[
                      styles.paradaAcaoTexto,
                      { color: theme.colors.secondary },
                    ]}
                  >
                    Editar
                  </Text>
                </TouchableOpacity>
              )}
              {onRemove && (
                <TouchableOpacity
                  style={styles.paradaAcaoBotao}
                  onPress={() => onRemove(parada)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Remover parada"
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={theme.colors.error}
                  />
                  <Text
                    style={[
                      styles.paradaAcaoTexto,
                      { color: theme.colors.error },
                    ]}
                  >
                    Remover
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Todo campo exibido entra aqui: a parada editada pelo gestor ou pulada
    // pelo motorista chega com o mesmo id e status, e o card (e o `onEdit`,
    // que recebe esta `parada`) ficaria com o dado antigo.
    const antes = prevProps.parada;
    const depois = nextProps.parada;
    return (
      antes.id === depois.id &&
      antes.status === depois.status &&
      antes.foto_url === depois.foto_url &&
      antes.observacao_pulo === depois.observacao_pulo &&
      antes.motivo_skip === depois.motivo_skip &&
      antes.observacoes === depois.observacoes &&
      antes.endereco === depois.endereco &&
      antes.destinatario === depois.destinatario &&
      antes.telefone === depois.telefone &&
      antes.tipo === depois.tipo &&
      antes.ordem === depois.ordem &&
      prevProps.index === nextProps.index &&
      prevProps.selected === nextProps.selected &&
      // A rota mudar de situação (ex.: cancelada) esconde editar/remover.
      prevProps.rotaStatus === nextProps.rotaStatus
    );
  },
);

ParadaCard.displayName = 'ParadaCard';
