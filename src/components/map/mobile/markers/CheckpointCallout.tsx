/**
 * Balão do pino da unidade (sede, ou partida/chegada) selecionado no mapa
 * nativo. Título e ícone vêm de `ESPEC_DO_PONTO` (`pontosDaUnidade`).
 *
 * Fora do <Marker>, como o ParadaCallout: dentro dele o "Copiar endereço"
 * não recebia toque no Android.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { CORES_SOBRE_O_MAPA } from '@/components/map/coresSobreOMapa';
import { mapMobileStyles as styles } from '@/components/map/mobile/styles';
import {
  ESPEC_DO_PONTO,
  type PontoComCoordenada,
  type PontoDaUnidade,
} from '@/components/map/pontosDaUnidade';
import { useUnistyles } from '@/utils/styles';

interface CheckpointCalloutProps {
  ponto: PontoDaUnidade<PontoComCoordenada>;
  unidadeNome?: string;
  onCopyAddress: (endereco: string) => void;
}

export function CheckpointCallout({
  ponto,
  unidadeNome,
  onCopyAddress,
}: CheckpointCalloutProps) {
  const { theme } = useUnistyles();
  const espec = ESPEC_DO_PONTO[ponto.tipo];
  const { endereco } = ponto.ponto;

  return (
    <View style={styles.checkpointCalloutContainer}>
      <View style={styles.checkpointCalloutHeader}>
        <View style={styles.checkpointIconBadge}>
          <Ionicons
            name={espec.ionicon}
            size={12}
            color={CORES_SOBRE_O_MAPA.branco}
          />
        </View>
        <Text style={styles.checkpointCalloutTitle}>{espec.titulo}</Text>
      </View>
      <Text style={styles.checkpointCalloutSubtitulo}>{espec.subtitulo}</Text>
      {unidadeNome && (
        <Text style={styles.checkpointCalloutUnidade}>{unidadeNome}</Text>
      )}
      <Text style={styles.checkpointCalloutAddress} numberOfLines={2}>
        {endereco}
      </Text>
      <TouchableOpacity
        style={styles.copyButton}
        onPress={() => onCopyAddress(endereco)}
        accessibilityLabel="Copiar endereço"
        accessibilityRole="button"
      >
        <Ionicons
          name="copy-outline"
          size={14}
          color={theme.colors.textSecondary}
        />
        <Text style={styles.copyButtonText}>Copiar endereço</Text>
      </TouchableOpacity>
    </View>
  );
}
