/**
 * Balão da parada selecionada no mapa nativo.
 *
 * Fica FORA do <Marker> (ver BalaoSobreposto): no Android, o balão dentro do
 * Marker era desenhado por baixo dos pinos criados depois e não recebia toque.
 * Aqui é uma View comum, então o toque funciona: o balão inteiro abre as ações
 * (quando a tela as oferece) e o "Ligar" abre o discador.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, TouchableOpacity, Pressable, Linking } from 'react-native';

import { getStatusLabel } from '@/components/map/infoWindowBuilders';
import { mapMobileStyles as styles } from '@/components/map/mobile/styles';
import { logger } from '@/lib/logger';
import { rotuloTipoParada } from '@/lib/motorista/rotuloTipoParada';
import type { ParadaMapItem as Parada } from '@/types/parada-map';
import { withOpacity } from '@/utils/color';
import { getMarkerFillColor } from '@/utils/mapMarkerColors';
import { useUnistyles } from '@/utils/styles';

export type ServicoDoPino = {
  ordem: number;
  tipo?: string | null;
  status: string;
};

/** "3 e 4", "3, 4 e 5". */
function listarOrdens(ordens: number[]): string {
  if (ordens.length < 2) return ordens.join('');
  return `${ordens.slice(0, -1).join(', ')} e ${ordens[ordens.length - 1]}`;
}

/** "Parada 3", ou "Paradas 3 e 4" no pino que reúne serviços do mesmo local. */
export function tituloDoPino(
  parada: Pick<Parada, 'ordem'>,
  servicos?: ServicoDoPino[],
): string {
  return servicos != null && servicos.length > 1
    ? `Paradas ${listarOrdens(servicos.map((s) => s.ordem))}`
    : `Parada ${parada.ordem}`;
}

interface ParadaCalloutProps {
  parada: Parada;
  /** Serviços do local, para o balão listar um a um. */
  servicos?: ServicoDoPino[];
  /** Toque no balão: abre as ações da parada. Sem ela, o balão é só leitura. */
  onAbrirAcoes?: () => void;
}

export function ParadaCallout({
  parada,
  servicos,
  onAbrirAcoes,
}: ParadaCalloutProps) {
  const { theme } = useUnistyles();
  const markerColor = getMarkerFillColor(parada.status, theme.colors);
  const agrupado = servicos != null && servicos.length > 1;
  const titulo = tituloDoPino(parada, servicos);

  return (
    <Pressable
      style={styles.calloutContainer}
      onPress={onAbrirAcoes}
      disabled={onAbrirAcoes == null}
      accessibilityRole={onAbrirAcoes ? 'button' : undefined}
      accessibilityLabel={`${titulo}, ${parada.endereco}`}
      accessibilityHint={onAbrirAcoes ? 'Abre as ações da parada' : undefined}
    >
      <Text style={styles.calloutTitle}>{titulo}</Text>
      <Text style={styles.calloutAddress} numberOfLines={2}>
        {parada.endereco}
      </Text>

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

      {parada.telefone && (
        <TouchableOpacity
          style={styles.calloutDetailRow}
          onPress={() =>
            // Sem discador (tablet) a promessa rejeita.
            Linking.openURL(`tel:${parada.telefone}`).catch((e) =>
              logger.warn('Não foi possível abrir o discador', e),
            )
          }
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

      <View style={styles.calloutBadges}>
        <View
          style={[
            styles.calloutStatus,
            { backgroundColor: withOpacity(markerColor, 0.12) },
          ]}
        >
          <Text style={[styles.calloutStatusText, { color: markerColor }]}>
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

      {onAbrirAcoes && (
        <Text style={styles.calloutDicaAcoes}>Toque para ver ações ›</Text>
      )}
    </Pressable>
  );
}
