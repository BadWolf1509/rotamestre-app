/**
 * RotasRecentes - Lista das últimas rotas do motorista
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { StatusBadge } from '@/components/StatusBadge';
import {
  OPACIDADE_FUNDO_STATUS_SOFT,
  propsDoStatusBadge,
} from '@/constants/statusConfig';
// `rotas.data` é coluna date: new Date() dela é meia-noite UTC e, em UTC-3,
// volta um dia. formatDateBR monta a data com componentes locais.
import { formatDateBR } from '@/lib/dateUtils';
import { formatarDecimal } from '@/lib/formatNumber';
import { withOpacity } from '@/utils/color';
import { useUnistyles } from '@/utils/styles';

import { styles } from './styles';

import type { RotaRecente } from './types';

interface RotasRecentesProps {
  rotas: RotaRecente[];
  onVerTodas?: () => void;
}

function RotaCard({ rota }: { rota: RotaRecente }) {
  const { theme } = useUnistyles();
  const router = useRouter();

  // Rótulo, cor, contraste e ícone da escala única de status (statusConfig).
  const selo = propsDoStatusBadge(rota.status, theme.colors);

  return (
    <TouchableOpacity
      style={styles.rotaCard}
      onPress={() => router.push(`/gestor/mapa-rota?id=${rota.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.rotaCardLeft}>
        <View
          style={[
            styles.rotaIconContainer,
            {
              backgroundColor: withOpacity(
                selo.color,
                OPACIDADE_FUNDO_STATUS_SOFT,
              ),
            },
          ]}
        >
          <Ionicons name={selo.icon} size={20} color={selo.textColor} />
        </View>
        <View style={styles.rotaInfo}>
          <Text style={styles.rotaData}>{formatDateBR(rota.data)}</Text>
          {rota.distancia_total != null && rota.distancia_total > 0 ? (
            <Text style={styles.rotaDistancia}>
              {formatarDecimal(rota.distancia_total)} km
            </Text>
          ) : null}
        </View>
      </View>

      <StatusBadge
        label={selo.label}
        color={selo.color}
        textColor={selo.textColor}
        variant="soft"
        size="sm"
      />
    </TouchableOpacity>
  );
}

export function RotasRecentes({ rotas, onVerTodas }: RotasRecentesProps) {
  const { theme } = useUnistyles();

  if (rotas.length === 0) {
    return (
      <View style={styles.rotasContainer}>
        <Text style={styles.rotasTitle}>Rotas Recentes</Text>
        <View style={styles.emptyRotas}>
          <Ionicons
            name="navigate-outline"
            size={40}
            color={theme.colors.gray300}
          />
          <Text style={styles.emptyRotasText}>
            Nenhuma rota encontrada para este motorista
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rotasContainer}>
      <View style={styles.rotasHeader}>
        <Text style={styles.rotasTitle}>Rotas Recentes</Text>
        {onVerTodas && (
          <TouchableOpacity onPress={onVerTodas}>
            <Text style={styles.rotasVerTodas}>Ver todas</Text>
          </TouchableOpacity>
        )}
      </View>

      {rotas.map((rota) => (
        <RotaCard key={rota.id} rota={rota} />
      ))}
    </View>
  );
}
