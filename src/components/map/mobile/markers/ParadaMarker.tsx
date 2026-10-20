/**
 * ParadaMarker component for MapaMobile
 *
 * Renders a delivery/pickup stop marker with an expandable callout.
 * The callout shows address, recipient, phone, status badge, and type badge.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, TouchableOpacity, Pressable, Linking } from 'react-native';

import { getStatusLabel } from '@/components/map/infoWindowBuilders';
import { mapMobileStyles as styles } from '@/components/map/mobile/styles';
import { rotuloTipoParada } from '@/lib/motorista/rotuloTipoParada';
import type { ParadaMapItem as Parada } from '@/types/parada-map';
import { withOpacity } from '@/utils/color';
import { getMarkerFillColor } from '@/utils/mapMarkerColors';
import { useUnistyles } from '@/utils/styles';

interface ParadaMarkerProps {
  parada: Parada;
  isSelected: boolean;
  onPress: (paradaId: string) => void;
  onLongPress: (paradaId: string) => void;
  /** Texto do pino quando ele reúne serviços do mesmo local ("3+4"). */
  rotulo?: string;
  /** Serviços do local, para o balão listar um a um. */
  servicos?: Array<{ ordem: number; tipo?: string | null; status: string }>;
}

/** "3 e 4", "3, 4 e 5". */
function listarOrdens(ordens: number[]): string {
  if (ordens.length < 2) return ordens.join('');
  return `${ordens.slice(0, -1).join(', ')} e ${ordens[ordens.length - 1]}`;
}

/**
 * Circular marker for a delivery/pickup stop.
 * Color reflects status; shows expandable callout with stop details when selected.
 */
export function ParadaMarker({
  parada,
  isSelected,
  onPress,
  onLongPress,
  rotulo,
  servicos,
}: ParadaMarkerProps) {
  const { theme } = useUnistyles();
  const markerColor = getMarkerFillColor(parada.status, theme.colors);
  const agrupado = servicos != null && servicos.length > 1;
  const titulo = agrupado
    ? `Paradas ${listarOrdens(servicos.map((s) => s.ordem))}`
    : `Parada ${parada.ordem}`;

  return (
    <View style={styles.markerWrapper}>
      {isSelected && (
        <View style={styles.calloutWrapper}>
          <View style={styles.calloutContainer}>
            <Text style={styles.calloutTitle}>{titulo}</Text>
            <Text style={styles.calloutAddress} numberOfLines={2}>
              {parada.endereco}
            </Text>

            {/* Recipient */}
            {parada.destinatario && (
              <View style={styles.calloutDetailRow}>
                <Ionicons
                  name="person-outline"
                  size={14}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.calloutDetailText} numberOfLines={1}>
                  {parada.destinatario}
                </Text>
              </View>
            )}

            {/* Clickable phone */}
            {parada.telefone && (
              <TouchableOpacity
                style={styles.calloutDetailRow}
                onPress={() => Linking.openURL(`tel:${parada.telefone}`)}
                accessibilityLabel={`Ligar para ${parada.telefone}`}
                accessibilityRole="button"
              >
                <Ionicons
                  name="call-outline"
                  size={14}
                  color={theme.colors.primary}
                />
                <Text style={styles.calloutPhoneText}>{parada.telefone}</Text>
              </TouchableOpacity>
            )}

            {/* Status + type badges */}
            <View style={styles.calloutBadges}>
              <View
                style={[
                  styles.calloutStatus,
                  {
                    backgroundColor: withOpacity(markerColor, 0.12),
                  },
                ]}
              >
                <Text
                  style={[styles.calloutStatusText, { color: markerColor }]}
                >
                  {getStatusLabel(parada.status)}
                </Text>
              </View>
              {!agrupado && parada.tipo && (
                <View style={styles.calloutTypeBadge}>
                  <Ionicons
                    name={
                      parada.tipo === 'entrega'
                        ? 'cube-outline'
                        : 'arrow-up-circle-outline'
                    }
                    size={12}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.calloutTypeText}>
                    {parada.tipo === 'entrega' ? 'Entrega' : 'Retirada'}
                  </Text>
                </View>
              )}
            </View>

            {agrupado &&
              servicos.map((servico) => (
                <Text key={servico.ordem} style={styles.calloutDetailText}>
                  {`${servico.ordem} · ${rotuloTipoParada(servico.tipo ?? '').titulo}`}
                </Text>
              ))}
          </View>
        </View>
      )}

      <Pressable
        onPress={() => onPress(parada.id)}
        onLongPress={() => onLongPress(parada.id)}
        delayLongPress={400}
        style={({ pressed }) => [
          styles.markerContainer,
          { backgroundColor: markerColor },
          isSelected && styles.markerSelected,
          pressed && styles.markerPressed,
        ]}
        accessibilityLabel={`${titulo}, ${parada.endereco}, ${getStatusLabel(parada.status)}`}
        accessibilityHint="Toque para ver detalhes. Mantenha pressionado para ações rápidas"
        accessibilityRole="button"
      >
        <Text style={styles.markerText}>{rotulo ?? parada.ordem}</Text>
      </Pressable>
    </View>
  );
}
